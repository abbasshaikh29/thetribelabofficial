"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Checkout from "@/components/payments/Checkout";

interface Community {
  _id: string;
  name: string;
  price?: number;
  pricingType?: string;
  paymentGatewayId?: string;
}

export default function SubscribePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/community/${slug}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load community");
        }
        const data = await res.json();
        setCommunity(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  if (loading) return <div className="p-6">Loading...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!community) return <div className="p-6">Community not found.</div>;

  // TODO (Task 4.3): Replace with actual dynamic checkout component
  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Subscribe to {community.name}</h1>
      <p>
        Price: {community.price ? `$${community.price}` : "Free"}
        {community.pricingType === "monthly" && "/month"}
        {community.pricingType === "yearly" && "/year"}
      </p>
      {community.paymentGatewayId ? (
        <Checkout communitySlug={slug} />
      ) : (
        <div className="text-red-500">Community has no payment gateway configured.</div>
      )}
      <button className="btn btn-outline" onClick={() => router.back()}>
        Go Back
      </button>
    </div>
  );
} 