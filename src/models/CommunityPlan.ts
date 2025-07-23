import mongoose, { Schema, model, models } from "mongoose";

export interface ICommunityPlan {
  _id?: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // Reference to User (admin)
  communityId: mongoose.Types.ObjectId; // Reference to Community
  
  // Plan Details
  name: string; // e.g., "Basic Membership", "Premium Access"
  description?: string;
  
  // Pricing Information
  amount: number; // Price in paise (e.g., 50000 = ₹500)
  currency: string; // "INR"
  interval: "monthly" | "yearly" | "one_time";
  intervalCount: number; // Default 1 (every 1 month/year)
  
  // Razorpay Integration
  razorpayPlanId?: string; // Razorpay plan ID for subscriptions
  razorpayItemId?: string; // Razorpay item ID for one-time payments
  
  // Plan Features
  features: string[]; // List of features included in this plan
  maxMembers?: number; // Maximum members allowed (null = unlimited)
  accessLevel: "basic" | "premium" | "vip"; // Access level for community features
  
  // Trial Settings
  trialPeriodDays: number; // Trial period in days (0 = no trial)
  
  // Plan Status
  isActive: boolean;
  isDefault: boolean; // Whether this is the default plan for the community
  
  // Visibility Settings
  isPublic: boolean; // Whether plan is visible to public
  requiresApproval: boolean; // Whether admin approval is needed after payment
  
  // Subscription Management
  allowCancellation: boolean;
  allowUpgrade: boolean;
  allowDowngrade: boolean;
  
  // Member Limits and Quotas
  quotas?: {
    postsPerMonth?: number;
    eventsPerMonth?: number;
    storageLimit?: number; // In MB
    downloadLimit?: number; // Downloads per month
  };
  
  // Billing Settings
  setupFee?: number; // One-time setup fee in paise
  cancellationFee?: number; // Fee for early cancellation in paise
  
  // Analytics
  totalSubscribers: number; // Current active subscribers
  totalRevenue: number; // Total revenue generated (in paise)
  conversionRate: number; // Percentage of viewers who subscribe
  
  // Metadata
  tags?: string[]; // Tags for categorization
  notes?: string; // Admin notes
  createdAt: Date;
  updatedAt: Date;
}

