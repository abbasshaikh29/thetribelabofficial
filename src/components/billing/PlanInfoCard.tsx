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
      <div className={`bg-white rounded-lg border p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
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
        icon: <Crown className="w-5 h-5 text-yellow-600" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    }
    
    if (trialActive) {
      const urgency = daysRemaining !== null && daysRemaining <= 3 ? 'urgent' : 'normal';
      return {
        status: `Trial Active (${daysRemaining} days left)`,
        icon: urgency === 'urgent' 
          ? <AlertTriangle className="w-5 h-5 text-red-600" />
          : <Clock className="w-5 h-5 text-yellow-600" />,
        color: urgency === 'urgent' ? 'text-red-600' : 'text-yellow-600',
        bgColor: urgency === 'urgent' ? 'bg-red-50' : 'bg-yellow-50',
        borderColor: urgency === 'urgent' ? 'border-red-200' : 'border-yellow-200'
      };
    }
    
    return {
      status: 'No Active Plan',
      icon: <AlertTriangle className="w-5 h-5 text-gray-600" />,
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    };
  };

  const statusInfo = getStatusInfo();

  const renderPaymentButton = () => {
    if (subscriptionActive) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <Crown className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-green-800 font-medium">You're all set with Premium!</p>
          <p className="text-sm text-green-700 mt-1">
            Renews on {formatDate(billingData?.subscriptionEndDate)}
          </p>
        </div>
      );
    }

    if (trialActive) {
      const isUrgent = daysRemaining !== null && daysRemaining <= 3;
      
      if (isUrgent) {
        return (
          <UrgentPayNowButton
            communityId={communityId}
            communitySlug={communitySlug}
            context="trial_reminder"
            onSuccess={onPaymentSuccess}
            onError={onPaymentError}
          />
        );
      }
      
      return (
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
      );
    }

    return (
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
    );
  };

  if (variant === 'compact') {
    return (
      <div className={`bg-white rounded-lg border p-4 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {statusInfo.icon}
            <span className={`font-medium ${statusInfo.color}`}>
              {statusInfo.status}
            </span>
          </div>
          <span className="text-2xl font-bold text-gray-900">$29/mo</span>
        </div>
        
        {trialActive && daysRemaining !== null && (
          <div className="mb-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${daysRemaining <= 3 ? 'bg-red-500' : 'bg-yellow-500'}`}
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
    <div className={`bg-white rounded-lg border ${className}`}>
      {showHeader && (
        <div className={`${statusInfo.bgColor} ${statusInfo.borderColor} border-b px-6 py-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {statusInfo.icon}
              <div>
                <h3 className={`font-semibold ${statusInfo.color}`}>
                  Community Management Plan
                </h3>
                <p className={`text-sm ${statusInfo.color} opacity-80`}>
                  {statusInfo.status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">$29</div>
              <div className="text-sm text-gray-600">per month</div>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Trial Progress (if active) */}
        {trialActive && daysRemaining !== null && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900">Trial Progress</span>
              <span className={`font-semibold ${daysRemaining <= 3 ? 'text-red-600' : 'text-yellow-600'}`}>
                {daysRemaining} days remaining
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  daysRemaining <= 3 ? 'bg-red-500' : 
                  daysRemaining <= 7 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${percentRemaining}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-600">
              <span>Started: {formatDate(billingData?.adminTrialInfo?.startDate)}</span>
              <span>Ends: {formatDate(billingData?.adminTrialInfo?.endDate)}</span>
            </div>
          </div>
        )}

        {/* Features */}
        {showFeatures && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-blue-600" />
              Unlimited Features Included
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {[
                'Unlimited Members',
                'Unlimited Storage', 
                'Unlimited Events',
                'Unlimited Channels',
                'Advanced Analytics',
                'Priority Support'
              ].map((feature, index) => (
                <div key={index} className="flex items-center text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2 flex-shrink-0" />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment Button */}
        <div className="pt-4 border-t border-gray-200">
          {renderPaymentButton()}
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Secure payment • Cancel anytime • No refunds after activation
          </p>
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
