import { Resend } from "resend";
import { EmailLog } from "@/models/EmailLog";
import { dbconnect } from "./db";
import mongoose from "mongoose";
import { EmailQueue } from "./email-queue";
import { randomBytes } from "crypto";

// Initialize Resend with API key
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

// Email configuration
const EMAIL_CONFIG = {
  from: process.env.EMAIL_FROM || "onboarding@resend.dev",
  appName: process.env.NEXT_PUBLIC_APP_NAME || "TheTribeLab",
  baseUrl: process.env.NEXTAUTH_URL || "http://localhost:3000",
  maxRetries: 3,
  retryDelay: 1000, // 1 second
};

// Email options interface
export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
  from?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  tags?: Array<{ name: string; value: string }>;
  userId?: string;
  communityId?: string;
  category?: string;
  trackDelivery?: boolean;
}

// Email result interface
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  retryCount?: number;
}

/**
 * Sleep function for retry delays
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Enhanced email validation
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(email)) return false;

  // Check against common disposable email domains
  const disposableDomains = [
    'tempmail.org', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'temp-mail.org'
  ];
  const domain = email.split('@')[1]?.toLowerCase();
  return !disposableDomains.includes(domain);
};

/**
 * Generic email sending function with retry logic
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  // Validate inputs
  if (!options.to || !options.subject || !options.html) {
    return {
      success: false,
      error: "Missing required email fields (to, subject, html)",
      errorCode: "INVALID_INPUT"
    };
  }

  // Validate email addresses
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return {
        success: false,
        error: `Invalid email address: ${email}`,
        errorCode: "INVALID_EMAIL"
      };
    }
  }

  // Check if Resend is properly initialized
  if (!resend) {
    // In development mode, log to console instead of failing
    if (process.env.NODE_ENV === "development") {
      console.log("=== EMAIL WOULD BE SENT (Development Mode) ===");
      console.log("To:", options.to);
      console.log("Subject:", options.subject);
      console.log("HTML Content:", options.html.substring(0, 200) + "...");
      console.log("=== END EMAIL LOG ===");

      return {
        success: true,
        messageId: `dev-${Date.now()}`,
        errorCode: "DEV_MODE"
      };
    }

    return {
      success: false,
      error: "Resend API key is not configured",
      errorCode: "MISSING_API_KEY"
    };
  }

  // Prepare email data
  const emailData = {
    from: options.from || EMAIL_CONFIG.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    ...(options.replyTo && { reply_to: options.replyTo }),
    ...(options.tags && { tags: options.tags }),
  };

  // Retry logic
  let lastError: any;
  for (let attempt = 0; attempt < EMAIL_CONFIG.maxRetries; attempt++) {
    try {
      const { data, error } = await resend.emails.send(emailData);

      if (error) {
        lastError = error;
        console.error(`Email send attempt ${attempt + 1} failed:`, error);

        // Don't retry on certain errors
        if (error.message?.includes('Invalid email') ||
            error.message?.includes('API key')) {
          break;
        }

        // Wait before retrying
        if (attempt < EMAIL_CONFIG.maxRetries - 1) {
          await sleep(EMAIL_CONFIG.retryDelay * (attempt + 1));
        }
        continue;
      }

      // Success - Log to database if tracking enabled
      if (options.trackDelivery !== false) {
        try {
          await dbconnect();
          await EmailLog.create({
            to: options.to,
            from: emailData.from,
            subject: options.subject,
            category: options.category || 'general',
            status: 'sent',
            messageId: data?.id,
            resendId: data?.id,
            userId: options.userId ? new mongoose.Types.ObjectId(options.userId) : undefined,
            communityId: options.communityId ? new mongoose.Types.ObjectId(options.communityId) : undefined,
            tags: options.tags,
            priority: options.priority,
            sentAt: new Date()
          });
        } catch (logError) {
          console.error('Error logging email:', logError);
          // Don't fail the email send if logging fails
        }
      }

      console.log("Email sent successfully:", {
        messageId: data?.id,
        recipient: options.to,
        subject: options.subject,
        attempt: attempt + 1
      });

      return {
        success: true,
        messageId: data?.id,
        retryCount: attempt
      };

    } catch (error: any) {
      lastError = error;
      console.error(`Email send attempt ${attempt + 1} failed:`, error);

      // Wait before retrying
      if (attempt < EMAIL_CONFIG.maxRetries - 1) {
        await sleep(EMAIL_CONFIG.retryDelay * (attempt + 1));
      }
    }
  }

  // All attempts failed - Log failure if tracking enabled
  if (options.trackDelivery !== false) {
    try {
      await dbconnect();
      await EmailLog.create({
        to: options.to,
        from: emailData.from,
        subject: options.subject,
        category: options.category || 'general',
        status: 'failed',
        userId: options.userId ? new mongoose.Types.ObjectId(options.userId) : undefined,
        communityId: options.communityId ? new mongoose.Types.ObjectId(options.communityId) : undefined,
        tags: options.tags,
        priority: options.priority,
        error: lastError?.message || "Failed to send email after all retries",
        errorCode: "SEND_FAILED",
        sentAt: new Date()
      });
    } catch (logError) {
      console.error('Error logging email failure:', logError);
    }
  }

  return {
    success: false,
    error: lastError?.message || "Failed to send email after all retries",
    errorCode: "SEND_FAILED",
    retryCount: EMAIL_CONFIG.maxRetries
  };
}

/**
 * Email verification template
 */
