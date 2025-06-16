"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Medal, Award, Crown } from "lucide-react";
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

interface LeaderboardProps {
  communityId: string;
  period?: "7day" | "30day" | "alltime";
  limit?: number;
  className?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({
  communityId,
  period = "30day",
  limit = 10,
  className = "",
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
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Trophy className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <Award className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "7day":
        return "7-Day";
      case "30day":
        return "30-Day";
      case "alltime":
        return "All-Time";
      default:
        return "30-Day";
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 rounded mb-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
            <div className="flex-1 h-4 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p style={{ color: 'var(--brand-error)' }}>Error loading leaderboard: {error}</p>
        <button
          onClick={fetchLeaderboard}
          className="mt-2 px-4 py-2 rounded transition-colors"
          style={{
            backgroundColor: 'var(--brand-primary)',
            color: 'white'
          }}
          onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
          onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Trophy className="w-5 h-5 text-yellow-500" />
        {getPeriodLabel()} Leaderboard
      </h3>

      <div className="space-y-3">
        {leaderboard.map((user) => (
          <div
            key={user._id}
            className="flex items-center space-x-3 p-3 rounded-lg transition-shadow"
            style={{
              backgroundColor: 'var(--card-bg)',
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid var(--card-border)'
            }}
            onMouseOver={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
            onMouseOut={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
          >
            {/* Rank */}
            <div className="flex items-center justify-center w-8">
              {user.rank <= 3 ? (
                getRankIcon(user.rank)
              ) : (
                <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  {user.rank}
                </span>
              )}
            </div>

            {/* Avatar with Level Badge */}
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                {user.profileImage ? (
                  <Image
                    src={user.profileImage}
                    alt={user.name || user.username}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    {(user.name || user.username).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <LevelBadge
                level={user.levelInfo.level}
                levelName={user.levelInfo.name}
                size="sm"
                position="bottom-right"
              />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/profile/${user._id}`}
                className="font-medium truncate block transition-colors"
                style={{ color: 'var(--text-primary)' }}
                onMouseOver={(e) => e.currentTarget.style.color = 'var(--brand-primary)'}
                onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              >
                {user.name || user.username}
              </Link>
              <p className="text-sm truncate" style={{ color: 'var(--text-tertiary)' }}>
                {user.levelInfo.name}
              </p>
            </div>

            {/* Points */}
            <div className="text-right">
              <div className="font-bold" style={{ color: 'var(--text-primary)' }}>
                +{user.displayPoints}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                points
              </div>
            </div>
          </div>
        ))}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
          No leaderboard data available yet.
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
