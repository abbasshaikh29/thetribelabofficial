"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Check, 
  Star, 
  Clock, 
  Users, 
  Shield, 
  Zap,
  ArrowRight,
  Loader2,
  AlertCircle
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
  accessLevel: 'basic' | 'premium' | 'vip';
  trialPeriodDays: number;
  isActive: boolean;
  isDefault: boolean;
  isPublic: boolean;
  requiresApproval: boolean;
  totalSubscribers: number;
  setupFee?: number;
}

interface PlanSelectionProps {
  communitySlug: string;
  communityName: string;
  onPlanSelect?: (plan: ICommunityPlan) => void;
  showHeader?: boolean;
}

export default function PlanSelection({
  communitySlug,
  communityName,
  onPlanSelect,
  showHeader = true
}: PlanSelectionProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<ICommunityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [communitySlug]);

  const fetchPlans = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/community/${communitySlug}/plans`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      const activePlans = data.plans.filter((plan: ICommunityPlan) => plan.isActive && plan.isPublic);
      setPlans(activePlans);

      // Auto-select default plan
      const defaultPlan = activePlans.find((plan: ICommunityPlan) => plan.isDefault);
      if (defaultPlan) {
        setSelectedPlan(defaultPlan._id);
      }
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: ICommunityPlan) => {
    if (!session) {
      router.push(`/login?redirect=/community/${communitySlug}/join`);
      return;
    }

    setSelectedPlan(plan._id);
    if (onPlanSelect) {
      onPlanSelect(plan);
    } else {
      // Default behavior - redirect to checkout
      router.push(`/community/${communitySlug}/checkout?planId=${plan._id}`);
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

  const getAccessLevelIcon = (level: string) => {
    switch (level) {
      case 'basic': return <Shield className="w-5 h-5" />;
      case 'premium': return <Zap className="w-5 h-5" />;
      case 'vip': return <Star className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'basic': return 'text-blue-600 bg-blue-100';
      case 'premium': return 'text-purple-600 bg-purple-100';
      case 'vip': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getPlanPopularity = (plan: ICommunityPlan, allPlans: ICommunityPlan[]) => {
    const totalSubscribers = allPlans.reduce((sum, p) => sum + p.totalSubscribers, 0);
    if (totalSubscribers === 0) return 0;
    return (plan.totalSubscribers / totalSubscribers) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Plans</h3>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={fetchPlans}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Available</h3>
        <p className="text-gray-600">
          This community hasn't set up any subscription plans yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      {showHeader && (
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Join {communityName}
          </h2>
          <p className="text-lg text-gray-600">
            Choose the plan that's right for you
          </p>
        </div>
      )}

      {/* Plans Grid */}
      <div className={`grid gap-6 ${
        plans.length === 1 ? 'max-w-md mx-auto' :
        plans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}>
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan._id;
          const popularity = getPlanPopularity(plan, plans);
          const isPopular = popularity > 40; // Mark as popular if >40% of subscribers

          return (
            <div
              key={plan._id}
              className={`relative bg-white rounded-xl border-2 p-6 cursor-pointer transition-all duration-200 ${
                isSelected 
                  ? 'border-blue-500 shadow-lg scale-105' 
                  : plan.isDefault
                  ? 'border-blue-300 shadow-md'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              }`}
              onClick={() => handlePlanSelect(plan)}
            >
              {/* Popular Badge */}
              {(isPopular || plan.isDefault) && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                    isPopular ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                  }`}>
                    <Star className="w-3 h-3" />
                    {isPopular ? 'Most Popular' : 'Recommended'}
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-6">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-4 ${getAccessLevelColor(plan.accessLevel)}`}>
                  {getAccessLevelIcon(plan.accessLevel)}
                  {plan.accessLevel.toUpperCase()}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                
                {plan.description && (
                  <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                )}

                {/* Price */}
                <div className="mb-4">
                  <div className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.amount, plan.currency)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {getIntervalText(plan.interval, plan.intervalCount)}
                  </div>
                  {plan.setupFee && plan.setupFee > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      + {formatCurrency(plan.setupFee, plan.currency)} setup fee
                    </div>
                  )}
                </div>

                {/* Trial Period */}
                {plan.trialPeriodDays > 0 && (
                  <div className="inline-flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full mb-4">
                    <Clock className="w-4 h-4" />
                    {plan.trialPeriodDays} day free trial
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Subscriber Count */}
              {plan.totalSubscribers > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                  <Users className="w-4 h-4" />
                  {plan.totalSubscribers} member{plan.totalSubscribers !== 1 ? 's' : ''}
                </div>
              )}

              {/* Action Button */}
              <button
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : plan.isDefault
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {isSelected ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="w-4 h-4" />
                    Selected
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    {plan.trialPeriodDays > 0 ? 'Start Free Trial' : 'Select Plan'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>

              {/* Approval Notice */}
              {plan.requiresApproval && (
                <div className="mt-3 text-xs text-gray-500 text-center">
                  * Requires admin approval after payment
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Additional Info */}
      <div className="text-center text-sm text-gray-500">
        <p>
          All plans include access to community features and content.{' '}
          <a href="#" className="text-blue-600 hover:underline">
            View detailed comparison
          </a>
        </p>
      </div>
    </div>
  );
}
