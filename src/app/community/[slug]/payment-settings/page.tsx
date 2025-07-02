"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import CommunityPaymentSettings from "@/components/payments/CommunityPaymentSettings";
import RazorpayConnectForm from "@/components/payments/RazorpayConnectForm";
import TransactionHistory from "@/components/payments/TransactionHistory";

export default function CommunityPaymentSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkCommunityAccess = async () => {
      if (status === "loading") return;

      if (!session) {
        router.push(
          `/api/auth/signin?callbackUrl=/community/${slug}/payment-settings`
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

  if (error) {
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
            Payment Settings
          </h1>
          <p className="text-halloween-black/70">
            Manage payment plans and settings for your community
          </p>
        </div>

        {communityId && (
          <>
            <RazorpayConnectForm />

            <div className="mt-12">
              <CommunityPaymentSettings
                communityId={communityId}
                communitySlug={slug}
              />
            </div>

            <div className="mt-16">
              <h2 className="text-2xl font-bold mb-6 text-halloween-purple">
                Transaction History
              </h2>
              <TransactionHistory
                type="payee"
                paymentType="community"
                communityId={communityId}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
