import { AdminPayout } from '@/models/AdminPayout';
import { RouteAccount } from '@/models/RouteAccount';
import { PlatformSubscription } from '@/models/PlatformSubscription';
import { TransferQueue } from './transfer-queue';
import mongoose from 'mongoose';

export interface ITransferError {
  code: string;
  message: string;
  category: 'temporary' | 'permanent' | 'account_issue' | 'system_error';
  retryable: boolean;
  suggestedAction: string;
  escalationRequired: boolean;
}

export interface IErrorAnalysis {
  errorType: ITransferError;
  affectedTransfers: number;
  estimatedResolutionTime: number; // Minutes
  recommendedActions: string[];
  adminNotificationRequired: boolean;
}

export class TransferErrorHandler {
  // Error classification patterns
  private static readonly ERROR_PATTERNS = {
    // Temporary errors - retry automatically
    NETWORK_ERROR: {
      patterns: ['network', 'timeout', 'connection', 'socket'],
      category: 'temporary' as const,
      retryable: true,
      escalationRequired: false
    },
    RATE_LIMIT: {
      patterns: ['rate limit', 'too many requests', '429'],
      category: 'temporary' as const,
      retryable: true,
      escalationRequired: false
    },
    SERVER_ERROR: {
      patterns: ['500', 'internal server error', 'service unavailable'],
      category: 'temporary' as const,
      retryable: true,
      escalationRequired: false
    },

    // Account issues - require admin action
    INSUFFICIENT_BALANCE: {
      patterns: ['insufficient balance', 'low balance', 'balance'],
      category: 'account_issue' as const,
      retryable: false,
      escalationRequired: true
    },
    ACCOUNT_SUSPENDED: {
      patterns: ['account suspended', 'suspended', 'blocked'],
      category: 'account_issue' as const,
      retryable: false,
      escalationRequired: true
    },
    INVALID_ACCOUNT: {
      patterns: ['invalid account', 'account not found', 'invalid recipient'],
      category: 'account_issue' as const,
      retryable: false,
      escalationRequired: true
    },
    KYC_PENDING: {
      patterns: ['kyc', 'verification pending', 'documents required'],
      category: 'account_issue' as const,
      retryable: false,
      escalationRequired: true
    },

    // Permanent errors - don't retry
    INVALID_AMOUNT: {
      patterns: ['invalid amount', 'amount too small', 'amount too large'],
      category: 'permanent' as const,
      retryable: false,
      escalationRequired: false
    },
    INVALID_CURRENCY: {
      patterns: ['invalid currency', 'currency not supported'],
      category: 'permanent' as const,
      retryable: false,
      escalationRequired: false
    },

    // System errors - escalate immediately
    API_KEY_INVALID: {
      patterns: ['invalid api key', 'unauthorized', 'authentication failed'],
      category: 'system_error' as const,
      retryable: false,
      escalationRequired: true
    },
    WEBHOOK_SIGNATURE: {
      patterns: ['invalid signature', 'signature verification failed'],
      category: 'system_error' as const,
      retryable: false,
      escalationRequired: true
    }
  };

  /**
   * Classify and analyze transfer error
   */
  static analyzeError(error: string, adminId?: mongoose.Types.ObjectId): IErrorAnalysis {
    const errorLower = error.toLowerCase();
    let errorType: ITransferError | null = null;

    // Find matching error pattern
    for (const [errorCode, config] of Object.entries(this.ERROR_PATTERNS)) {
      if (config.patterns.some(pattern => errorLower.includes(pattern))) {
        errorType = {
          code: errorCode,
          message: error,
          category: config.category,
          retryable: config.retryable,
          suggestedAction: this.getSuggestedAction(errorCode),
          escalationRequired: config.escalationRequired
        };
        break;
      }
    }

    // Default to unknown error if no pattern matches
    if (!errorType) {
      errorType = {
        code: 'UNKNOWN_ERROR',
        message: error,
        category: 'system_error',
        retryable: true,
        suggestedAction: 'Contact support for assistance',
        escalationRequired: true
      };
    }

    return {
      errorType,
      affectedTransfers: 1, // Will be calculated if needed
      estimatedResolutionTime: this.getEstimatedResolutionTime(errorType.category),
      recommendedActions: this.getRecommendedActions(errorType),
      adminNotificationRequired: this.shouldNotifyAdmin(errorType, adminId)
    };
  }

