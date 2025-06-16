"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import SettingsModal from "./SettingsModal";
import UserCommunitySettings from "@/components/communitycommponets/UserCommunitySettings";
import CommunitySettingsForm from "@/components/communitycommponets/CommunitySettingsForm";
import CommunityAboutMediaManager from "@/components/communitycommponets/CommunityAboutMediaManager";
import CommunityAccessSettings from "@/components/communitycommponets/CommunityAccessSettings";
import CommunityPlanInfo from "@/components/communitycommponets/CommunityPlanInfo";

import AnalyticsDashboard from "@/components/communitycommponets/AnalyticsDashboard";
import AdminPanelSettings from "@/components/communitycommponets/AdminPanelSettings";
import LevelManagement from "@/components/gamification/LevelManagement";
import { CommunityBillingProvider } from "@/contexts/CommunityBillingContext";
import { DetailedPlanInfoCard } from "@/components/billing/PlanInfoCard";

interface CommunitySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
  slug?: string;
}

export default function CommunitySettingsModal({
  isOpen,
  onClose,
  initialTab = "UserSettings",
  slug: propSlug,
}: CommunitySettingsModalProps) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = propSlug || paramSlug;
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSubAdmin, setIsSubAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is admin or sub-admin
  useEffect(() => {
    const checkUserRole = async () => {
      if (session?.user && slug) {
        try {
          setLoading(true);
          const res = await fetch(`/api/community/${slug}`);
          if (!res.ok) {
            throw new Error("Failed to fetch community data");
          }
          const data = await res.json();

          const userId = session.user.id;
          setIsAdmin(data.admin === userId);
          setIsSubAdmin(data.subAdmins?.includes(userId) || false);

          setLoading(false);
        } catch (error) {
          console.error("Error checking user role:", error);
          setLoading(false);
        }
      }
    };

    if (session?.user && isOpen) {
      checkUserRole();
    }
  }, [session, slug, isOpen]);

  // Reset to default tab when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center min-h-[300px]">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      );
    }

    switch (activeTab) {
      case "CommunitySettings":
        return (isAdmin || isSubAdmin) ? <CommunitySettingsForm /> : null;
      case "AboutMedia":
        return (isAdmin || isSubAdmin) ? (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">About Page Media</h3>
            <p className="text-sm text-gray-600">
              Manage images and videos that appear on your community's about page.
            </p>
            <CommunityAboutMediaManager />
          </div>
        ) : null;
      case "Analytics":
        return (isAdmin || isSubAdmin) ? <AnalyticsDashboard /> : null;
      case "LevelManagement":
        return (isAdmin || isSubAdmin) ? (
          <div className="space-y-6">
            <h3 className="text-xl font-bold">Level Management</h3>
            <p className="text-sm text-gray-600">
              Customize level names for your community's gamification system.
            </p>
            <LevelManagement communityId={slug || ""} />
          </div>
        ) : null;
      case "AccessSettings":
        return isAdmin ? <CommunityAccessSettings /> : null;
      case "PlanInfo":
        return isAdmin ? <CommunityPlanInfo /> : null;
      case "Billing":
        return isAdmin ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold">Billing & Subscription</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Manage your community subscription and payment details
                </p>
              </div>
            </div>
            <DetailedPlanInfoCard
              communityId={slug}
              communitySlug={slug}
              onPaymentSuccess={(subscription) => {
                console.log('Payment successful in settings modal:', subscription);
                // Could add a success toast here
              }}
              onPaymentError={(error) => {
                console.error('Payment error in settings modal:', error);
                // Could add an error toast here
              }}
            />
          </div>
        ) : null;

      case "AdminPanel":
        return isAdmin ? <AdminPanelSettings /> : null;
      case "UserSettings":
      default:
        return <UserCommunitySettings />;
    }
  };

  return (
    <CommunityBillingProvider>
      <SettingsModal
        isOpen={isOpen}
        onClose={onClose}
        title="Community Settings"
        maxWidth="max-w-6xl"
      >
        <div className="flex flex-col lg:flex-row h-full">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-base-300 p-4 lg:p-6">
          <div className="flex flex-row lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto lg:overflow-x-visible">
            {/* User Settings Link - Always visible */}
            <button
              onClick={() => setActiveTab("UserSettings")}
              className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                activeTab === "UserSettings" ? "bg-primary text-primary-content" : ""
              }`}
            >
              Your Settings
            </button>

            {/* Admin/SubAdmin only links */}
            {(isAdmin || isSubAdmin) && (
              <>
                <button
                  onClick={() => setActiveTab("CommunitySettings")}
                  className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                    activeTab === "CommunitySettings" ? "bg-primary text-primary-content" : ""
                  }`}
                >
                  Community Settings
                </button>
                <button
                  onClick={() => setActiveTab("AboutMedia")}
                  className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                    activeTab === "AboutMedia" ? "bg-primary text-primary-content" : ""
                  }`}
                >
                  About Media
                </button>
                <button
                  onClick={() => setActiveTab("Analytics")}
                  className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                    activeTab === "Analytics" ? "bg-primary text-primary-content" : ""
                  }`}
                >
                  Analytics
                </button>
                <button
                  onClick={() => setActiveTab("LevelManagement")}
                  className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                    activeTab === "LevelManagement" ? "bg-primary text-primary-content" : ""
                  }`}
                >
                  Level Management
                </button>
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setActiveTab("AccessSettings")}
                      className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                        activeTab === "AccessSettings" ? "bg-primary text-primary-content" : ""
                      }`}
                    >
                      Access & Pricing
                    </button>
                    <button
                      onClick={() => setActiveTab("PlanInfo")}
                      className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                        activeTab === "PlanInfo" ? "bg-primary text-primary-content" : ""
                      }`}
                    >
                      Plan Info
                    </button>
                    <button
                      onClick={() => setActiveTab("Billing")}
                      className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                        activeTab === "Billing" ? "bg-primary text-primary-content" : ""
                      }`}
                    >
                      Billing
                    </button>

                    <button
                      onClick={() => setActiveTab("AdminPanel")}
                      className={`py-2 lg:py-3 px-3 lg:px-4 w-full lg:w-auto flex-shrink-0 text-left font-semibold text-xs lg:text-sm transition-colors duration-200 rounded-lg hover:bg-base-200 ${
                        activeTab === "AdminPanel" ? "bg-primary text-primary-content" : ""
                      }`}
                    >
                      Admin Panel
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          {renderTabContent()}
        </div>
      </div>
    </SettingsModal>
    </CommunityBillingProvider>
  );
}
