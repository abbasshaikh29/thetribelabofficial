"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Shield, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft,
  Lock
} from 'lucide-react';

interface ICommunityPlan {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'one_time';
  intervalCount: number;
  features: string[];
  trialPeriodDays: number;
  setupFee?: number;
  requiresApproval: boolean;
}

interface CheckoutFormProps {
  communitySlug: string;
  planId: string;
  onSuccess?: (subscriptionId: string) => void;
  onCancel?: () => void;
}

// Razorpay types are already declared globally

export default function CheckoutForm({ communitySlug, planId, onSuccess, onCancel }: CheckoutFormProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [plan, setPlan] = useState<ICommunityPlan | null>(null);
  const [community, setCommunity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);

    fetchPlan();

    return () => {
      document.body.removeChild(script);
    };
  }, [planId]);

  const fetchPlan = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/community/${communitySlug}/plans/${planId}`);
      
      if (!response.ok) {
        throw new Error('Plan not found');
      }

      const data = await response.json();
      setPlan(data.plan);
      setCommunity(data.community);
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to fetch plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!session || !plan || !razorpayLoaded) return;

    setProcessing(true);
    setError(null);

    try {
      // Create order
      const orderResponse = await fetch('/api/payments/create-subscription-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: plan._id,
          communityId: community.id,
          amount: plan.amount + (plan.setupFee || 0),
          currency: plan.currency
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        throw new Error(orderData.error || 'Failed to create order');
      }

      // Configure Razorpay options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'TheTribeLab',
        description: `${plan.name} - ${orderData.communityName}`,
        order_id: orderData.orderId,
        prefill: {
          name: session.user.name || session.user.username,
          email: session.user.email,
        },
        theme: {
          color: '#3B82F6'
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const verifyResponse = await fetch('/api/payments/verify-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId: plan._id,
                communityId: community.id
              }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            // Success
            if (onSuccess) {
              onSuccess(verifyData.subscriptionId);
            } else {
              router.push(`/community/${communitySlug}/welcome?subscription=${verifyData.subscriptionId}`);
            }

          } catch (error: any) {
            setError(error.message);
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          }
        }
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      setError(error.message);
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${(amount / 100).toLocaleString('en-IN')}`;
  };

  const getIntervalText = (interval: string, intervalCount: number) => {
    if (interval === 'one_time') return 'One-time payment';
    const unit = interval === 'monthly' ? 'month' : 'year';
    return intervalCount === 1 ? `per ${unit}` : `per ${intervalCount} ${unit}s`;
  };

  const getTotalAmount = () => {
    if (!plan) return 0;
    return plan.amount + (plan.setupFee || 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          type="button"
          onClick={onCancel || (() => router.back())}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Subscription</h1>
        <p className="text-gray-600">You're almost there! Complete your payment to join the community.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Plan Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Plan Summary</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">{plan.name}</h3>
              {plan.description && (
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
              )}
            </div>

            {/* Features */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Included features:</h4>
              <ul className="space-y-1">
                {plan.features.slice(0, 5).map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    {feature}
                  </li>
                ))}
                {plan.features.length > 5 && (
                  <li className="text-sm text-gray-500">
                    +{plan.features.length - 5} more features
                  </li>
                )}
              </ul>
            </div>

            {/* Trial Period */}
            {plan.trialPeriodDays > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {plan.trialPeriodDays} day free trial included
                  </span>
                </div>
                <p className="text-xs text-green-700 mt-1">
                  You won't be charged until your trial ends
                </p>
              </div>
            )}

            {/* Approval Notice */}
            {plan.requiresApproval && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Admin approval required</span>
                </div>
                <p className="text-xs text-yellow-700 mt-1">
                  Access will be granted after admin approval
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
          
          {/* Pricing Breakdown */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-600">Plan price:</span>
              <span className="font-medium">
                {formatCurrency(plan.amount, plan.currency)} {getIntervalText(plan.interval, plan.intervalCount)}
              </span>
            </div>
            
            {plan.setupFee && plan.setupFee > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Setup fee:</span>
                <span className="font-medium">{formatCurrency(plan.setupFee, plan.currency)}</span>
              </div>
            )}
            
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">
                  {plan.trialPeriodDays > 0 ? 'Due after trial:' : 'Total due today:'}
                </span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(getTotalAmount(), plan.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Payment Button */}
          <button
            type="button"
            onClick={handlePayment}
            disabled={processing || !razorpayLoaded || !session}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )}
            {processing ? 'Processing...' : 
             plan.trialPeriodDays > 0 ? 'Start Free Trial' : 
             'Complete Payment'}
          </button>

          {/* Security Notice */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Lock className="w-4 h-4" />
            <span>Secured by Razorpay. Your payment information is encrypted and secure.</span>
          </div>

          {/* Terms */}
          <div className="mt-4 text-xs text-gray-500">
            By completing this purchase, you agree to our{' '}
            <a href="/terms" className="text-blue-600 hover:underline">Terms of Service</a>{' '}
            and{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
          </div>
        </div>
      </div>
    </div>
  );
}
