"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// Unified interface for community subscription checkout
interface CommunitySubscriptionCheckoutProps {
  communityId?: string; // For existing communities upgrading
  communitySlug?: string; // Community slug for redirect
  buttonText?: string | React.ReactNode;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  onStart?: () => void; // Called when payment process starts
  className?: string;
  customButton?: (props: any) => React.ReactNode; // Custom button renderer
  disabled?: boolean;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const CommunitySubscriptionCheckout: React.FC<CommunitySubscriptionCheckoutProps> = ({
  communityId,
  communitySlug,
  buttonText = "Start 14-Day Free Trial",
  onSuccess,
  onError,
  onStart,
  className = "",
  customButton,
  disabled = false
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpayScript = () => {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          setIsScriptLoaded(true);
          resolve(true);
          return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          setIsScriptLoaded(true);
          resolve(true);
        };
        script.onerror = () => {
          setError("Failed to load payment gateway");
          resolve(false);
        };
        document.body.appendChild(script);
      });
    };

    loadRazorpayScript();
  }, []);

  const handleSubscription = async () => {
    if (!session?.user) {
      setError("You must be logged in to start a subscription");
      return;
    }

    if (!isScriptLoaded) {
      setError("Payment gateway is not ready. Please try again.");
      return;
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      setError("Razorpay configuration error: Public key not found");
      return;
    }

    setIsLoading(true);
    setError(null);
    onStart?.(); // Notify that payment process has started

    try {
      // Create community subscription with standardized plan
      const response = await fetch("/api/community-subscriptions/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId,
          adminId: session.user.id,
          customerNotify: true,
          notes: {
            planName: "Community Management Plan",
            adminEmail: session.user.email,
            communityId: communityId || "new"
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create subscription");
      }

      const { subscription, razorpaySubscription, shortUrl } = data;

      // If subscription requires authentication, open Razorpay checkout
      if (razorpaySubscription.status === "created" && shortUrl) {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          subscription_id: razorpaySubscription.id,
          name: "TheTribeLab",
          description: "Community Management Plan - $29/month",
          handler: async function (response: any) {
            await verifySubscriptionPayment(
              response.razorpay_subscription_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );
          },
          prefill: {
            name: session.user.name || "",
            email: session.user.email || "",
          },
          theme: {
            color: "#F37021",
          },
          modal: {
            ondismiss: function() {
              console.log("Subscription modal dismissed by user");
              setIsLoading(false);
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        // Subscription created successfully (trial period)
        onSuccess?.(subscription);
        // Redirect to community slug URL as requested
        if (communitySlug) {
          router.push(`/Newcompage/${communitySlug}?subscription=activated`);
        } else if (communityId) {
          // Fallback: try to get community slug from ID
          router.push(`/Newcompage/${communityId}?subscription=activated`);
        } else {
          router.push(`/admin/communities?subscription=created`);
        }
      }
    } catch (error: any) {
      console.error("Subscription error:", error);
      setError(error.message || "An error occurred during subscription");
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify subscription payment
  const verifySubscriptionPayment = async (
    subscriptionId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      const verifyResponse = await fetch("/api/community-subscriptions/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId,
          paymentId,
          signature,
          communityId
        }),
      });

      const verifyData = await verifyResponse.json();

      if (verifyResponse.ok) {
        // Reset loading state before calling success callback
        setIsLoading(false);

        onSuccess?.(verifyData.subscription);

        // Redirect to community slug URL as requested
        if (communitySlug) {
          router.push(`/Newcompage/${communitySlug}?subscription=success`);
        } else if (communityId) {
          // Fallback: try using communityId as slug (in case it's already a slug)
          router.push(`/Newcompage/${communityId}?subscription=success`);
        } else {
          router.push(`/admin/communities?subscription=success`);
        }
      } else {
        throw new Error(verifyData.error || "Subscription verification failed");
      }
    } catch (error: any) {
      console.error("Subscription verification error:", error);
      setError(error.message);
      onError?.(error.message);
      setIsLoading(false); // Reset loading state on error
    }
  };

  return (
    <div className={`community-subscription-checkout ${className}`}>
      {/* Standardized Plan Information */}
      <div className="mb-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-lg text-gray-900 mb-2">Community Management Plan</h3>
        <p className="text-gray-600 text-sm mb-3">Complete community management solution with unlimited features</p>
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-blue-600">
            $29<span className="text-sm font-normal text-gray-500">/month</span>
          </div>
          <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded">
            14 days free trial • Unlimited access
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">Processed as ₹2,400 INR</p>
      </div>

      {/* Core Features - Always Unlimited */}
      <div className="mb-4 p-4 bg-green-50 rounded-lg">
        <h4 className="font-medium text-green-900 mb-2">✨ Unlimited Access Included:</h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Unlimited Members
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Unlimited Storage
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Unlimited Events
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Unlimited Channels
          </div>
        </div>
      </div>

      {/* Additional Features */}
      <div className="mb-4">
        <h4 className="font-medium text-gray-900 mb-2">Additional Features:</h4>
        <ul className="space-y-1">
          <li className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-blue-500 mr-2 flex-shr-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Analytics & insights
          </li>
          <li className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Email support
          </li>
          <li className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Cancel anytime
          </li>
        </ul>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {customButton ? (
        customButton({
          onClick: handleSubscription,
          disabled: disabled || isLoading || !isScriptLoaded,
          isLoading,
          isScriptLoaded,
          buttonText
        })
      ) : (
        <button
          type="button"
          onClick={handleSubscription}
          disabled={disabled || isLoading || !isScriptLoaded}
          className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </div>
          ) : !isScriptLoaded ? (
            "Loading..."
          ) : (
            buttonText
          )}
        </button>
      )}

      <p className="text-xs text-gray-500 text-center mt-3">
        Secure payment powered by Razorpay • Cancel anytime
      </p>
    </div>
  );
};

// Legacy wrapper for backward compatibility with billing page
const RazorpayCheckout: React.FC<any> = (props) => {
  // Convert legacy props to new subscription format
  return (
    <CommunitySubscriptionCheckout
      communityId={props.communityId}
      communitySlug={props.communitySlug}
      buttonText={props.buttonText || "Subscribe Now ($29/month)"}
      onSuccess={props.onSuccess}
      onError={props.onError}
      className={props.className}
    />
  );
};

export default RazorpayCheckout;
export { CommunitySubscriptionCheckout };
