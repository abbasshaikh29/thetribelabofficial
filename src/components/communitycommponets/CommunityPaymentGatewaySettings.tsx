"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Gateway {
  _id: string;
  name: "stripe" | "razorpay";
  isEnabled: boolean;
}

interface CommunityPaymentGatewaySettingsProps {
  onEditGateway: (name: "stripe" | "razorpay") => void;
}

const POTENTIAL_GATEWAYS: Array<{
  name: "razorpay" | "stripe";
  label: string;
  logo: string;
}> = [
  {
    name: "razorpay",
    label: "Razorpay",
    logo: "/razorpay-logo.svg",
  },
  {
    name: "stripe",
    label: "Stripe",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg",
  },
];

export default function CommunityPaymentGatewaySettings({
  onEditGateway,
}: CommunityPaymentGatewaySettingsProps) {
  const { slug } = useParams<{ slug: string }>();
  const [dbGateways, setDbGateways] = useState<Gateway[]>([]);
  const [communityGatewayId, setCommunityGatewayId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [gateRes, commRes] = await Promise.all([
          fetch("/api/payment-gateways"),
          fetch(`/api/community/${slug}`),
        ]);
        const gateData = gateRes.ok ? await gateRes.json() : { gateways: [] };
        const commData = commRes.ok ? await commRes.json() : {};
        setDbGateways(gateData.gateways || []);
        setCommunityGatewayId(commData.paymentGatewayId || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug]);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Connect a Payment Gateway</h3>
      <p className="text-sm text-gray-500">
        Select a payment provider to accept payments from your members.
      </p>
      {error && <p className="text-red-500">{error}</p>}

      <div className="space-y-4">
        {POTENTIAL_GATEWAYS.map((pg) => {
          const dbGateway = dbGateways.find((g) => g.name === pg.name);
          const isEnabledByAdmin = dbGateway?.isEnabled || false;
          const isSelected = communityGatewayId === dbGateway?._id;

          return (
            <div
              key={pg.name}
              className={`flex items-center justify-between border rounded-lg p-4 shadow-sm ${
                isSelected ? "border-primary ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <img
                  src={pg.logo}
                  alt={pg.label}
                  width={48}
                  height={48}
                  className="w-12 h-12 object-contain"
                />
                <div>
                  <p className="font-medium text-lg capitalize">
                    {pg.label}{" "}
                    {isSelected && (
                      <span className="text-green-600 text-sm ml-1">
                        (Active)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {`Connect your ${pg.label} account`}
                  </p>
                  {!isEnabledByAdmin && !isSelected && (
                     <p className="text-xs text-orange-500 mt-1">
                       This gateway is not enabled by the platform admin.
                     </p>
                  )}
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => onEditGateway(pg.name)}
                disabled={!isEnabledByAdmin && !isSelected}
              >
                {isSelected ? "EDIT" : "CONNECT"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
} 