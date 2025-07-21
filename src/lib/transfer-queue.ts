import { AdminPayout, IAdminPayout } from '@/models/AdminPayout';
import { RouteAccount } from '@/models/RouteAccount';
import { AutoTransferEngine } from './auto-transfer-engine';
import { TransferManager, ITransferData } from './transfer-manager';
import mongoose from 'mongoose';

export interface IQueuedTransfer {
  id: string;
  adminId: mongoose.Types.ObjectId;
  transferData: ITransferData;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  queuedAt: Date;
  estimatedProcessingTime: Date;
}

export interface IQueueStats {
  totalQueued: number;
  highPriority: number;
  normalPriority: number;
  lowPriority: number;
  averageWaitTime: number;
  processingRate: number;
  errorRate: number;
}

export class TransferQueue {
  private static readonly MAX_CONCURRENT_TRANSFERS = 5;
  private static readonly RETRY_DELAYS = [5, 15, 30, 60, 120]; // Minutes
  private static processing = false;

  /**
   * Add transfer to queue with intelligent scheduling
   */
  static async enqueue(transferData: ITransferData): Promise<IQueuedTransfer> {
    try {
      // Get transfer decision from auto-transfer engine
      const decision = await AutoTransferEngine.shouldInitiateTransfer(transferData);

      if (decision.shouldTransfer) {
        // Process immediately
        return this.processImmediate(transferData, decision.priority);
      } else {
        // Add to queue with delay
        return this.addToQueue(transferData, decision);
      }

    } catch (error) {
      console.error('Queue enqueue error:', error);
      throw error;
    }
  }

  /**
   * Process transfer immediately
   */
  private static async processImmediate(
    transferData: ITransferData, 
    priority: 'low' | 'normal' | 'high' | 'urgent'
  ): Promise<IQueuedTransfer> {
    const queuedTransfer: IQueuedTransfer = {
      id: `immediate_${Date.now()}`,
      adminId: transferData.adminId,
      transferData,
      priority,
      scheduledAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      queuedAt: new Date(),
      estimatedProcessingTime: new Date()
    };

    try {
      const result = await TransferManager.createTransfer(transferData);
      
      if (!result.success) {
        // If immediate processing fails, add to retry queue
        return this.addToRetryQueue(queuedTransfer, result.error || 'Transfer failed');
      }

      return queuedTransfer;

    } catch (error: any) {
      return this.addToRetryQueue(queuedTransfer, error.message);
    }
  }

  /**
   * Add transfer to scheduled queue
   */
  private static async addToQueue(
    transferData: ITransferData, 
    decision: any
  ): Promise<IQueuedTransfer> {
    const scheduledAt = decision.delayMinutes 
      ? new Date(Date.now() + (decision.delayMinutes * 60 * 1000))
      : AutoTransferEngine.getOptimalTransferTime();

    const queuedTransfer: IQueuedTransfer = {
      id: `queued_${Date.now()}_${transferData.adminId}`,
      adminId: transferData.adminId,
      transferData,
      priority: decision.priority || 'normal',
      scheduledAt,
      attempts: 0,
      maxAttempts: 5,
      queuedAt: new Date(),
      estimatedProcessingTime: scheduledAt
    };

    // Store in database as pending payout
    const payout = new AdminPayout({
      adminId: transferData.adminId,
      routeAccountId: '', // Will be filled when processed
      feeBreakdown: {
        grossAmount: transferData.grossAmount,
        platformFeeRate: transferData.platformFeeRate || 5.0,
        platformFeeAmount: Math.round((transferData.grossAmount * (transferData.platformFeeRate || 5.0)) / 100),
        processingFeeAmount: Math.round((transferData.grossAmount * 2) / 100) + 200,
        adminEarnings: 0 // Will be calculated
      },
      status: 'queued',
      sourceType: transferData.sourceType,
      sourceTransactionId: transferData.sourceTransactionId,
      memberId: transferData.memberId,
      communityId: transferData.communityId,
      paymentReceivedAt: new Date(),
      isBatchTransfer: decision.batchWithOthers || false,
      retryCount: 0,
      maxRetries: queuedTransfer.maxAttempts,
      nextRetryAt: scheduledAt,
      isReconciled: false,
      platformFeeDeducted: false,
      failureReason: decision.reason
    });

    // Calculate admin earnings
    payout.feeBreakdown.adminEarnings = Math.max(0, 
      payout.feeBreakdown.grossAmount - 
      payout.feeBreakdown.platformFeeAmount - 
      payout.feeBreakdown.processingFeeAmount
    );

    await payout.save();
    queuedTransfer.id = payout._id!.toString();

    console.log(`Transfer queued: ${queuedTransfer.id}, scheduled for: ${scheduledAt.toISOString()}`);
    return queuedTransfer;
  }