const communityPlanSchema = new Schema<ICommunityPlan>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      required: true
    },
    
    // Plan Details
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500
    },
    
    // Pricing Information
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      uppercase: true
    },
    interval: {
      type: String,
      enum: ["monthly", "yearly", "one_time"],
      required: true,
      default: "monthly"
    },
    intervalCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    
    // Razorpay Integration
    razorpayPlanId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    razorpayItemId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    
    // Plan Features
    features: [{
      type: String,
      trim: true,
      maxlength: 200
    }],
    maxMembers: {
      type: Number,
      min: 1
    },
    accessLevel: {
      type: String,
      enum: ["basic", "premium", "vip"],
      default: "basic",
      required: true
    },
    
    // Trial Settings
    trialPeriodDays: {
      type: Number,
      default: 0,
      min: 0,
      max: 365
    },
    
    // Plan Status
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // Visibility Settings
    isPublic: {
      type: Boolean,
      default: true
    },
    requiresApproval: {
      type: Boolean,
      default: false
    },
    
    // Subscription Management
    allowCancellation: {
      type: Boolean,
      default: true
    },
    allowUpgrade: {
      type: Boolean,
      default: true
    },
    allowDowngrade: {
      type: Boolean,
      default: false
    },
    
    // Member Limits and Quotas
    quotas: {
      postsPerMonth: {
        type: Number,
        min: 0
      },
      eventsPerMonth: {
        type: Number,
        min: 0
      },
      storageLimit: {
        type: Number,
        min: 0
      },
      downloadLimit: {
        type: Number,
        min: 0
      }
    },
    
    // Billing Settings
    setupFee: {
      type: Number,
      default: 0,
      min: 0
    },
    cancellationFee: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Analytics
    totalSubscribers: {
      type: Number,
      default: 0,
      min: 0
    },
    totalRevenue: {
      type: Number,
      default: 0,
      min: 0
    },
    conversionRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    
    // Metadata
    tags: [{
      type: String,
      trim: true,
      maxlength: 50
    }],
    notes: {
      type: String,
      maxlength: 1000
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for better query performance
communityPlanSchema.index({ communityId: 1, isActive: 1 });
communityPlanSchema.index({ adminId: 1, isActive: 1 });
communityPlanSchema.index({ amount: 1, interval: 1 });
communityPlanSchema.index({ accessLevel: 1, isActive: 1 });

// Ensure only one default plan per community (this also serves as the communityId + isDefault index)
communityPlanSchema.index(
  { communityId: 1, isDefault: 1 },
  {
    unique: true,
    partialFilterExpression: { isDefault: true }
  }
);

// Virtual for formatted price display
communityPlanSchema.virtual('formattedPrice').get(function() {
  const price = this.amount / 100; // Convert paise to rupees
  return `₹${price.toLocaleString('en-IN')}`;
});

// Virtual for checking if plan has trial
communityPlanSchema.virtual('hasTrial').get(function() {
  return this.trialPeriodDays > 0;
});

// Virtual for total price including setup fee
communityPlanSchema.virtual('totalPrice').get(function() {
  return this.amount + (this.setupFee || 0);
});

// Method to create Razorpay plan
communityPlanSchema.methods.createRazorpayPlan = async function() {
  // This will be implemented in the Razorpay service
  // Returns the created plan ID
};

// Method to update subscriber count
communityPlanSchema.methods.updateSubscriberCount = function(increment: number = 1) {
  this.totalSubscribers = Math.max(0, this.totalSubscribers + increment);
  return this.save();
};

// Method to record revenue
communityPlanSchema.methods.recordRevenue = function(amount: number) {
  this.totalRevenue += amount;
  return this.save();
};

// Method to calculate conversion rate
communityPlanSchema.methods.calculateConversionRate = function(totalViews: number) {
  if (totalViews === 0) return 0;
  this.conversionRate = (this.totalSubscribers / totalViews) * 100;
  return this.save();
};

// Static method to get default plan for community
communityPlanSchema.statics.getDefaultPlan = function(communityId: mongoose.Types.ObjectId) {
  return this.findOne({ communityId, isDefault: true, isActive: true });
};

// Static method to get active plans for community
communityPlanSchema.statics.getActivePlans = function(communityId: mongoose.Types.ObjectId) {
  return this.find({ communityId, isActive: true }).sort({ amount: 1 });
};

// Pre-save middleware to enforce default plan constraints
communityPlanSchema.pre('save', async function(next) {
  // Only run this middleware if isDefault is being set to true
  if (this.isModified('isDefault') && this.isDefault) {
    try {
      // If this plan is being set as default, unset all other default plans for the same community
      // Only do this if we're not in a transaction (to avoid conflicts with our transaction logic)
      if (!this.$session()) {
        await (this.constructor as any).updateMany(
          {
            communityId: this.communityId,
            adminId: this.adminId,
            _id: { $ne: this._id },
            isDefault: true
          },
          { isDefault: false }
        );
      }
    } catch (error) {
      console.error('Error in CommunityPlan pre-save middleware:', error);
      // Don't fail the save operation, just log the error
      // The transaction logic in the API routes should handle this
    }
  }
  next();
});

// Pre-update middleware to enforce default plan constraints for findOneAndUpdate operations
communityPlanSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], async function(next) {
  const update = this.getUpdate() as any;

  // Check if isDefault is being set to true
  if (update && (update.isDefault === true || (update.$set && update.$set.isDefault === true))) {
    try {
      // Get the document being updated to find its communityId and adminId
      const docToUpdate = await this.model.findOne(this.getQuery());

      if (docToUpdate && !this.getOptions().session) {
        // If not in a transaction, unset other default plans
        await this.model.updateMany(
          {
            communityId: docToUpdate.communityId,
            adminId: docToUpdate.adminId,
            _id: { $ne: docToUpdate._id },
            isDefault: true
          },
          { isDefault: false }
        );
      }
    } catch (error) {
      console.error('Error in CommunityPlan pre-update middleware:', error);
      // Don't fail the update operation, just log the error
    }
  }
  next();
});

export const CommunityPlan =
  models.CommunityPlan || model<ICommunityPlan>("CommunityPlan", communityPlanSchema);
