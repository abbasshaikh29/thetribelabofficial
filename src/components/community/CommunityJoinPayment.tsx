"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CreditCard } from "lucide-react";
import Script from "next/script";
import type { RazorpayOptions, RazorpayInstance } from "@/types/razorpay";

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface CommunityJoinPaymentProps {
  communityId: string;
  communitySlug: string;
  communityName: string;
}

const CommunityJoinPayment: React.FC<CommunityJoinPaymentProps> = ({
  communityId,
  communitySlug,
  communityName,
}) => {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [community, setCommunity] = useState<any>(null);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  // Fetch community data
  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const response = await fetch(`/api/community/${communitySlug}`);
        if (!response.ok) {
          throw new Error("Failed to fetch community details");
        }
        const data = await response.json();
        setCommunity(data);
        console.log("Community data loaded:", data);
      } catch (error) {
        console.error("Error fetching community:", error);
        setError("Failed to load community details");
      }
    };

    fetchCommunity();
  }, [communitySlug]);

  // Fallback script loading mechanism
  useEffect(() => {
    // Check if Razorpay is already loaded
    if (window.Razorpay) {
      console.log("Razorpay already available");
      setIsScriptLoaded(true);
      return;
    }

    // Fallback: manually load script if Next.js Script component fails
    const timer = setTimeout(() => {
      if (!isScriptLoaded && !window.Razorpay) {
        console.log("Attempting manual script load...");
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => {
          console.log("Razorpay script loaded manually");
          setIsScriptLoaded(true);
        };
        script.onerror = () => {
          console.error("Failed to load Razorpay script manually");
          setError(
            "Failed to load payment system. Please check your internet connection."
          );
        };
        document.head.appendChild(script);
      }
    }, 3000); // Wait 3 seconds before fallback

    return () => clearTimeout(timer);
  }, [isScriptLoaded]);

  // Handle payment
  const handlePayment = async () => {
    console.log("Payment button clicked");
    console.log("Community:", community);
    console.log("Session:", session?.user);
    console.log("Script loaded:", isScriptLoaded);
    console.log("Razorpay available:", !!window.Razorpay);

    if (!community) {
      setError("Community data not loaded");
      return;
    }

    if (!session?.user) {
      setError("Please sign in to continue");
      return;
    }

    if (!isScriptLoaded) {
      setError("Payment system not ready. Please wait or refresh the page.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create payment order
      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: communitySlug,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create payment order");
      }

      const orderData = await orderResponse.json();

      if (orderData.gateway === "razorpay") {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          order_id: orderData.session.id,
          name: "TheTribeLab",
          description: `Join ${communityName}`,
          handler: async function (response: any) {
            await verifyPayment(
              orderData.session.id,
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
            ondismiss: function () {
              console.log("Payment modal dismissed by user");
              setIsLoading(false);
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      } else {
        throw new Error("Unsupported payment gateway");
      }
    } catch (error) {
      console.error("Payment error:", error);
      setError(error instanceof Error ? error.message : "Payment failed");
      setIsLoading(false);
    }
  };

  // Verify payment and join community
  const verifyPayment = async (
    orderId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      // Verify payment
      const verifyResponse = await fetch("/api/payments/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          orderId,
          paymentId,
          signature,
          communitySlug,
        }),
      });

      if (!verifyResponse.ok) {
        throw new Error("Payment verification failed");
      }

      const verifyData = await verifyResponse.json();
      setSuccess("Payment successful! Joining community...");

      // Join community after successful payment
      const joinResponse = await fetch("/api/community/join-paid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          communityId,
          transactionId: verifyData.transactionId,
        }),
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json();
        throw new Error(errorData.error || "Failed to join community");
      }

      setSuccess("Successfully joined community!");

      // Redirect to community page after a short delay
      setTimeout(() => {
        router.push(`/Newcompage/${communitySlug}`);
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error("Error verifying payment or joining community:", error);
      setError(
        error instanceof Error ? error.message : "Failed to complete payment"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => {
          console.log("Razorpay script loaded successfully");
          setIsScriptLoaded(true);
        }}
        onError={(e) => {
          console.error("Failed to load Razorpay script:", e);
          setError("Failed to load payment system. Please refresh the page.");
        }}
      />

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-halloween-purple mb-2">
            Join {communityName}
          </h2>
          <p className="text-halloween-black/70">
            Complete your payment to join this paid community.
          </p>
          {community && community.price > 0 && (
            <div className="mt-4">
              <span className="text-3xl font-bold text-halloween-orange">
                {formatCurrency(community.price, community.currency || "USD")}
              </span>
              {community.pricingType &&
                community.pricingType !== "one_time" && (
                  <span className="text-halloween-black/70 ml-1">
                    /{community.pricingType === "monthly" ? "month" : "year"}
                  </span>
                )}
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error mb-6">
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-6">
            <p>{success}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-halloween-orange" />
          </div>
        ) : community ? (
          <div className="text-center">
            {!isScriptLoaded && (
              <div className="mb-4 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Loading payment system...
              </div>
            )}

            <button
              type="button"
              onClick={handlePayment}
              disabled={!isScriptLoaded || isLoading}
              className="btn px-8 py-3 text-lg border-none transition-colors duration-200"
              style={{
                backgroundColor:
                  !isScriptLoaded || isLoading
                    ? "var(--neutral)"
                    : "var(--brand-primary)",
                color: "var(--primary-content)",
              }}
              onMouseEnter={(e) => {
                if (isScriptLoaded && !isLoading) {
                  e.currentTarget.style.backgroundColor =
                    "var(--brand-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (isScriptLoaded && !isLoading) {
                  e.currentTarget.style.backgroundColor =
                    "var(--brand-primary)";
                }
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  {community.price > 0
                    ? `Pay ${formatCurrency(community.price, community.currency || "USD")} & Join`
                    : "Join Community"}
                </>
              )}
            </button>

            {!isScriptLoaded && (
              <p
                className="text-xs mt-2"
                style={{ color: "var(--brand-primary)" }}
              >
                Waiting for payment system to load...
              </p>
            )}

            {isScriptLoaded && (
              <p
                className="text-xs mt-3"
                style={{ color: "var(--text-secondary)" }}
              >
                Secure payment powered by Razorpay
              </p>
            )}
          </div>
        ) : (
          <div className="flex justify-center items-center py-8">
            <Loader2
              className="w-8 h-8 animate-spin"
              style={{ color: "var(--brand-primary)" }}
            />
            <span className="ml-2" style={{ color: "var(--text-primary)" }}>
              Loading community details...
            </span>
          </div>
        )}
      </div>
    </>
  );
};

export default CommunityJoinPayment;
