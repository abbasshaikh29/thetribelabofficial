import { PlatformSubscription, IPlatformSubscription } from '@/models/PlatformSubscription';
import { User } from '@/models/User';
import mongoose from 'mongoose';

export interface ITrialStatus {
  isActive: boolean;
  daysRemaining: number;
  percentRemaining: number;
  endDate: Date | null;
  isExpired: boolean;
  isInGracePeriod: boolean;
  gracePeriodEndDate: Date | null;
  canCreateCommunities: boolean;
  canReceivePayments: boolean;
  warningLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface ITrialNotification {
  type: 'trial_reminder' | 'trial_expiring' | 'trial_expired' | 'grace_period' | 'account_suspended';
  daysRemaining: number;
  message: string;
  actionRequired: boolean;
  urgencyLevel: 'info' | 'warning' | 'error';
}

export class TrialManager {
  /**
   * Get trial status for an admin
   */
  static async getTrialStatus(adminId: mongoose.Types.ObjectId): Promise<ITrialStatus> {
    const subscription = await PlatformSubscription.findOne({ adminId });
    
    if (!subscription) {
      // No subscription found - create one
      await this.createTrialSubscription(adminId);
      return this.getTrialStatus(adminId);
    }

    const now = new Date();
    const isActive = subscription.isTrialActive && subscription.trialEndDate && subscription.trialEndDate > now;
    
    let daysRemaining = 0;
    let percentRemaining = 0;
    
    if (subscription.trialEndDate) {
      const timeRemaining = subscription.trialEndDate.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
      percentRemaining = Math.max(0, Math.min(100, (daysRemaining / 14) * 100));
    }

    const isExpired = subscription.trialEndDate ? subscription.trialEndDate <= now : false;
    const isInGracePeriod = subscription.isInGracePeriod && subscription.gracePeriodEndDate && subscription.gracePeriodEndDate > now;
    
    // Determine capabilities based on status
    const canCreateCommunities = isActive || isInGracePeriod || subscription.status === 'active';
    const canReceivePayments = isActive || subscription.status === 'active';
    
    // Determine warning level
    let warningLevel: ITrialStatus['warningLevel'] = 'none';
    if (subscription.status === 'suspended') {
      warningLevel = 'critical';
    } else if (isExpired && !isInGracePeriod) {
      warningLevel = 'critical';
    } else if (isInGracePeriod) {
      warningLevel = 'high';
    } else if (daysRemaining <= 1) {
      warningLevel = 'high';
    } else if (daysRemaining <= 3) {
      warningLevel = 'medium';
    } else if (daysRemaining <= 7) {
      warningLevel = 'low';
    }

    return {
      isActive,
      daysRemaining,
      percentRemaining,
      endDate: subscription.trialEndDate,
      isExpired,
      isInGracePeriod,
      gracePeriodEndDate: subscription.gracePeriodEndDate,
      canCreateCommunities,
      canReceivePayments,
      warningLevel
    };
  }

  /**
   * Create trial subscription for admin
   */
  static async createTrialSubscription(adminId: mongoose.Types.ObjectId): Promise<IPlatformSubscription> {
    const existingSubscription = await PlatformSubscription.findOne({ adminId });
    if (existingSubscription) {
      throw new Error('Platform subscription already exists for this admin');
    }

    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    const subscription = new PlatformSubscription({
      adminId,
      planType: 'starter',
      amount: 240000, // ₹2,400 in paise
      currency: 'INR',
      interval: 'monthly',
      status: 'trial',
      trialStartDate: now,
      trialEndDate,
      isTrialActive: true,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndDate,
      nextBillingDate: trialEndDate,
      feeDeductionEnabled: true,
      pendingFeeAmount: 0,
      totalFeesDeducted: 0,
      gracePeriodDays: 7,
      isInGracePeriod: false,
      consecutiveFailures: 0,
      maxFailuresAllowed: 3,
      autoReactivateOnPayment: true,
      invoiceGeneration: true,
      emailNotifications: true,
      monthlyEarnings: 0,
      memberCount: 0,
      transactionCount: 0
    });

    await subscription.save();
    return subscription;
  }

  /**
   * Extend trial period
   */
  static async extendTrial(adminId: mongoose.Types.ObjectId, additionalDays: number): Promise<IPlatformSubscription> {
    const subscription = await PlatformSubscription.findOne({ adminId });
    if (!subscription) {
      throw new Error('Platform subscription not found');
    }

    if (!subscription.trialEndDate) {
      throw new Error('No active trial to extend');
    }

    // Extend trial end date
    const newEndDate = new Date(subscription.trialEndDate.getTime() + (additionalDays * 24 * 60 * 60 * 1000));
    subscription.trialEndDate = newEndDate;
    subscription.currentPeriodEnd = newEndDate;
    subscription.nextBillingDate = newEndDate;
    subscription.isTrialActive = true;
    subscription.status = 'trial';

    await subscription.save();
    return subscription;
  }

  /**
   * Start grace period when trial expires
   */
  static async startGracePeriod(adminId: mongoose.Types.ObjectId): Promise<IPlatformSubscription> {
    const subscription = await PlatformSubscription.findOne({ adminId });
    if (!subscription) {
      throw new Error('Platform subscription not found');
    }

    const now = new Date();
    const gracePeriodEnd = new Date(now.getTime() + (subscription.gracePeriodDays * 24 * 60 * 60 * 1000));

    subscription.isTrialActive = false;
    subscription.status = 'past_due';
    subscription.isInGracePeriod = true;
    subscription.gracePeriodEndDate = gracePeriodEnd;

    await subscription.save();
    return subscription;
  }

