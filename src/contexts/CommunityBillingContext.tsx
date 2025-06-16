"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface CommunityBillingData {
  _id: string;
  adminTrialInfo?: {
    activated: boolean;
    startDate?: string;
    endDate?: string;
    hasUsedTrial?: boolean;
    trialUsedAt?: string;
    cancelled?: boolean;
    cancelledDate?: string;
  };
  paymentStatus?: "unpaid" | "trial" | "paid" | "expired";
  subscriptionEndDate?: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  freeTrialActivated?: boolean;
}

interface CommunityBillingContextType {
  billingData: CommunityBillingData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  refreshBillingData: () => Promise<void>;
  updateBillingData: (data: Partial<CommunityBillingData>) => void;
  // Computed values (from status endpoint when available)
  daysRemaining: number;
  trialActive: boolean;
  subscriptionActive: boolean;
  percentRemaining: number;
  // Add slug to context
  slug: string | null;
}

const CommunityBillingContext = createContext<CommunityBillingContextType | undefined>(undefined);

export const useCommunityBilling = () => {
  const context = useContext(CommunityBillingContext);
  if (!context) {
    throw new Error("useCommunityBilling must be used within a CommunityBillingProvider");
  }
  return context;
};

interface CommunityBillingProviderProps {
  children: ReactNode;
}

export const CommunityBillingProvider: React.FC<CommunityBillingProviderProps> = ({ children }) => {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [billingData, setBillingData] = useState<CommunityBillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Store status endpoint values directly
  const [statusData, setStatusData] = useState<{
    hasActiveSubscription: boolean;
    hasActiveTrial: boolean;
    daysRemaining: number;
  } | null>(null);

  const fetchBillingData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      if (isRefresh) setRefreshing(true);
      setError(null);

      console.log('CommunityBillingContext: Starting fetch for slug:', slug, 'session:', !!session?.user?.id);

      // Use the same comprehensive status endpoint as the billing page
      const statusResponse = await fetch(`/api/community/${slug}/status`, {
        method: 'GET',
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "Content-Type": "application/json",
        },
      });

      console.log('Status endpoint response status:', statusResponse.status, statusResponse.ok);

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('Community status data received (context):', JSON.stringify(statusData, null, 2));

        if (statusData.found && statusData.community) {
          const newBillingData = {
            _id: statusData.community._id.toString(),
            adminTrialInfo: statusData.community.adminTrialInfo,
            paymentStatus: statusData.community.paymentStatus,
            subscriptionEndDate: statusData.community.subscriptionEndDate,
            subscriptionId: statusData.community.subscriptionId,
            subscriptionStatus: statusData.community.subscriptionStatus,
            freeTrialActivated: statusData.community.freeTrialActivated,
          };

          // Store the authoritative status values from the endpoint
          setStatusData({
            hasActiveSubscription: statusData.hasActiveSubscription || false,
            hasActiveTrial: statusData.hasActiveTrial || false,
            daysRemaining: statusData.daysRemaining || 0,
          });

          console.log('Setting billing data from status (context):', newBillingData);
          console.log('Setting status data (context):', {
            hasActiveSubscription: statusData.hasActiveSubscription,
            hasActiveTrial: statusData.hasActiveTrial,
            daysRemaining: statusData.daysRemaining,
          });
          setBillingData(newBillingData);
          return; // Exit early if status endpoint worked
        } else {
          console.log('Status endpoint returned data but no community found:', statusData);
        }
      } else {
        const errorText = await statusResponse.text();
        console.log('Status endpoint failed with status:', statusResponse.status, 'error:', errorText);
      }

      // Fallback to basic community endpoint if status endpoint fails
      console.log('Status endpoint failed, falling back to basic community endpoint');
      const response = await fetch(`/api/community/${slug}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      console.log('Basic community endpoint response status:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('Basic community endpoint failed:', errorText);
        throw new Error("Failed to fetch community data");
      }

      const data = await response.json();
      console.log('Community billing data received (context fallback):', JSON.stringify(data, null, 2));

      if (data && data._id) {
        const newBillingData = {
          _id: data._id.toString(),
          adminTrialInfo: data.adminTrialInfo,
          paymentStatus: data.paymentStatus,
          subscriptionEndDate: data.subscriptionEndDate,
          subscriptionId: data.subscriptionId,
          subscriptionStatus: data.subscriptionStatus,
          freeTrialActivated: data.freeTrialActivated,
        };

        console.log('Setting billing data (context fallback):', newBillingData);
        setBillingData(newBillingData);
        // Clear status data since we're using fallback
        setStatusData(null);
      } else {
        console.log('Basic community endpoint returned data but no valid community:', data);
      }
    } catch (err) {
      console.error("Error fetching billing data:", err);
      setError("Failed to load billing information");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshBillingData = async () => {
    await fetchBillingData(true);
  };

  const updateBillingData = (updates: Partial<CommunityBillingData>) => {
    setBillingData(prev => prev ? { ...prev, ...updates } : null);
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    if (slug && session?.user?.id) {
      console.log('CommunityBillingContext: Initial fetch triggered for slug:', slug, 'user:', session.user.id);
      fetchBillingData();
    } else {
      console.log('CommunityBillingContext: Skipping fetch - slug:', slug, 'session:', !!session?.user?.id);
    }
  }, [slug, session?.user?.id]);

  useEffect(() => {
    if (!slug || !session?.user?.id) return;

    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing billing data (context)...');
      fetchBillingData(true);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [slug, session?.user?.id]);

  // Computed values - use status endpoint data when available, fallback to local calculations
  const calculateDaysRemaining = () => {
    if (!billingData?.adminTrialInfo?.endDate) return 0;

    const endDate = new Date(billingData.adminTrialInfo.endDate);
    const today = new Date();

    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 0;
  };

  const isTrialActiveFallback = () => {
    if (billingData?.paymentStatus === 'paid') {
      return false;
    }

    const hasActiveAdminTrial = billingData?.adminTrialInfo?.activated === true &&
      billingData?.adminTrialInfo?.endDate &&
      new Date(billingData.adminTrialInfo.endDate) > new Date();

    const hasActiveLegacyTrial = billingData?.freeTrialActivated === true &&
      billingData?.subscriptionEndDate &&
      new Date(billingData.subscriptionEndDate) > new Date() &&
      billingData?.paymentStatus === 'trial';

    return hasActiveAdminTrial || hasActiveLegacyTrial;
  };

  const isSubscriptionActiveFallback = () => {
    return billingData?.paymentStatus === 'paid' &&
      billingData?.subscriptionEndDate &&
      new Date(billingData.subscriptionEndDate) > new Date();
  };

  // Use status endpoint data when available, otherwise use fallback calculations
  const daysRemaining = statusData?.daysRemaining ?? calculateDaysRemaining();
  const trialActive = statusData ? statusData.hasActiveTrial : isTrialActiveFallback();
  const subscriptionActive = statusData ? statusData.hasActiveSubscription : isSubscriptionActiveFallback();
  const percentRemaining = trialActive ? (daysRemaining / 14) * 100 : 0;

  // Debug logging removed for production build

  const contextValue: CommunityBillingContextType = {
    billingData,
    loading,
    error,
    refreshing,
    refreshBillingData,
    updateBillingData,
    daysRemaining,
    trialActive: Boolean(trialActive),
    subscriptionActive: Boolean(subscriptionActive),
    percentRemaining,
    slug,
  };

  return (
    <CommunityBillingContext.Provider value={contextValue}>
      {children}
    </CommunityBillingContext.Provider>
  );
};
