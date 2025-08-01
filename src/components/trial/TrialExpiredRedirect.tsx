"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface TrialExpiredRedirectProps {
  communitySlug: string;
}

/**
 * Component that redirects admins to billing page when trial expires
 * This serves as a backup to the middleware
 */
export default function TrialExpiredRedirect({ communitySlug }: TrialExpiredRedirectProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Only check for authenticated users
    if (!session?.user?.id || checking) return;

    const checkTrialStatus = async () => {
      try {
        setChecking(true);

        // Check community status
        const response = await fetch(`/api/community/${communitySlug}/status`, {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          console.error('Failed to check community status');
          return;
        }

        const statusData = await response.json();

        // Check if user is admin of this community
        const isAdmin = statusData.community &&
                        session.user.id === statusData.community.admin;

        if (isAdmin) {
          // If no active trial and no active subscription, redirect to billing
          const hasActiveAccess = statusData.hasActiveSubscription ||
                                 statusData.hasActiveTrial;

          if (!hasActiveAccess) {
            console.log('🔄 Trial expired, redirecting to billing page...');
            router.push(`/billing/${communitySlug}?expired=true`);
          }
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
      } finally {
        setChecking(false);
      }
    };

    checkTrialStatus();
  }, [session, communitySlug, router, checking]);

  // This component doesn't render anything
  return null;
}


