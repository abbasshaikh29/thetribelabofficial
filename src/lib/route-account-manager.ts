import { RouteAccount, IRouteAccount, IBankDetails, IKycDetails } from '@/models/RouteAccount';
import { User } from '@/models/User';
import { razorpayRoute, IRouteAccountRequest, IRouteAccountResponse } from './razorpay-route';
import mongoose from 'mongoose';

export interface ICreateRouteAccountData {
  adminId: mongoose.Types.ObjectId;
  bankDetails: IBankDetails;
  kycDetails: IKycDetails;
  email: string;
  phone: string;
}

export interface IRouteAccountStatus {
  isReady: boolean;
  status: string;
  kycStatus: string;
  missingRequirements: string[];
  canReceivePayouts: boolean;
}

export class RouteAccountManager {
  /**
   * Create a new Route account for an admin
   */
  static async createRouteAccount(data: ICreateRouteAccountData): Promise<IRouteAccount> {
    try {
      // Validate admin exists
      const admin = await User.findById(data.adminId);
      if (!admin) {
        throw new Error('Admin user not found');
      }

      // Check if Route account already exists
      const existingAccount = await RouteAccount.findOne({ adminId: data.adminId });
      if (existingAccount) {
        throw new Error('Route account already exists for this admin');
      }

      // Validate bank details
      this.validateBankDetails(data.bankDetails);
      
      // Validate KYC details
      this.validateKycDetails(data.kycDetails);

      // Create Route account in database first
      const routeAccount = new RouteAccount({
        adminId: data.adminId,
        bankDetails: data.bankDetails,
        kycDetails: data.kycDetails,
        status: 'pending',
        kycStatus: 'not_submitted',
        settlementSchedule: 'daily',
        minimumPayoutAmount: 100000, // ₹1,000 in paise
        totalPayoutsReceived: 0,
        totalPayoutsCount: 0,
        errorCount: 0
      });

      await routeAccount.save();

      // Prepare Razorpay Route account creation request
      const routeAccountRequest: IRouteAccountRequest = {
        email: data.email,
        phone: data.phone,
        type: 'route',
        reference_id: data.adminId.toString(),
        legal_business_name: data.kycDetails.businessName || admin.name || admin.username,
        business_type: data.kycDetails.businessType,
        contact_name: admin.name || admin.username,
        profile: {
          category: 'education',
          subcategory: 'online_education'
        },
        legal_info: {
          pan: data.kycDetails.panNumber,
          gst: data.kycDetails.gstNumber
        },
        notes: {
          admin_id: data.adminId.toString(),
          created_by: 'thetribelab_platform'
        }
      };

      try {
        // Create Route account with Razorpay
        const razorpayAccount = await razorpayRoute.createAccount(routeAccountRequest);

        // Update local record with Razorpay account ID
        routeAccount.routeAccountId = razorpayAccount.id;
        routeAccount.status = 'under_review';
        routeAccount.kycStatus = 'submitted';
        
        await routeAccount.save();

        return routeAccount;
      } catch (razorpayError: any) {
        // If Razorpay creation fails, update local record with error
        await routeAccount.recordError(`Razorpay account creation failed: ${razorpayError.message}`);
        throw new Error(`Failed to create Razorpay Route account: ${razorpayError.message}`);
      }
    } catch (error: any) {
      console.error('Route account creation error:', error);
      throw error;
    }
  }

  /**
   * Update Route account status from Razorpay
   */
  static async syncAccountStatus(adminId: mongoose.Types.ObjectId): Promise<IRouteAccount | null> {
    try {
      const routeAccount = await RouteAccount.findOne({ adminId });
      if (!routeAccount || !routeAccount.routeAccountId) {
        return null;
      }

      // Fetch latest status from Razorpay
      const razorpayAccount = await razorpayRoute.getAccount(routeAccount.routeAccountId);

      // Update local status based on Razorpay status
      const previousStatus = routeAccount.status;
      routeAccount.status = this.mapRazorpayStatus(razorpayAccount.status);
      
      // Update KYC status if account is activated
      if (razorpayAccount.status === 'activated') {
        routeAccount.kycStatus = 'verified';
        if (!routeAccount.activatedAt) {
          routeAccount.activatedAt = new Date();
        }
      }

      // Log status change
      if (previousStatus !== routeAccount.status) {
        console.log(`Route account ${routeAccount.routeAccountId} status changed: ${previousStatus} -> ${routeAccount.status}`);
      }

      await routeAccount.save();
      return routeAccount;
    } catch (error: any) {
      console.error('Failed to sync Route account status:', error);
      throw error;
    }
  }

