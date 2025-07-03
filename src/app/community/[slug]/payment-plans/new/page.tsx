"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import Header from "@/components/Header";

export default function NewPaymentPlanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState("INR");
  const [billingInterval, setBillingInterval] = useState<
    "one_time" | "monthly" | "yearly"
  >("monthly");
  const [intervalCount, setIntervalCount] = useState<number>(1);
  const [features, setFeatures] = useState<string[]>([""]);

  useEffect(() => {
    const checkCommunityAccess = async () => {
      if (status === "loading") return;

      if (!session) {
        router.push(
          `/api/auth/signin?callbackUrl=/community/${slug}/payment-plans/new`
        );
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch community details
        const response = await fetch(`/api/community/${slug}`);

        if (!response.ok) {
          throw new Error("Failed to fetch community details");
        }

        const community = await response.json();
        setCommunityId(community._id);

        // Check if user is admin
        const isUserAdmin = community.admin === session.user.id;
        setIsAdmin(isUserAdmin);

        if (!isUserAdmin) {
          router.push(`/community/${slug}`);
        }
      } catch (error) {
        console.error("Error checking community access:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to check community access"
        );
      } finally {
        setIsLoading(false);
      }
    };

    checkCommunityAccess();
  }, [session, status, slug, router]);

  // Add a new feature field
  const addFeature = () => {
    setFeatures([...features, ""]);
  };

  // Remove a feature field
  const removeFeature = (index: number) => {
    const newFeatures = [...features];
    newFeatures.splice(index, 1);
    setFeatures(newFeatures);
  };

  // Update a feature value
  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!communityId) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Filter out empty features
      const filteredFeatures = features.filter(
        (feature) => feature.trim() !== ""
      );

      // Create payment plan
      const response = await fetch("/api/payments/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          amount: parseFloat(amount.toString()),
          currency,
          interval: billingInterval,
          intervalCount: parseInt(intervalCount.toString()),
          features: filteredFeatures,
          planType: "community",
          communityId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create payment plan");
      }

      setSuccess("Payment plan created successfully");

      // Redirect to payment settings page after a short delay
      setTimeout(() => {
        router.push(`/community/${slug}/payment-settings`);
      }, 1500);
    } catch (error) {
      console.error("Error creating payment plan:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create payment plan"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-halloween-orange" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !isSaving) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
            <p>Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-halloween-purple mb-2">
            Create Payment Plan
          </h1>
          <p className="text-halloween-black/70">
            Create a new payment plan for your community members
          </p>
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

        <div className="bg-white rounded-lg shadow-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="form-control">
              <label htmlFor="name" className="label">
                <span className="label-text font-medium">Plan Name</span>
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input input-bordered w-full"
                placeholder="e.g. Basic Plan, Premium Membership"
                required
              />
            </div>

            <div className="form-control">
              <label htmlFor="description" className="label">
                <span className="label-text font-medium">Description</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea textarea-bordered w-full"
                placeholder="Describe what members get with this plan"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label htmlFor="amount" className="label">
                  <span className="label-text font-medium">Price</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  id="amount"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = parseFloat(value);
                    if (value === "" || (!isNaN(numValue) && numValue >= 0)) {
                      setAmount(value === "" ? 0 : numValue);
                    }
                  }}
                  className="input input-bordered w-full"
                  placeholder="e.g. 10.00"
                  required
                  min="0"
                />
              </div>

              <div className="form-control">
                <label htmlFor="currency" className="label">
                  <span className="label-text font-medium">Currency</span>
                </label>
                <select
                  id="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="select select-bordered w-full"
                  required
                >
                  <option value="INR">Indian Rupee (₹)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                  <option value="GBP">British Pound (£)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="form-control">
                <label htmlFor="interval" className="label">
                  <span className="label-text font-medium">
                    Billing Interval
                  </span>
                </label>
                <select
                  id="interval"
                  value={billingInterval}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Validate input to prevent code injection
                    if (
                      value === "one_time" ||
                      value === "monthly" ||
                      value === "yearly"
                    ) {
                      setBillingInterval(
                        value as "one_time" | "monthly" | "yearly"
                      );
                    }
                  }}
                  className="select select-bordered w-full"
                  required
                >
                  <option value="one_time">One-time Payment</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {billingInterval !== "one_time" && (
                <div className="form-control">
                  <label htmlFor="intervalCount" className="label">
                    <span className="label-text font-medium">
                      Interval Count
                    </span>
                  </label>
                  <input
                    type="number"
                    id="intervalCount"
                    value={intervalCount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Validate and sanitize numeric input
                      const numValue = parseInt(value, 10);
                      if (
                        !isNaN(numValue) &&
                        numValue >= 1 &&
                        numValue <= 999
                      ) {
                        setIntervalCount(numValue);
                      }
                    }}
                    className="input input-bordered w-full"
                    placeholder="1"
                    min="1"
                    required
                  />
                  <span className="text-xs text-halloween-black/60 mt-1">
                    {billingInterval === "monthly"
                      ? "Number of months between charges"
                      : "Number of years between charges"}
                  </span>
                </div>
              )}
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Plan Features</span>
              </label>

              <div className="space-y-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={feature}
                      onChange={(e) => updateFeature(index, e.target.value)}
                      className="input input-bordered w-full"
                      placeholder={`Feature ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="btn btn-ghost btn-square text-red-500"
                      disabled={features.length === 1}
                      aria-label="Remove feature"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addFeature}
                className="btn btn-ghost mt-3 text-halloween-orange"
              >
                <Plus className="w-5 h-5 mr-1" />
                Add Feature
              </button>
            </div>

            <div className="flex justify-end gap-4 mt-8">
              <button
                type="button"
                onClick={() =>
                  router.push(`/community/${slug}/payment-settings`)
                }
                className="btn btn-ghost"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn bg-halloween-orange text-white hover:bg-halloween-orange/90 border-none"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Create Plan"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
