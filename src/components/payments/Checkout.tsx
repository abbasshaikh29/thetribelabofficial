"use client";

import React, { useEffect, useState } from "react";
import Script from "next/script";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { RazorpayOptions, RazorpayPaymentResponse } from "@/types/razorpay";

interface CheckoutProps {
  communitySlug: string;
}

export default function Checkout({ communitySlug }: CheckoutProps) {
  const [gateway, setGateway] = useState<"stripe" | "razorpay" | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/payments/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: communitySlug })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create order");
        setGateway(data.gateway);
        setSessionData(data.session);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [communitySlug]);

  if (loading) return <p>Initializing payment...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!gateway) return <p>No payment gateway configured.</p>;

  if (gateway === "stripe") {
    return <StripeCheckout session={sessionData} />;
  }
  if (gateway === "razorpay") {
    return <RazorpayCheckout order={sessionData} />;
  }
  return null;
}

const stripePromise = typeof window !== "undefined" && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

function StripeCheckout({ session }: { session: any }) {
  if (!stripePromise || !session?.client_secret) {
    return <p className="text-red-500">Stripe not configured.</p>;
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: session.client_secret }}>
      <StripeForm />
    </Elements>
  );
}

function StripeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      setError(error.message || "Payment failed");
      setSubmitting(false);
    } else {
      window.location.reload(); // or redirect to community page; backend webhook will activate membership
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 border p-4 rounded">
      <PaymentElement />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={submitting || !stripe}>
        {submitting ? "Processing..." : "Pay"}
      </button>
    </form>
  );
}

function RazorpayCheckout({ order }: { order: any }) {
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded) return;
    if (!order) return;

    const options: RazorpayOptions = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      name: "Community Subscription",
      order_id: order.id,
      handler: async function (response: RazorpayPaymentResponse) {
        try {
          // Send payment details to backend for verification
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: order.id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              subscriptionId: response.razorpay_subscription_id,
            }),
          });
          const data = await verifyRes.json();
          if (!verifyRes.ok || !data.success) {
            throw new Error(data.error || "Payment verification failed");
          }

          // Verification successful – redirect
          window.location.href = `/community/${order.slug}`;
        } catch (err: any) {
          alert(err.message || "Payment verification failed. Please contact support.");
        }
      },
      prefill: {},
      theme: { color: "#3182ce" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }, [scriptLoaded, order]);

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />
      <p>Redirecting to Razorpay...</p>
    </>
  );
} 