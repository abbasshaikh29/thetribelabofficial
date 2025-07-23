"use client";

import React, { useState, useEffect, lazy, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import SettingsModal from "./SettingsModal";
import {
  CommunityBillingProvider,
  useCommunityBilling,
} from "@/contexts/CommunityBillingContext";
import {
  CommunityDataProvider,
  useCommunityData,
} from "@/contexts/CommunityDataContext";
import PlanInfoCard from "@/components/billing/PlanInfoCard";
import NoSSR from "@/components/common/NoSSR";

// Lazy load heavy components for better performance
const UserCommunitySettings = lazy(
  () => import("@/components/communitycommponets/UserCommunitySettings")
);
const CommunitySettingsForm = lazy(
  () => import("@/components/communitycommponets/CommunitySettingsForm")
);
const CommunityAboutMediaManager = lazy(
  () => import("@/components/communitycommponets/CommunityAboutMediaManager")
);
const CommunityAccessSettings = lazy(
  () => import("@/components/communitycommponets/CommunityAccessSettings")
);
const AnalyticsDashboard = lazy(
  () => import("@/components/communitycommponets/AnalyticsDashboard")
);
const CommunityPlanInfo = lazy(
  () => import("@/components/communitycommponets/CommunityPlanInfo")
);
const CommunityPaymentGatewaySettings = lazy(
  () =>
    import("@/components/communitycommponets/CommunityPaymentGatewaySettings")
);
const RazorpayConnectForm = lazy(
  () => import("@/components/payments/RazorpayConnectForm")
);
const SimplePaymentButton = lazy(
  () => import("@/components/payments/SimplePaymentButton")
);

const AdminPanelSettings = lazy(
  () => import("@/components/communitycommponets/AdminPanelSettings")
);
const LevelManagement = lazy(
  () => import("@/components/gamification/LevelManagement")
);

// Loading component for lazy-loaded components
const ComponentLoader = () => (
  <div className="flex justify-center items-center min-h-[300px]">
    <span className="loading loading-spinner loading-lg text-primary"></span>
  </div>
);

// Define interface for tab items
interface TabItem {
  key: string;
  label: string;
  condition: boolean;
}

interface CommunitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  slug?: string;
}