  /**
   * Handle transfer error with appropriate action
   */
  static async handleTransferError(
    payoutId: string,
    error: string,
    adminId: mongoose.Types.ObjectId
  ): Promise<{
    action: 'retry' | 'queue' | 'fail' | 'escalate';
    nextRetryAt?: Date;
    notificationSent: boolean;
  }> {
    try {
      const analysis = this.analyzeError(error, adminId);
      const payout = await AdminPayout.findById(payoutId);

      if (!payout) {
        throw new Error('Payout not found');
      }

      // Update error information
      payout.failureReason = error;
      payout.lastErrorAnalysis = {
        errorCode: analysis.errorType.code,
        category: analysis.errorType.category,
        retryable: analysis.errorType.retryable,
        analyzedAt: new Date()
      };

      let action: 'retry' | 'queue' | 'fail' | 'escalate';
      let nextRetryAt: Date | undefined;
      let notificationSent = false;

      switch (analysis.errorType.category) {
        case 'temporary':
          if (payout.retryCount < payout.maxRetries) {
            action = 'retry';
            nextRetryAt = this.calculateNextRetryTime(payout.retryCount, analysis.errorType.code);
            payout.status = 'queued';
            payout.nextRetryAt = nextRetryAt;
          } else {
            action = 'fail';
            payout.status = 'failed';
            notificationSent = await this.sendAdminNotification(adminId, analysis, payout);
          }
          break;

        case 'account_issue':
          action = 'escalate';
          payout.status = 'failed';
          await this.handleAccountIssue(adminId, analysis.errorType.code);
          notificationSent = await this.sendAdminNotification(adminId, analysis, payout);
          break;

        case 'permanent':
          action = 'fail';
          payout.status = 'failed';
          notificationSent = await this.sendAdminNotification(adminId, analysis, payout);
          break;

        case 'system_error':
          action = 'escalate';
          payout.status = 'failed';
          await this.escalateSystemError(analysis, payout);
          notificationSent = await this.sendAdminNotification(adminId, analysis, payout);
          break;

        default:
          action = 'queue';
          payout.status = 'queued';
          nextRetryAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
          payout.nextRetryAt = nextRetryAt;
      }

      await payout.save();

      return { action, nextRetryAt, notificationSent };

    } catch (error: any) {
      console.error('Error handling transfer error:', error);
      throw error;
    }
  }

  /**
   * Get suggested action for error code
   */
  private static getSuggestedAction(errorCode: string): string {
    const actions: Record<string, string> = {
      NETWORK_ERROR: 'Automatic retry will be attempted',
      RATE_LIMIT: 'Transfer will be retried after rate limit resets',
      SERVER_ERROR: 'Automatic retry will be attempted',
      INSUFFICIENT_BALANCE: 'Check platform account balance and add funds',
      ACCOUNT_SUSPENDED: 'Contact Razorpay support to resolve account suspension',
      INVALID_ACCOUNT: 'Verify Route account details and KYC status',
      KYC_PENDING: 'Complete KYC verification process',
      INVALID_AMOUNT: 'Check transfer amount and minimum limits',
      INVALID_CURRENCY: 'Verify currency settings',
      API_KEY_INVALID: 'Check API key configuration',
      WEBHOOK_SIGNATURE: 'Verify webhook signature configuration'
    };

    return actions[errorCode] || 'Contact support for assistance';
  }

  /**
   * Get estimated resolution time in minutes
   */
  private static getEstimatedResolutionTime(category: string): number {
    const times: Record<string, number> = {
      temporary: 30,      // 30 minutes
      account_issue: 1440, // 24 hours
      permanent: 0,        // Immediate (no resolution)
      system_error: 120    // 2 hours
    };

    return times[category] || 60;
  }