  /**
   * Add failed transfer to retry queue
   */
  private static async addToRetryQueue(
    queuedTransfer: IQueuedTransfer, 
    error: string
  ): Promise<IQueuedTransfer> {
    queuedTransfer.attempts++;
    queuedTransfer.lastError = error;

    if (queuedTransfer.attempts >= queuedTransfer.maxAttempts) {
      console.error(`Transfer ${queuedTransfer.id} exceeded max attempts: ${error}`);
      // Mark as permanently failed
      await AdminPayout.findByIdAndUpdate(queuedTransfer.id, {
        status: 'failed',
        failureReason: `Max retries exceeded: ${error}`
      });
      return queuedTransfer;
    }

    // Calculate next retry time with exponential backoff
    const delayMinutes = this.RETRY_DELAYS[Math.min(queuedTransfer.attempts - 1, this.RETRY_DELAYS.length - 1)];
    queuedTransfer.scheduledAt = new Date(Date.now() + (delayMinutes * 60 * 1000));
    queuedTransfer.estimatedProcessingTime = queuedTransfer.scheduledAt;

    // Update database record
    await AdminPayout.findByIdAndUpdate(queuedTransfer.id, {
      status: 'queued',
      retryCount: queuedTransfer.attempts,
      nextRetryAt: queuedTransfer.scheduledAt,
      failureReason: error
    });

    console.log(`Transfer ${queuedTransfer.id} scheduled for retry ${queuedTransfer.attempts} at: ${queuedTransfer.scheduledAt.toISOString()}`);
    return queuedTransfer;
  }

  /**
   * Process queued transfers
   */
  static async processQueue(): Promise<{
    processed: number;
    failed: number;
    remaining: number;
  }> {
    if (this.processing) {
      console.log('Queue processing already in progress');
      return { processed: 0, failed: 0, remaining: 0 };
    }

    this.processing = true;
    let processed = 0;
    let failed = 0;

    try {
      // Get transfers ready for processing
      const readyTransfers = await AdminPayout.find({
        status: 'queued',
        nextRetryAt: { $lte: new Date() },
        retryCount: { $lt: 5 }
      })
      .sort({ 
        priority: -1, // High priority first
        nextRetryAt: 1 // Oldest first
      })
      .limit(this.MAX_CONCURRENT_TRANSFERS);

      console.log(`Processing ${readyTransfers.length} queued transfers`);

      for (const payout of readyTransfers) {
        try {
          // Mark as processing
          payout.status = 'processing';
          await payout.save();

          // Create transfer data
          const transferData: ITransferData = {
            adminId: payout.adminId,
            grossAmount: payout.feeBreakdown.grossAmount,
            sourceTransactionId: payout.sourceTransactionId!,
            memberId: payout.memberId,
            communityId: payout.communityId,
            sourceType: payout.sourceType as any,
            platformFeeRate: payout.feeBreakdown.platformFeeRate
          };

          // Attempt transfer
          const result = await TransferManager.createTransfer(transferData);

          if (result.success) {
            // Mark as processed
            await AdminPayout.findByIdAndUpdate(payout._id, {
              status: 'processed',
              razorpayTransferId: result.transferId,
              transferCompletedAt: new Date()
            });
            processed++;
            console.log(`Transfer ${payout._id} processed successfully`);

          } else {
            // Handle failure
            await this.handleTransferFailure(payout, result.error || 'Unknown error');
            failed++;
          }

        } catch (error: any) {
          await this.handleTransferFailure(payout, error.message);
          failed++;
        }
      }

      // Get remaining queue count
      const remaining = await AdminPayout.countDocuments({
        status: { $in: ['queued', 'pending'] }
      });

      console.log(`Queue processing completed: ${processed} processed, ${failed} failed, ${remaining} remaining`);

      return { processed, failed, remaining };

    } finally {
      this.processing = false;
    }
  }