  /**
   * Get Route account status and readiness
   */
  static async getAccountStatus(adminId: mongoose.Types.ObjectId): Promise<IRouteAccountStatus> {
    const routeAccount = await RouteAccount.findOne({ adminId });
    
    if (!routeAccount) {
      return {
        isReady: false,
        status: 'not_created',
        kycStatus: 'not_submitted',
        missingRequirements: ['Route account not created'],
        canReceivePayouts: false
      };
    }

    const missingRequirements: string[] = [];
    
    // Check account status
    if (routeAccount.status !== 'activated') {
      missingRequirements.push('Account not activated');
    }
    
    // Check KYC status
    if (routeAccount.kycStatus !== 'verified') {
      missingRequirements.push('KYC verification pending');
    }
    
    // Check if Razorpay account ID exists
    if (!routeAccount.routeAccountId) {
      missingRequirements.push('Razorpay Route account not created');
    }

    const isReady = missingRequirements.length === 0;
    const canReceivePayouts = isReady && routeAccount.status === 'activated';

    return {
      isReady,
      status: routeAccount.status,
      kycStatus: routeAccount.kycStatus,
      missingRequirements,
      canReceivePayouts
    };
  }

  /**
   * Update bank details for Route account
   */
  static async updateBankDetails(
    adminId: mongoose.Types.ObjectId,
    bankDetails: IBankDetails
  ): Promise<IRouteAccount> {
    this.validateBankDetails(bankDetails);

    const routeAccount = await RouteAccount.findOne({ adminId });
    if (!routeAccount) {
      throw new Error('Route account not found');
    }

    routeAccount.bankDetails = bankDetails;
    
    // Reset status if account was previously rejected due to bank details
    if (routeAccount.status === 'rejected') {
      routeAccount.status = 'pending';
      routeAccount.kycStatus = 'not_submitted';
    }

    await routeAccount.save();
    return routeAccount;
  }

  /**
   * Update KYC details for Route account
   */
  static async updateKycDetails(
    adminId: mongoose.Types.ObjectId,
    kycDetails: IKycDetails
  ): Promise<IRouteAccount> {
    this.validateKycDetails(kycDetails);

    const routeAccount = await RouteAccount.findOne({ adminId });
    if (!routeAccount) {
      throw new Error('Route account not found');
    }

    routeAccount.kycDetails = kycDetails;
    
    // Update KYC status
    if (routeAccount.kycStatus === 'not_submitted') {
      routeAccount.kycStatus = 'submitted';
    }

    await routeAccount.save();
    return routeAccount;
  }

  /**
   * Get all Route accounts that need status sync
   */
  static async getAccountsNeedingSync(): Promise<IRouteAccount[]> {
    return RouteAccount.find({
      routeAccountId: { $exists: true, $ne: null },
      status: { $in: ['pending', 'under_review'] },
      updatedAt: { $lt: new Date(Date.now() - 60 * 60 * 1000) } // Not updated in last hour
    });
  }

  /**
   * Validate bank details
   */
  private static validateBankDetails(bankDetails: IBankDetails): void {
    if (!bankDetails.accountNumber || !/^[0-9]{9,18}$/.test(bankDetails.accountNumber)) {
      throw new Error('Invalid bank account number');
    }

    if (!bankDetails.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode)) {
      throw new Error('Invalid IFSC code');
    }

    if (!bankDetails.accountHolderName || bankDetails.accountHolderName.trim().length < 2) {
      throw new Error('Invalid account holder name');
    }
  }

  /**
   * Validate KYC details
   */
  private static validateKycDetails(kycDetails: IKycDetails): void {
    if (!kycDetails.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(kycDetails.panNumber)) {
      throw new Error('Invalid PAN number');
    }

    if (!kycDetails.businessType) {
      throw new Error('Business type is required');
    }

    if (kycDetails.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(kycDetails.gstNumber)) {
      throw new Error('Invalid GST number');
    }
  }

  /**
   * Map Razorpay account status to our internal status
   */
  private static mapRazorpayStatus(razorpayStatus: string): 'pending' | 'under_review' | 'activated' | 'suspended' | 'rejected' {
    switch (razorpayStatus) {
      case 'created':
        return 'under_review';
      case 'activated':
        return 'activated';
      case 'suspended':
        return 'suspended';
      case 'rejected':
        return 'rejected';
      default:
        return 'pending';
    }
  }

  /**
   * Get Route account by admin ID
   */
  static async getRouteAccount(adminId: mongoose.Types.ObjectId): Promise<IRouteAccount | null> {
    return RouteAccount.findOne({ adminId });
  }

  /**
   * Check if admin can receive payouts
   */
  static async canReceivePayouts(adminId: mongoose.Types.ObjectId): Promise<boolean> {
    const status = await this.getAccountStatus(adminId);
    return status.canReceivePayouts;
  }
}
