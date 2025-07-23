import mongoose, { Schema, model, models } from "mongoose";

export interface IPlatformSubscription {
  _id?: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // Reference to User (admin)
  
  // Subscription Details
  razorpaySubscriptionId?: string; // Razorpay subscription ID for platform fees
  razorpayCustomerId?: string; // Admin's customer ID for platform billing
  
  // Plan Information
  planType: "starter" | "pro" | "enterprise";
  amount: number; // Monthly fee in paise (₹2,400 = 240000 paise)
  currency: string; // "INR"
  interval: "monthly" | "yearly";
  
  // Subscription Status
  status: "trial" | "active" | "past_due" | "cancelled" | "suspended" | "expired";
  
  // Trial Information
  trialStartDate?: Date;
  trialEndDate?: Date;
  trialDaysRemaining?: number;
  isTrialActive: boolean;
  
  // Billing Periods
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  nextBillingDate: Date;
  
  // Payment Information
  lastPaymentDate?: Date;
  lastPaymentAmount?: number;
  lastPaymentStatus?: "success" | "failed" | "pending";
  
  // Fee Deduction from Earnings
  feeDeductionEnabled: boolean; // Whether to deduct from admin earnings
  pendingFeeAmount: number; // Amount pending to be deducted (in paise)
  totalFeesDeducted: number; // Total fees deducted from earnings (in paise)
  
  // Grace Period Management
  gracePeriodEndDate?: Date;
  isInGracePeriod: boolean;
  gracePeriodDays: number; // Default 7 days
  
  // Payment Failure Tracking
  consecutiveFailures: number;
  lastFailureDate?: Date;
  lastFailureReason?: string;
  maxFailuresAllowed: number; // Default 3
  
  // Suspension Management
  suspendedAt?: Date;
  suspensionReason?: string;
  autoReactivateOnPayment: boolean;
  
  // Billing Preferences
  billingEmail?: string;
  invoiceGeneration: boolean;
  emailNotifications: boolean;
  