  /**
   * Handle transfer failure with retry logic
   */
  private static async handleTransferFailure(payout: any, error: string): Promise<void> {
    payout.retryCount++;
    payout.failureReason = error;

    if (payout.retryCount >= payout.maxRetries) {
      // Mark as permanently failed
      payout.status = 'failed';
      console.error(`Transfer ${payout._id} permanently failed: ${error}`);
    } else {
      // Schedule retry
      const delayMinutes = this.RETRY_DELAYS[Math.min(payout.retryCount - 1, this.RETRY_DELAYS.length - 1)];
      payout.nextRetryAt = new Date(Date.now() + (delayMinutes * 60 * 1000));
      payout.status = 'queued';
      console.log(`Transfer ${payout._id} scheduled for retry ${payout.retryCount} in ${delayMinutes} minutes`);
    }

    await payout.save();
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<IQueueStats> {
    try {
      const stats = await AdminPayout.aggregate([
        {
          $match: {
            status: { $in: ['queued', 'pending'] }
          }
        },
        {
          $group: {
            _id: null,
            totalQueued: { $sum: 1 },
            highPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] }
            },
            normalPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'normal'] }, 1, 0] }
            },
            lowPriority: {
              $sum: { $cond: [{ $eq: ['$priority', 'low'] }, 1, 0] }
            },
            avgWaitTime: {
              $avg: {
                $subtract: [new Date(), '$queuedAt']
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalQueued: 0,
        highPriority: 0,
        normalPriority: 0,
        lowPriority: 0,
        avgWaitTime: 0
      };

      // Calculate processing rate (transfers per hour)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const processedLast24h = await AdminPayout.countDocuments({
        status: 'processed',
        transferCompletedAt: { $gte: last24Hours }
      });

      const failedLast24h = await AdminPayout.countDocuments({
        status: 'failed',
        updatedAt: { $gte: last24Hours }
      });

      const processingRate = processedLast24h / 24; // Per hour
      const errorRate = processedLast24h > 0 ? (failedLast24h / (processedLast24h + failedLast24h)) * 100 : 0;

      return {
        totalQueued: result.totalQueued,
        highPriority: result.highPriority,
        normalPriority: result.normalPriority,
        lowPriority: result.lowPriority,
        averageWaitTime: result.avgWaitTime / (1000 * 60), // Convert to minutes
        processingRate,
        errorRate
      };

    } catch (error) {
      console.error('Queue stats error:', error);
      return {
        totalQueued: 0,
        highPriority: 0,
        normalPriority: 0,
        lowPriority: 0,
        averageWaitTime: 0,
        processingRate: 0,
        errorRate: 0
      };
    }
  }

  /**
   * Clear failed transfers older than specified days
   */
  static async clearOldFailedTransfers(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
    
    const result = await AdminPayout.deleteMany({
      status: 'failed',
      updatedAt: { $lt: cutoffDate }
    });

    console.log(`Cleared ${result.deletedCount} old failed transfers`);
    return result.deletedCount;
  }
}
