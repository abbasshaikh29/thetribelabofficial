"use client";

import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Settings,
  ExternalLink
} from 'lucide-react';

interface IRouteAccountStatus {
  isReady: boolean;
  status: string;
  kycStatus: string;
  missingRequirements: string[];
  canReceivePayouts: boolean;
}

interface IRouteAccount {
  id: string;
  status: string;
  kycStatus: string;
  routeAccountId?: string;
  settlementSchedule: string;
  minimumPayoutAmount: number;
  totalPayoutsReceived: number;
  totalPayoutsCount: number;
  lastPayoutAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface RouteAccountStatusProps {
  onSetupClick?: () => void;
  showSetupButton?: boolean;
}

export default function RouteAccountStatus({ onSetupClick, showSetupButton = true }: RouteAccountStatusProps) {
  const [status, setStatus] = useState<IRouteAccountStatus | null>(null);
  const [account, setAccount] = useState<IRouteAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccountStatus();
  }, []);

  const fetchAccountStatus = async () => {
    try {
      setError(null);
      const response = await fetch('/api/admin/route-account/status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch account status');
      }

      const data = await response.json();
      setStatus(data.status);
      setAccount(data.account);
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to fetch account status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/route-account/status', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to sync account status');
      }

      const data = await response.json();
      setStatus(data.status);
      setAccount(data.account);
    } catch (error: any) {
      setError(error.message);
      console.error('Failed to sync account status:', error);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activated': return 'text-green-600 bg-green-100';
      case 'under_review': return 'text-yellow-600 bg-yellow-100';
      case 'pending': return 'text-blue-600 bg-blue-100';
      case 'suspended': return 'text-red-600 bg-red-100';
      case 'rejected': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'activated': return <CheckCircle className="w-5 h-5" />;
      case 'under_review': return <Clock className="w-5 h-5" />;
      case 'pending': return <Clock className="w-5 h-5" />;
      case 'suspended': return <AlertCircle className="w-5 h-5" />;
      case 'rejected': return <AlertCircle className="w-5 h-5" />;
      default: return <Clock className="w-5 h-5" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 100).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-semibold">Error Loading Account Status</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={fetchAccountStatus}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status || status.status === 'not_created') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Set Up Payment Account
          </h3>
          <p className="text-gray-600 mb-6">
            Create your Route account to start receiving payments from community members.
          </p>
          {showSetupButton && (
            <button
              onClick={onSetupClick}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Set Up Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Status Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Payment Account Status</h3>
          <button
            onClick={handleSyncStatus}
            disabled={syncing}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Account Status */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.status)}`}>
                {getStatusIcon(status.status)}
                {status.status.replace('_', ' ').toUpperCase()}
              </div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">KYC Status:</span>
                <span className={`font-medium ${status.kycStatus === 'verified' ? 'text-green-600' : 'text-yellow-600'}`}>
                  {status.kycStatus.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Can Receive Payouts:</span>
                <span className={`font-medium ${status.canReceivePayouts ? 'text-green-600' : 'text-red-600'}`}>
                  {status.canReceivePayouts ? 'Yes' : 'No'}
                </span>
              </div>
              {account?.routeAccountId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Route Account ID:</span>
                  <span className="font-mono text-xs">{account.routeAccountId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Requirements */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Requirements</h4>
            {status.missingRequirements.length > 0 ? (
              <div className="space-y-2">
                {status.missingRequirements.map((requirement, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    {requirement}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                All requirements met
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payout Statistics */}
      {account && status.canReceivePayouts && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Payout Statistics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(account.totalPayoutsReceived)}
              </div>
              <div className="text-sm text-gray-600">Total Received</div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {account.totalPayoutsCount}
              </div>
              <div className="text-sm text-gray-600">Total Payouts</div>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {account.lastPayoutAt ? formatDate(account.lastPayoutAt) : 'Never'}
              </div>
              <div className="text-sm text-gray-600">Last Payout</div>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings */}
      {account && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Account Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Settlement Schedule
              </label>
              <div className="text-sm text-gray-900 capitalize">
                {account.settlementSchedule}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Payout Amount
              </label>
              <div className="text-sm text-gray-900">
                {formatCurrency(account.minimumPayoutAmount)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Created
              </label>
              <div className="text-sm text-gray-900">
                {formatDate(account.createdAt)}
              </div>
            </div>

            {account.activatedAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Activated
                </label>
                <div className="text-sm text-gray-900">
                  {formatDate(account.activatedAt)}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-4">
              <button className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <Settings className="w-4 h-4" />
                Update Settings
              </button>
              <button className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800">
                <ExternalLink className="w-4 h-4" />
                View in Razorpay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
