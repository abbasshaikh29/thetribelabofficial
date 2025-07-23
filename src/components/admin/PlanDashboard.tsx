"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Users, 
  DollarSign, 
  TrendingUp,
  Settings,
  Star,
  Clock
} from 'lucide-react';

interface ICommunityPlan {
  _id: string;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly' | 'one_time';
  intervalCount: number;
  razorpayPlanId?: string;
  features: string[];
  accessLevel: 'basic' | 'premium' | 'vip';
  trialPeriodDays: number;
  isActive: boolean;
  isDefault: boolean;
  isPublic: boolean;
  requiresApproval: boolean;
  totalSubscribers: number;
  totalRevenue: number;
  conversionRate: number;
  createdAt: string;
}

interface PlanDashboardProps {
  communityId: string;
  onCreatePlan?: () => void;
  onEditPlan?: (plan: ICommunityPlan) => void;
}

export default function PlanDashboard({ communityId, onCreatePlan, onEditPlan }: PlanDashboardProps) {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<ICommunityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [communityId]);

  const fetchPlans = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/community-plans?communityId=${communityId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch plans');
      }

      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (planId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/community-plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (!response.ok) {
        throw new Error('Failed to update plan status');
      }

      await fetchPlans(); // Refresh plans
    } catch (error: any) {
      console.error('Failed to toggle plan status:', error);
    }
  };

  const handleSetDefault = async (planId: string) => {
    try {
      const response = await fetch(`/api/admin/community-plans/${planId}/set-default`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to set default plan');
      }

      await fetchPlans(); // Refresh plans
    } catch (error: any) {
      console.error('Failed to set default plan:', error);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/community-plans/${planId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete plan');
      }

      await fetchPlans(); // Refresh plans
    } catch (error: any) {
      console.error('Failed to delete plan:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'INR') => {
    const symbol = currency === 'INR' ? '₹' : '$';
    return `${symbol}${(amount / 100).toLocaleString('en-IN')}`;
  };

  const getIntervalText = (interval: string, intervalCount: number) => {
    if (interval === 'one_time') return 'One-time';
    const unit = interval === 'monthly' ? 'month' : 'year';
    return intervalCount === 1 ? `per ${unit}` : `per ${intervalCount} ${unit}s`;
  };

  const getAccessLevelColor = (level: string) => {
    switch (level) {
      case 'basic': return 'bg-blue-100 text-blue-800';
      case 'premium': return 'bg-purple-100 text-purple-800';
      case 'vip': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Plans</h2>
          <p className="text-gray-600">Create and manage pricing plans for your community</p>
        </div>
        <button
          onClick={onCreatePlan}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Plans Grid */}
      {plans.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Created</h3>
          <p className="text-gray-600 mb-6">
            Create your first subscription plan to start monetizing your community.
          </p>
          <button
            onClick={onCreatePlan}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Your First Plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan._id}
              className={`bg-white rounded-lg border-2 p-6 relative ${
                plan.isDefault ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              {/* Default Badge */}
              {plan.isDefault && (
                <div className="absolute -top-3 left-4">
                  <div className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    <Star className="w-3 h-3" />
                    Default
                  </div>
                </div>
              )}

              {/* Plan Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(plan._id, plan.isActive)}
                      className={`p-1 rounded ${
                        plan.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      title={plan.isActive ? 'Active' : 'Inactive'}
                    >
                      {plan.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => onEditPlan?.(plan)}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"
                      title="Edit Plan"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan._id)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete Plan"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {plan.description && (
                  <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                )}

                {/* Price */}
                <div className="mb-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(plan.amount, plan.currency)}
                    <span className="text-sm font-normal text-gray-600 ml-1">
                      {getIntervalText(plan.interval, plan.intervalCount)}
                    </span>
                  </div>
                </div>

                {/* Access Level */}
                <div className="mb-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getAccessLevelColor(plan.accessLevel)}`}>
                    {plan.accessLevel.toUpperCase()}
                  </span>
                </div>

                {/* Trial Period */}
                {plan.trialPeriodDays > 0 && (
                  <div className="flex items-center gap-1 text-sm text-green-600 mb-3">
                    <Clock className="w-4 h-4" />
                    {plan.trialPeriodDays} day free trial
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Features:</h4>
                <ul className="space-y-1">
                  {plan.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                      <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                  {plan.features.length > 3 && (
                    <li className="text-sm text-gray-500">
                      +{plan.features.length - 3} more features
                    </li>
                  )}
                </ul>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{plan.totalSubscribers}</div>
                  <div className="text-xs text-gray-600">Subscribers</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(plan.totalRevenue, plan.currency)}
                  </div>
                  <div className="text-xs text-gray-600">Revenue</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-900">{plan.conversionRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600">Conversion</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {!plan.isDefault && (
                  <button
                    onClick={() => handleSetDefault(plan._id)}
                    className="flex-1 text-sm bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => onEditPlan?.(plan)}
                  className="flex-1 text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
                >
                  Edit Plan
                </button>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <div className={`w-2 h-2 rounded-full ${plan.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-xs text-gray-600">
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
                {plan.isPublic && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-xs text-gray-600">Public</span>
                  </>
                )}
                {plan.requiresApproval && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <span className="text-xs text-gray-600">Approval Required</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {plans.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{plans.length}</div>
              <div className="text-sm text-gray-600">Total Plans</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {plans.reduce((sum, plan) => sum + plan.totalSubscribers, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Subscribers</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(plans.reduce((sum, plan) => sum + plan.totalRevenue, 0))}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-full mb-3">
                <Star className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {plans.filter(plan => plan.isActive).length}
              </div>
              <div className="text-sm text-gray-600">Active Plans</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
