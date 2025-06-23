"use client";

import React, { useEffect, useState } from "react";

interface Gateway {
  _id: string;
  name: "razorpay" | "stripe";
  isEnabled: boolean;
  credentials?: any;
}

export default function RazorpayConnectForm() {
  const [gateway, setGateway] = useState<Gateway | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(true);
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
        const razor = (data.gateways as Gateway[]).find((g) => g.name === "razorpay") || null;
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
    try {
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
      setMsg("Razorpay account connected successfully");
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <p>Loading gateway...</p>;

  return (
    <div className="bg-base-100 rounded-box shadow p-6 space-y-4">
      <h3 className="text-lg font-semibold">Connect Razorpay Account</h3>
      {msg && <p className="text-green-600 text-sm">{msg}</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}
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
      <button className="btn btn-primary" onClick={handleSave} disabled={!apiKey || !secretKey}>
        {gateway ? "Update" : "Connect"}
      </button>
    </div>
  );
} 