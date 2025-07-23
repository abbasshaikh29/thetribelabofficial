"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Header from "@/components/Header";
import CommunityJoinPayment from "@/components/community/CommunityJoinPayment";

export default function CommunityJoinPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [community, setCommunity] = useState<any>(null);

  useEffect(() => {
    const fetchCommunityData = async () => {
      if (status === "loading") return;

      if (!session) {
        router.push(
          `/api/auth/signin?callbackUrl=/community/${slug}/join`
        );
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Fetch community details
        const response = await fetch(`/api/community/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Community not found");
          }
          throw new Error("Failed to fetch community details");
        }

        const communityData = await response.json();
        setCommunity(communityData);

        // Check if user is already a member
        if (communityData.members && communityData.members.includes(session.user.id)) {
          router.push(`/Newcompage/${slug}`);
          return;
        }

        // Check if community requires payment
        const isPaid = communityData.price && communityData.price > 0;
        if (!isPaid) {
          // For free communities, redirect to regular join flow
          router.push(`/Newcompage/${slug}`);
          return;
        }

      } catch (error) {
        console.error("Error fetching community data:", error);
        setError(
          error instanceof Error
            ? error.message
            : "Failed to fetch community data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommunityData();
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
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
            <button
              onClick={() => router.push(`/Newcompage/${slug}`)}
              className="mt-4 btn btn-primary"
            >
              Go Back to Community
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Community not found</h2>
            <button
              onClick={() => router.push("/")}
              className="btn btn-primary"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-halloween-purple mb-2">
            Join {community.name}
          </h1>
          <p className="text-halloween-black/70">
            Complete your payment to join this community
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <CommunityJoinPayment
            communityId={community._id}
            communitySlug={slug}
            communityName={community.name}
          />
        </div>
      </div>
    </div>
  );
}
