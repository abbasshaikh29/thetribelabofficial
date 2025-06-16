"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface SimplePaymentButtonProps {
  communityId?: string;
  communitySlug?: string;
  buttonText?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
  className?: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const SimplePaymentButton: React.FC<SimplePaymentButtonProps> = ({
  communityId,
  communitySlug,
  buttonText = "Pay Now ($29/month)",
  onSuccess,
  onError,
  className = ""
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
    if (!session?.user) {
      setError("You must be logged in to make a payment");
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

    try {
      // Create community subscription
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
            console.log("Payment completed, verifying...");

            await verifyPayment(
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

  // Verify payment
  const verifyPayment = async (
    subscriptionId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      console.log("Verifying payment signature...");

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

      console.log(`Verification ${verifyResponse.ok ? 'successful' : 'failed'}`);

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
      console.error("Payment verification error:", error);
      setError(error.message);
      onError?.(error.message);
      setIsLoading(false);
    }
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
        disabled={isLoading || !isScriptLoaded}
        className={`${className} ${isLoading || !isScriptLoaded ? 'opacity-50 cursor-not-allowed' : ''}`}
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
