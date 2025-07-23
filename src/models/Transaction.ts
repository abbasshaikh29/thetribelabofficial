import mongoose, { Schema, model, models } from "mongoose";

export interface ITransactionFeeBreakdown {
  grossAmount: number; // Total payment amount (in paise)
  platformFeeRate: number; // Platform fee percentage
  platformFeeAmount: number; // Platform fee deducted (in paise)
  processingFeeAmount: number; // Payment gateway fee (in paise)
  adminEarnings: number; // Net amount for admin (in paise)
}

export interface ITransaction {
  _id?: mongoose.Types.ObjectId;
  orderId: string;
  paymentId?: string;
  signature?: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  paymentType: "platform" | "community" | "community_subscription";
  payerId: string; // User who made the payment
  payeeId?: string; // Community admin who received the payment (for community payments)
  communityId?: mongoose.Types.ObjectId; // Related community (for community payments)
  planId?: mongoose.Types.ObjectId; // Related payment plan

  // Enhanced fee tracking for Route-based payments
  feeBreakdown?: ITransactionFeeBreakdown;
  routeTransferId?: string; // Razorpay Route transfer ID
  routePayoutId?: mongoose.Types.ObjectId; // Reference to AdminPayout

  // Platform fee management
  platformFeeCollected: boolean; // Whether platform fee was collected
  platformFeeCollectedAt?: Date;
  platformFeeMethod: "deducted_from_payment" | "deducted_from_earnings" | "direct_charge";

  metadata?: Record<string, any>; // Additional payment data
  createdAt: Date;
  updatedAt?: Date;
}

const feeBreakdownSchema = new Schema<ITransactionFeeBreakdown>({
  grossAmount: { type: Number, required: true, min: 0 },
  platformFeeRate: { type: Number, required: true, min: 0, max: 100 },
  platformFeeAmount: { type: Number, required: true, min: 0 },
  processingFeeAmount: { type: Number, required: true, min: 0 },
  adminEarnings: { type: Number, required: true, min: 0 }
});

const transactionSchema = new Schema<ITransaction>(
  {
    orderId: { type: String, required: true, unique: true },
    paymentId: { type: String, unique: true, sparse: true },
    signature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "INR" },
    status: {
      type: String,
      required: true,
      enum: ["created", "authorized", "captured", "refunded", "failed"],
      default: "created",
    },
    paymentType: {
      type: String,
      required: true,
      enum: ["platform", "community", "community_subscription"],
    },
    payerId: {
      type: String,
      ref: "User",
      required: true,
    },
    payeeId: {
      type: String,
      ref: "User",
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaymentPlan",
    },

    // Enhanced fee tracking
    feeBreakdown: feeBreakdownSchema,
    routeTransferId: { type: String },
    routePayoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminPayout"
    },

    // Platform fee management
    platformFeeCollected: { type: Boolean, default: false },
    platformFeeCollectedAt: Date,
    platformFeeMethod: {
      type: String,
      enum: ["deducted_from_payment", "deducted_from_earnings", "direct_charge"],
      default: "deducted_from_payment"
    },

    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// Create indexes for faster queries
transactionSchema.index({ payerId: 1 });
transactionSchema.index({ payeeId: 1 });
transactionSchema.index({ communityId: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ routeTransferId: 1 });
transactionSchema.index({ platformFeeCollected: 1 });
transactionSchema.index({ paymentType: 1, status: 1 });

export const Transaction =
  models.Transaction || model<ITransaction>("Transaction", transactionSchema);
