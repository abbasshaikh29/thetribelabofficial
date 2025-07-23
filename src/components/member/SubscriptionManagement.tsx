"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Calendar, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  ArrowUpCircle,
  ArrowDownCircle,
  Settings,
  Download,
  RefreshCw
} from 'lucide-react';

interface ISubscription {
  id: string;
  planId: string;
  planName: string;
  communityId: string;
  communityName: string;
  status: 'active' | 'trial' | 'pending_approval' | 'cancelled' | 'expired';
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'one_time';
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;
  trialEndDate?: string;
  isInTrial: boolean;
  canCancel: boolean;
  canUpgrade: boolean;
  canDowngrade: boolean;
  daysRemaining?: number;
}

interface SubscriptionManagementProps {
  communityId?: string;
  showHeader?: boolean;
}

export default function SubscriptionManagement({ 
  communityId, 
  showHeader = true 
}: SubscriptionManagementProps) {
  const { data: session } = useSession();
  const [subscriptions, setSubscriptions] = useState<ISubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchSubscriptions();
    }
  }, [session, communityId]);

  const fetchSubscriptions = async () => {
    try {
      setError(null);
      const url = communityId 
        ? `/api/member/subscriptions?communityId=${communityId}`
        : '/api/member/subscriptions';
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      setSubscriptions(data.subscriptions || []);
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    try {
      const response = await fetch(`/api/member/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      await fetchSubscriptions(); // Refresh list
    } catch (error: any) {
      console.error('Failed to cancel subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const handleUpgradeDowngrade = async (subscriptionId: string, newPlanId: string) => {
    try {
      const response = await fetch(`/api/member/subscriptions/${subscriptionId}/change-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPlanId }),
      });

      if (!response.ok) {
        throw new Error('Failed to change plan');
      }

      await fetchSubscriptions(); // Refresh list
    } catch (error: any) {
      console.error('Failed to change plan:', error);
      alert('Failed to change plan. Please try again.');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${(amount / 100).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'trial': return <Clock className="w-5 h-5 text-blue-500" />;
      case 'pending_approval': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'cancelled': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'expired': return <XCircle className="w-5 h-5 text-gray-500" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'trial': return 'text-blue-600 bg-blue-100';
      case 'pending_approval': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      case 'expired': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getIntervalText = (interval: string) => {
    switch (interval) {
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      case 'one_time': return 'One-time';
      default: return interval;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Subscriptions</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchSubscriptions}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions</h3>
        <p className="text-gray-600">
          You don't have any active subscriptions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Subscriptions</h2>
            <p className="text-gray-600">Manage your community subscriptions</p>
          </div>
          <button
            onClick={fetchSubscriptions}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      )}

      {/* Subscriptions List */}
      <div className="space-y-4">
        {subscriptions.map((subscription) => (
          <div
            key={subscription.id}
            className="bg-white rounded-lg border border-gray-200 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {getStatusIcon(subscription.status)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {subscription.communityName}
                  </h3>
                  <p className="text-gray-600">{subscription.planName}</p>
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-2 ${getStatusColor(subscription.status)}`}>
                    {subscription.status.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(subscription.amount, subscription.currency)}
                </div>
                <div className="text-sm text-gray-600">
                  {getIntervalText(subscription.interval)}
                </div>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <div className="text-sm text-gray-900">
                  {formatDate(subscription.startDate)}
                </div>
              </div>

              {subscription.isInTrial && subscription.trialEndDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trial Ends
                  </label>
                  <div className="text-sm text-gray-900">
                    {formatDate(subscription.trialEndDate)}
                    {subscription.daysRemaining !== undefined && (
                      <span className="text-blue-600 ml-1">
                        ({subscription.daysRemaining} days left)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {subscription.nextBillingDate && !subscription.isInTrial && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Billing
                  </label>
                  <div className="text-sm text-gray-900">
                    {formatDate(subscription.nextBillingDate)}
                  </div>
                </div>
              )}

              {subscription.endDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <div className="text-sm text-gray-900">
                    {formatDate(subscription.endDate)}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              {subscription.canUpgrade && (
                <button
                  onClick={() => {/* Handle upgrade */}}
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Upgrade
                </button>
              )}

              {subscription.canDowngrade && (
                <button
                  onClick={() => {/* Handle downgrade */}}
                  className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Downgrade
                </button>
              )}

              <button
                onClick={() => {/* Handle settings */}}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>

              <button
                onClick={() => {/* Handle invoice download */}}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
              >
                <Download className="w-4 h-4" />
                Invoice
              </button>

              {subscription.canCancel && subscription.status === 'active' && (
                <button
                  onClick={() => handleCancelSubscription(subscription.id)}
                  className="inline-flex items-center gap-2 text-sm text-red-600 hover:text-red-800 ml-auto"
                >
                  <XCircle className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
