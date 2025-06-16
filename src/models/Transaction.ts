import mongoose, { Schema, model, models } from "mongoose";

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
  metadata?: Record<string, any>; // Additional payment data
  createdAt: Date;
  updatedAt?: Date;
}

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

export const Transaction =
  models.Transaction || model<ITransaction>("Transaction", transactionSchema);
