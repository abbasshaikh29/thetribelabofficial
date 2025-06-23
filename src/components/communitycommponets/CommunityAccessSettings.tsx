"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { useNotification } from "@/components/Notification";
import { Globe, Lock, DollarSign, Tag } from "lucide-react";

interface AccessSettings {
  isPrivate: boolean;
  price: number;
  currency: string;
  pricingType: "monthly" | "yearly" | "one_time";
}

export default function CommunityAccessSettings() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<AccessSettings>({
    isPrivate: true,
    price: 0,
    currency: "USD",
    pricingType: "one_time",
  });
  const { showNotification } = useNotification();

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!session?.user) return;

      try {
        setIsLoading(true);
        console.log("Fetching settings for slug:", slug);
        const response = await fetch(`/api/community/${slug}/access-settings`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API error response:", errorData);
          throw new Error(
            errorData.error || "Failed to fetch community access settings"
          );
        }

        const data = await response.json();
        console.log("Received settings data:", data);

        setSettings({
          isPrivate: data.isPrivate !== undefined ? data.isPrivate : true,
          price: data.price !== undefined ? data.price : 0,
          currency: data.currency || "USD",
          pricingType: data.pricingType || "one_time",
        });
      } catch (error) {
        console.error("Error fetching access settings:", error);
        showNotification(
          error instanceof Error
            ? error.message
            : "Failed to fetch community access settings",
          "error"
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.user && slug) {
      fetchSettings();
    }
  }, [slug, session?.user?.id]);

  // Handle visibility toggle
  const handleVisibilityToggle = async () => {
    try {
      setIsSaving(true);
      const newValue = !settings.isPrivate;

      console.log("Toggling visibility to:", newValue);

      const response = await fetch(`/api/community/${slug}/access-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...settings,
          isPrivate: newValue,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(
          errorData.error || "Failed to update community visibility"
        );
      }

      const data = await response.json();
      console.log("Visibility update response:", data);

      setSettings((prevSettings) => ({
        ...prevSettings,
        isPrivate: data.isPrivate !== undefined ? data.isPrivate : true,
      }));

      showNotification(
        `Community is now ${data.isPrivate ? "private" : "public"}`,
        "success"
      );
    } catch (error) {
      console.error("Error updating visibility:", error);
      showNotification(
        error instanceof Error
          ? error.message
          : "Failed to update community visibility",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle price update
  const handlePriceUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSaving(true);

      console.log("Updating price settings:", {
        price: settings.price,
        currency: settings.currency,
        pricingType: settings.pricingType,
      });

      const response = await fetch(`/api/community/${slug}/access-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(errorData.error || "Failed to update community price");
      }

      const data = await response.json();
      console.log("Price update response:", data);

      setSettings((prevSettings) => ({
        ...prevSettings,
        price: data.price !== undefined ? data.price : 0,
        currency: data.currency || "USD",
        pricingType: data.pricingType || "one_time",
      }));

      showNotification("Community price updated successfully", "success");
    } catch (error) {
      console.error("Error updating price:", error);
      showNotification(
        error instanceof Error
          ? error.message
          : "Failed to update community price",
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="bg-base-100 rounded-box shadow-sm p-6">
        <h3 className="text-xl font-bold mb-4">Community Visibility</h3>
        <p className="text-sm text-gray-600 mb-4">
          Control whether your community is private or public. Private
          communities require approval to join.
        </p>

        <div className="form-control">
          <label className="label cursor-pointer justify-start gap-4">
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.isPrivate}
              onChange={handleVisibilityToggle}
              disabled={isSaving}
            />
            <div className="flex items-center gap-2">
              {settings.isPrivate ? (
                <>
                  <Lock size={18} className="text-gray-600" />
                  <span className="label-text font-medium">
                    Private Community
                  </span>
                </>
              ) : (
                <>
                  <Globe size={18} className="text-gray-600" />
                  <span className="label-text font-medium">
                    Public Community
                  </span>
                </>
              )}
            </div>
          </label>
          <p className="text-sm text-gray-500 mt-2 ml-14">
            {settings.isPrivate
              ? "Only approved members can join and view content"
              : "Anyone can request to join and view basic content"}
          </p>
        </div>
      </div>

      <div className="bg-base-100 rounded-box shadow-sm p-6">
        <h3 className="text-xl font-bold mb-4">Community Price</h3>
        <p className="text-sm text-gray-600 mb-4">
          Set a price for joining your community. Set to 0 for free access.
        </p>

        <form onSubmit={handlePriceUpdate} className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="form-control w-full md:w-1/2">
                <label className="label">
                  <span className="label-text">Price ($)</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*"
                  value={settings.price}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      price: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input input-bordered w-full"
                  placeholder="Enter price"
                />
              </div>

              <div className="form-control w-full md:w-1/2">
                <label className="label" htmlFor="currency-select">
                  <span className="label-text">Currency</span>
                </label>
                <select
                  id="currency-select"
                  name="currency"
                  aria-label="Currency"
                  value={settings.currency}
                  onChange={(e) =>
                    setSettings({ ...settings, currency: e.target.value })
                  }
                  className="select select-bordered w-full"
                >
                  <option value="USD">USD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="pricing-type-select">
                <span className="label-text">Pricing Type</span>
              </label>
              <select
                id="pricing-type-select"
                name="pricingType"
                aria-label="Pricing Type"
                value={settings.pricingType}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    pricingType: e.target.value as
                      | "monthly"
                      | "yearly"
                      | "one_time",
                  })
                }
                className="select select-bordered w-full"
              >
                <option value="one_time">One-time Payment (Lifetime)</option>
                <option value="monthly">Monthly Subscription</option>
                <option value="yearly">Yearly Subscription</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {settings.pricingType === "one_time"
                  ? "Members pay once for lifetime access"
                  : settings.pricingType === "monthly"
                    ? "Members pay monthly to maintain access"
                    : "Members pay yearly to maintain access"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Tag size={18} className="text-gray-600" />
            <span className="text-sm font-medium">
              Current price:{" "}
              {settings.price > 0
                ? `${settings.currency === "USD" ? "$" : settings.currency} ${settings.price} ${
                    settings.pricingType === "one_time"
                      ? "(one-time)"
                      : settings.pricingType === "monthly"
                        ? "(per month)"
                        : "(per year)"
                  }`
                : "Free"}
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary mt-4"
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : (
              "Update Price"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
