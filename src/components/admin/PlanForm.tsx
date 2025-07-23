"use client";

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  DollarSign, 
  Clock, 
  Users, 
  Shield,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface ICommunityPlan {
  _id?: string;
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
  maxMembers?: number;
  setupFee?: number;
  cancellationFee?: number;
}

interface PlanFormProps {
  communityId: string;
  plan?: ICommunityPlan;
  isOpen: boolean;
  onClose: () => void;
  onSave: (plan: ICommunityPlan) => void;
}

export default function PlanForm({ communityId, plan, isOpen, onClose, onSave }: PlanFormProps) {
  const [formData, setFormData] = useState<ICommunityPlan>({
    name: '',
    description: '',
    amount: 0,
    currency: 'INR',
    interval: 'monthly',
    intervalCount: 1,
    features: [''],
    accessLevel: 'basic',
    trialPeriodDays: 0,
    isActive: true,
    isDefault: false,
    isPublic: true,
    requiresApproval: false,
    maxMembers: undefined,
    setupFee: 0,
    cancellationFee: 0
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setFormData(plan);
    } else {
      // Reset form for new plan
      setFormData({
        name: '',
        description: '',
        amount: 0,
        currency: 'INR',
        interval: 'monthly',
        intervalCount: 1,
        features: [''],
        accessLevel: 'basic',
        trialPeriodDays: 0,
        isActive: true,
        isDefault: false,
        isPublic: true,
        requiresApproval: false,
        maxMembers: undefined,
        setupFee: 0,
        cancellationFee: 0
      });
    }
    setError(null);
    setSuccess(null);
  }, [plan, isOpen]);

  const handleInputChange = (field: keyof ICommunityPlan, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData(prev => ({
      ...prev,
      features: newFeatures
    }));
  };

  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, '']
    }));
  };

  const removeFeature = (index: number) => {
    if (formData.features.length > 1) {
      const newFeatures = formData.features.filter((_, i) => i !== index);
      setFormData(prev => ({
        ...prev,
        features: newFeatures
      }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Plan name is required');
      return false;
    }

    if (formData.amount <= 0) {
      setError('Plan amount must be greater than 0');
      return false;
    }

    if (formData.intervalCount <= 0) {
      setError('Interval count must be greater than 0');
      return false;
    }

    const validFeatures = formData.features.filter(f => f.trim());
    if (validFeatures.length === 0) {
      setError('At least one feature is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      // Clean up features (remove empty ones)
      const cleanedData = {
        ...formData,
        features: formData.features.filter(f => f.trim()),
        amount: Math.round(formData.amount * 100), // Convert to paise
        setupFee: formData.setupFee ? Math.round(formData.setupFee * 100) : 0,
        cancellationFee: formData.cancellationFee ? Math.round(formData.cancellationFee * 100) : 0
      };

      const url = plan 
        ? `/api/admin/community-plans/${plan._id}`
        : '/api/admin/community-plans';
      
      const method = plan ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...cleanedData,
          communityId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save plan');
      }

      setSuccess(plan ? 'Plan updated successfully!' : 'Plan created successfully!');
      onSave(data.plan);
      
      // Close form after short delay
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const calculateFees = () => {
    const grossAmount = formData.amount * 100; // Convert to paise
    const platformFeeRate = 5.0; // 5%
    const platformFee = Math.round((grossAmount * platformFeeRate) / 100);
    const processingFee = Math.round((grossAmount * 2) / 100) + 200; // 2% + ₹2
    const netAmount = grossAmount - platformFee - processingFee;

    return {
      gross: grossAmount,
      platformFee,
      processingFee,
      net: Math.max(0, netAmount)
    };
  };

  const fees = calculateFees();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5" />
                <p>{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <p>{success}</p>
              </div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plan Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Premium Membership"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe what this plan includes..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Pricing</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  min="1"
                  step="0.01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Billing Interval
                </label>
                <select
                  value={formData.interval}
                  onChange={(e) => handleInputChange('interval', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Billing Interval"
                  title="Select billing interval"
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
            </div>

            {/* Fee Breakdown */}
            {formData.amount > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Fee Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Member pays:</span>
                    <span className="font-medium">{formatCurrency(formData.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Platform fee (5%):</span>
                    <span className="text-red-600">-{formatCurrency(fees.platformFee / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Processing fee:</span>
                    <span className="text-red-600">-{formatCurrency(fees.processingFee / 100)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-medium text-gray-900">You receive:</span>
                    <span className="font-medium text-green-600">{formatCurrency(fees.net / 100)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Features</h3>
            
            <div className="space-y-3">
              {formData.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    placeholder="Enter a feature..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {formData.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      aria-label="Remove feature"
                      title="Remove feature"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                onClick={addFeature}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <Plus className="w-4 h-4" />
                Add Feature
              </button>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Settings</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Level
                </label>
                <select
                  value={formData.accessLevel}
                  onChange={(e) => handleInputChange('accessLevel', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  aria-label="Access Level"
                  title="Select access level"
                >
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="vip">VIP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trial Period (days)
                </label>
                <input
                  type="number"
                  value={formData.trialPeriodDays}
                  onChange={(e) => handleInputChange('trialPeriodDays', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  min="0"
                  max="365"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Active (visible to members)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Public (visible to non-members)</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.requiresApproval}
                  onChange={(e) => handleInputChange('requiresApproval', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Requires admin approval after payment</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Set as default plan</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-gray-600 hover:text-gray-800"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <DollarSign className="w-4 h-4" />
              )}
              {loading ? 'Saving...' : (plan ? 'Update Plan' : 'Create Plan')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
