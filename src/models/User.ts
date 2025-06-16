import mongoose, { Schema, model, models } from "mongoose";
import bcrypt from "bcryptjs";
import slugify from "slugify";

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface MessagingPreferences {
  allowDirectMessages: boolean;
  blockedCommunities: string[]; // Array of community IDs where messaging is blocked
}

interface PaymentSettings {
  subscriptionStatus?: string;
  subscriptionEndDate?: Date;
}

interface CommunityAdminSubscription {
  razorpayCustomerId?: string;
  // Community admin subscription management
  adminSubscriptions: Array<{
    communityId: mongoose.Types.ObjectId;
    subscriptionId: string; // Razorpay subscription ID
    subscriptionStatus: "trial" | "active" | "past_due" | "cancelled" | "expired";
    planId: mongoose.Types.ObjectId;
    subscriptionStartDate: Date;
    subscriptionEndDate: Date;
    trialEndDate?: Date;
    retryAttempts: number;
    lastRetryDate?: Date;
    nextRetryDate?: Date;
    isActive: boolean;
  }>;
  // Payment failure tracking
  totalFailedPayments: number;
  lastPaymentFailure?: Date;
  // Billing notifications
  notificationPreferences: {
    renewalReminders: boolean;
    paymentFailures: boolean;
    trialExpiry: boolean;
  };
}

export interface IUser {
  _id: mongoose.Types.ObjectId;
  username: string;
  name?: string;
  email: string;
  password?: string;
  provider?: string;
  providerId?: string;
  providerType?: string;
  slug?: string;
  createdAt: Date;
  firstName?: string;
  lastName?: string;
  bio?: string;
  timezone?: string;
  notificationSettings?: NotificationSettings;
  messagingPreferences?: MessagingPreferences;
  paymentSettings?: PaymentSettings;
  communityAdminSubscription?: CommunityAdminSubscription;
  community: mongoose.Types.ObjectId[];
  followedBy: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  profileImage?: string;
  emailVerified?: boolean;
  verificationToken?: string;
  verificationTokenExpiry?: Date;
  role?: "user" | "admin" | "platform_admin";
  // Gamification fields
  points?: number;
  level?: number;
  monthlyPoints?: number; // Points earned in current month
  lastPointsReset?: Date; // Last time monthly points were reset
}

const userSchema = new mongoose.Schema<IUser>(
  {
    _id: { type: Schema.Types.ObjectId, auto: true },
    username: { type: String, required: true, unique: true },
    name: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    provider: { type: String },
    providerId: { type: String },
    providerType: { type: String },
    slug: { type: String, unique: true, sparse: true },
    createdAt: { type: Date, default: Date.now },
    firstName: { type: String },
    lastName: { type: String },
    bio: { type: String },
    timezone: { type: String },
    notificationSettings: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    messagingPreferences: {
      allowDirectMessages: { type: Boolean, default: true },
      blockedCommunities: [{ type: String }],
    },
    communityAdminSubscription: {
      razorpayCustomerId: { type: String },
      adminSubscriptions: [{
        communityId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Community",
          required: true
        },
        subscriptionId: { type: String, required: true },
        subscriptionStatus: {
          type: String,
          enum: ["trial", "active", "past_due", "cancelled", "expired"],
          default: "trial"
        },
        planId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CommunitySubscriptionPlan",
          required: true
        },
        subscriptionStartDate: { type: Date, default: Date.now },
        subscriptionEndDate: { type: Date },
        trialEndDate: { type: Date },
        retryAttempts: { type: Number, default: 0 },
        lastRetryDate: { type: Date },
        nextRetryDate: { type: Date },
        isActive: { type: Boolean, default: true }
      }],
      totalFailedPayments: { type: Number, default: 0 },
      lastPaymentFailure: { type: Date },
      notificationPreferences: {
        renewalReminders: { type: Boolean, default: true },
        paymentFailures: { type: Boolean, default: true },
        trialExpiry: { type: Boolean, default: true }
      }
    },
    community: [{ type: Schema.Types.ObjectId, ref: "Community" }],
    followedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }],
    profileImage: { type: String },
    emailVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationTokenExpiry: { type: Date },
    role: {
      type: String,
      enum: ["user", "admin", "platform_admin"],
      default: "user",
    },
    // Gamification fields
    points: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    monthlyPoints: { type: Number, default: 0 },
    lastPointsReset: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (this.isModified("username")) {
    (this as any).slug = slugify((this as any).username, { lower: true, strict: true });
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (this.isModified("password") && (this as any).password) {
    if (!(this as any).password.startsWith("$2b$")) {
      (this as any).password = await bcrypt.hash((this as any).password, 10);
    }
  }
  next();
});

userSchema.index(
  { providerId: 1, providerType: 1 },
  { unique: true, sparse: true }
);
export const User = models.User || model<IUser>("User", userSchema);