  /**
   * Convert trial to active subscription
   */
  static async convertToActive(adminId: mongoose.Types.ObjectId): Promise<IPlatformSubscription> {
    const subscription = await PlatformSubscription.findOne({ adminId });
    if (!subscription) {
      throw new Error('Platform subscription not found');
    }

    return subscription.convertToActive();
  }

  /**
   * Suspend account after grace period
   */
  static async suspendAccount(adminId: mongoose.Types.ObjectId, reason: string): Promise<IPlatformSubscription> {
    const subscription = await PlatformSubscription.findOne({ adminId });
    if (!subscription) {
      throw new Error('Platform subscription not found');
    }

    return subscription.suspend(reason);
  }

  /**
   * Get trial notification for admin
   */
  static async getTrialNotification(adminId: mongoose.Types.ObjectId): Promise<ITrialNotification | null> {
    const status = await this.getTrialStatus(adminId);
    
    if (status.warningLevel === 'critical') {
      if (status.isInGracePeriod) {
        return {
          type: 'grace_period',
          daysRemaining: status.daysRemaining,
          message: `Your trial has expired. You have ${Math.ceil((status.gracePeriodEndDate!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left in your grace period.`,
          actionRequired: true,
          urgencyLevel: 'error'
        };
      } else if (status.isExpired) {
        return {
          type: 'account_suspended',
          daysRemaining: 0,
          message: 'Your account has been suspended. Please upgrade to continue using the platform.',
          actionRequired: true,
          urgencyLevel: 'error'
        };
      }
    }
    
    if (status.isActive) {
      if (status.daysRemaining === 0) {
        return {
          type: 'trial_expiring',
          daysRemaining: 0,
          message: 'Your trial expires today! Upgrade now to continue without interruption.',
          actionRequired: true,
          urgencyLevel: 'error'
        };
      } else if (status.daysRemaining === 1) {
        return {
          type: 'trial_expiring',
          daysRemaining: 1,
          message: 'Your trial expires tomorrow! Upgrade now to avoid service interruption.',
          actionRequired: true,
          urgencyLevel: 'warning'
        };
      } else if (status.daysRemaining <= 3) {
        return {
          type: 'trial_reminder',
          daysRemaining: status.daysRemaining,
          message: `Your trial expires in ${status.daysRemaining} days. Consider upgrading to continue enjoying all features.`,
          actionRequired: false,
          urgencyLevel: 'warning'
        };
      } else if (status.daysRemaining <= 7) {
        return {
          type: 'trial_reminder',
          daysRemaining: status.daysRemaining,
          message: `You have ${status.daysRemaining} days left in your trial. Explore all features before it ends!`,
          actionRequired: false,
          urgencyLevel: 'info'
        };
      }
    }

    return null;
  }

  /**
   * Get admins whose trials are expiring soon (for batch notifications)
   */
  static async getExpiringTrials(daysAhead: number = 3): Promise<IPlatformSubscription[]> {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    targetDate.setHours(23, 59, 59, 999); // End of day

    const startOfTargetDay = new Date(targetDate);
    startOfTargetDay.setHours(0, 0, 0, 0); // Start of day

    return PlatformSubscription.find({
      isTrialActive: true,
      status: 'trial',
      trialEndDate: {
        $gte: startOfTargetDay,
        $lte: targetDate
      }
    }).populate('adminId', 'email username name');
  }

  /**
   * Get admins in grace period
   */
  static async getGracePeriodAccounts(): Promise<IPlatformSubscription[]> {
    const now = new Date();
    
    return PlatformSubscription.find({
      isInGracePeriod: true,
      gracePeriodEndDate: { $gt: now }
    }).populate('adminId', 'email username name');
  }

  /**
   * Get accounts that need to be suspended (grace period expired)
   */
  static async getAccountsToSuspend(): Promise<IPlatformSubscription[]> {
    const now = new Date();
    
    return PlatformSubscription.find({
      $or: [
        {
          isInGracePeriod: true,
          gracePeriodEndDate: { $lte: now },
          status: { $ne: 'suspended' }
        },
        {
          isTrialActive: false,
          status: 'past_due',
          isInGracePeriod: false,
          gracePeriodEndDate: { $lte: now }
        }
      ]
    }).populate('adminId', 'email username name');
  }

  /**
   * Process trial expirations (to be run daily via cron)
   */
  static async processTrialExpirations(): Promise<{
    expiredTrials: number;
    gracePeriodStarted: number;
    accountsSuspended: number;
  }> {
    const now = new Date();
    let expiredTrials = 0;
    let gracePeriodStarted = 0;
    let accountsSuspended = 0;

    // Find trials that expired today
    const expiredTrialSubscriptions = await PlatformSubscription.find({
      isTrialActive: true,
      trialEndDate: { $lte: now },
      status: 'trial'
    });

    // Start grace period for expired trials
    for (const subscription of expiredTrialSubscriptions) {
      try {
        await this.startGracePeriod(subscription.adminId);
        expiredTrials++;
        gracePeriodStarted++;
      } catch (error) {
        console.error(`Failed to start grace period for admin ${subscription.adminId}:`, error);
      }
    }

    // Suspend accounts with expired grace periods
    const accountsToSuspend = await this.getAccountsToSuspend();
    for (const subscription of accountsToSuspend) {
      try {
        await this.suspendAccount(subscription.adminId, 'Grace period expired');
        accountsSuspended++;
      } catch (error) {
        console.error(`Failed to suspend account for admin ${subscription.adminId}:`, error);
      }
    }

    return {
      expiredTrials,
      gracePeriodStarted,
      accountsSuspended
    };
  }
}
