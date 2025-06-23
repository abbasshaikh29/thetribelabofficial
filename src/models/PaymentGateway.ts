import mongoose, { Schema, model, models } from "mongoose";

// Interface describing the shape of the credentials object.
// Different providers may store different fields, so we keep it flexible.
export interface PaymentGatewayCredentials {
  apiKey: string;
  secretKey: string;
  [key: string]: any; // Additional provider-specific keys
}

export interface IPaymentGateway {
  _id?: mongoose.Types.ObjectId;
  /** The payment provider's name (e.g. 'stripe', 'razorpay'). */
  name: "stripe" | "razorpay";
  /** Whether this gateway is currently enabled for use on the platform. */
  isEnabled: boolean;
  /** Encrypted credentials required to communicate with the provider's API. */
  credentials: PaymentGatewayCredentials;
  createdAt?: Date;
  updatedAt?: Date;
  /** Reference to the user who owns this gateway configuration */
  ownerId: mongoose.Types.ObjectId;
}

const paymentGatewaySchema = new Schema<IPaymentGateway>(
  {
    name: {
      type: String,
      enum: ["stripe", "razorpay"],
      required: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    // Storing credentials as a mixed object keeps the schema flexible across providers.
    credentials: {
      type: Schema.Types.Mixed,
      required: true,
    },
    // Reference to the user who owns this gateway configuration
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent model recompilation in development with Hot Module Replacement (HMR)
export const PaymentGateway =
  models.PaymentGateway || model<IPaymentGateway>("PaymentGateway", paymentGatewaySchema); 