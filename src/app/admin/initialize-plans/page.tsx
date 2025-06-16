"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, AlertCircle, CreditCard, Settings } from "lucide-react";

interface Plan {
  _id: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  interval: string;
  trialPeriodDays: number;
  features: string[];
  razorpayPlanId: string;
  isActive: boolean;
}

export default function InitializePlansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }
    fetchPlans();
  }, [session, status, router]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/initialize-plans");
      const data = await response.json();

      if (response.ok) {
        setPlans(data.plans || []);
      } else {
        setError(data.error || "Failed to fetch plans");
      }
    } catch (error: any) {
      setError("Failed to fetch plans: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const initializePlans = async () => {
    setInitializing(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/initialize-plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setPlans(data.plans || []);
      } else {
        setError(data.error || "Failed to initialize plans");
      }
    } catch (error: any) {
      setError("Failed to initialize plans: " + error.message);
    } finally {
      setInitializing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8" />
            Initialize Subscription Plans
          </h1>
          <p className="text-base-content/70">
            Set up default subscription plans for community management
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="alert alert-error mb-6">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success mb-6">
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        {/* Current Status */}
        <div className="card bg-base-200 shadow-md mb-6">
          <div className="card-body">
            <h2 className="card-title flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Current Status
            </h2>
            
            {plans.length > 0 ? (
              <div className="space-y-4">
                <div className="alert alert-success">
                  <CheckCircle className="w-5 h-5" />
                  <span>Found {plans.length} active subscription plans</span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th>Plan Name</th>
                        <th>Price</th>
                        <th>Trial Period</th>
                        <th>Razorpay ID</th>
                        <th>Features</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((plan) => (
                        <tr key={plan._id}>
                          <td>
                            <div>
                              <div className="font-bold">{plan.name}</div>
                              <div className="text-sm opacity-50">{plan.description}</div>
                            </div>
                          </td>
                          <td>
                            <span className="font-mono">
                              ₹{(plan.amount / 100).toFixed(2)}/{plan.interval}
                            </span>
                          </td>
                          <td>{plan.trialPeriodDays} days</td>
                          <td>
                            <code className="text-xs bg-base-300 px-2 py-1 rounded">
                              {plan.razorpayPlanId}
                            </code>
                          </td>
                          <td>
                            <span className="badge badge-outline">
                              {plan.features.length} features
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="alert alert-warning">
                  <AlertCircle className="w-5 h-5" />
                  <span>No subscription plans found</span>
                </div>
                
                <p className="text-sm text-base-content/70">
                  You need to initialize subscription plans before users can subscribe to communities.
                  This will create default plans in both your database and Razorpay.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card bg-base-200 shadow-md">
          <div className="card-body">
            <h2 className="card-title">Actions</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Initialize Default Plans</h3>
                <p className="text-sm text-base-content/70 mb-4">
                  This will create default subscription plans including Starter (₹9.99/month) and Pro (₹29.99/month) 
                  with proper Razorpay integration.
                </p>
                
                <button
                  onClick={initializePlans}
                  disabled={initializing}
                  className="btn btn-primary"
                >
                  {initializing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Initializing Plans...
                    </>
                  ) : (
                    "Initialize Default Plans"
                  )}
                </button>
              </div>

              <div className="divider"></div>

              <div>
                <h3 className="font-semibold mb-2">Refresh Status</h3>
                <p className="text-sm text-base-content/70 mb-4">
                  Check the current status of subscription plans.
                </p>
                
                <button
                  onClick={fetchPlans}
                  disabled={loading}
                  className="btn btn-outline"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Refreshing...
                    </>
                  ) : (
                    "Refresh Status"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost"
          >
            ← Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
