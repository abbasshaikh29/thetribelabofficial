"use client";

import React, { useState, useEffect } from "react";

interface MigrationStatus {
  totalCommunities: number;
  communitiesWithPlans: number;
  communitiesWithoutPlans: number;
  migrationNeeded: boolean;
  legacyPlanExists: boolean;
  legacyPlanId?: string;
}

const CommunityMigration: React.FC = () => {
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    checkMigrationStatus();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/migrate-communities");
      const data = await response.json();

      if (response.ok) {
        setStatus(data.migration);
      } else {
        setError(data.error || "Failed to check migration status");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm("Are you sure you want to migrate all communities to the subscription model?")) {
      return;
    }

    try {
      setMigrating(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/admin/migrate-communities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Successfully migrated ${data.updated} communities to subscription model`);
        await checkMigrationStatus(); // Refresh status
      } else {
        setError(data.error || "Failed to run migration");
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setMigrating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="community-migration bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Community Subscription Migration
      </h2>
      
      <p className="text-gray-600 mb-6">
        This tool migrates existing communities to the new subscription-only model.
        Communities without subscription plans will be assigned a default "Legacy Starter" plan with a 14-day trial.
      </p>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      {status && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Migration Status</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status.totalCommunities}</div>
              <div className="text-sm text-blue-800">Total Communities</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{status.communitiesWithPlans}</div>
              <div className="text-sm text-green-800">With Subscription Plans</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{status.communitiesWithoutPlans}</div>
              <div className="text-sm text-yellow-800">Need Migration</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Migration Progress</span>
              <span className="text-sm text-gray-500">
                {status.communitiesWithPlans} / {status.totalCommunities}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${status.totalCommunities > 0 ? (status.communitiesWithPlans / status.totalCommunities) * 100 : 0}%` 
                }}
              ></div>
            </div>
          </div>

          {status.migrationNeeded ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Migration Required
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <p>
                      {status.communitiesWithoutPlans} communities need to be migrated to the subscription model.
                      This will assign them a default "Legacy Starter" plan with unlimited access and a 14-day trial period.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Migration Complete
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>All communities have been successfully migrated to the subscription model.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4">
        <button
          onClick={checkMigrationStatus}
          disabled={loading}
          className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Checking..." : "Refresh Status"}
        </button>

        {status?.migrationNeeded && (
          <button
            onClick={runMigration}
            disabled={migrating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {migrating ? "Migrating..." : `Migrate ${status.communitiesWithoutPlans} Communities`}
          </button>
        )}
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <h4 className="font-medium text-gray-700 mb-2">What this migration does:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Creates a "Legacy Starter" plan with unlimited access</li>
          <li>Assigns this plan to all communities without subscription plans</li>
          <li>Sets communities to "trial" status with 14-day trial period</li>
          <li>Enables unlimited members, storage, events, and channels</li>
          <li>Allows community admins to upgrade to paid plans later</li>
        </ul>
      </div>
    </div>
  );
};

export default CommunityMigration;
