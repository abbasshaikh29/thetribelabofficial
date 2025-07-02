import { dbconnect } from './db';
import { Community } from '@/models/Community';
import { User } from '@/models/User';
import { TrialHistory } from '@/models/TrialHistory';
import { createNotification } from './notifications';
import { sendTrialExpiredEmail } from './resend';

/**
 * Process expired trials and suspend communities/users
 */
export async function processExpiredTrials() {
  try {
    await dbconnect();
    
    const now = new Date();
    console.log(`Processing expired trials at ${now.toISOString()}`);
    
    // Find all active trials that have expired
    const expiredTrials = await TrialHistory.find({
      status: 'active',
      endDate: { $lt: now }
    });
    
    console.log(`Found ${expiredTrials.length} expired trials to process`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    for (const trial of expiredTrials) {
      try {
        await processExpiredTrial(trial);
        processedCount++;
      } catch (error) {
        console.error(`Error processing expired trial ${trial._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Processed ${processedCount} expired trials, ${errorCount} errors`);
    
    return {
      success: true,
      processed: processedCount,
      errors: errorCount,
      total: expiredTrials.length
    };
  } catch (error) {
    console.error('Error processing expired trials:', error);
    return {
      success: false,
      error: String(error)
    };
  }
}

/**
 * Process a single expired trial
 */
async function processExpiredTrial(trial: any) {
  console.log(`Processing expired trial: ${trial._id} for user ${trial.userId}`);
  
  // Update trial status to expired
  trial.status = 'expired';
  await trial.save();
  
  if (trial.trialType === 'community' && trial.communityId) {
    await suspendCommunity(trial.communityId.toString(), trial.userId);
  } else if (trial.trialType === 'user') {
    await suspendUser(trial.userId);
  }
  
  // Send expiration notification
  await sendTrialExpiredNotification(trial);
}

/**
 * Suspend a community when trial expires
 */
async function suspendCommunity(communityId: string, userId: string) {
  try {
    const community = await Community.findById(communityId);
    if (!community) {
      console.error(`Community ${communityId} not found for suspension`);
      return;
    }
    
    // Check if community already has active payment
    if (community.paymentStatus === 'paid') {
      console.log(`Community ${communityId} has active payment, skipping suspension`);
      return;
    }
    
    // Suspend the community
    community.suspended = true;
    community.suspendedAt = new Date();
    community.suspensionReason = 'Trial expired without payment';
    community.paymentStatus = 'expired';
    
    // Deactivate trial info
    if (community.adminTrialInfo) {
      community.adminTrialInfo.activated = false;
    }
    community.freeTrialActivated = false;
    
    await community.save();
    
    console.log(`Community ${communityId} suspended due to trial expiration`);
    
    // Send suspension notification to admin
    await sendCommunitySuspensionNotification(community, userId);
  } catch (error) {
    console.error(`Error suspending community ${communityId}:`, error);
    throw error;
  }
}

/**
 * Suspend a user when trial expires
 */
async function suspendUser(userId: string) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User ${userId} not found for suspension`);
      return;
    }
    
    // Check if user already has active payment
    if (user.paymentSettings?.subscriptionStatus === 'active') {
      console.log(`User ${userId} has active subscription, skipping suspension`);
      return;
    }
    
    // Update user payment settings
    if (user.paymentSettings) {
      user.paymentSettings.subscriptionStatus = 'unpaid';
      user.paymentSettings.subscriptionEndDate = undefined;
    }
    
    // Downgrade user role if they were upgraded during trial
    if (user.role === 'admin') {
      user.role = 'user';
    }
    
    await user.save();
    
    console.log(`User ${userId} downgraded due to trial expiration`);
  } catch (error) {
    console.error(`Error suspending user ${userId}:`, error);
    throw error;
  }
}

/**
 * Send trial expired notification
 */
async function sendTrialExpiredNotification(trial: any) {
  try {
    const user = await User.findById(trial.userId);
    if (!user) return;
    
    let title = 'Your Free Trial Has Expired';
    let message = 'Your free trial has expired. Please subscribe to continue using premium features.';
    let linkUrl = '/profile';
    let communityName = '';
    
    if (trial.trialType === 'community' && trial.communityId) {
      const community = await Community.findById(trial.communityId);
      if (community) {
        communityName = community.name;
        title = `Trial Expired for ${communityName}`;
        message = `Your free trial for ${communityName} has expired and the community has been suspended. Subscribe now to reactivate your community.`;
        linkUrl = `/billing/${community.slug}`;
      }
    }
    
    // Create in-app notification
    await createNotification({
      userId: trial.userId,
      title,
      message,
      type: 'trial_expired',
      linkUrl,
      metadata: {
        trialId: trial._id.toString(),
        trialType: trial.trialType,
        communityId: trial.communityId?.toString(),
        expiredAt: new Date().toISOString()
      }
    });
    
    // Send email notification
    await sendTrialExpiredEmail(user.email, {
      adminName: user.name || user.username,
      communityName: trial.trialType === 'community' && trial.communityId ?
        (await Community.findById(trial.communityId))?.name || 'Your Community' :
        'Your Trial',
      paymentUrl: `${process.env.NEXTAUTH_URL}${linkUrl}`,
      trialType: trial.trialType
    });
    
    console.log(`Sent trial expiration notification to user ${trial.userId}`);
  } catch (error) {
    console.error('Error sending trial expired notification:', error);
  }
}

/**
 * Send community suspension notification
 */
async function sendCommunitySuspensionNotification(community: any, userId: string) {
  try {
    const user = await User.findById(userId);
    if (!user) return;
    
    const title = `${community.name} Has Been Suspended`;
    const message = `Your community "${community.name}" has been suspended due to trial expiration. Members cannot access the community until you subscribe.`;
    const linkUrl = `/billing/${community.slug}`;
    
    // Create in-app notification
    await createNotification({
      userId,
      title,
      message,
      type: 'community_suspended',
      linkUrl,
      metadata: {
        communityId: community._id.toString(),
        suspendedAt: community.suspendedAt.toISOString(),
        reason: community.suspensionReason
      }
    });
    
    // Send email notification
    await sendTrialExpiredEmail(user.email, {
      adminName: user.name || user.username,
      communityName: community.name,
      paymentUrl: `${process.env.NEXTAUTH_URL}${linkUrl}`,
      trialType: 'community'
    });
    
    console.log(`Sent community suspension notification to user ${userId}`);
  } catch (error) {
    console.error('Error sending community suspension notification:', error);
  }
}

/**
 * Check if a community is suspended
 */
export async function isCommunityActive(communityId: string): Promise<boolean> {
  try {
    await dbconnect();
    
    const community = await Community.findById(communityId);
    if (!community) return false;
    
    // Community is active if:
    // 1. Not suspended, OR
    // 2. Has active payment, OR  
    // 3. Has active trial
    const isActive = !community.suspended || 
                    community.paymentStatus === 'paid' ||
                    (community.adminTrialInfo?.activated && 
                     community.adminTrialInfo?.endDate && 
                     new Date(community.adminTrialInfo.endDate) > new Date());
    
    return isActive;
  } catch (error) {
    console.error('Error checking community status:', error);
    return false; // Fail closed for security
  }
}
