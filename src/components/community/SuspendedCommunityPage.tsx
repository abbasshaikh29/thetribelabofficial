"use client";

import React from 'react';
import { useSession } from 'next-auth/react';
import { AlertTriangle, Clock, Shield, Users, Database, RefreshCw } from 'lucide-react';
import { UrgentPayNowButton } from '@/components/payments/PayNowButton';

interface SuspendedCommunityPageProps {
  communityId: string;
  communityName: string;
  communitySlug?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  isAdmin?: boolean;
  onReactivation?: () => void;
}

export default function SuspendedCommunityPage({
  communityId,
  communityName,
  communitySlug,
  suspendedAt,
  suspensionReason = 'trial_expired',
  isAdmin = false,
  onReactivation
}: SuspendedCommunityPageProps) {
  const { data: session } = useSession();

  const formatSuspensionDate = (dateString?: string) => {
    if (!dateString) return 'Recently';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSuspensionMessage = () => {
    switch (suspensionReason) {
      case 'trial_expired':
        return 'This community has been suspended because the free trial period has expired.';
      case 'payment_failed':
        return 'This community has been suspended due to failed payment attempts.';
      case 'admin_action':
        return 'This community has been suspended by the administrator.';
      default:
        return 'This community is currently suspended.';
    }
  };

  const getReactivationMessage = () => {
    if (suspensionReason === 'trial_expired') {
      return 'Subscribe now to reactivate your community and restore full access for all members.';
    }
    return 'Please resolve the payment issue to reactivate your community.';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main suspension notice */}
        <div className="bg-white rounded-lg shadow-lg border border-red-200 overflow-hidden">
          {/* Header */}
          <div className="bg-red-50 border-b border-red-200 p-6">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-red-900">
                  Community Suspended
                </h1>
                <p className="text-red-700 mt-1">
                  {communityName}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Suspension details */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                What happened?
              </h2>
              <p className="text-red-800 mb-3">
                {getSuspensionMessage()}
              </p>
              <div className="flex items-center text-sm text-red-700">
                <Clock className="w-4 h-4 mr-2" />
                <span>Suspended: {formatSuspensionDate(suspendedAt)}</span>
              </div>
            </div>

            {/* Impact explanation */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">
                Current Impact
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-start space-x-3">
                  <Users className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Member Access</p>
                    <p className="text-sm text-yellow-800">All members are blocked from accessing the community</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-900">Features Disabled</p>
                    <p className="text-sm text-yellow-800">All community features are temporarily disabled</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Database className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">Data Safe</p>
                    <p className="text-sm text-green-800">Your data is preserved and will be restored</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin reactivation section */}
            {isAdmin && session?.user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  Reactivate Your Community
                </h3>
                <p className="text-blue-800 mb-4">
                  {getReactivationMessage()}
                </p>
                
                <div className="space-y-4">
                  <UrgentPayNowButton
                    communityId={communityId}
                    communitySlug={communitySlug}
                    buttonText="Reactivate Community - $29/month"
                    context="suspension"
                    onSuccess={(subscription) => {
                      console.log('Community reactivated:', subscription);
                      onReactivation?.();
                    }}
                    onError={(error) => {
                      console.error('Reactivation error:', error);
                    }}
                  />
                  
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2">
                      What happens after reactivation?
                    </h4>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li className="flex items-center">
                        <RefreshCw className="w-4 h-4 mr-2 text-green-600" />
                        Community access restored within minutes
                      </li>
                      <li className="flex items-center">
                        <Users className="w-4 h-4 mr-2 text-green-600" />
                        All members regain full access
                      </li>
                      <li className="flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-green-600" />
                        All features and data fully restored
                      </li>
                      <li className="flex items-center">
                        <Database className="w-4 h-4 mr-2 text-green-600" />
                        No data loss - everything preserved
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Non-admin message */}
            {!isAdmin && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Community Temporarily Unavailable
                </h3>
                <p className="text-gray-700 mb-4">
                  This community is currently suspended. Please contact the community administrator for more information.
                </p>
                <p className="text-sm text-gray-600">
                  The community will be restored once the administrator resolves the suspension.
                </p>
              </div>
            )}

            {/* Support information */}
            <div className="border-t border-gray-200 pt-6">
              <div className="text-center">
                <h4 className="font-semibold text-gray-900 mb-2">
                  Need Help?
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  If you have questions about this suspension or need assistance, please contact our support team.
                </p>
                <div className="flex justify-center space-x-4 text-sm">
                  <a 
                    href="mailto:support@thetribelab.com" 
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Email Support
                  </a>
                  <span className="text-gray-400">|</span>
                  <a 
                    href="/help" 
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Help Center
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional information */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Community ID: {communityId} • Suspended: {formatSuspensionDate(suspendedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

// Compact version for embedding in other components
export function SuspendedCommunityBanner({
  communityName,
  isAdmin = false,
  onReactivate
}: {
  communityName: string;
  isAdmin?: boolean;
  onReactivate?: () => void;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900">
            {communityName} is Suspended
          </h3>
          <p className="text-sm text-red-800 mt-1">
            This community is currently suspended due to trial expiration.
            {isAdmin ? ' Subscribe to reactivate immediately.' : ' Contact the administrator for more information.'}
          </p>
          {isAdmin && (
            <button
              onClick={onReactivate}
              className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            >
              Reactivate Community
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
