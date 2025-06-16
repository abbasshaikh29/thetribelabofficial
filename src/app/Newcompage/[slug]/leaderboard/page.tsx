"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import CommunityNav from "@/components/communitynav/CommunityNav";
import Leaderboard from "@/components/gamification/Leaderboard";
import { Trophy, Calendar, Clock, Infinity } from "lucide-react";

export default function LeaderboardPage() {
  const params = useParams();
  const { data: session } = useSession();
  const [community, setCommunity] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"7day" | "30day" | "alltime">("30day");
  const [loading, setLoading] = useState(true);

  const slug = params.slug as string;

  useEffect(() => {
    if (slug) {
      fetchCommunity();
    }
  }, [slug]);

  const fetchCommunity = async () => {
    try {
      const response = await fetch(`/api/community/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setCommunity(data);
      }
    } catch (error) {
      console.error("Error fetching community:", error);
    } finally {
      setLoading(false);
    }
  };

  const periodOptions = [
    {
      value: "7day" as const,
      label: "7 Days",
      icon: <Clock className="w-4 h-4" />,
      description: "Top contributors this week",
    },
    {
      value: "30day" as const,
      label: "30 Days",
      icon: <Calendar className="w-4 h-4" />,
      description: "Top contributors this month",
    },
    {
      value: "alltime" as const,
      label: "All Time",
      icon: <Infinity className="w-4 h-4" />,
      description: "Top contributors of all time",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <CommunityNav />
        <div className="container mx-auto px-4 py-8 mt-6">
          <div className="animate-pulse">
            <div className="h-8 rounded mb-6 w-1/3" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-lg p-6" style={{ backgroundColor: 'var(--card-bg)' }}>
                  <div className="h-6 rounded mb-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
                  {[...Array(5)].map((_, j) => (
                    <div key={j} className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
                      <div className="flex-1 h-4 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <CommunityNav />
        <div className="container mx-auto px-4 py-8 mt-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Community Not Found
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              The community you're looking for doesn't exist or you don't have access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <CommunityNav />

      <div className="container mx-auto px-4 py-8 mt-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {community.name} Leaderboard
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            See who's leading the community with their contributions and engagement.
          </p>
        </div>

        {/* Period Selector */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-4">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedPeriod(option.value)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg border transition-all"
                style={{
                  backgroundColor: selectedPeriod === option.value
                    ? 'var(--brand-primary)'
                    : 'var(--card-bg)',
                  color: selectedPeriod === option.value
                    ? 'white'
                    : 'var(--text-primary)',
                  borderColor: selectedPeriod === option.value
                    ? 'var(--brand-primary)'
                    : 'var(--card-border)',
                  boxShadow: selectedPeriod === option.value
                    ? 'var(--shadow-md)'
                    : 'var(--shadow-sm)'
                }}
                onMouseOver={(e) => {
                  if (selectedPeriod !== option.value) {
                    e.currentTarget.style.borderColor = 'var(--brand-primary)';
                    e.currentTarget.style.opacity = '0.8';
                  }
                }}
                onMouseOut={(e) => {
                  if (selectedPeriod !== option.value) {
                    e.currentTarget.style.borderColor = 'var(--card-border)';
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {option.icon}
                <div className="text-left">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs opacity-75">{option.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Main Leaderboard */}
          <div className="lg:col-span-2 xl:col-span-2">
            <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
              <Leaderboard
                communityId={community._id?.toString() || ""}
                period={selectedPeriod}
                limit={20}
              />
            </div>
          </div>

          {/* Sidebar with additional info */}
          <div className="space-y-6">
            {/* Community Stats */}
            <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                Community Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Total Members</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {community.members?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-secondary)' }}>Active Period</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {periodOptions.find(p => p.value === selectedPeriod)?.label}
                  </span>
                </div>
              </div>
            </div>

            {/* How Points Work */}
            <div className="rounded-lg p-6" style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                How Points Work
              </h3>
              <div className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}></div>
                  <span>Earn 1 point for each like received on your posts</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}></div>
                  <span>Earn 1 point for each like received on your comments</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}></div>
                  <span>Level up as you earn more points</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: 'var(--brand-primary)' }}></div>
                  <span>Monthly leaderboard resets every 30 days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
