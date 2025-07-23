import { AdminPayout } from '@/models/AdminPayout';
import { RouteAccount } from '@/models/RouteAccount';
import { PlatformSubscription } from '@/models/PlatformSubscription';
import { TransferManager, ITransferData } from './transfer-manager';
import { RouteAccountManager } from './route-account-manager';
import mongoose from 'mongoose';

export interface ITransferDecision {
  shouldTransfer: boolean;
  reason: string;
  delayMinutes?: number;
  batchWithOthers?: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface ITransferBatch {
  adminId: mongoose.Types.ObjectId;
  transfers: ITransferData[];
  totalAmount: number;
  estimatedSavings: number;
  batchId: string;
}

export interface IAutoTransferStats {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  queuedTransfers: number;
  totalAmount: number;
  averageTransferTime: number;
  batchEfficiency: number;
}

export class AutoTransferEngine {
  /**
   * Intelligent transfer decision making
   */
  static async shouldInitiateTransfer(transferData: ITransferData): Promise<ITransferDecision> {
    try {
      // Check if admin can receive transfers
      const canReceive = await RouteAccountManager.canReceivePayouts(transferData.adminId);
      if (!canReceive) {
        return {
          shouldTransfer: false,
          reason: 'Route account not ready for payouts',
          delayMinutes: 60, // Check again in 1 hour
          priority: 'normal'
        };
      }

      // Get Route account details
      const routeAccount = await RouteAccount.findOne({ adminId: transferData.adminId });
      if (!routeAccount) {
        return {
          shouldTransfer: false,
          reason: 'Route account not found',
          delayMinutes: 1440, // Check again in 24 hours
          priority: 'low'
        };
      }

      // Check minimum payout amount
      const netAmount = this.calculateNetAmount(transferData.grossAmount);
      if (netAmount < routeAccount.minimumPayoutAmount) {
        return {
          shouldTransfer: false,
          reason: `Amount below minimum payout threshold (₹${routeAccount.minimumPayoutAmount / 100})`,
          batchWithOthers: true,
          priority: 'low'
        };
      }

      // Check for pending transfers to batch
      const pendingTransfers = await this.getPendingTransfersForAdmin(transferData.adminId);
      if (pendingTransfers.length > 0 && netAmount < 500000) { // Less than ₹5,000
        return {
          shouldTransfer: false,
          reason: 'Batching with other pending transfers for efficiency',
          batchWithOthers: true,
          delayMinutes: 30, // Wait 30 minutes for more transfers
          priority: 'normal'
        };
      }

      // Check admin's platform subscription status
      const platformSubscription = await PlatformSubscription.findOne({ adminId: transferData.adminId });
      if (platformSubscription?.status === 'suspended') {
        return {
          shouldTransfer: false,
          reason: 'Admin platform subscription suspended',
          delayMinutes: 1440, // Check again in 24 hours
          priority: 'low'
        };
      }

      // High priority for large amounts
      if (netAmount >= 1000000) { // ₹10,000 or more
        return {
          shouldTransfer: true,
          reason: 'High value transfer - immediate processing',
          priority: 'high'
        };
      }

      // Normal transfer
      return {
        shouldTransfer: true,
        reason: 'Standard transfer criteria met',
        priority: 'normal'
      };

    } catch (error) {
      console.error('Transfer decision error:', error);
      return {
        shouldTransfer: false,
        reason: 'Error in transfer decision logic',
        delayMinutes: 60,
        priority: 'low'
      };
    }
  }

