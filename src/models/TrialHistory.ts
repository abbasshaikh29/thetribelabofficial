import mongoose, { Schema, model, models, Model } from "mongoose";

export interface ITrialHistory {
  _id?: mongoose.Types.ObjectId;
  userId: string; // User who activated the trial
  communityId?: mongoose.Types.ObjectId; // Community for which trial was activated
  trialType: "user" | "community"; // Type of trial
  startDate: Date; // When trial started
  endDate: Date; // When trial ends/ended
  status: "active" | "expired" | "cancelled" | "converted"; // Trial status
  cancelledAt?: Date; // When trial was cancelled
  convertedAt?: Date; // When trial was converted to paid subscription
  ipAddress?: string; // IP address for fraud detection
  userAgent?: string; // User agent for fraud detection
  metadata?: Record<string, any>; // Additional data
  createdAt: Date;
  updatedAt?: Date;
}

// Interface for static methods
export interface ITrialHistoryModel extends Model<ITrialHistory, {}, {}, {}, any, any, any> {
  hasUserUsedTrial(
    userId: string,
    trialType: "user" | "community",
    communityId?: string
  ): Promise<boolean>;

  getActiveTrial(
    userId: string,
    trialType: "user" | "community",
    communityId?: string
  ): Promise<ITrialHistory | null>;
}

const trialHistorySchema = new Schema<ITrialHistory>(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
      index: true,
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      index: true,
    },
    trialType: {
      type: String,
      required: true,
      enum: ["user", "community"],
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["active", "expired", "cancelled", "converted"],
      default: "active",
      index: true,
    },
    cancelledAt: {
      type: Date,
    },
    convertedAt: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true
  }
);

// Add compound indexes for efficient queries
trialHistorySchema.index({ userId: 1, trialType: 1 });
trialHistorySchema.index({ userId: 1, communityId: 1 });
trialHistorySchema.index({ status: 1, endDate: 1 });
trialHistorySchema.index({ createdAt: -1 });

// Compound index to prevent duplicate trials for same user/community
trialHistorySchema.index(
  { userId: 1, communityId: 1, trialType: 1 },
  { 
    unique: true,
    partialFilterExpression: { 
      status: { $in: ["active", "expired", "converted"] } 
    }
  }
);

// Method to check if user has already used a trial
trialHistorySchema.statics.hasUserUsedTrial = async function(
  userId: string, 
  trialType: "user" | "community", 
  communityId?: string
) {
  const query: any = { userId, trialType };
  if (communityId) {
    query.communityId = new mongoose.Types.ObjectId(communityId);
  }
  
  const existingTrial = await this.findOne(query);
  return !!existingTrial;
};

// Method to get active trial for user
trialHistorySchema.statics.getActiveTrial = async function(
  userId: string, 
  trialType: "user" | "community", 
  communityId?: string
) {
  const query: any = { 
    userId, 
    trialType, 
    status: "active",
    endDate: { $gt: new Date() }
  };
  if (communityId) {
    query.communityId = new mongoose.Types.ObjectId(communityId);
  }
  
  return await this.findOne(query);
};

export const TrialHistory =
  models.TrialHistory || model<ITrialHistory, ITrialHistoryModel>("TrialHistory", trialHistorySchema);
