"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import CommunitySubscriptionCheckout from "@/components/payments/RazorpayCheckout";

interface CommunitySubscription {
  _id: string;
  razorpaySubscriptionId: string;
  status: string;
  currentStart: string;
  currentEnd: string;
  amount: number;
  currency: string;
  interval: string;
  paidCount: number;
  totalCount: number;
  retryAttempts: number;
  maxRetryAttempts: number;
  nextRetryAt?: string;
  consecutiveFailures: number;
  communityId?: {
    _id: string;
    name: string;
    slug: string;
  };
}

interface SubscriptionPlan {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: "monthly" | "yearly";
  features: string[];
  trialPeriodDays?: number;
  allowCustomBranding: boolean;
  prioritySupport: boolean;
  analyticsAccess: boolean;
  advancedAnalytics: boolean;
  apiAccess: boolean;
  whitelabelOptions: boolean;
  dedicatedSupport: boolean;
  customIntegrations: boolean;
}

interface CommunitySubscriptionManagerProps {
  communityId?: string;
  showPlanSelection?: boolean;
}

const CommunitySubscriptionManager: React.FC<CommunitySubscriptionManagerProps> = ({
  communityId,
  showPlanSelection = true
}) => {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<CommunitySubscription[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetchData();
    }
  }, [session, communityId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch admin's subscriptions
      const subscriptionsResponse = await fetch("/api/subscriptions/manage");
      if (subscriptionsResponse.ok) {
        const subscriptionsData = await subscriptionsResponse.json();
        let adminSubscriptions = subscriptionsData.subscriptions || [];
        
        // Filter by community if specified
        if (communityId) {
          adminSubscriptions = adminSubscriptions.filter(
            (sub: any) => sub.communityId?._id === communityId
          );
        }
        
        setSubscriptions(adminSubscriptions);
      }

      // Fetch available plans
      if (showPlanSelection) {
        const plansResponse = await fetch("/api/community-subscription-plans?isActive=true");
        if (plansResponse.ok) {
          const plansData = await plansResponse.json();
          setPlans(plansData.plans || []);
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, cancelAtCycleEnd: boolean = true) => {
    if (!confirm(`Are you sure you want to cancel this subscription${cancelAtCycleEnd ? ' at the end of the current cycle' : ' immediately'}?`)) {
      return;
    }

    try {
      setActionLoading(subscriptionId);
      const response = await fetch("/api/subscriptions/manage", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId,
          action: "cancel",
          cancelAtCycleEnd
        }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchData();
        alert("Subscription cancelled successfully");
      } else {
        setError(data.error || "Failed to cancel subscription");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-green-600 bg-green-100";
      case "trial":
        return "text-blue-600 bg-blue-100";
      case "cancelled":
        return "text-red-600 bg-red-100";
      case "past_due":
        return "text-yellow-600 bg-yellow-100";
      case "expired":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const hasActiveSubscription = subscriptions.some(sub => 
    ["active", "trial", "past_due"].includes(sub.status)
  );

  return (
    <div className="community-subscription-manager">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {communityId ? "Community Subscription" : "My Community Subscriptions"}
        </h2>
        <p className="text-gray-600">
          Manage your community hosting subscriptions and billing
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Current Subscriptions */}
      {subscriptions.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscriptions</h3>
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div key={subscription._id} className="bg-white rounded-lg shadow border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {subscription.communityId?.name || "Community Subscription"}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {formatPrice(subscription.amount, subscription.currency)} / {subscription.interval}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Current Period</p>
                    <p className="text-sm text-gray-900">
                      {formatDate(subscription.currentStart)} - {formatDate(subscription.currentEnd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Payments</p>
                    <p className="text-sm text-gray-900">
                      {subscription.paidCount} of {subscription.totalCount || "∞"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Subscription ID</p>
                    <p className="text-sm text-gray-900 font-mono">
                      {subscription.razorpaySubscriptionId}
                    </p>
                  </div>
                </div>

                {subscription.status === "past_due" && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>Payment Failed:</strong> Your subscription payment failed. 
                      {subscription.retryAttempts < subscription.maxRetryAttempts && subscription.nextRetryAt && (
                        <span> Next retry on {formatDate(subscription.nextRetryAt)}.</span>
                      )}
                      {subscription.retryAttempts >= subscription.maxRetryAttempts && (
                        <span> Maximum retry attempts reached. Please update your payment method.</span>
                      )}
                    </p>
                  </div>
                )}

                {subscription.status === "active" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCancelSubscription(subscription.razorpaySubscriptionId, true)}
                      disabled={actionLoading === subscription.razorpaySubscriptionId}
                      className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
                    >
                      Cancel at Period End
                    </button>
                    <button
                      onClick={() => handleCancelSubscription(subscription.razorpaySubscriptionId, false)}
                      disabled={actionLoading === subscription.razorpaySubscriptionId}
                      className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Cancel Immediately
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Selection */}
      {showPlanSelection && !hasActiveSubscription && plans.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose a Subscription Plan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            {plans.map((plan) => (
              <div
                key={plan._id}
                className={`bg-white rounded-lg shadow border-2 p-6 cursor-pointer transition-all ${
                  selectedPlan?._id === plan._id
                    ? "border-blue-500 shadow-lg"
                    : "border-gray-200 hover:border-gray-300"
                }`}
                onClick={() => setSelectedPlan(plan)}
              >
                <h4 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h4>
                {plan.description && (
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                )}
                
                <div className="text-3xl font-bold text-blue-600 mb-4">
                  {formatPrice(plan.amount, plan.currency)}
                  <span className="text-lg font-normal text-gray-500">/{plan.interval}</span>
                </div>

                {/* Unlimited Access Badge */}
                <div className="mb-4 p-3 bg-green-50 rounded-lg">
                  <div className="text-center">
                    <span className="text-green-800 font-medium text-sm">
                      🚀 Unlimited Everything
                    </span>
                    <p className="text-green-700 text-xs mt-1">
                      Members • Storage • Events • Channels
                    </p>
                  </div>
                </div>

                {/* Premium Features */}
                <div className="space-y-2 mb-4">
                  {plan.allowCustomBranding && (
                    <div className="flex items-center text-sm text-blue-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Custom Branding
                    </div>
                  )}
                  {plan.prioritySupport && (
                    <div className="flex items-center text-sm text-blue-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Priority Support
                    </div>
                  )}
                  {plan.advancedAnalytics && (
                    <div className="flex items-center text-sm text-blue-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Advanced Analytics
                    </div>
                  )}
                  {plan.apiAccess && (
                    <div className="flex items-center text-sm text-blue-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      API Access
                    </div>
                  )}
                  {plan.dedicatedSupport && (
                    <div className="flex items-center text-sm text-blue-600">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Dedicated Support
                    </div>
                  )}
                </div>

                {plan.features && plan.features.length > 0 && (
                  <ul className="space-y-1">
                    {plan.features.slice(0, 3).map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {selectedPlan && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Start {selectedPlan.name} Subscription
              </h4>
              <CommunitySubscriptionCheckout
                planId={selectedPlan._id}
                communityId={communityId}
                onSuccess={() => {
                  fetchData();
                  setSelectedPlan(null);
                }}
                onError={(error: string) => setError(error)}
              />
            </div>
          )}
        </div>
      )}

      {showPlanSelection && !hasActiveSubscription && plans.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-600">No subscription plans available at the moment.</p>
        </div>
      )}
    </div>
  );
};

export default CommunitySubscriptionManager;