export const sendVerificationEmail = async (
  email: string,
  token: string,
  username: string
) => {
  const verificationUrl = `${EMAIL_CONFIG.baseUrl}/verify-email?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <h2 style="color: #333;">Welcome to ${EMAIL_CONFIG.appName}!</h2>
      <p>Hi ${username},</p>
      <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationUrl}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">
          Verify Email Address
        </a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p style="word-break: break-all; color: #666; background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you did not sign up for ${EMAIL_CONFIG.appName}, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
      <p style="font-size: 12px; color: #999; text-align: center;">&copy; ${new Date().getFullYear()} ${EMAIL_CONFIG.appName}. All rights reserved.</p>
    </div>
  `;
  const subject = `Verify your email address for ${EMAIL_CONFIG.appName}`;

  return await EmailQueue.addJob({
    to: email,
    subject: subject,
    html: html,
    category: 'verification',
    priority: 'high',
    tags: [{ name: 'type', value: 'verification' }]
  });
};

/**
 * Trial reminder email template
 */
export const sendTrialReminderEmail = async (
  email: string,
  data: {
    adminName: string;
    communityName: string;
    daysRemaining: number;
    trialEndDate: Date;
    paymentUrl: string;
  }
) => {
  const { adminName, communityName, daysRemaining, trialEndDate, paymentUrl } = data;
  const subject = `[Action Required] Your ${communityName} trial expires in ${daysRemaining} day(s)`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${adminName},</h2>
      <p>Your free trial for the community "${communityName}" is ending in <strong>${daysRemaining} day(s)</strong>, on ${trialEndDate.toDateString()}.</p>
      <p>To keep your community active and avoid suspension, please subscribe to a plan.</p>
      <a href="${EMAIL_CONFIG.baseUrl}${paymentUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
        Subscribe Now
      </a>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'trial_reminder',
    tags: [
      { name: 'community', value: communityName },
      { name: 'days_remaining', value: daysRemaining.toString() }
    ]
  });
};

/**
 * Trial expired email template
 */
export const sendTrialExpiredEmail = async (
  email: string,
  data: {
    adminName: string;
    communityName: string;
    paymentUrl: string;
    trialType: string;
  }
) => {
  const { adminName, communityName, paymentUrl, trialType } = data;
  const subject = `Your ${EMAIL_CONFIG.appName} trial for "${communityName}" has expired`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${adminName},</h2>
      <p>Your ${trialType} trial for the community "${communityName}" has ended.</p>
      <p>Your community is now suspended, and members cannot access it. To reactivate your community and restore access, please subscribe to a plan.</p>
      <a href="${EMAIL_CONFIG.baseUrl}${paymentUrl}" style="background-color: #28a745; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
        Reactivate Your Community
      </a>
      <p>If you have any questions, please contact our support team.</p>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'trial_expired',
    priority: 'high',
    tags: [{ name: 'community', value: communityName }]
  });
};

/**
 * Subscription renewal reminder email template
 */