// Billing Tab Content Component
function BillingTabContent() {
  const {
    billingData,
    loading,
    trialActive,
    subscriptionActive,
    daysRemaining,
    slug,
  } = useCommunityBilling();

  const handleUpgrade = () => {
    // Navigate to the dedicated billing page where users can:
    // 1. Start a free trial (if eligible)
    // 2. Complete payment for immediate upgrade
    // 3. View detailed billing information and options
    // 4. Handle different subscription states (trial, expired, etc.)
    if (slug) {
      window.location.href = `/billing/${slug}`;
    } else {
      console.error("No slug available for billing navigation");
    }
  };

  if (loading && !billingData) {
    return <ComponentLoader />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg md:text-xl font-bold">
            Billing & Subscription
          </h3>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
            Manage your community subscription and payment details
          </p>
        </div>
      </div>
      <PlanInfoCard
        community={{
          _id: billingData?._id || "",
          name: "Default Community",
          slug: slug || "",
          description: "",
          paymentStatus: billingData?.paymentStatus,
          freeTrialActivated: billingData?.freeTrialActivated,
          subscriptionEndDate: billingData?.subscriptionEndDate,
          subscriptionId: billingData?.subscriptionId,
          subscriptionStatus: billingData?.subscriptionStatus,
        }}
        trialActive={trialActive}
        isPaymentActive={subscriptionActive}
        remainingDays={daysRemaining}
        onUpgrade={handleUpgrade}
      />
      {!subscriptionActive && billingData?._id && (
        <div className="pt-2">
          <Suspense fallback={<ComponentLoader />}>
            <SimplePaymentButton
              communityId={billingData._id}
              communitySlug={slug || undefined}
              buttonText="Pay Now ($29/month)"
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-none shadow-lg hover:shadow-xl transform transition-all duration-200 hover:scale-[1.02] text-white font-semibold py-3 rounded-lg flex items-center justify-center"
              onSuccess={() => window.location.reload()}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}

// Tab Navigation Component
function TabNavigation({
  visibleTabs,
  activeTab,
  setActiveTab,
  showMobileNav,
  setShowMobileNav,
}: {
  visibleTabs: TabItem[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showMobileNav: boolean;
  setShowMobileNav: (show: boolean) => void;
}) {
  return (
    <>
      {/* Mobile Navigation Toggle */}
      <div className="lg:hidden border-b border-base-300 p-3">
        <button
          onClick={() => setShowMobileNav(!showMobileNav)}
          className="flex items-center gap-2 py-2 px-3 bg-base-200 rounded-lg text-sm font-medium hover:bg-base-300 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <span>Menu</span>
        </button>
      </div>

      {/* Mobile Navigation Sidebar */}
      {showMobileNav && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowMobileNav(false)}
          />
          <div className="lg:hidden fixed left-0 top-0 h-full w-64 bg-base-100 shadow-xl z-50 transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-4 border-b border-base-300">
                <h3 className="font-semibold text-lg">Settings Menu</h3>
                <button
                  onClick={() => setShowMobileNav(false)}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Close menu"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <div className="flex-1 p-4 space-y-1">
                {visibleTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setShowMobileNav(false);
                    }}
                    className={`w-full text-left py-3 px-4 text-sm font-medium transition-colors duration-200 rounded-lg ${
                      activeTab === tab.key
                        ? "bg-primary text-primary-content shadow-sm"
                        : "hover:bg-base-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop Sidebar Navigation */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col border-r border-base-300 bg-base-50">
        <div className="p-4 space-y-1 flex-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`w-full text-left py-3 px-4 text-sm font-medium transition-colors duration-200 rounded-lg ${
                activeTab === tab.key
                  ? "bg-primary text-primary-content shadow-sm"
                  : "hover:bg-base-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Tab Content Renderer Component
function TabContentRenderer({
  activeTab,
  isAdmin,
  isSubAdmin,
  editingGateway,
  setEditingGateway,
  slug,
}: {
  activeTab: string;
  isAdmin: boolean;
  isSubAdmin: boolean;
  editingGateway: "stripe" | "razorpay" | null;
  setEditingGateway: (gateway: "stripe" | "razorpay" | null) => void;
  slug: string;
}) {
  const renderContent = () => {
    switch (activeTab) {
      case "CommunitySettings":
        return isAdmin || isSubAdmin ? (
          <Suspense fallback={<ComponentLoader />}>
            <CommunitySettingsForm />
          </Suspense>
        ) : null;

      case "AboutMedia":
        return isAdmin || isSubAdmin ? (
          <div className="space-y-4 md:space-y-6">
            <h3 className="text-lg md:text-xl font-bold">About Page Media</h3>
            <p className="text-xs md:text-sm text-gray-600">
              Manage images and videos that appear on your community's about
              page.
            </p>
            <Suspense fallback={<ComponentLoader />}>
              <CommunityAboutMediaManager />
            </Suspense>
          </div>
        ) : null;

      case "Analytics":
        return isAdmin || isSubAdmin ? (
          <Suspense fallback={<ComponentLoader />}>
            <AnalyticsDashboard />
          </Suspense>
        ) : null;

      case "LevelManagement":
        return isAdmin || isSubAdmin ? (
          <div className="space-y-4 md:space-y-6">
            <h3 className="text-lg md:text-xl font-bold">Level Management</h3>
            <p className="text-xs md:text-sm text-gray-600">
              Customize level names for your community's gamification system.
            </p>
            <Suspense fallback={<ComponentLoader />}>
              <LevelManagement communityId={slug || ""} />
            </Suspense>
          </div>
        ) : null;

      case "AccessSettings":
        return isAdmin ? (
          <Suspense fallback={<ComponentLoader />}>
            <CommunityAccessSettings />
          </Suspense>
        ) : null;

      case "PlanInfo":
        return isAdmin ? (
          <Suspense fallback={<ComponentLoader />}>
            <CommunityPlanInfo />
          </Suspense>
        ) : null;

      case "PaymentGateway":
        return isAdmin ? (
          <div className="space-y-6 md:space-y-8">
            {!editingGateway && (
              <Suspense fallback={<ComponentLoader />}>
                <CommunityPaymentGatewaySettings
                  onEditGateway={(name) => setEditingGateway(name)}
                />
              </Suspense>
            )}

            {editingGateway === "razorpay" && (
              <div>
                <button
                  className="btn btn-sm btn-ghost mb-4"
                  onClick={() => setEditingGateway(null)}
                >
                  &larr; Back to gateways
                </button>
                <Suspense fallback={<ComponentLoader />}>
                  <RazorpayConnectForm />
                </Suspense>
              </div>
            )}

            {editingGateway === "stripe" && (
              <div>
                <button
                  className="btn btn-sm btn-ghost mb-4"
                  onClick={() => setEditingGateway(null)}
                >
                  &larr; Back to gateways
                </button>
                <div className="border rounded-lg p-6 md:p-8 text-center">
                  <h3 className="text-lg md:text-xl font-bold">
                    Stripe Connect
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Stripe connection form will be here.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : null;

      case "Billing":
        return isAdmin ? <BillingTabContent /> : null;

      case "AdminPanel":
        return isAdmin ? (
          <Suspense fallback={<ComponentLoader />}>
            <AdminPanelSettings />
          </Suspense>
        ) : null;

      case "UserSettings":
      default:
        return (
          <Suspense fallback={<ComponentLoader />}>
            <UserCommunitySettings />
          </Suspense>
        );
    }
  };

  return <div className="h-full">{renderContent()}</div>;
}

// Internal component that uses the context
function CommunitySettingsContent({
  initialTab = "UserSettings",
  onClose,
}: {
  initialTab?: string;
  onClose: () => void;
}) {
  const { isAdmin, isSubAdmin, loading } = useCommunityData();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [editingGateway, setEditingGateway] = useState<
    "stripe" | "razorpay" | null
  >(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const { slug: paramSlug } = useParams<{ slug: string }>();

  // Reset state when modal opens
  useEffect(() => {
    setActiveTab(initialTab);
    setEditingGateway(null);
    setShowMobileNav(false);
  }, [initialTab]);

  const tabItems = [
    { key: "UserSettings", label: "Your Settings", condition: true },
    {
      key: "CommunitySettings",
      label: "Community Settings",
      condition: isAdmin || isSubAdmin,
    },
    {
      key: "AboutMedia",
      label: "About Media",
      condition: isAdmin || isSubAdmin,
    },
    {
      key: "Analytics",
      label: "Analytics",
      condition: isAdmin || isSubAdmin,
    },
    {
      key: "LevelManagement",
      label: "Level Management",
      condition: isAdmin || isSubAdmin,
    },
    { key: "AccessSettings", label: "Access & Pricing", condition: isAdmin },
    { key: "PlanInfo", label: "Plan Info", condition: isAdmin },
    { key: "PaymentGateway", label: "Payments", condition: isAdmin },
    { key: "Billing", label: "Billing", condition: isAdmin },
    { key: "AdminPanel", label: "Admin Panel", condition: isAdmin },
  ];

  const visibleTabs = tabItems.filter((tab) => tab.condition);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 relative">
      <TabNavigation
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        showMobileNav={showMobileNav}
        setShowMobileNav={setShowMobileNav}
      />

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 md:p-6 overflow-y-auto modal-custom-scroll">
            <TabContentRenderer
              activeTab={activeTab}
              isAdmin={isAdmin}
              isSubAdmin={isSubAdmin}
              editingGateway={editingGateway}
              setEditingGateway={setEditingGateway}
              slug={paramSlug || ""}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component with providers
export default function CommunitySettingsModal({
  isOpen,
  onClose,
  initialTab = "UserSettings",
  slug: propSlug,
}: CommunitySettingsModalProps) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = propSlug || paramSlug;

  if (!slug) {
    return null;
  }

  return (
    <NoSSR fallback={null}>
      <CommunityDataProvider slug={slug}>
        <CommunityBillingProvider>
          <SettingsModal
            isOpen={isOpen}
            onClose={onClose}
            title="Community Settings"
            maxWidth="max-w-7xl"
            maxHeight="max-h-[95vh]"
          >
            <CommunitySettingsContent
              initialTab={initialTab}
              onClose={onClose}
            />
          </SettingsModal>
        </CommunityBillingProvider>
      </CommunityDataProvider>
    </NoSSR>
  );
}
