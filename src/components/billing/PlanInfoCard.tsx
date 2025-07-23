"use client";

import React from "react";
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Crown,
  Zap,
  CreditCard,
} from "lucide-react";


interface CommunityData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  // Legacy trial system only
  paymentStatus?: string;
  freeTrialActivated?: boolean;
  subscriptionEndDate?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
}

interface PlanInfoCardProps {
  community: CommunityData;
  trialActive: boolean;
  isPaymentActive: boolean;
  remainingDays: number | null;
  onUpgrade?: () => void;
}

export default function PlanInfoCard({
  community,
  trialActive,
  isPaymentActive,
  remainingDays,
  onUpgrade,
}: PlanInfoCardProps) {
  if (!community) {
    return (
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (isPaymentActive) {
    return (
      <div className="bg-white rounded-lg border border-green-200 p-6">
        <div className="flex items-center mb-4">
          <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
          <div>
            <h3 className="font-bold text-green-800">Active Subscription</h3>
            <p className="text-green-600 text-sm">
              Your premium plan is active
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-medium">Status:</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              {community.subscriptionStatus || "Active"}
            </span>
          </div>
          {community.subscriptionEndDate && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Next billing:</span>
              <span className="text-sm">
                {new Date(community.subscriptionEndDate).toLocaleDateString()}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-medium">Plan:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              Premium ($29/month)
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (trialActive) {
    return (
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-lg border border-blue-200 p-6">
        <div className="flex items-center mb-4">
          <Clock className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h3 className="font-bold text-blue-800">Free Trial Active</h3>
            <p className="text-blue-600 text-sm">
              Enjoying premium features
              {remainingDays !== null && ` - ${remainingDays} days left`}
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-700">Status:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              14-Day Free Trial
            </span>
          </div>
          {remainingDays !== null && (
            <div className="flex justify-between items-center">
              <span className="font-medium text-blue-700">Days Remaining:</span>
              <span
                className={`font-bold ${remainingDays <= 3 ? "text-red-600" : "text-blue-600"}`}
              >
                {remainingDays} days
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="font-medium text-blue-700">After Trial:</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
              Premium ($29/month)
            </span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">
            {remainingDays !== null && remainingDays <= 3
              ? "Trial ending soon! Upgrade now to keep your premium features."
              : "Upgrade anytime to secure your premium access."}
          </p>
          <button
            onClick={onUpgrade}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center"
          >
            <Crown className="w-4 h-4 mr-2" />
            Upgrade to Premium
          </button>
        </div>
      </div>
    );
  }

  // Show subscription pending only if trial has ended AND no active payment
  if (community.subscriptionId && !trialActive && !isPaymentActive) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
        <div className="flex items-center mb-4">
          <AlertTriangle className="w-6 h-6 text-yellow-600 mr-3" />
          <div>
            <h3 className="font-bold text-yellow-800">
              Trial Ended - Upgrade Required
            </h3>
            <p className="text-yellow-600 text-sm">
              Complete payment to restore premium access
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Status:</span>
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
              Payment Required
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Plan:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
              Premium ($29/month)
            </span>
          </div>
          {community.subscriptionEndDate && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Access until:</span>
              <span className="text-sm">
                {new Date(community.subscriptionEndDate).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="bg-yellow-100 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-sm font-medium">
            Complete your payment to restore full premium features
          </p>
        </div>

        <button
          onClick={onUpgrade}
          className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center"
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Complete Payment
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <AlertTriangle className="w-6 h-6 text-gray-600 mr-3" />
        <div>
          <h3 className="font-bold text-gray-800">No Active Plan</h3>
          <p className="text-gray-600 text-sm">
            Start your free trial or upgrade to premium
          </p>
        </div>
      </div>

      <button
        onClick={onUpgrade}
        className="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center"
      >
        <Crown className="w-4 h-4 mr-2" />
        Start Free Trial
      </button>
    </div>
  );
}

// Legacy trial system only - simplified component without variants