export const sendRenewalReminderEmail = async (
  email: string,
  data: {
    adminName: string;
    communityName: string;
    subscriptionAmount: number;
    currency: string;
    renewalDate: Date;
    daysUntilRenewal: number;
  }
) => {
  const { adminName, communityName, subscriptionAmount, currency, renewalDate, daysUntilRenewal } = data;
  const formattedAmount = `${currency} ${subscriptionAmount.toFixed(2)}`;
  const subject = `Upcoming subscription renewal for ${communityName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${adminName},</h2>
      <p>This is a reminder that your subscription for "${communityName}" will automatically renew on ${renewalDate.toDateString()} (${daysUntilRenewal} day(s)).</p>
      <p>You will be charged ${formattedAmount}. No action is needed from your side if you wish to continue your subscription.</p>
      <p>To manage your subscription, please visit your billing settings.</p>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'renewal_reminder',
    tags: [{ name: 'community', value: communityName }]
  });
};

/**
 * Payment failed email template
 */
export const sendPaymentFailedEmail = async (
  email: string,
  data: {
    adminName: string;
    communityName: string;
    subscriptionAmount: number;
    currency: string;
    failureReason: string;
    retryAttempts: number;
    maxRetryAttempts: number;
    nextRetryDate?: Date;
    paymentUrl: string;
  }
) => {
  const { adminName, communityName, subscriptionAmount, currency, failureReason, retryAttempts, maxRetryAttempts, nextRetryDate, paymentUrl } = data;
  const formattedAmount = `${currency} ${subscriptionAmount.toFixed(2)}`;
  const subject = `[Action Required] Payment failed for your ${communityName} subscription`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${adminName},</h2>
      <p>We were unable to process the payment of ${formattedAmount} for your subscription to "${communityName}".</p>
      <p><strong>Reason:</strong> ${failureReason}</p>
      ${nextRetryDate ? `<p>We will attempt to charge your card again on ${nextRetryDate.toDateString()}.</p>` : ''}
      <p>Please update your payment information to keep your subscription active.</p>
      <a href="${EMAIL_CONFIG.baseUrl}${paymentUrl}" style="background-color: #dc3545; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
        Update Payment Method
      </a>
      <p>This was attempt ${retryAttempts} of ${maxRetryAttempts}. If the payment fails on the final attempt, your subscription will be cancelled.</p>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'payment_failed',
    priority: 'high',
    tags: [{ name: 'community', value: communityName }]
  });
};

/**
 * Subscription cancelled email template
 */
export const sendSubscriptionCancelledEmail = async (
  email: string,
  data: {
    adminName: string;
    communityName: string;
    cancellationDate: Date;
    accessEndDate: Date;
  }
) => {
  const { adminName, communityName, cancellationDate, accessEndDate } = data;
  const subject = `Your subscription for ${communityName} has been cancelled`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hi ${adminName},</h2>
      <p>Your subscription for "${communityName}" was cancelled on ${cancellationDate.toDateString()}.</p>
      <p>You will continue to have access to the community until ${accessEndDate.toDateString()}. After this date, your community will be suspended.</p>
      <p>You can reactivate your subscription any time before the access ends to avoid service interruption.</p>
      <p>We're sorry to see you go!</p>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'subscription_cancelled',
    tags: [{ name: 'community', value: communityName }]
  });
};

/**
 * Trial welcome email template
 */
export const sendTrialWelcomeEmail = async (
  email: string,
  data: {
    userName: string;
    communityName?: string;
    trialType: string;
    trialEndDate: Date;
    paymentUrl: string;
  }
) => {
  const { userName, communityName, trialType, trialEndDate, paymentUrl } = data;
  const subject = `Welcome to your ${EMAIL_CONFIG.appName} ${trialType} trial!`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome, ${userName}!</h2>
      <p>You've started a ${trialType} trial${communityName ? ` for "${communityName}"` : ''} on ${EMAIL_CONFIG.appName}.</p>
      <p>Your trial will end on ${trialEndDate.toDateString()}.</p>
      <p>Explore all the features and see how ${EMAIL_CONFIG.appName} can help you build and manage your community.</p>
      ${paymentUrl ? `<p>When you're ready to subscribe, you can manage your subscription here:</p>
      <a href="${EMAIL_CONFIG.baseUrl}${paymentUrl}" style="background-color: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
        Manage Subscription
      </a>` : ''}
      <p>Enjoy your trial!</p>
      <p>Thanks,<br/>The ${EMAIL_CONFIG.appName} Team</p>
    </div>
  `;

  return await EmailQueue.addJob({
    to: email,
    subject,
    html,
    category: 'trial_welcome',
    tags: communityName ? [{ name: 'community', value: communityName }] : []
  });
};

/**
 * Generates a secure random token for email verification.
 */
export const generateVerificationToken = (): string => {
  return randomBytes(32).toString('hex');
};
