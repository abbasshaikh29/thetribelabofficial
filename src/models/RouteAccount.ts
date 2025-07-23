import mongoose, { Schema, model, models } from "mongoose";

export interface IBankDetails {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  bankName?: string;
  branchName?: string;
}

export interface IKycDetails {
  panNumber: string;
  panVerified: boolean;
  aadharNumber?: string;
  aadharVerified?: boolean;
  gstNumber?: string;
  businessType: "individual" | "partnership" | "private_limited" | "public_limited" | "llp";
  businessName?: string;
}

export interface IRouteAccount {
  _id?: mongoose.Types.ObjectId;
  adminId: mongoose.Types.ObjectId; // Reference to User (admin)
  routeAccountId?: string; // Razorpay Route account ID
  
  // Bank Details
  bankDetails: IBankDetails;
  
  // KYC Information
  kycDetails: IKycDetails;
  
  // Account Status
  status: "pending" | "under_review" | "activated" | "suspended" | "rejected";
  kycStatus: "not_submitted" | "submitted" | "under_review" | "verified" | "rejected";
  
  // Verification Details
  verificationDocuments?: {
    panCard?: string; // File path or URL
    aadharCard?: string;
    bankStatement?: string;
    businessProof?: string;
  };
  
  // Route Account Settings
  settlementSchedule: "daily" | "weekly" | "monthly";
  minimumPayoutAmount: number; // Minimum amount for payout (in paise)
  
  // Status Tracking
  activatedAt?: Date;
  lastPayoutAt?: Date;
  totalPayoutsReceived: number; // Total amount received (in paise)
  totalPayoutsCount: number; // Number of payouts received
  
  // Error Tracking
  lastError?: string;
  errorCount: number;
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>({
  accountNumber: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^[0-9]{9,18}$/.test(v); // Bank account number validation
      },
      message: 'Invalid bank account number format'
    }
  },
  ifscCode: { 
    type: String, 
    required: true,
    uppercase: true,
    validate: {
      validator: function(v: string) {
        return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v); // IFSC code validation
      },
      message: 'Invalid IFSC code format'
    }
  },
  accountHolderName: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  bankName: { 
    type: String,
    trim: true,
    maxlength: 100
  },
  branchName: { 
    type: String,
    trim: true,
    maxlength: 100
  }
});

const kycDetailsSchema = new Schema<IKycDetails>({
  panNumber: { 
    type: String, 
    required: true,
    uppercase: true,
    validate: {
      validator: function(v: string) {
        return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v); // PAN validation
      },
      message: 'Invalid PAN number format'
    }
  },
  panVerified: { type: Boolean, default: false },
  aadharNumber: { 
    type: String,
    validate: {
      validator: function(v: string) {
        return !v || /^[0-9]{12}$/.test(v); // Aadhar validation (optional)
      },
      message: 'Invalid Aadhar number format'
    }
  },
  aadharVerified: { type: Boolean, default: false },
  gstNumber: { 
    type: String,
    uppercase: true,
    validate: {
      validator: function(v: string) {
        return !v || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
      },
      message: 'Invalid GST number format'
    }
  },
  businessType: {
    type: String,
    enum: ["individual", "partnership", "private_limited", "public_limited", "llp"],
    default: "individual",
    required: true
  },
  businessName: { 
    type: String,
    trim: true,
    maxlength: 200
  }
});

const routeAccountSchema = new Schema<IRouteAccount>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true // One Route account per admin
    },
    routeAccountId: {
      type: String,
      unique: true,
      sparse: true // Allows null values but ensures uniqueness when present
    },
    
    // Bank Details
    bankDetails: {
      type: bankDetailsSchema,
      required: true
    },
    
    // KYC Information
    kycDetails: {
      type: kycDetailsSchema,
      required: true
    },
    
    // Account Status
    status: {
      type: String,
      enum: ["pending", "under_review", "activated", "suspended", "rejected"],
      default: "pending",
      required: true
    },
    kycStatus: {
      type: String,
      enum: ["not_submitted", "submitted", "under_review", "verified", "rejected"],
      default: "not_submitted",
      required: true
    },
    
    // Verification Documents
    verificationDocuments: {
      panCard: String,
      aadharCard: String,
      bankStatement: String,
      businessProof: String
    },
    
    // Route Account Settings
    settlementSchedule: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      default: "daily"
    },
    minimumPayoutAmount: {
      type: Number,
      default: 100000, // ₹1,000 in paise
      min: 10000 // Minimum ₹100
    },
    
    // Status Tracking
    activatedAt: Date,
    lastPayoutAt: Date,
    totalPayoutsReceived: {
      type: Number,
      default: 0,
      min: 0
    },
    totalPayoutsCount: {
      type: Number,
      default: 0,
      min: 0
    },
    
    // Error Tracking
    lastError: String,
    errorCount: {
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
routeAccountSchema.index({ status: 1 });
routeAccountSchema.index({ kycStatus: 1 });
routeAccountSchema.index({ "bankDetails.ifscCode": 1 });
routeAccountSchema.index({ "kycDetails.panNumber": 1 });

// Virtual for checking if account is ready for payouts
routeAccountSchema.virtual('isPayoutReady').get(function() {
  return this.status === 'activated' && 
         this.kycStatus === 'verified' && 
         this.routeAccountId;
});

// Method to update payout statistics
routeAccountSchema.methods.recordPayout = function(amount: number) {
  this.totalPayoutsReceived += amount;
  this.totalPayoutsCount += 1;
  this.lastPayoutAt = new Date();
  return this.save();
};

// Method to record error
routeAccountSchema.methods.recordError = function(error: string) {
  this.lastError = error;
  this.errorCount += 1;
  return this.save();
};

export const RouteAccount = 
  models.RouteAccount || model<IRouteAccount>("RouteAccount", routeAccountSchema);
