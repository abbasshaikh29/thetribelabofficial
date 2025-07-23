"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface GatewayCredentials {
  [key: string]: string;
}

interface Gateway {
  _id: string;
  name: "stripe" | "razorpay";
  isEnabled: boolean;
  credentials: GatewayCredentials;
}

export default function PaymentSettingsPage() {
  const router = useRouter();
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: "stripe" as "stripe" | "razorpay",
    isEnabled: true,
    credentials: "" // JSON string
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // UI state for plugin list vs edit form
  const [editingName, setEditingName] = useState<"stripe" | "razorpay" | null>(null);

  // Fetch existing gateways
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/payment-gateways");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to fetch gateways");
        }
        const data = await res.json();
        setGateways(data.gateways);

        // If we arrived with a search param ?edit=razorpay etc. open edit directly
        const params = new URLSearchParams(window.location.search);
        const editParam = params.get("edit") as "stripe" | "razorpay" | null;
        if (editParam && (editParam === "stripe" || editParam === "razorpay")) {
          setEditingName(editParam);
          const gw = data.gateways.find((g: Gateway) => g.name === editParam);
          if (gw) {
            setForm({
              name: gw.name,
              isEnabled: gw.isEnabled,
              credentials: JSON.stringify(gw.credentials || {}, null, 2),
            });
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Helper to open edit form
  const handleEditClick = (name: "stripe" | "razorpay") => {
    const gw = gateways.find((g) => g.name === name);
    setEditingName(name);
    if (gw) {
      setForm({
        name: gw.name,
        isEnabled: gw.isEnabled,
        credentials: JSON.stringify(gw.credentials || {}, null, 2),
      });
    } else {
      // default empty credentials for new gateway
      setForm({ name, isEnabled: true, credentials: "" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    let credentialsObj: GatewayCredentials = {};
    try {
      credentialsObj = JSON.parse(form.credentials || "{}");
    } catch (err) {
      setError("Credentials must be valid JSON");
      return;
    }

    try {
      const res = await fetch("/api/admin/payment-gateways", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          isEnabled: form.isEnabled,
          credentials: credentialsObj
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save gateway");
      }
      setMessage("Gateway saved successfully");
      // refresh list
      setGateways((prev) => {
        const existingIndex = prev.findIndex((g) => g.name === data.gateway.name);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = data.gateway;
          return updated;
        }
        return [...prev, data.gateway];
      });
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Determine ON/OFF status
  const isGatewayEnabled = (name: "stripe" | "razorpay") => {
    const gw = gateways.find((g) => g.name === name);
    return gw ? gw.isEnabled : false;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Payment Gateway Settings</h1>

      {/* Plugin style list */}
      <div className="space-y-4 mb-8">
        {["razorpay", "stripe"].map((name) => {
          const enabled = isGatewayEnabled(name as any);
          const logoSrc =
            name === "razorpay"
              ? "/razorpay-logo.svg"
              : "https://raw.githubusercontent.com/stripe/stripe-client-libraries-demo/master/logo.png";
          const label = name === "razorpay" ? "Razorpay" : "Stripe";
          const description =
            name === "razorpay"
              ? "Accept payments via Razorpay."
              : "Accept payments via Stripe.";
          return (
            <div
              key={name}
              className="flex items-center justify-between bg-base-100 border rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                {/* Logo */}
                <img
                  src={logoSrc}
                  alt={label}
                  width={40}
                  height={40}
                  className="w-10 h-10 object-contain"
                />
                <div>
                  <p className="font-medium text-lg">
                    {label} {enabled ? (
                      <span className="text-green-600 text-sm ml-1">(On)</span>
                    ) : (
                      <span className="text-gray-400 text-sm ml-1">(Off)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">{description}</p>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => handleEditClick(name as any)}
              >
                EDIT
              </button>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      {editingName && <hr className="my-6" />}

      {error && <p className="text-red-500 mb-4">{error}</p>}
      {message && <p className="text-green-600 mb-4">{message}</p>}

      {/* Show form only when editing */}
      {editingName && (
        <>
          <h2 className="text-xl font-semibold mb-2 capitalize">
            Edit {editingName} Gateway
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Provider</label>
              <input
                name="name"
                title="Provider"
                aria-label="Provider"
                type="text"
                value={form.name}
                disabled
                className="border p-2 rounded w-full bg-gray-100 cursor-not-allowed"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={form.isEnabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isEnabled: e.target.checked }))
                }
              />
              <label htmlFor="enabled">Enabled</label>
            </div>
            <div>
              <label className="block font-medium mb-1">Credentials (JSON)</label>
              <textarea
                name="credentials"
                title="Credentials"
                aria-label="Credentials"
                value={form.credentials}
                onChange={(e) =>
                  setForm((f) => ({ ...f, credentials: e.target.value }))
                }
                rows={6}
                className="border p-2 rounded w-full font-mono"
              />
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save Gateway
              </button>
              <button
                type="button"
                onClick={() => setEditingName(null)}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </>
      )}

      {/* If not editing show notice */}
      {!editingName && (
        <p className="text-gray-500 text-sm">
          Select a gateway above to edit its settings.
        </p>
      )}
    </div>
  );
} 