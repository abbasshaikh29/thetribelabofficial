"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Gateway {
  _id: string;
  name: "razorpay" | "stripe";
  isEnabled: boolean;
  credentials?: any;
}

export default function RazorpayConnectForm() {
  const { slug } = useParams<{ slug: string }>();
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // load current user gateway
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/user/payment-gateways");
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || "Failed to load gateways");
        }
        const data = await res.json();
        const razor =
          (data.gateways as Gateway[]).find((g) => g.name === "razorpay") ||
          null;
        setGateway(razor);
        if (razor?.credentials) {
          setApiKey(razor.credentials.apiKey || "");
          setSecretKey(razor.credentials.secretKey || "");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async () => {
    setError(null);
    setMsg(null);
    setSaving(true);
    try {
      // First, create/update the payment gateway
      const res = await fetch("/api/user/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "razorpay",
          isEnabled: true,
          credentials: { apiKey, secretKey },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setGateway(data.gateway);

      // If we have a community slug, associate this gateway with the community
      if (slug && data.gateway?._id) {
        try {
          const communityRes = await fetch(
            `/api/community/${slug}/payment-gateway`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentGatewayId: data.gateway._id,
              }),
            }
          );

          if (!communityRes.ok) {
            console.warn(
              "Failed to associate gateway with community, but gateway was saved"
            );
          }
        } catch (associationError) {
          console.warn(
            "Failed to associate gateway with community:",
            associationError
          );
        }
      }

      setMsg("Razorpay account connected successfully");

      // Clear success message after 5 seconds
      setTimeout(() => {
        setMsg(null);
      }, 5000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading gateway...</p>;

  return (
    <div className="bg-base-100 rounded-box shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Connect Razorpay Account</h3>
        {gateway && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-sm text-green-600 font-medium">
              Connected
            </span>
          </div>
        )}
      </div>

      {msg && (
        <div className="alert alert-success">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{msg}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium">Key ID</label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="rzp_live_..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Key Secret</label>
          <input
            type="password"
            className="input input-bordered w-full"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            placeholder="********"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className={`btn ${
            gateway ? "btn-outline btn-primary" : "btn-primary"
          }`}
          onClick={handleSave}
          disabled={!apiKey || !secretKey || saving}
        >
          {saving ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Saving...
            </>
          ) : gateway ? (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Update Credentials
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Connect Razorpay
            </>
          )}
        </button>

        {gateway && (
          <div className="text-sm text-gray-600">
            Last updated: {new Date().toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
}
