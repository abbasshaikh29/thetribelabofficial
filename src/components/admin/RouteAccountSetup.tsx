"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Building, 
  User, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  ArrowRight,
  Shield,
  Clock
} from 'lucide-react';

interface IBankDetails {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  bankName?: string;
  branchName?: string;
}

interface IKycDetails {
  panNumber: string;
  panVerified: boolean;
  aadharNumber?: string;
  aadharVerified?: boolean;
  gstNumber?: string;
  businessType: "individual" | "partnership" | "private_limited" | "public_limited" | "llp";
  businessName?: string;
}

interface IRouteAccountStatus {
  isReady: boolean;
  status: string;
  kycStatus: string;
  missingRequirements: string[];
  canReceivePayouts: boolean;
}

export default function RouteAccountSetup() {
  const { data: session } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<IRouteAccountStatus | null>(null);

  const [bankDetails, setBankDetails] = useState<IBankDetails>({
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: '',
    branchName: ''
  });

  const [kycDetails, setKycDetails] = useState<IKycDetails>({
    panNumber: '',
    panVerified: false,
    aadharNumber: '',
    aadharVerified: false,
    gstNumber: '',
    businessType: 'individual',
    businessName: ''
  });

  const steps = [
    {
      id: 'bank',
      title: 'Bank Account Details',
      description: 'Enter your bank account information for receiving payments',
      icon: CreditCard
    },
    {
      id: 'kyc',
      title: 'KYC Information',
      description: 'Provide KYC details for account verification',
      icon: Shield
    },
    {
      id: 'review',
      title: 'Review & Submit',
      description: 'Review your information and create Route account',
      icon: CheckCircle
    }
  ];

  useEffect(() => {
    fetchAccountStatus();
  }, []);

  const fetchAccountStatus = async () => {
    try {
      const response = await fetch('/api/admin/route-account/status');
      if (response.ok) {
        const data = await response.json();
        setAccountStatus(data.status);
        
        // If account already exists, show status instead of form
        if (data.status.isReady || data.status.status !== 'not_created') {
          setCurrentStep(3); // Show status step
        }
      }
    } catch (error) {
      console.error('Failed to fetch account status:', error);
    }
  };

  const validateBankDetails = (): boolean => {
    if (!bankDetails.accountNumber || !/^[0-9]{9,18}$/.test(bankDetails.accountNumber)) {
      setError('Please enter a valid bank account number (9-18 digits)');
      return false;
    }

    if (!bankDetails.ifscCode || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankDetails.ifscCode.toUpperCase())) {
      setError('Please enter a valid IFSC code (e.g., SBIN0001234)');
      return false;
    }

    if (!bankDetails.accountHolderName || bankDetails.accountHolderName.trim().length < 2) {
      setError('Please enter a valid account holder name');
      return false;
    }

    return true;
  };

  const validateKycDetails = (): boolean => {
    if (!kycDetails.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(kycDetails.panNumber.toUpperCase())) {
      setError('Please enter a valid PAN number (e.g., ABCDE1234F)');
      return false;
    }

    if (kycDetails.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(kycDetails.gstNumber.toUpperCase())) {
      setError('Please enter a valid GST number or leave it empty');
      return false;
    }

    if (!kycDetails.businessType) {
      setError('Please select a business type');
      return false;
    }

    return true;
  };

  const handleNext = () => {
    setError(null);

    if (currentStep === 0) {
      if (!validateBankDetails()) return;
    } else if (currentStep === 1) {
      if (!validateKycDetails()) return;
    }

    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/route-account/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bankDetails: {
            ...bankDetails,
            ifscCode: bankDetails.ifscCode.toUpperCase()
          },
          kycDetails: {
            ...kycDetails,
            panNumber: kycDetails.panNumber.toUpperCase(),
            gstNumber: kycDetails.gstNumber ? kycDetails.gstNumber.toUpperCase() : undefined
          },
          email: session?.user?.email,
          phone: '9999999999' // You might want to collect this in the form
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create Route account');
      }

      setSuccess('Route account created successfully! Your account is now under review.');
      setCurrentStep(3); // Move to status step
      await fetchAccountStatus();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderBankDetailsStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bank Account Number *
        </label>
        <input
          type="text"
          value={bankDetails.accountNumber}
          onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '') })}
          placeholder="Enter your bank account number"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={18}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          IFSC Code *
        </label>
        <input
          type="text"
          value={bankDetails.ifscCode}
          onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value.toUpperCase() })}
          placeholder="e.g., SBIN0001234"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={11}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Account Holder Name *
        </label>
        <input
          type="text"
          value={bankDetails.accountHolderName}
          onChange={(e) => setBankDetails({ ...bankDetails, accountHolderName: e.target.value })}
          placeholder="Enter account holder name as per bank records"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bank Name (Optional)
          </label>
          <input
            type="text"
            value={bankDetails.bankName}
            onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
            placeholder="e.g., State Bank of India"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch Name (Optional)
          </label>
          <input
            type="text"
            value={bankDetails.branchName}
            onChange={(e) => setBankDetails({ ...bankDetails, branchName: e.target.value })}
            placeholder="e.g., Mumbai Main Branch"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
    </div>
  );

  const renderKycStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          PAN Number *
        </label>
        <input
          type="text"
          value={kycDetails.panNumber}
          onChange={(e) => setKycDetails({ ...kycDetails, panNumber: e.target.value.toUpperCase() })}
          placeholder="e.g., ABCDE1234F"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={10}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Type *
        </label>
        <select
          value={kycDetails.businessType}
          onChange={(e) => setKycDetails({ ...kycDetails, businessType: e.target.value as any })}
          aria-label="Business Type"
          title="Select business type"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="individual">Individual</option>
          <option value="partnership">Partnership</option>
          <option value="private_limited">Private Limited</option>
          <option value="public_limited">Public Limited</option>
          <option value="llp">LLP</option>
        </select>
      </div>

      {kycDetails.businessType !== 'individual' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Name
          </label>
          <input
            type="text"
            value={kycDetails.businessName}
            onChange={(e) => setKycDetails({ ...kycDetails, businessName: e.target.value })}
            placeholder="Enter your business name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          GST Number (Optional)
        </label>
        <input
          type="text"
          value={kycDetails.gstNumber}
          onChange={(e) => setKycDetails({ ...kycDetails, gstNumber: e.target.value.toUpperCase() })}
          placeholder="e.g., 22AAAAA0000A1Z5"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={15}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Aadhar Number (Optional)
        </label>
        <input
          type="text"
          value={kycDetails.aadharNumber}
          onChange={(e) => setKycDetails({ ...kycDetails, aadharNumber: e.target.value.replace(/\D/g, '') })}
          placeholder="Enter 12-digit Aadhar number"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={12}
        />
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Account Details</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">Account Number:</span> {bankDetails.accountNumber}</div>
          <div><span className="font-medium">IFSC Code:</span> {bankDetails.ifscCode}</div>
          <div><span className="font-medium">Account Holder:</span> {bankDetails.accountHolderName}</div>
          {bankDetails.bankName && <div><span className="font-medium">Bank:</span> {bankDetails.bankName}</div>}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">KYC Information</h3>
        <div className="space-y-2 text-sm">
          <div><span className="font-medium">PAN Number:</span> {kycDetails.panNumber}</div>
          <div><span className="font-medium">Business Type:</span> {kycDetails.businessType}</div>
          {kycDetails.businessName && <div><span className="font-medium">Business Name:</span> {kycDetails.businessName}</div>}
          {kycDetails.gstNumber && <div><span className="font-medium">GST Number:</span> {kycDetails.gstNumber}</div>}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900">What happens next?</h4>
            <p className="text-sm text-blue-700 mt-1">
              Your Route account will be created and submitted for verification. This process typically takes 1-2 business days. 
              You'll receive email updates on the verification status.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const currentStepData = steps[currentStep];
  const Icon = currentStepData?.icon || CheckCircle;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Set Up Payment Account</h1>
        <p className="text-gray-600">
          Configure your Route account to receive payments from community members
        </p>
      </div>

      {/* Progress Steps */}
      {currentStep < 3 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  index <= currentStep ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {index < currentStep ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-16 h-1 mx-2 ${
                    index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">{currentStepData.title}</h2>
            <p className="text-gray-600">{currentStepData.description}</p>
          </div>
        </div>
      )}

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p>{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5" />
            <p>{success}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {currentStep === 0 && renderBankDetailsStep()}
        {currentStep === 1 && renderKycStep()}
        {currentStep === 2 && renderReviewStep()}
        
        {currentStep === 3 && accountStatus && (
          <div className="text-center space-y-4">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
              accountStatus.isReady ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {accountStatus.isReady ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <Clock className="w-8 h-8 text-yellow-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900">
              {accountStatus.isReady ? 'Account Ready!' : 'Account Under Review'}
            </h2>
            <p className="text-gray-600">
              {accountStatus.isReady 
                ? 'Your Route account is verified and ready to receive payments.'
                : 'Your Route account has been submitted for verification. We\'ll notify you once it\'s approved.'
              }
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <h3 className="font-medium text-gray-900 mb-2">Account Status</h3>
              <div className="space-y-1 text-sm">
                <div>Status: <span className="font-medium">{accountStatus.status}</span></div>
                <div>KYC Status: <span className="font-medium">{accountStatus.kycStatus}</span></div>
                <div>Can Receive Payouts: <span className="font-medium">{accountStatus.canReceivePayouts ? 'Yes' : 'No'}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep < 3 && (
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="px-6 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <button
            onClick={currentStep === 2 ? handleSubmit : handleNext}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : currentStep === 2 ? (
              'Create Account'
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      )}

      {currentStep === 3 && (
        <div className="text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
