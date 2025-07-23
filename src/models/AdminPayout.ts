import mongoose, { Schema, model, models } from "mongoose";

export interface IFeeBreakdown {
  grossAmount: number; // Total member payment (in paise)
  platformFeeRate: number; // Platform fee percentage (e.g., 5.0 for 5%)
  platformFeeAmount: number; // Platform fee deducted (in paise)
  processingFeeAmount: number; // Razorpay processing fee (in paise)
  netAmount: number; // Amount transferred to admin (in paise)
}

export interface IAdminPayout {
  _id?: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // Reference to User (admin)
  routeAccountId: string; // Razorpay Route account ID
  
  // Transfer Details
  razorpayTransferId?: string; // Razorpay transfer ID
  razorpayPaymentId?: string; // Original payment ID that triggered this payout
  
  // Amount Information
  feeBreakdown: IFeeBreakdown;
  
  // Transfer Status
  status: "pending" | "queued" | "processing" | "processed" | "failed" | "reversed";
  
  // Source Information
  sourceType: "member_subscription" | "one_time_payment" | "manual_transfer";
  sourceTransactionId?: mongoose.Types.ObjectId; // Reference to original transaction
  memberId?: mongoose.Types.ObjectId; // Member who made the payment
  communityId?: mongoose.Types.ObjectId; // Community for which payment was made
  
  // Timing Information
  paymentReceivedAt: Date; // When the original payment was received
  transferInitiatedAt?: Date; // When the transfer was initiated
  transferCompletedAt?: Date; // When the transfer was completed
  
  // Batch Information (for bulk transfers)
  batchId?: string; // For grouping multiple transfers
  isBatchTransfer: boolean;
  
  // Error Handling
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
  
  // Settlement Information
  settlementId?: string; // Razorpay settlement ID
  settlementDate?: Date;
  settlementStatus?: "pending" | "settled" | "failed";
  
  // Reconciliation
  isReconciled: boolean;
  reconciledAt?: Date;
  reconciledBy?: mongoose.Types.ObjectId; // Admin user who reconciled
  
  // Platform Fee Deduction Tracking
  platformFeeDeducted: boolean;
  platformFeeDeductedAt?: Date;
  platformFeeTransactionId?: mongoose.Types.ObjectId;
  
  // Metadata
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const feeBreakdownSchema = new Schema<IFeeBreakdown>({
  grossAmount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFeeRate: {
    type: Number,
    required: true,
    min: 0,
    max: 100, // Percentage
    default: 5.0 // 5% platform fee
  },
  platformFeeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  processingFeeAmount: {
    type: Number,
    required: true,
    min: 0
  },
  netAmount: {
    type: Number,
    required: true,
    min: 0
  }
});

const adminPayoutSchema = new Schema<IAdminPayout>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    routeAccountId: {
      type: String,
      required: true,
      index: true
    },
    
    // Transfer Details
    razorpayTransferId: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    razorpayPaymentId: {
      type: String,
      index: true
    },
    
    // Amount Information
    feeBreakdown: {
      type: feeBreakdownSchema,
      required: true
    },
    
    // Transfer Status
    status: {
      type: String,
      enum: ["pending", "queued", "processing", "processed", "failed", "reversed"],
      default: "pending",
      required: true,
      index: true
    },
    
    // Source Information
    sourceType: {
      type: String,
      enum: ["member_subscription", "one_time_payment", "manual_transfer"],
      required: true,
      index: true
    },
    sourceTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      index: true
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    communityId: {
      type: Schema.Types.ObjectId,
      ref: "Community",
      index: true
    },
    
    // Timing Information
    paymentReceivedAt: {
      type: Date,
      required: true,
      index: true
    },
    transferInitiatedAt: {
      type: Date,
      index: true
    },
    transferCompletedAt: {
      type: Date,
      index: true
    },
    
    // Batch Information
    batchId: {
      type: String,
      index: true
    },
    isBatchTransfer: {
      type: Boolean,
      default: false
    },
    