  /**
   * Create optimized transfer batches
   */
  static async createTransferBatches(): Promise<ITransferBatch[]> {
    try {
      // Get all pending transfers that can be batched
      const pendingPayouts = await AdminPayout.find({
        status: 'pending',
        isBatchTransfer: false,
        $or: [
          { nextRetryAt: { $lte: new Date() } },
          { nextRetryAt: { $exists: false } }
        ]
      }).populate('adminId');

      // Group by admin
      const adminGroups = new Map<string, any[]>();
      for (const payout of pendingPayouts) {
        const adminId = payout.adminId.toString();
        if (!adminGroups.has(adminId)) {
          adminGroups.set(adminId, []);
        }
        adminGroups.get(adminId)!.push(payout);
      }

      const batches: ITransferBatch[] = [];

      // Create batches for each admin
      for (const [adminIdStr, payouts] of adminGroups) {
        const adminId = new mongoose.Types.ObjectId(adminIdStr);
        
        // Check if admin can receive transfers
        const canReceive = await RouteAccountManager.canReceivePayouts(adminId);
        if (!canReceive) continue;

        // Calculate batch metrics
        const totalAmount = payouts.reduce((sum, p) => sum + p.feeBreakdown.netAmount, 0);
        const routeAccount = await RouteAccount.findOne({ adminId });
        
        if (!routeAccount || totalAmount < routeAccount.minimumPayoutAmount) continue;

        // Create transfer data for batch
        const transfers: ITransferData[] = payouts.map(payout => ({
          adminId,
          grossAmount: payout.feeBreakdown.grossAmount,
          sourceTransactionId: payout.sourceTransactionId,
          memberId: payout.memberId,
          communityId: payout.communityId,
          sourceType: payout.sourceType as any,
          platformFeeRate: payout.feeBreakdown.platformFeeRate
        }));

        // Calculate estimated savings from batching
        const individualTransferFees = payouts.length * 200; // ₹2 per transfer
        const batchTransferFee = 200; // Single ₹2 fee for batch
        const estimatedSavings = individualTransferFees - batchTransferFee;

        batches.push({
          adminId,
          transfers,
          totalAmount,
          estimatedSavings,
          batchId: `batch_${Date.now()}_${adminId}`
        });
      }

      return batches.sort((a, b) => b.totalAmount - a.totalAmount); // Largest batches first

    } catch (error) {
      console.error('Batch creation error:', error);
      return [];
    }
  }

  /**
   * Process transfer batches efficiently
   */
  static async processBatches(batches: ITransferBatch[]): Promise<{
    processedBatches: number;
    totalTransfers: number;
    totalAmount: number;
    errors: string[];
  }> {
    let processedBatches = 0;
    let totalTransfers = 0;
    let totalAmount = 0;
    const errors: string[] = [];

    for (const batch of batches) {
      try {
        console.log(`Processing batch ${batch.batchId} with ${batch.transfers.length} transfers`);

        // Mark payouts as batch processing
        await AdminPayout.updateMany(
          {
            adminId: batch.adminId,
            status: 'pending',
            sourceTransactionId: { $in: batch.transfers.map(t => t.sourceTransactionId) }
          },
          {
            status: 'processing',
            batchId: batch.batchId,
            isBatchTransfer: true
          }
        );

        // Process the batch as a single transfer
        const combinedTransfer: ITransferData = {
          adminId: batch.adminId,
          grossAmount: batch.transfers.reduce((sum, t) => sum + t.grossAmount, 0),
          sourceTransactionId: batch.transfers[0].sourceTransactionId, // Use first as reference
          sourceType: 'member_subscription'
        };

        const result = await TransferManager.createTransfer(combinedTransfer);

        if (result.success) {
          // Update all payouts in batch as processed
          await AdminPayout.updateMany(
            { batchId: batch.batchId },
            {
              status: 'processed',
              razorpayTransferId: result.transferId,
              transferCompletedAt: new Date()
            }
          );

          processedBatches++;
          totalTransfers += batch.transfers.length;
          totalAmount += batch.totalAmount;

          console.log(`Batch ${batch.batchId} processed successfully`);
        } else {
          // Mark batch as failed
          await AdminPayout.updateMany(
            { batchId: batch.batchId },
            {
              status: 'failed',
              failureReason: result.error
            }
          );

          errors.push(`Batch ${batch.batchId}: ${result.error}`);
        }

      } catch (error: any) {
        errors.push(`Batch ${batch.batchId}: ${error.message}`);
        console.error(`Batch processing error for ${batch.batchId}:`, error);
      }
    }

    return {
      processedBatches,
      totalTransfers,
      totalAmount,
      errors
    };
  }