  /**
   * Get recommended actions for error type
   */
  private static getRecommendedActions(errorType: ITransferError): string[] {
    const actions: Record<string, string[]> = {
      NETWORK_ERROR: ['Wait for automatic retry', 'Check network connectivity'],
      RATE_LIMIT: ['Wait for rate limit reset', 'Consider batching transfers'],
      INSUFFICIENT_BALANCE: ['Add funds to platform account', 'Check account balance'],
      ACCOUNT_SUSPENDED: ['Contact Razorpay support', 'Review account compliance'],
      INVALID_ACCOUNT: ['Verify bank details', 'Check KYC status', 'Update Route account'],
      KYC_PENDING: ['Complete KYC verification', 'Submit required documents'],
      API_KEY_INVALID: ['Check API key configuration', 'Regenerate API keys if needed'],
      WEBHOOK_SIGNATURE: ['Verify webhook secret', 'Check signature validation']
    };

    return actions[errorType.code] || ['Contact support', 'Review error details'];
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private static calculateNextRetryTime(retryCount: number, errorCode: string): Date {
    const baseDelays: Record<string, number[]> = {
      NETWORK_ERROR: [2, 5, 10, 20, 40],      // Minutes
      RATE_LIMIT: [15, 30, 60, 120, 240],     // Minutes
      SERVER_ERROR: [5, 10, 20, 40, 80],      // Minutes
      default: [5, 15, 30, 60, 120]           // Minutes
    };

    const delays = baseDelays[errorCode] || baseDelays.default;
    const delayMinutes = delays[Math.min(retryCount, delays.length - 1)];
    
    return new Date(Date.now() + (delayMinutes * 60 * 1000));
  }

  /**
   * Handle account-specific issues
   */
  private static async handleAccountIssue(adminId: mongoose.Types.ObjectId, errorCode: string): Promise<void> {
    try {
      const routeAccount = await RouteAccount.findOne({ adminId });
      
      if (routeAccount) {
        // Update account status based on error
        switch (errorCode) {
          case 'ACCOUNT_SUSPENDED':
            routeAccount.status = 'suspended';
            break;
          case 'KYC_PENDING':
            routeAccount.kycStatus = 'pending';
            break;
          case 'INVALID_ACCOUNT':
            routeAccount.status = 'rejected';
            break;
        }

        await routeAccount.recordError(`Account issue: ${errorCode}`);
      }

    } catch (error) {
      console.error('Error handling account issue:', error);
    }
  }

  /**
   * Escalate system errors
   */
  private static async escalateSystemError(analysis: IErrorAnalysis, payout: any): Promise<void> {
    try {
      // Log critical system error
      console.error('CRITICAL SYSTEM ERROR:', {
        errorCode: analysis.errorType.code,
        message: analysis.errorType.message,
        payoutId: payout._id,
        adminId: payout.adminId,
        timestamp: new Date().toISOString()
      });

      // You could integrate with error tracking services here
      // e.g., Sentry, Bugsnag, etc.

    } catch (error) {
      console.error('Error escalating system error:', error);
    }
  }

  /**
   * Send notification to admin
   */
  private static async sendAdminNotification(
    adminId: mongoose.Types.ObjectId,
    analysis: IErrorAnalysis,
    payout: any
  ): Promise<boolean> {
    try {
      // This would integrate with your notification system
      // For now, just log the notification
      console.log('Admin notification:', {
        adminId,
        errorCode: analysis.errorType.code,
        message: analysis.errorType.message,
        suggestedAction: analysis.errorType.suggestedAction,
        payoutId: payout._id,
        amount: payout.feeBreakdown.netAmount
      });

      // You could send email, SMS, or in-app notifications here
      return true;

    } catch (error) {
      console.error('Error sending admin notification:', error);
      return false;
    }
  }

  /**
   * Check if admin should be notified
   */
  private static shouldNotifyAdmin(errorType: ITransferError, adminId?: mongoose.Types.ObjectId): boolean {
    // Always notify for account issues and system errors
    if (errorType.category === 'account_issue' || errorType.category === 'system_error') {
      return true;
    }

    // Notify for permanent errors
    if (errorType.category === 'permanent') {
      return true;
    }

    // Don't notify for temporary errors unless they persist
    return false;
  }

  /**
   * Get error statistics for monitoring
   */
  static async getErrorStats(adminId?: mongoose.Types.ObjectId): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsByCode: Record<string, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  }> {
    try {
      const matchCondition = adminId ? { adminId } : {};
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const errorStats = await AdminPayout.aggregate([
        {
          $match: {
            ...matchCondition,
            status: 'failed',
            updatedAt: { $gte: last24Hours }
          }
        },
        {
          $group: {
            _id: null,
            totalErrors: { $sum: 1 },
            errorsByCategory: {
              $push: '$lastErrorAnalysis.category'
            },
            errorsByCode: {
              $push: '$lastErrorAnalysis.errorCode'
            }
          }
        }
      ]);

      const result = errorStats[0] || {
        totalErrors: 0,
        errorsByCategory: [],
        errorsByCode: []
      };

      // Count errors by category and code
      const categoryCount: Record<string, number> = {};
      const codeCount: Record<string, number> = {};

      result.errorsByCategory.forEach((category: string) => {
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      result.errorsByCode.forEach((code: string) => {
        codeCount[code] = (codeCount[code] || 0) + 1;
      });

      // Calculate resolution rate
      const totalTransfers = await AdminPayout.countDocuments({
        ...matchCondition,
        updatedAt: { $gte: last24Hours }
      });

      const resolutionRate = totalTransfers > 0 
        ? ((totalTransfers - result.totalErrors) / totalTransfers) * 100 
        : 100;

      return {
        totalErrors: result.totalErrors,
        errorsByCategory: categoryCount,
        errorsByCode: codeCount,
        resolutionRate,
        averageResolutionTime: 0 // Would need to calculate based on retry times
      };

    } catch (error) {
      console.error('Error getting error stats:', error);
      return {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByCode: {},
        resolutionRate: 100,
        averageResolutionTime: 0
      };
    }
  }
}