    // Error Handling
    failureReason: String,
    retryCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0
    },
    nextRetryAt: Date,
    
    // Settlement Information
    settlementId: String,
    settlementDate: Date,
    settlementStatus: {
      type: String,
      enum: ["pending", "settled", "failed"]
    },
    
    // Reconciliation
    isReconciled: {
      type: Boolean,
      default: false,
      index: true
    },
    reconciledAt: Date,
    reconciledBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    
    // Platform Fee Deduction Tracking
    platformFeeDeducted: {
      type: Boolean,
      default: false,
      index: true
    },
    platformFeeDeductedAt: Date,
    platformFeeTransactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction"
    },
    
    // Metadata
    notes: {
      type: String,
      maxlength: 1000
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for better query performance
adminPayoutSchema.index({ adminId: 1, status: 1 });
adminPayoutSchema.index({ adminId: 1, paymentReceivedAt: -1 });
adminPayoutSchema.index({ status: 1, nextRetryAt: 1 });
adminPayoutSchema.index({ batchId: 1, status: 1 });
adminPayoutSchema.index({ settlementDate: 1, settlementStatus: 1 });
adminPayoutSchema.index({ communityId: 1, paymentReceivedAt: -1 });

// Virtual for checking if payout is overdue
adminPayoutSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'pending') return false;
  
  const hoursSincePayment = (Date.now() - this.paymentReceivedAt.getTime()) / (1000 * 60 * 60);
  return hoursSincePayment > 24; // Consider overdue after 24 hours
});

// Virtual for checking if retry is due
adminPayoutSchema.virtual('isRetryDue').get(function() {
  if (this.status !== 'failed' || !this.nextRetryAt) return false;
  return this.nextRetryAt <= new Date();
});

// Method to calculate fee breakdown
adminPayoutSchema.statics.calculateFeeBreakdown = function(
  grossAmount: number, 
  platformFeeRate: number = 5.0
): IFeeBreakdown {
  const platformFeeAmount = Math.round((grossAmount * platformFeeRate) / 100);
  
  // Razorpay processing fee: 2% + ₹2 (in paise)
  const processingFeeAmount = Math.round((grossAmount * 2) / 100) + 200;
  
  const netAmount = grossAmount - platformFeeAmount - processingFeeAmount;
  
  return {
    grossAmount,
    platformFeeRate,
    platformFeeAmount,
    processingFeeAmount,
    netAmount: Math.max(0, netAmount) // Ensure non-negative
  };
};

// Method to initiate transfer
adminPayoutSchema.methods.initiateTransfer = function() {
  this.status = 'queued';
  this.transferInitiatedAt = new Date();
  return this.save();
};

// Method to mark as processed
adminPayoutSchema.methods.markProcessed = function(transferId: string) {
  this.status = 'processed';
  this.razorpayTransferId = transferId;
  this.transferCompletedAt = new Date();
  return this.save();
};

// Method to mark as failed and schedule retry
adminPayoutSchema.methods.markFailed = function(reason: string) {
  this.status = 'failed';
  this.failureReason = reason;
  this.retryCount += 1;
  
  // Schedule next retry with exponential backoff
  if (this.retryCount <= this.maxRetries) {
    const delayMinutes = Math.pow(2, this.retryCount) * 30; // 30min, 1hr, 2hr
    this.nextRetryAt = new Date(Date.now() + (delayMinutes * 60 * 1000));
  }
  
  return this.save();
};

// Method to reconcile payout
adminPayoutSchema.methods.reconcile = function(reconciledBy: mongoose.Types.ObjectId) {
  this.isReconciled = true;
  this.reconciledAt = new Date();
  this.reconciledBy = reconciledBy;
  return this.save();
};

export const AdminPayout = 
  models.AdminPayout || model<IAdminPayout>("AdminPayout", adminPayoutSchema);
