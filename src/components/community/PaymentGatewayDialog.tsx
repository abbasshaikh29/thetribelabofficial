"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Loader2, CreditCard, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RazorpayInstance, RazorpayOptions } from "@/types/razorpay";

interface PaymentGatewayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
  communitySlug: string;
  communityName: string;
  price: number;
  currency?: string;
  pricingType?: "monthly" | "yearly" | "one_time";
  onSuccess?: () => void;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}
export default function PaymentGatewayDialog({
  isOpen,
  onClose,
  communityId,
  communitySlug,
  communityName,
  price,
  currency = "USD",
  pricingType = "one_time",
  onSuccess,
}: PaymentGatewayDialogProps) {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setIsScriptLoaded(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay script");
      setError("Failed to load payment system");
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(amount);
  };

  const getPriceText = () => {
    let priceText = formatCurrency(price, currency);
    if (pricingType === "monthly") {
      priceText += "/mo";
    } else if (pricingType === "yearly") {
      priceText += "/yr";
    }
    return priceText;
  };

  const verifyPayment = async (
    orderId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      const response = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentId,
          signature,
          communityId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Payment verification failed");
      }

      // Join the community after successful payment
      const joinResponse = await fetch("/api/community/join-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          communityId,
          transactionId: paymentId,
        }),
      });

      if (!joinResponse.ok) {
        const joinData = await joinResponse.json();
        throw new Error(joinData.error || "Failed to join community");
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error) {
      console.error("Payment verification error:", error);
      setError(
        error instanceof Error ? error.message : "Payment verification failed"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!session?.user) {
      setError("Please log in to continue");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create order
      const orderResponse = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: communitySlug,
          amount: price,
          currency,
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
            color: "#fcaa96", // Using --brand-primary color
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          backgroundColor: "var(--modal-bg)",
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              color: "var(--brand-primary)",
              fontSize: "1.25rem",
              fontWeight: "600",
            }}
          >
            Join {communityName}
          </DialogTitle>
          <DialogDescription
            style={{
              color: "var(--text-secondary)",
            }}
          >
            Complete your payment to join this community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--brand-primary)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "0.5rem",
            }}
          >
            <CardHeader className="pb-3">
              <CardTitle
                style={{
                  fontSize: "1.125rem",
                  color: "var(--brand-primary)",
                  fontWeight: "600",
                }}
              >
                Community Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p
                    style={{
                      fontWeight: "500",
                      color: "var(--text-primary)",
                    }}
                  >
                    {communityName}
                  </p>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {pricingType === "monthly" && "Monthly subscription"}
                    {pricingType === "yearly" && "Yearly subscription"}
                    {pricingType === "one_time" && "One-time payment"}
                  </p>
                </div>
                <Badge
                  style={{
                    backgroundColor: "var(--brand-primary)",
                    color: "white",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.375rem",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                  }}
                >
                  {getPriceText()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {error && (
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "var(--brand-error)",
                borderColor: "var(--brand-error)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderRadius: "0.375rem",
                opacity: "0.1",
              }}
            >
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--brand-error)",
                  fontWeight: "500",
                }}
              >
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading}
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                transition: "var(--theme-transition)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                e.currentTarget.style.borderColor = "var(--border-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePayment}
              disabled={!isScriptLoaded || isLoading}
              className="flex-1"
              style={{
                backgroundColor: isLoading
                  ? "var(--text-muted)"
                  : "var(--brand-primary)",
                color: "white",
                borderColor: isLoading
                  ? "var(--text-muted)"
                  : "var(--brand-primary)",
                borderWidth: "1px",
                borderStyle: "solid",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: "500",
                transition: "var(--theme-transition)",
                opacity: isLoading ? "0.6" : "1",
              }}
              onMouseEnter={(e) => {
                if (!isLoading && isScriptLoaded) {
                  e.currentTarget.style.backgroundColor =
                    "var(--brand-secondary)";
                  e.currentTarget.style.borderColor = "var(--brand-secondary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && isScriptLoaded) {
                  e.currentTarget.style.backgroundColor =
                    "var(--brand-primary)";
                  e.currentTarget.style.borderColor = "var(--brand-primary)";
                }
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay {getPriceText()}
                </>
              )}
            </Button>
          </div>

          {!isScriptLoaded && (
            <p
              style={{
                fontSize: "0.75rem",
                textAlign: "center",
                color: "var(--brand-primary)",
                fontWeight: "500",
              }}
            >
              Loading payment system...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
