import mongoose, { Schema, model, models } from "mongoose";

export interface ICommunitySubscription {
  _id?: mongoose.Types.ObjectId;
  razorpaySubscriptionId: string;
  razorpayPlanId: string;
  razorpayCustomerId: string;
  adminId: string; // Community admin user ID
  communityId: mongoose.Types.ObjectId;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired";
  currentStart: Date;
  currentEnd: Date;
  endedAt?: Date;
  chargeAt: Date;
  startAt?: Date;
  endAt?: Date;
  authAttempts: number;
  totalCount: number;
  paidCount: number;
  customerNotify: boolean;
  quantity: number;
  notes?: Record<string, string>;
  // Standardized billing details - $29/month processed as ₹2,400
  amount: number; // Always 240000 (₹2,400 in paise)
  currency: string; // Always "INR"
  interval: "monthly"; // Only monthly subscriptions
  intervalCount: number; // Always 1
  // Trial and retry logic
  trialEndDate?: Date;
  retryAttempts: number;
  maxRetryAttempts: number;
  nextRetryAt?: Date;
  lastRetryAt?: Date;
  // Webhook tracking
  lastWebhookAt?: Date;
  webhookEvents: Array<{
    event: string;
    receivedAt: Date;
    processed: boolean;
    data?: any;
  }>;
  // Payment failures
  failureReason?: string;
  lastFailureAt?: Date;
  consecutiveFailures: number;
  // Notifications
  notificationsSent: Array<{
    type: "renewal_reminder" | "payment_failed" | "subscription_cancelled" | "payment_retry";
    sentAt: Date;
    channel: "email" | "sms" | "push";
  }>;
  // Trial reminder tracking
  trialReminders: Array<{
    daysRemaining: number;
    sentAt: Date;
    emailSent: boolean;
    inAppSent: boolean;
    metadata?: Record<string, any>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const communitySubscriptionSchema = new Schema<ICommunitySubscription>(
  {
    razorpaySubscriptionId: {
      type: String,
      required: true,
      unique: true
    },
    razorpayPlanId: {
      type: String,
      required: true
    },
    razorpayCustomerId: {
      type: String,
      required: true
    },
    adminId: {
      type: String,
      ref: "User",
      required: true
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: true
    },
    status: {
      type: String,
      enum: ["created", "authenticated", "active", "pending", "halted", "cancelled", "completed", "expired"],
      default: "created"
    },
    currentStart: { type: Date, required: true },
    currentEnd: { type: Date, required: true },
    endedAt: { type: Date },
    chargeAt: { type: Date, required: true },
    startAt: { type: Date },
    endAt: { type: Date },
    authAttempts: { type: Number, default: 0 },
    totalCount: { type: Number, required: true },
    paidCount: { type: Number, default: 0 },
    customerNotify: { type: Boolean, default: true },
    quantity: { type: Number, default: 1 },
    notes: { type: Map, of: String },
    // Standardized billing details - $29/month processed as ₹2,400
    amount: { type: Number, required: true, default: 240000 }, // ₹2,400 in paise
    currency: { type: String, default: "INR", required: true },
    interval: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
      required: true
    },
    intervalCount: { type: Number, default: 1, required: true },
    // Trial and retry logic
    trialEndDate: { type: Date },
    retryAttempts: { type: Number, default: 0 },
    maxRetryAttempts: { type: Number, default: 3 },
    nextRetryAt: { type: Date },
    lastRetryAt: { type: Date },
    // Webhook tracking
    lastWebhookAt: { type: Date },
    webhookEvents: [{
      event: { type: String, required: true },
      receivedAt: { type: Date, default: Date.now },
      processed: { type: Boolean, default: false },
      data: { type: Schema.Types.Mixed }
    }],
    // Payment failures
    failureReason: { type: String },
    lastFailureAt: { type: Date },
    consecutiveFailures: { type: Number, default: 0 },
    // Notifications
    notificationsSent: [{
      type: {
        type: String,
        enum: ["renewal_reminder", "payment_failed", "subscription_cancelled", "payment_retry"],
        required: true
      },
      sentAt: { type: Date, default: Date.now },
      channel: {
        type: String,
        enum: ["email", "sms", "push"],
        required: true
      }
    }],
    // Trial reminder tracking
    trialReminders: [{
      daysRemaining: { type: Number, required: true },
      sentAt: { type: Date, default: Date.now },
      emailSent: { type: Boolean, default: false },
      inAppSent: { type: Boolean, default: false },
      metadata: { type: Schema.Types.Mixed }
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for efficient queries
communitySubscriptionSchema.index({ adminId: 1, status: 1 });
communitySubscriptionSchema.index({ chargeAt: 1, status: 1 });
communitySubscriptionSchema.index({ nextRetryAt: 1, status: 1 });

export const CommunitySubscription = models.CommunitySubscription || model<ICommunitySubscription>("CommunitySubscription", communitySubscriptionSchema);

// Keep legacy export for backward compatibility during migration
export const Subscription = CommunitySubscription;
