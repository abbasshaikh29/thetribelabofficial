"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, Clock, X, CreditCard } from 'lucide-react';
import { useCommunityBilling } from '@/contexts/CommunityBillingContext';
import { useSettingsModal } from '@/components/modals/SettingsModalProvider';

interface TrialReminderBannerProps {
  communityId?: string;
  communitySlug?: string;
  className?: string;
}

export default function TrialReminderBanner({ 
  communityId, 
  communitySlug, 
  className = "" 
}: TrialReminderBannerProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const { openSettingsModal } = useSettingsModal();
  const {
    billingData,
    loading,
    daysRemaining,
    trialActive,
    subscriptionActive
  } = useCommunityBilling();

  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Get community slug from params if not provided
  const currentSlug = communitySlug || (params?.slug as string);

  useEffect(() => {
    // Only show banner if:
    // 1. User is logged in
    // 2. Trial is active
    // 3. 7 days or less remaining
    // 4. User hasn't dismissed it
    // 5. Not already subscribed
    if (
      session?.user &&
      trialActive &&
      daysRemaining !== null &&
      daysRemaining <= 7 &&
      !dismissed &&
      !subscriptionActive &&
      !loading
    ) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [session, trialActive, daysRemaining, dismissed, subscriptionActive, loading]);

  const handlePayNow = () => {
    if (currentSlug) {
      // Open settings modal with billing tab
      openSettingsModal('billing');
    } else {
      // Fallback to billing page
      router.push('/admin/billing');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store dismissal in localStorage to persist across page reloads
    if (typeof window !== 'undefined' && currentSlug) {
      localStorage.setItem(`trial-banner-dismissed-${currentSlug}`, Date.now().toString());
    }
  };

  // Check if banner was previously dismissed (within last 24 hours)
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSlug) {
      const dismissedTime = localStorage.getItem(`trial-banner-dismissed-${currentSlug}`);
      if (dismissedTime) {
        const dismissedAt = parseInt(dismissedTime);
        const now = Date.now();
        const hoursSinceDismissed = (now - dismissedAt) / (1000 * 60 * 60);
        
        // Re-show banner after 24 hours or if less than 2 days remaining
        if (hoursSinceDismissed < 24 && daysRemaining !== null && daysRemaining > 2) {
          setDismissed(true);
        }
      }
    }
  }, [currentSlug, daysRemaining]);

  if (!isVisible || loading) {
    return null;
  }

  const getUrgencyLevel = () => {
    if (daysRemaining === null) return 'medium';
    if (daysRemaining <= 1) return 'critical';
    if (daysRemaining <= 2) return 'high';
    if (daysRemaining <= 3) return 'medium';
    return 'low';
  };

  const getUrgencyStyles = () => {
    const urgency = getUrgencyLevel();
    switch (urgency) {
      case 'critical':
        return {
          bg: 'bg-red-50 border-red-200',
          text: 'text-red-800',
          button: 'bg-red-600 hover:bg-red-700 text-white',
          icon: 'text-red-600'
        };
      case 'high':
        return {
          bg: 'bg-orange-50 border-orange-200',
          text: 'text-orange-800',
          button: 'bg-orange-600 hover:bg-orange-700 text-white',
          icon: 'text-orange-600'
        };
      case 'medium':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          text: 'text-yellow-800',
          button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
          icon: 'text-yellow-600'
        };
      default:
        return {
          bg: 'bg-blue-50 border-blue-200',
          text: 'text-blue-800',
          button: 'bg-blue-600 hover:bg-blue-700 text-white',
          icon: 'text-blue-600'
        };
    }
  };

  const styles = getUrgencyStyles();
  const urgency = getUrgencyLevel();

  const getUrgencyIcon = () => {
    if (urgency === 'critical' || urgency === 'high') {
      return <AlertTriangle className="w-5 h-5" />;
    }
    return <Clock className="w-5 h-5" />;
  };

  const getUrgencyText = () => {
    if (daysRemaining === null) return '';
    if (daysRemaining === 0) return 'Trial expires today!';
    if (daysRemaining === 1) return 'Trial expires tomorrow!';
    return `Trial expires in ${daysRemaining} days`;
  };

  const getMessage = () => {
    if (urgency === 'critical') {
      return 'Your community will be suspended after trial expiration. Subscribe now to avoid interruption.';
    }
    if (urgency === 'high') {
      return 'Your community will be suspended soon. Subscribe now to maintain access.';
    }
    return 'Subscribe now to avoid community suspension and maintain unlimited access.';
  };

  return (
    <div className={`${styles.bg} border ${styles.text} rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className={`${styles.icon} mt-0.5`}>
            {getUrgencyIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-sm">
                {getUrgencyText()}
              </h3>
              {urgency === 'critical' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  URGENT
                </span>
              )}
            </div>
            
            <p className="text-sm opacity-90 mb-3">
              {getMessage()}
            </p>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePayNow}
                className={`${styles.button} px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center space-x-2`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Subscribe Now ($29/month)</span>
              </button>
              
              <span className="text-xs opacity-75">
                Unlimited features • Cancel anytime
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
          aria-label="Dismiss notification"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// Compact version for smaller spaces
export function CompactTrialReminderBanner({ 
  communityId, 
  communitySlug, 
  className = "" 
}: TrialReminderBannerProps) {
  const { data: session } = useSession();
  const { openSettingsModal } = useSettingsModal();
  const {
    daysRemaining,
    trialActive,
    subscriptionActive,
    loading
  } = useCommunityBilling();

  const [dismissed, setDismissed] = useState(false);

  if (
    !session?.user ||
    !trialActive ||
    daysRemaining === null ||
    daysRemaining > 7 ||
    dismissed ||
    subscriptionActive ||
    loading
  ) {
    return null;
  }

  const handlePayNow = () => {
    openSettingsModal('billing');
  };

  const urgency = daysRemaining <= 2 ? 'critical' : 'medium';
  const bgColor = urgency === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';

  return (
    <div className={`${bgColor} px-3 py-2 rounded-md text-sm flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-2">
        <Clock className="w-4 h-4" />
        <span className="font-medium">
          Trial expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={handlePayNow}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded text-xs font-medium transition-colors duration-200"
        >
          Subscribe
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="hover:bg-white hover:bg-opacity-20 p-1 rounded transition-colors duration-200"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
