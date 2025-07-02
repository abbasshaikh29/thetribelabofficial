"use client";

import React from 'react';
import { CheckCircle, Clock, AlertTriangle, Crown, Zap } from 'lucide-react';
import { useCommunityBilling } from '@/contexts/CommunityBillingContext';
import PayNowButton, { TrialConversionButton, UrgentPayNowButton } from '@/components/payments/PayNowButton';

interface PlanInfoCardProps {
  communityId?: string;
  communitySlug?: string;
  showHeader?: boolean;
  showFeatures?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onPaymentSuccess?: (subscription: any) => void;
  onPaymentError?: (error: string) => void;
  className?: string;
}

export default function PlanInfoCard({
  communityId,
  communitySlug,
  showHeader = true,
  showFeatures = true,
  variant = 'default',
  onPaymentSuccess,
  onPaymentError,
  className = ""
}: PlanInfoCardProps) {
  const {
    billingData,
    loading,
    daysRemaining,
    trialActive,
    subscriptionActive,
    percentRemaining
  } = useCommunityBilling();

  if (loading) {
    return (
      <div className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-lg p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-3/4"></div>
          <div className="h-8 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg"></div>
            <div className="h-3 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusInfo = () => {
    if (subscriptionActive) {
      return {
        status: 'Premium Active',
        icon: <Crown className="w-5 h-5 text-amber-500 drop-shadow-sm" />,
        color: 'text-emerald-700',
        bgColor: 'bg-gradient-to-r from-emerald-50 to-green-50',
        borderColor: 'border-emerald-200',
        glowColor: 'shadow-emerald-200/50'
      };
    }
    
    if (trialActive) {
      const urgency = daysRemaining !== null && daysRemaining <= 3 ? 'urgent' : 'normal';
      return {
        status: `Trial Active (${daysRemaining} days left)`,
        icon: urgency === 'urgent' 
          ? <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-sm animate-pulse" />
          : <Clock className="w-5 h-5 text-amber-500 drop-shadow-sm" />,
        color: urgency === 'urgent' ? 'text-red-700' : 'text-amber-700',
        bgColor: urgency === 'urgent' ? 'bg-gradient-to-r from-red-50 to-orange-50' : 'bg-gradient-to-r from-amber-50 to-yellow-50',
        borderColor: urgency === 'urgent' ? 'border-red-200' : 'border-amber-200',
        glowColor: urgency === 'urgent' ? 'shadow-red-200/50' : 'shadow-amber-200/50'
      };
    }
    
    return {
      status: 'No Active Plan',
      icon: <AlertTriangle className="w-5 h-5 text-slate-500 drop-shadow-sm" />,
      color: 'text-slate-700',
      bgColor: 'bg-gradient-to-r from-slate-50 to-gray-50',
      borderColor: 'border-slate-200',
      glowColor: 'shadow-slate-200/50'
    };
  };

  const statusInfo = getStatusInfo();

  const renderPaymentButton = () => {
    if (subscriptionActive) {
      return (
        <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100 border border-emerald-200 rounded-xl p-6 text-center shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-green-500/5"></div>
          <div className="relative">
            <Crown className="w-12 h-12 text-amber-500 mx-auto mb-4 drop-shadow-sm" />
            <p className="text-emerald-800 font-bold text-xl mb-2">You're all set with Premium!</p>
            <div className="inline-flex items-center bg-white/80 backdrop-blur-sm rounded-lg px-4 py-2 shadow-sm border border-emerald-100">
              <span className="text-sm text-emerald-700 font-semibold">
                Renews on {formatDate(billingData?.subscriptionEndDate)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (trialActive) {
      const isUrgent = daysRemaining !== null && daysRemaining <= 3;
      
      if (isUrgent) {
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-50 via-orange-50 to-red-100 border-2 border-red-200 rounded-xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10"></div>
              <div className="relative text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3 animate-pulse" />
                <p className="text-red-800 font-bold text-lg mb-2">Trial Ending Soon!</p>
                <p className="text-red-700 text-sm font-medium">
                  Only {daysRemaining} days left to upgrade
                </p>
              </div>
            </div>
            <UrgentPayNowButton
              communityId={communityId}
              communitySlug={communitySlug}
              context="trial_reminder"
              onSuccess={onPaymentSuccess}
              onError={onPaymentError}
            />
          </div>
        );
      }
      
      return (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 border border-blue-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
            <div className="relative text-center">
              <Clock className="w-10 h-10 text-blue-500 mx-auto mb-3" />
              <p className="text-blue-800 font-bold text-lg mb-2">Free Trial Active</p>
              <p className="text-blue-700 text-sm font-medium">
                {daysRemaining} days remaining to enjoy all features
              </p>
            </div>
          </div>
          <TrialConversionButton
            communityId={communityId}
            communitySlug={communitySlug}
            daysRemaining={daysRemaining}
            size="lg"
            showFeatures={variant === 'detailed'}
            context="settings"
            onSuccess={onPaymentSuccess}
            onError={onPaymentError}
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-100 border border-violet-200 rounded-xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 to-purple-500/5"></div>
          <div className="relative text-center">
            <Zap className="w-10 h-10 text-violet-500 mx-auto mb-3" />
            <p className="text-violet-800 font-bold text-lg mb-2">Ready to Get Started?</p>
            <p className="text-violet-700 text-sm font-medium">
              Start your 14-day free trial and unlock all premium features
            </p>
          </div>
        </div>
        <PayNowButton
          communityId={communityId}
          communitySlug={communitySlug}
          buttonText="Start 14-Day Free Trial"
          variant="primary"
          size="lg"
          showFeatures={variant === 'detailed'}
          context="settings"
          onSuccess={onPaymentSuccess}
          onError={onPaymentError}
        />
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <div className={`bg-gradient-to-br from-white to-gray-50 rounded-2xl border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 p-5 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            {statusInfo.icon}
            <span className={`font-semibold text-lg ${statusInfo.color}`}>
              {statusInfo.status}
            </span>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">$29</span>
            <span className="text-slate-600 text-sm font-medium">/mo</span>
          </div>
        </div>
        
        {trialActive && daysRemaining !== null && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${daysRemaining <= 3 ? 'bg-gradient-to-r from-red-500 to-pink-500' : 'bg-gradient-to-r from-amber-500 to-orange-500'} shadow-sm`}
                style={{ width: `${percentRemaining}%` }}
              ></div>
            </div>
          </div>
        )}
        
        {renderPaymentButton()}
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-white via-gray-50 to-white rounded-2xl border border-gray-200 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden ${className}`}>
      {showHeader && (
        <div className={`${statusInfo.bgColor} ${statusInfo.borderColor} border-b px-7 py-6 shadow-sm ${statusInfo.glowColor}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white/70 rounded-xl shadow-sm">
                {statusInfo.icon}
              </div>
              <div>
                <h3 className={`font-bold text-xl ${statusInfo.color}`}>
                  Community Management Plan
                </h3>
                <p className={`text-sm ${statusInfo.color} opacity-80 font-medium`}>
                  {statusInfo.status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">$29</div>
              <div className="text-sm text-slate-600 font-medium">per month</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-7 space-y-7">
        {/* Trial Progress (if active) */}
        {trialActive && daysRemaining !== null && (
          <div className="space-y-4 bg-gradient-to-br from-white to-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900 text-lg flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-500" />
                Trial Progress
              </span>
              <div className={`font-bold text-lg ${daysRemaining <= 3 ? 'text-red-600 bg-red-50 border border-red-200' : 'text-amber-600 bg-amber-50 border border-amber-200'} px-4 py-2 rounded-lg shadow-sm`}>
                {daysRemaining} days remaining
              </div>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner overflow-hidden">
              <div
                className={`h-4 rounded-full transition-all duration-500 shadow-sm ${
                  daysRemaining <= 3 ? 'bg-gradient-to-r from-red-500 to-pink-500' : 
                  daysRemaining <= 7 ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-emerald-500 to-green-500'
                }`}
                style={{ width: `${percentRemaining}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-sm text-slate-600 bg-white/80 rounded-lg px-4 py-3 border border-gray-100">
              <span className="font-semibold">Started: {formatDate(billingData?.adminTrialInfo?.startDate)}</span>
              <span className="font-semibold">Ends: {formatDate(billingData?.adminTrialInfo?.endDate)}</span>
            </div>
          </div>
        )}

        {/* Features */}
        {showFeatures && (
          <div className="space-y-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5"></div>
            <div className="relative">
              <h4 className="font-bold text-slate-900 text-xl flex items-center mb-4">
                <div className="p-2 bg-blue-500/10 rounded-lg mr-3 shadow-sm border border-blue-200">
                  <Zap className="w-6 h-6 text-blue-600" />
                </div>
                Unlimited Features Included
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  'Unlimited Members',
                  'Unlimited Storage', 
                  'Unlimited Events',
                  'Unlimited Channels',
                  'Advanced Analytics',
                  'Priority Support'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-slate-700 bg-white/80 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm border border-white/50 hover:shadow-md hover:bg-white/90 transition-all duration-200">
                    <CheckCircle className="w-4 h-4 text-emerald-600 mr-3 flex-shrink-0" />
                    <span className="font-semibold">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Payment Button */}
        <div className="pt-2">
          {renderPaymentButton()}
        </div>

        {/* Additional Info */}
        <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 rounded-xl p-6 border border-slate-200 shadow-sm space-y-5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-500/5 to-gray-500/5"></div>
          <div className="relative">
            <div className="flex items-center justify-center space-x-8 text-sm mb-5">
              <div className="flex items-center space-x-2 text-emerald-600">
                <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-sm"></div>
                <span className="font-semibold">Unlimited features</span>
              </div>
              <div className="flex items-center space-x-2 text-blue-600">
                <div className="w-3 h-3 bg-blue-500 rounded-full shadow-sm"></div>
                <span className="font-semibold">Cancel anytime</span>
              </div>
              <div className="flex items-center space-x-2 text-amber-600">
                <div className="w-3 h-3 bg-amber-500 rounded-full shadow-sm"></div>
                <span className="font-semibold">No setup fees</span>
              </div>
            </div>
            
            <div className="text-center border-t border-slate-200 pt-5">
              <div className="bg-white/80 backdrop-blur-sm rounded-lg px-4 py-3 mb-4 border border-slate-200 shadow-sm">
                <p className="text-sm text-slate-700 font-semibold mb-2">
                  🔒 Secure payment • No refunds after activation
                </p>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-bold underline hover:no-underline transition-all duration-200 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md">
                  Upgrade to unlock all premium features
                </button>
              </div>
              <div>
                <button className="text-blue-500 hover:text-blue-700 text-sm font-semibold underline hover:no-underline transition-all duration-200 bg-blue-50/50 hover:bg-blue-100/50 px-3 py-1 rounded-md">
                  View full billing details
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Specialized variants
export function CompactPlanInfoCard(props: Omit<PlanInfoCardProps, 'variant'>) {
  return <PlanInfoCard {...props} variant="compact" />;
}

export function DetailedPlanInfoCard(props: Omit<PlanInfoCardProps, 'variant' | 'showFeatures'>) {
  return <PlanInfoCard {...props} variant="detailed" showFeatures={true} />;
}