  /**
   * Get pending transfers for an admin
   */
  private static async getPendingTransfersForAdmin(adminId: mongoose.Types.ObjectId): Promise<any[]> {
    return AdminPayout.find({
      adminId,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
  }

  /**
   * Calculate net amount after fees
   */
  private static calculateNetAmount(grossAmount: number, platformFeeRate: number = 5.0): number {
    const platformFee = Math.round((grossAmount * platformFeeRate) / 100);
    const processingFee = Math.round((grossAmount * 2) / 100) + 200;
    return Math.max(0, grossAmount - platformFee - processingFee);
  }

  /**
   * Get auto-transfer statistics
   */
  static async getTransferStats(adminId?: mongoose.Types.ObjectId): Promise<IAutoTransferStats> {
    try {
      const matchCondition = adminId ? { adminId } : {};
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const stats = await AdminPayout.aggregate([
        {
          $match: {
            ...matchCondition,
            createdAt: { $gte: last24Hours }
          }
        },
        {
          $group: {
            _id: null,
            totalTransfers: { $sum: 1 },
            successfulTransfers: {
              $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] }
            },
            failedTransfers: {
              $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
            },
            queuedTransfers: {
              $sum: { $cond: [{ $in: ['$status', ['pending', 'queued']] }, 1, 0] }
            },
            totalAmount: { $sum: '$feeBreakdown.netAmount' },
            avgTransferTime: {
              $avg: {
                $subtract: ['$transferCompletedAt', '$paymentReceivedAt']
              }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalTransfers: 0,
        successfulTransfers: 0,
        failedTransfers: 0,
        queuedTransfers: 0,
        totalAmount: 0,
        avgTransferTime: 0
      };

      // Calculate batch efficiency
      const batchTransfers = await AdminPayout.countDocuments({
        ...matchCondition,
        isBatchTransfer: true,
        createdAt: { $gte: last24Hours }
      });

      const batchEfficiency = result.totalTransfers > 0 
        ? (batchTransfers / result.totalTransfers) * 100 
        : 0;

      return {
        totalTransfers: result.totalTransfers,
        successfulTransfers: result.successfulTransfers,
        failedTransfers: result.failedTransfers,
        queuedTransfers: result.queuedTransfers,
        totalAmount: result.totalAmount,
        averageTransferTime: result.avgTransferTime / (1000 * 60), // Convert to minutes
        batchEfficiency
      };

    } catch (error) {
      console.error('Transfer stats error:', error);
      return {
        totalTransfers: 0,
        successfulTransfers: 0,
        failedTransfers: 0,
        queuedTransfers: 0,
        totalAmount: 0,
        averageTransferTime: 0,
        batchEfficiency: 0
      };
    }
  }

  /**
   * Optimize transfer timing based on patterns
   */
  static getOptimalTransferTime(): Date {
    const now = new Date();
    const hour = now.getHours();

    // Avoid peak banking hours (9 AM - 11 AM, 2 PM - 4 PM IST)
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) {
      // Schedule for next optimal window
      const nextOptimal = new Date(now);
      if (hour <= 11) {
        nextOptimal.setHours(12, 0, 0, 0); // 12 PM
      } else {
        nextOptimal.setHours(17, 0, 0, 0); // 5 PM
      }
      return nextOptimal;
    }

    // Avoid weekends for large transfers
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
      const nextMonday = new Date(now);
      nextMonday.setDate(now.getDate() + (1 + (7 - dayOfWeek)) % 7);
      nextMonday.setHours(10, 0, 0, 0);
      return nextMonday;
    }

    // Current time is optimal
    return now;
  }
}
