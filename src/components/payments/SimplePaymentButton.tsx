"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { RazorpayOptions, RazorpayPaymentResponse } from "@/types/razorpay";

interface SimplePaymentButtonProps {
  communityId?: string;
  communitySlug?: string;
  buttonText?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  className?: string;
  disabled?: boolean;
}

const SimplePaymentButton: React.FC<SimplePaymentButtonProps> = ({
  communityId,
  communitySlug,
  buttonText = "Pay Now ($29/month)",
  onSuccess,
  onError,
  className = "",
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

  const handlePayment = async () => {
    console.log('🔄 Payment button clicked');
    console.log('Session:', session?.user ? 'Authenticated' : 'Not authenticated');
    console.log('Script loaded:', isScriptLoaded);
    console.log('Razorpay key:', process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? 'Set' : 'Not set');

    if (!session?.user) {
      console.error('❌ User not authenticated');
      setError("You must be logged in to make a payment");
      return;
    }

    if (!isScriptLoaded) {
      console.error('❌ Razorpay script not loaded');
      setError("Payment gateway is not ready. Please try again.");
      return;
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) {
      console.error('❌ Razorpay key not found');
      setError("Razorpay configuration error: Public key not found");
      return;
    }

    console.log('✅ All checks passed, creating subscription...');
    setIsLoading(true);
    setError(null);

    try {
      // Create community subscription
      console.log('📡 Making API call to create subscription...');
      console.log('Community ID:', communityId);
      console.log('Admin ID:', session.user.id);

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

      console.log('📡 API response status:', response.status);
      const data = await response.json();
      console.log('📡 API response data:', data);

      if (!response.ok) {
        console.error('❌ API call failed:', data);
        throw new Error(data.error || "Failed to create subscription");
      }

      const { subscription, razorpaySubscription, shortUrl } = data;

      // If subscription requires authentication, open Razorpay checkout
      if (razorpaySubscription.status === "created" && shortUrl) {
        const options: RazorpayOptions = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          subscription_id: razorpaySubscription.id,
          name: "TheTribeLab",
          description: "Community Management Plan - $29/month",
          handler: async function (response: RazorpayPaymentResponse) {
            console.log("Payment completed, verifying...");

            await verifyPayment(
              response.razorpay_subscription_id!,
              response.razorpay_payment_id!,
              response.razorpay_signature!
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
              console.log("Payment modal dismissed by user");
              setIsLoading(false);
            }
          }
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        // Subscription created successfully
        onSuccess?.(subscription);
        // Redirect to community slug URL
        if (communitySlug) {
          router.push(`/Newcompage/${communitySlug}?subscription=activated`);
        } else if (communityId) {
          router.push(`/Newcompage/${communityId}?subscription=activated`);
        }
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      setError(error.message || "An error occurred during payment");
      onError?.(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Verify payment with optimized timeout and retry logic
  const verifyPayment = async (
    subscriptionId: string,
    paymentId: string,
    signature: string
  ) => {
    const maxRetries = 2;
    let retryCount = 0;

    const attemptVerification = async (): Promise<void> => {
      try {
        console.log(`Verifying payment signature... (attempt ${retryCount + 1}/${maxRetries + 1})`);
        setIsLoading(true);

        // Progressive timeout: start with 15s, then 30s, then 45s
        const timeoutMs = 15000 + (retryCount * 15000);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        const verifyData = await verifyResponse.json();

        console.log(`Verification ${verifyResponse.ok ? 'successful' : 'failed'} in ${verifyData.processingTime || 'unknown'}ms`);

        if (verifyResponse.ok) {
          setIsLoading(false);
          onSuccess?.(verifyData.subscription);

          // Redirect to community slug URL
          if (communitySlug) {
            router.push(`/Newcompage/${communitySlug}?subscription=success`);
          } else if (communityId) {
            router.push(`/Newcompage/${communityId}?subscription=success`);
          }
        } else {
          console.error("Verification failed:", verifyData);
          throw new Error(verifyData.error || "Payment verification failed");
        }
      } catch (error: any) {
        console.error(`Payment verification error (attempt ${retryCount + 1}):`, error);

        if (error.name === 'AbortError' && retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying payment verification... (${retryCount}/${maxRetries})`);
          setError(`Verification timeout. Retrying... (${retryCount}/${maxRetries})`);

          // Wait 2 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
          return attemptVerification();
        }

        // Final error handling
        if (error.name === 'AbortError') {
          setError("Payment verification is taking longer than expected. Your payment may still be processing. Please check your subscription status in a few minutes.");
        } else {
          setError(error.message || "Payment verification failed");
        }

        onError?.(error.message);
        setIsLoading(false);
      }
    };

    return attemptVerification();
  };

  return (
    <div className="simple-payment-button w-full max-w-full">
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-center">
          <p className="text-red-600 text-xs break-words">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handlePayment}
        disabled={disabled || isLoading || !isScriptLoaded}
        className={`${className} ${disabled || isLoading || !isScriptLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    </div>
  );
};

export default SimplePaymentButton;
