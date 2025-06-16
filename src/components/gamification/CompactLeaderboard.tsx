"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Medal, Award, Crown, ChevronRight } from "lucide-react";
import LevelBadge from "./LevelBadge";

interface LeaderboardUser {
  _id: string;
  username: string;
  name?: string;
  profileImage?: string;
  points: number;
  monthlyPoints: number;
  level: number;
  rank: number;
  levelInfo: {
    level: number;
    name: string;
    pointsRequired: number;
    pointsToNext: number;
    progress: number;
  };
  displayPoints: number;
}

interface CompactLeaderboardProps {
  communityId: string;
  period?: "7day" | "30day" | "alltime";
  limit?: number;
  className?: string;
  communitySlug?: string;
}

const CompactLeaderboard: React.FC<CompactLeaderboardProps> = ({
  communityId,
  period = "30day",
  limit = 5,
  className = "",
  communitySlug,
}) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [communityId, period, limit]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/gamification/leaderboard?communityId=${communityId}&period=${period}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch leaderboard");
      }

      const data = await response.json();
      setLeaderboard(data.leaderboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 2:
        return <Trophy className="w-4 h-4 text-gray-400" />;
      case 3:
        return <Medal className="w-4 h-4 text-amber-600" />;
      default:
        return <span className="w-4 h-4 flex items-center justify-center text-xs font-bold text-gray-500">#{rank}</span>;
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "7day":
        return "Weekly";
      case "30day":
        return "Monthly";
      case "alltime":
        return "All Time";
      default:
        return "Monthly";
    }
  };

  if (loading) {
    return (
      <div className={`rounded-lg p-4 ${className}`} style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Trophy className="w-4 h-4 text-yellow-500" />
            Leaderboard (30-day)
          </h3>
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded animate-pulse">
              <div className="w-4 h-4 bg-gray-300 rounded"></div>
              <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
              <div className="flex-1">
                <div className="w-20 h-3 bg-gray-300 rounded mb-1"></div>
                <div className="w-12 h-2 bg-gray-300 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-lg p-4 ${className}`} style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Trophy className="w-4 h-4 text-yellow-500" />
            Leaderboard (30-day)
          </h3>
        </div>
        <p className="text-sm" style={{ color: 'var(--brand-error)' }}>Unable to load leaderboard</p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-4 ${className}`} style={{ backgroundColor: 'var(--card-bg)', boxShadow: 'var(--shadow-sm)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy className="w-4 h-4 text-yellow-500" />
          Leaderboard (30-day)
        </h3>
        {communitySlug && (
          <Link 
            href={`/Newcompage/${communitySlug}/leaderboard`}
            className="text-xs flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--brand-primary)' }}
          >
            See all
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No leaderboard data available yet
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((user, index) => (
            <div
              key={user._id}
              className="flex items-center gap-3 p-2 rounded transition-colors hover:bg-opacity-50"
              style={{ backgroundColor: index < 3 ? 'var(--brand-primary-light)' : 'transparent' }}
            >
              <div className="flex-shrink-0">
                {getRankIcon(user.rank)}
              </div>
              
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  {user.profileImage ? (
                    <Image
                      src={user.profileImage}
                      alt={user.name || user.username}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                      {(user.name || user.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {user.name || user.username}
                  </p>
                  <LevelBadge level={user.level} size="sm" />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {user.displayPoints} points
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CompactLeaderboard;
