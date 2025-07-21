import { AdminPayout, IAdminPayout, IFeeBreakdown } from '@/models/AdminPayout';
import { RouteAccount } from '@/models/RouteAccount';
import { Transaction } from '@/models/Transaction';
import { PlatformSubscription } from '@/models/PlatformSubscription';
import { razorpayRoute, ITransferRequest } from './razorpay-route';
import { RouteAccountManager } from './route-account-manager';
import mongoose from 'mongoose';

export interface ITransferData {
  adminId: mongoose.Types.ObjectId;
  grossAmount: number; // Total payment amount in paise
  sourceTransactionId: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  communityId?: mongoose.Types.ObjectId;
  sourceType: 'member_subscription' | 'one_time_payment' | 'manual_transfer';
  platformFeeRate?: number; // Default 5%
}

export interface ITransferResult {
  success: boolean;
  payout?: IAdminPayout;
  error?: string;
  transferId?: string;
}

export interface IBulkTransferResult {
  totalTransfers: number;
  successfulTransfers: number;
  failedTransfers: number;
  results: ITransferResult[];
}

export class TransferManager {
  /**
   * Create a transfer to admin's Route account
   */
  static async createTransfer(data: ITransferData): Promise<ITransferResult> {
    try {
      // Validate admin can receive payouts
      const canReceivePayouts = await RouteAccountManager.canReceivePayouts(data.adminId);
      if (!canReceivePayouts) {
        return await this.queueTransfer(data, 'Route account not ready for payouts');
      }

      // Get Route account
      const routeAccount = await RouteAccount.findOne({ adminId: data.adminId });
      if (!routeAccount || !routeAccount.routeAccountId) {
        return await this.queueTransfer(data, 'Route account not found');
      }

      // Calculate fee breakdown
      const feeBreakdown = this.calculateFeeBreakdown(
        data.grossAmount,
        data.platformFeeRate || 5.0
      );

      // Check minimum payout amount
      if (feeBreakdown.netAmount < routeAccount.minimumPayoutAmount) {
        return await this.queueTransfer(
          data,
          `Amount below minimum payout threshold (₹${routeAccount.minimumPayoutAmount / 100})`
        );
      }

      // Create payout record
      const payout = new AdminPayout({
        adminId: data.adminId,
        routeAccountId: routeAccount.routeAccountId,
        feeBreakdown,
        status: 'pending',
        sourceType: data.sourceType,
        sourceTransactionId: data.sourceTransactionId,
        memberId: data.memberId,
        communityId: data.communityId,
        paymentReceivedAt: new Date(),
        isBatchTransfer: false,
        retryCount: 0,
        maxRetries: 3,
        isReconciled: false,
        platformFeeDeducted: false
      });

      await payout.save();

      try {
        // Prepare transfer request
        const transferRequest: ITransferRequest = {
          account: routeAccount.routeAccountId,
          amount: feeBreakdown.netAmount,
          currency: 'INR',
          mode: razorpayRoute.getOptimalTransferMode(feeBreakdown.netAmount),
          purpose: 'payout',
          queue_if_low_balance: true,
          reference_id: payout._id!.toString(),
          narration: `Payout for ${data.sourceType}`,
          notes: {
            admin_id: data.adminId.toString(),
            source_transaction: data.sourceTransactionId.toString(),
            platform_fee: feeBreakdown.platformFeeAmount.toString(),
            processing_fee: feeBreakdown.processingFeeAmount.toString()
          }
        };

        // Create transfer with Razorpay
        const transfer = await razorpayRoute.createTransfer(transferRequest);

        // Update payout record
        await payout.markProcessed(transfer.id);

        // Update Route account statistics
        await routeAccount.recordPayout(feeBreakdown.netAmount);

        // Deduct platform fee from admin's earnings or subscription
        await this.handlePlatformFeeDeduction(data.adminId, feeBreakdown.platformFeeAmount);

        return {
          success: true,
          payout,
          transferId: transfer.id
        };

      } catch (transferError: any) {
        // Mark payout as failed and schedule retry
        await payout.markFailed(transferError.message);
        
        return {
          success: false,
          payout,
          error: transferError.message
        };
      }

    } catch (error: any) {
      console.error('Transfer creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Queue transfer for later processing
   */
  private static async queueTransfer(data: ITransferData, reason: string): Promise<ITransferResult> {
    const feeBreakdown = this.calculateFeeBreakdown(
      data.grossAmount,
      data.platformFeeRate || 5.0
    );

    const payout = new AdminPayout({
      adminId: data.adminId,
      routeAccountId: '', // Will be filled when Route account is ready
      feeBreakdown,
      status: 'queued',
      sourceType: data.sourceType,
      sourceTransactionId: data.sourceTransactionId,
      memberId: data.memberId,
      communityId: data.communityId,
      paymentReceivedAt: new Date(),
      isBatchTransfer: false,
      retryCount: 0,
      maxRetries: 3,
      isReconciled: false,
      platformFeeDeducted: false,
      failureReason: reason
    });

    await payout.save();

    return {
      success: false,
      payout,
      error: `Transfer queued: ${reason}`
    };
  }

  /**
   * Process queued transfers for admins with newly activated Route accounts
   */
  static async processQueuedTransfers(adminId: mongoose.Types.ObjectId): Promise<IBulkTransferResult> {
    const queuedPayouts = await AdminPayout.find({
      adminId,
      status: 'queued'
    }).sort({ paymentReceivedAt: 1 });

    const results: ITransferResult[] = [];
    let successfulTransfers = 0;
    let failedTransfers = 0;

    for (const payout of queuedPayouts) {
      try {
        const transferData: ITransferData = {
          adminId: payout.adminId,
          grossAmount: payout.feeBreakdown.grossAmount,
          sourceTransactionId: payout.sourceTransactionId!,
          memberId: payout.memberId,
          communityId: payout.communityId,
          sourceType: payout.sourceType as any,
          platformFeeRate: payout.feeBreakdown.platformFeeRate
        };

        // Delete the queued payout and create a new one
        await AdminPayout.findByIdAndDelete(payout._id);
        
        const result = await this.createTransfer(transferData);
        results.push(result);

        if (result.success) {
          successfulTransfers++;
        } else {
          failedTransfers++;
        }

      } catch (error: any) {
        results.push({
          success: false,
          error: error.message
        });
        failedTransfers++;
      }
    }

    return {
      totalTransfers: queuedPayouts.length,
      successfulTransfers,
      failedTransfers,
      results
    };
  }

  /**
   * Retry failed transfers
   */
  static async retryFailedTransfers(): Promise<IBulkTransferResult> {
    const failedPayouts = await AdminPayout.find({
      status: 'failed',
      retryCount: { $lt: 3 },
      $or: [
        { nextRetryAt: { $lte: new Date() } },
        { nextRetryAt: { $exists: false } }
      ]
    }).sort({ paymentReceivedAt: 1 });

    const results: ITransferResult[] = [];
    let successfulTransfers = 0;
    let failedTransfers = 0;

    for (const payout of failedPayouts) {
      try {
        // Get Route account
        const routeAccount = await RouteAccount.findOne({ adminId: payout.adminId });
        if (!routeAccount || !routeAccount.routeAccountId) {
          await payout.markFailed('Route account not available');
          results.push({
            success: false,
            payout,
            error: 'Route account not available'
          });
          failedTransfers++;
          continue;
        }

        // Update payout with Route account ID if missing
        if (!payout.routeAccountId) {
          payout.routeAccountId = routeAccount.routeAccountId;
        }

        // Prepare transfer request
        const transferRequest: ITransferRequest = {
          account: routeAccount.routeAccountId,
          amount: payout.feeBreakdown.netAmount,
          currency: 'INR',
          mode: razorpayRoute.getOptimalTransferMode(payout.feeBreakdown.netAmount),
          purpose: 'payout',
          queue_if_low_balance: true,
          reference_id: payout._id!.toString(),
          narration: `Retry payout for ${payout.sourceType}`,
          notes: {
            admin_id: payout.adminId.toString(),
            retry_attempt: (payout.retryCount + 1).toString()
          }
        };

        // Create transfer with Razorpay
        const transfer = await razorpayRoute.createTransfer(transferRequest);

        // Update payout record
        await payout.markProcessed(transfer.id);

        // Update Route account statistics
        await routeAccount.recordPayout(payout.feeBreakdown.netAmount);

        results.push({
          success: true,
          payout,
          transferId: transfer.id
        });
        successfulTransfers++;

      } catch (error: any) {
        await payout.markFailed(error.message);
        results.push({
          success: false,
          payout,
          error: error.message
        });
        failedTransfers++;
      }
    }

    return {
      totalTransfers: failedPayouts.length,
      successfulTransfers,
      failedTransfers,
      results
    };
  }

  /**
   * Calculate fee breakdown
   */
  private static calculateFeeBreakdown(
    grossAmount: number,
    platformFeeRate: number = 5.0
  ): IFeeBreakdown {
    return razorpayRoute.calculateFeeBreakdown(grossAmount, platformFeeRate);
  }

  /**
   * Handle platform fee deduction
   */
  private static async handlePlatformFeeDeduction(
    adminId: mongoose.Types.ObjectId,
    platformFeeAmount: number
  ): Promise<void> {
    try {
      const platformSubscription = await PlatformSubscription.findOne({ adminId });
      
      if (platformSubscription && platformSubscription.feeDeductionEnabled) {
        // Add to pending fee amount to be deducted from future earnings
        platformSubscription.pendingFeeAmount += platformFeeAmount;
        await platformSubscription.save();
      }
      
      // Note: Actual fee collection will be handled by the billing system
    } catch (error) {
      console.error('Platform fee deduction error:', error);
      // Don't fail the transfer if fee deduction fails
    }
  }

  /**
   * Get transfer statistics for admin
   */
  static async getTransferStats(adminId: mongoose.Types.ObjectId): Promise<{
    totalTransfers: number;
    totalAmount: number;
    successfulTransfers: number;
    failedTransfers: number;
    pendingTransfers: number;
    lastTransferDate?: Date;
  }> {
    const stats = await AdminPayout.aggregate([
      { $match: { adminId } },
      {
        $group: {
          _id: null,
          totalTransfers: { $sum: 1 },
          totalAmount: { $sum: '$feeBreakdown.netAmount' },
          successfulTransfers: {
            $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] }
          },
          failedTransfers: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          pendingTransfers: {
            $sum: { $cond: [{ $in: ['$status', ['pending', 'queued', 'processing']] }, 1, 0] }
          },
          lastTransferDate: { $max: '$transferCompletedAt' }
        }
      }
    ]);

    return stats[0] || {
      totalTransfers: 0,
      totalAmount: 0,
      successfulTransfers: 0,
      failedTransfers: 0,
      pendingTransfers: 0
    };
  }
}