  // Usage Tracking (for future tiered pricing)
  monthlyEarnings: number; // Admin's monthly earnings (in paise)
  memberCount: number; // Number of paying members
  transactionCount: number; // Number of transactions processed
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const platformSubscriptionSchema = new Schema<IPlatformSubscription>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One platform subscription per admin
      index: true
    },
    
    // Subscription Details
    razorpaySubscriptionId: {
      type: String,
      unique: true,
      sparse: true
    },
    razorpayCustomerId: {
      type: String,
      sparse: true
    },
    
    // Plan Information
    planType: {
      type: String,
      enum: ["starter", "pro", "enterprise"],
      default: "starter",
      required: true
    },
    amount: {
      type: Number,
      default: 240000, // ₹2,400 in paise
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "INR",
      required: true
    },
    interval: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
      required: true
    },
    
    // Subscription Status
    status: {
      type: String,
      enum: ["trial", "active", "past_due", "cancelled", "suspended", "expired"],
      default: "trial",
      required: true
    },
    
    // Trial Information
    trialStartDate: Date,
    trialEndDate: Date,
    trialDaysRemaining: {
      type: Number,
      min: 0,
      max: 14
    },
    isTrialActive: {
      type: Boolean,
      default: true
    },
    
    // Billing Periods
    currentPeriodStart: {
      type: Date,
      required: true,
      default: Date.now
    },
    currentPeriodEnd: {
      type: Date,
      required: true
    },
    nextBillingDate: {
      type: Date,
      required: true
    },
    
    // Payment Information
    lastPaymentDate: Date,
    lastPaymentAmount: {
      type: Number,
      min: 0
    },
    lastPaymentStatus: {
      type: String,
      enum: ["success", "failed", "pending"]
    },
    
    // Fee Deduction from Earnings
    feeDeductionEnabled: {
      type: Boolean,
      default: true
    },
    pendingFeeAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalFeesDeducted: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Grace Period Management
    gracePeriodEndDate: Date,
    isInGracePeriod: {
      type: Boolean,
      default: false
    },
    gracePeriodDays: {
      type: Number,
      default: 7,
      min: 0,
      max: 30
    },
    
    // Payment Failure Tracking
    consecutiveFailures: {
      type: Number,
      default: 0,
      min: 0
    },
    lastFailureDate: Date,
    lastFailureReason: String,
    maxFailuresAllowed: {
      type: Number,
      default: 3,
      min: 1
    },
    
    // Suspension Management
    suspendedAt: Date,
    suspensionReason: String,
    autoReactivateOnPayment: {
      type: Boolean,
      default: true
    },
    
    // Billing Preferences
    billingEmail: {
      type: String,
      validate: {
        validator: function(v: string) {
          return !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Invalid email format'
      }
    },
    invoiceGeneration: {
      type: Boolean,
      default: true
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    
    // Usage Tracking
    monthlyEarnings: {
      type: Number,
      default: 0,
      min: 0
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0
    },
    transactionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Metadata
    notes: {
      type: String,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
platformSubscriptionSchema.index({ adminId: 1 });
platformSubscriptionSchema.index({ status: 1 });
platformSubscriptionSchema.index({ nextBillingDate: 1 });
platformSubscriptionSchema.index({ trialEndDate: 1 });
platformSubscriptionSchema.index({ isTrialActive: 1 });
platformSubscriptionSchema.index({ gracePeriodEndDate: 1 });
platformSubscriptionSchema.index({ razorpaySubscriptionId: 1 });

// Virtual for checking if subscription is active
platformSubscriptionSchema.virtual('isActive').get(function() {
  return ['trial', 'active'].includes(this.status) && !this.suspendedAt;
});

// Virtual for checking if payment is overdue
platformSubscriptionSchema.virtual('isOverdue').get(function() {
  return this.status === 'past_due' || 
         (this.nextBillingDate < new Date() && this.status !== 'trial');
});

// Method to calculate trial days remaining
platformSubscriptionSchema.methods.calculateTrialDaysRemaining = function() {
  if (!this.isTrialActive || !this.trialEndDate) return 0;
  
  const now = new Date();
  const diffTime = this.trialEndDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
};

// Method to start trial
platformSubscriptionSchema.methods.startTrial = function(durationDays: number = 14) {
  const now = new Date();
  this.trialStartDate = now;
  this.trialEndDate = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));
  this.isTrialActive = true;
  this.status = 'trial';
  this.currentPeriodStart = now;
  this.currentPeriodEnd = this.trialEndDate;
  this.nextBillingDate = this.trialEndDate;
  
  return this.save();
};

// Method to end trial and start billing
platformSubscriptionSchema.methods.convertToActive = function() {
  const now = new Date();
  this.isTrialActive = false;
  this.status = 'active';
  this.currentPeriodStart = now;
  
  // Set next billing date based on interval
  const nextBilling = new Date(now);
  if (this.interval === 'monthly') {
    nextBilling.setMonth(nextBilling.getMonth() + 1);
  } else {
    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
  }
  
  this.currentPeriodEnd = nextBilling;
  this.nextBillingDate = nextBilling;
  
  return this.save();
};

// Method to record payment
platformSubscriptionSchema.methods.recordPayment = function(amount: number, status: string) {
  this.lastPaymentDate = new Date();
  this.lastPaymentAmount = amount;
  this.lastPaymentStatus = status as any;
  
  if (status === 'success') {
    this.consecutiveFailures = 0;
    this.pendingFeeAmount = Math.max(0, this.pendingFeeAmount - amount);
    this.totalFeesDeducted += amount;
    
    // Update billing period
    const now = new Date();
    this.currentPeriodStart = now;
    
    const nextBilling = new Date(now);
    if (this.interval === 'monthly') {
      nextBilling.setMonth(nextBilling.getMonth() + 1);
    } else {
      nextBilling.setFullYear(nextBilling.getFullYear() + 1);
    }
    
    this.currentPeriodEnd = nextBilling;
    this.nextBillingDate = nextBilling;
    this.status = 'active';
    
    // Clear grace period
    this.isInGracePeriod = false;
    this.gracePeriodEndDate = undefined;
  } else {
    this.consecutiveFailures += 1;
    this.lastFailureDate = new Date();
  }
  
  return this.save();
};

// Method to suspend subscription
platformSubscriptionSchema.methods.suspend = function(reason: string) {
  this.status = 'suspended';
  this.suspendedAt = new Date();
  this.suspensionReason = reason;
  
  return this.save();
};

export const PlatformSubscription = 
  models.PlatformSubscription || model<IPlatformSubscription>("PlatformSubscription", platformSubscriptionSchema);
