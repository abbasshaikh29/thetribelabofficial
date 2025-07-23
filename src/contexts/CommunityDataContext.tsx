"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";

interface CommunityData {
  _id: string;
  name: string;
  description?: string;
  admin: string;
  subAdmins?: string[];
  members?: string[];
  bannerImageurl?: string;
  iconImageUrl?: string;
  joinRequests?: any[];
  isPrivate?: boolean;
  price?: number;
  currency?: string;
  pricingType?: string;
  adminQuestions?: string[];
  // Add other fields as needed
}

interface CommunityDataContextType {
  communityData: CommunityData | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isMember: boolean;
  refetchCommunityData: () => Promise<void>;
}

const CommunityDataContext = createContext<
  CommunityDataContextType | undefined
>(undefined);

interface CommunityDataProviderProps {
  children: React.ReactNode;
  slug: string;
}

export function CommunityDataProvider({
  children,
  slug,
}: CommunityDataProviderProps) {
  const { data: session } = useSession();
  const [communityData, setCommunityData] = useState<CommunityData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);

  const fetchCommunityData = useCallback(async () => {
    if (!session?.user || !slug) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/community/${slug}`);

      if (!response.ok) {
        throw new Error("Failed to fetch community data");
      }

      const data = await response.json();
      setCommunityData(data);

      // Set user roles
      const userId = session.user.id;
      setIsAdmin(data.admin === userId);
      setIsSubAdmin(data.subAdmins?.includes(userId) || false);
      setIsMember(data.members?.includes(userId) || false);
    } catch (err) {
      console.error("Error fetching community data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch community data"
      );
    } finally {
      setLoading(false);
    }
  }, [session?.user, slug]);

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  const contextValue: CommunityDataContextType = {
    communityData,
    loading,
    error,
    isAdmin,
    isSubAdmin,
    isMember,
    refetchCommunityData: fetchCommunityData,
  };

  return (
    <CommunityDataContext.Provider value={contextValue}>
      {children}
    </CommunityDataContext.Provider>
  );
}

export function useCommunityData() {
  const context = useContext(CommunityDataContext);
  if (context === undefined) {
    throw new Error(
      "useCommunityData must be used within a CommunityDataProvider"
    );
  }
  return context;
}
