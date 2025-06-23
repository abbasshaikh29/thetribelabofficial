"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import { useSession } from "next-auth/react";

export default function PaymentSettings() {
  const { data: session } = useSession();
  const [paymentInfo, setPaymentInfo] = useState({
    cardNumber: "",
    expiration: "",
    cvc: "",
    billingAddress: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Available gateways definitions (could be moved to separate config)
  const GATEWAY_OPTIONS: Array<{ name: "razorpay" | "stripe"; label: string; logo: string }> = [
    { name: "razorpay", label: "Razorpay", logo: "/razorpay-logo.svg" },
    { name: "stripe", label: "Stripe", logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" },
  ];

  // Gateways fetched for the current user
  interface UserGateway {
    _id: string;
    name: "stripe" | "razorpay";
    isEnabled: boolean; // whether platform admin enabled it
  }

  const [userGateways, setUserGateways] = useState<UserGateway[]>([]);

  // UI state: show plugin list or edit form and selected gateway
  const [showForm, setShowForm] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<"stripe" | "razorpay" | null>(null);

  // Helper to reset form visibility
  const openEdit = (gateway: "stripe" | "razorpay") => {
    setSelectedGateway(gateway);
    setShowForm(true);
  };
  const closeEdit = () => {
    setShowForm(false);
    setSelectedGateway(null);
    setError("");
    setSuccess("");
  };

  // Load user gateways on mount
  React.useEffect(() => {
    async function loadGateways() {
      try {
        const res = await fetch("/api/user/payment-gateways");
        const data = await res.json();
        setUserGateways(data.gateways || []);
      } catch (err) {
        console.error("Failed to load user gateways", err);
      }
    }
    loadGateways();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPaymentInfo({ ...paymentInfo, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/user/payment", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentInfo),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to update payment information"
        );
      }

      setSuccess("Payment information updated successfully");
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update payment information"
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-base-100 rounded-box shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Payment Settings</h2>

      {/* Dynamic plugin list */}
      {!showForm && (
        <div className="space-y-4 mb-6">
          {GATEWAY_OPTIONS.map((gw) => {
            const userGw = userGateways.find((g) => g.name === gw.name);
            const isConnected = Boolean(userGw);
            return (
              <div
                key={gw.name}
                className="flex items-center justify-between border rounded-lg p-4"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={gw.logo}
                    alt={gw.label}
                    width={40}
                    height={40}
                    className="w-10 h-10 object-contain"
                  />
                  <div>
                    <p className="font-medium text-lg">
                      {gw.label}{" "}
                      <span
                        className={`${isConnected ? "text-green-600" : "text-gray-400"} text-sm ml-1`}
                      >
                        ({isConnected ? "On" : "Off"})
                      </span>
                    </p>
                    <p className="text-sm text-gray-500">
                      {`Manage your ${gw.label} payment method.`}
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => openEdit(gw.name)}
                >
                  {isConnected ? "EDIT" : "CONNECT"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Existing payment form */}
      {showForm && selectedGateway && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-control">
            <label htmlFor="cardNumber" className="label">
              <span className="label-text">{selectedGateway} Card Number</span>
            </label>
            <input
              type="text"
              id="cardNumber"
              name="cardNumber"
              value={paymentInfo.cardNumber}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="1234 5678 9012 3456"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label htmlFor="expiration" className="label">
                <span className="label-text">Expiration Date</span>
              </label>
              <input
                type="text"
                id="expiration"
                name="expiration"
                value={paymentInfo.expiration}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="MM/YY"
                required
              />
            </div>
            <div className="form-control">
              <label htmlFor="cvc" className="label">
                <span className="label-text">CVC</span>
              </label>
              <input
                type="text"
                id="cvc"
                name="cvc"
                value={paymentInfo.cvc}
                onChange={handleChange}
                className="input input-bordered w-full"
                placeholder="CVC"
                required
              />
            </div>
          </div>
          <div className="form-control">
            <label htmlFor="billingAddress" className="label">
              <span className="label-text">Billing Address</span>
            </label>
            <input
              type="text"
              id="billingAddress"
              name="billingAddress"
              value={paymentInfo.billingAddress}
              onChange={handleChange}
              className="input input-bordered w-full"
              placeholder="123 Main St, City, Country"
              required
            />
          </div>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          {success && (
            <div className="text-green-500 text-sm mt-2">{success}</div>
          )}
          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              Save Payment Information
            </button>
            <button type="button" className="btn btn-outline" onClick={closeEdit}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
