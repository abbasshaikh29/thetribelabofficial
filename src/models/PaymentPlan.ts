import mongoose, { Schema, model, models } from "mongoose";

export interface ICommunitySubscriptionPlan {
  _id?: mongoose.Types.ObjectId;
  name: string; // "Community Management Plan"
  description?: string;
  amount: number; // Price in paise (e.g., 240000 = ₹2,400 for $29/month)
  currency: string; // Always "INR"
  interval: "monthly"; // Only monthly subscriptions
  intervalCount: number; // Always 1
  trialPeriodDays: number; // Always 14 days
  features: string[]; // Unlimited features list
  isActive: boolean;
  razorpayPlanId: string; // Required for Razorpay integration
  // Feature flags for different plan tiers
  allowCustomBranding: boolean;
  prioritySupport: boolean;
  analyticsAccess: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  whitelabelOptions: boolean;
  dedicatedSupport: boolean;
  customIntegrations: boolean;
  // Legacy unlimited fields (kept for backward compatibility)
  unlimitedMembers: boolean; // Always true
  unlimitedStorage: boolean; // Always true
  unlimitedEvents: boolean; // Always true
  unlimitedChannels: boolean; // Always true
  basicAnalytics: boolean; // Always true
  emailSupport: boolean; // Always true
  createdAt: Date;
  updatedAt?: Date;
}

const communitySubscriptionPlanSchema = new Schema<ICommunitySubscriptionPlan>(
  {
    name: { type: String, required: true },
    description: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    interval: {
      type: String,
      enum: ["monthly"],
      default: "monthly",
      required: true
    },
    intervalCount: { type: Number, default: 1, required: true },
    trialPeriodDays: { type: Number, default: 14, required: true }, // 14-day trial
    features: [{
      type: String,
      default: [
        "Unlimited members",
        "Unlimited storage",
        "Unlimited events",
        "Unlimited channels",
        "Basic analytics",
        "Email support"
      ]
    }],
    isActive: { type: Boolean, default: true },
    razorpayPlanId: { type: String, required: true },
    // Feature flags for different plan tiers
    allowCustomBranding: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    analyticsAccess: { type: Boolean, default: true },
    advancedAnalytics: { type: Boolean, default: false },
    apiAccess: { type: Boolean, default: false },
    whitelabelOptions: { type: Boolean, default: false },
    dedicatedSupport: { type: Boolean, default: false },
    customIntegrations: { type: Boolean, default: false },
    // Legacy unlimited fields (kept for backward compatibility)
    unlimitedMembers: { type: Boolean, default: true },
    unlimitedStorage: { type: Boolean, default: true },
    unlimitedEvents: { type: Boolean, default: true },
    unlimitedChannels: { type: Boolean, default: true },
    basicAnalytics: { type: Boolean, default: true },
    emailSupport: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

// Add indexes after schema creation
communitySubscriptionPlanSchema.index({ interval: 1, isActive: 1 });
communitySubscriptionPlanSchema.index({ amount: 1 });
communitySubscriptionPlanSchema.index({ razorpayPlanId: 1 });

export const CommunitySubscriptionPlan = models.CommunitySubscriptionPlan ||
  model<ICommunitySubscriptionPlan>("CommunitySubscriptionPlan", communitySubscriptionPlanSchema);
