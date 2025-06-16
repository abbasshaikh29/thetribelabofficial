"use client";
import React, { useState, useEffect } from "react";
import Image from "next/image"; // Import next/image
import { useRouter } from "next/navigation";
import { User, MessageSquareText } from 'lucide-react'; // Icons for buttons
import FollowButton from "../FollowButton";
import { useSession } from "next-auth/react";
import LevelBadge from "../gamification/LevelBadge";
import ProgressBar from "../gamification/ProgressBar";

interface UserHoverCardProps {
  children: React.ReactNode;
  username: string;
  userId: string;
  profileImage?: string;
  activeStatus?: string;
  bio?: string;
  membershipInfo?: string;
  level?: number;
  pointsToNextLevel?: string;
  onChatClick?: (userId: string) => void;
  communityId?: string;
  showGamification?: boolean;
}

export default function UserHoverCard({
  children,
  username,
  userId,
  profileImage,
  activeStatus,
  bio,
  membershipInfo,
  level,
  pointsToNextLevel,
  onChatClick,
  communityId,
  showGamification = true,
}: UserHoverCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const [gamificationData, setGamificationData] = useState<any>(null);

  const handleProfileClick = () => {
    router.push(`/profile/${userId}`);
  };

  // Get current user session to check if user is logged in
  const { data: session } = useSession();
  const [isFollowing, setIsFollowing] = useState(false);

  // Handler for when the follow status is updated by FollowButton
  const handleFollowUpdate = (newStatus: boolean) => {
    setIsFollowing(newStatus);
  };

  // Check if current user is following this user
  useEffect(() => {
    if (session?.user?.id && userId !== session.user.id) {
      const checkFollowStatus = async () => {
        try {
          const response = await fetch(`/api/users/${userId}/follow/status`, {
            method: 'GET',
          });

          if (response.ok) {
            const data = await response.json();
            setIsFollowing(data.isFollowing);
          }
        } catch (error) {
          console.error('Error checking follow status:', error);
        }
      };

      checkFollowStatus();
    }
  }, [userId, session?.user?.id]);

  // Fetch gamification data
  useEffect(() => {
    if (showGamification && userId && !level) {
      const fetchGamificationData = async () => {
        try {
          const url = `/api/gamification/user/${userId}${communityId ? `?communityId=${communityId}` : ''}`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            setGamificationData(data);
          }
        } catch (error) {
          console.error('Error fetching gamification data:', error);
        }
      };

      fetchGamificationData();
    }
  }, [showGamification, userId, level, communityId]);

  const handleChatClick = () => {
    if (onChatClick) {
      onChatClick(userId);
    } else {
      console.log(`Chat button clicked for user: ${userId} (${username}).`);
      alert(`Chat feature not available for ${username}. Please try again later.`);
    }
  };

  let timeoutId: NodeJS.Timeout;
  const handleMouseEnter = () => {
    clearTimeout(timeoutId);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    timeoutId = setTimeout(() => {
      setIsHovered(false);
    }, 200); 
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span 
        onClick={handleProfileClick} 
        className="cursor-pointer font-medium hover:underline"
        style={{ color: 'var(--text-primary)' }}
      >
        {children} 
      </span>

      {isHovered && (
        <div 
          className="absolute z-[9999] bottom-full left-0 mb-2 w-80 rounded-lg shadow-2xl border p-4 transform transition-all duration-150 ease-out scale-100 origin-bottom-left"
          onMouseEnter={handleMouseEnter} // Keep card open if mouse enters it
          onMouseLeave={handleMouseLeave} // Hide card if mouse leaves it
          style={{
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text-primary)",
            borderColor: "var(--border-color, #e5e7eb)"
          }}
        >
          {/* Top section: Profile Image and Level */}
          <div className="flex items-start space-x-4 mb-4">
            <div className="flex-shrink-0 text-center">
              <div className="relative">
                {profileImage ? (
                  <Image
                    src={profileImage}
                    alt={username}
                    width={80} // Add width
                    height={80} // Add height
                    className="w-20 h-20 rounded-full object-cover border-2 shadow-md"
                    style={{ borderColor: "var(--border-color, #e5e7eb)" }}
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-3xl border-2 shadow-md"
                  style={{
                    color: 'var(--text-secondary)',
                    borderColor: "var(--border-color, #e5e7eb)",
                    backgroundColor: "var(--bg-tertiary)"
                  }}>
                    {username.charAt(0).toUpperCase()}
                  </div>
                )}
                {showGamification && (level || gamificationData?.currentLevel) && (
                  <LevelBadge
                    level={level || gamificationData?.currentLevel?.level}
                    levelName={gamificationData?.currentLevel?.name}
                    size="md"
                    position="bottom-right"
                  />
                )}
              </div>
            </div>

            {/* User Details Section */}
            <div className="flex-grow">
              <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{username}</h3>
              {activeStatus && <p className="text-xs" style={{ color: "var(--text-tertiary, #6b7280)" }}>{activeStatus}</p>}
              {bio && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{bio}</p>}
              {membershipInfo && <p className="text-xs mt-1" style={{ color: "var(--text-tertiary, #6b7280)" }}>{membershipInfo}</p>}

              {/* Gamification Progress */}
              {showGamification && (gamificationData?.currentLevel || level) && (
                <div className="mt-3">
                  <ProgressBar
                    currentPoints={gamificationData?.points || 0}
                    pointsToNext={gamificationData?.currentLevel?.pointsToNext || 0}
                    progress={gamificationData?.currentLevel?.progress || 0}
                    currentLevelName={gamificationData?.currentLevel?.name || `Level ${level}`}
                    nextLevelName={gamificationData?.nextLevel?.name}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Buttons Section */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t" style={{ borderColor: "var(--border-color, #e5e7eb)" }}>
            <button 
              onClick={handleProfileClick}
              className="flex items-center justify-center w-full py-2 px-3 rounded-md font-medium text-xs transition-colors duration-150"
              style={{ 
                backgroundColor: "var(--bg-tertiary)", 
                color: "var(--text-secondary)"
              }}
            >
              <User size={14} className="mr-1.5" /> PROFILE
            </button>
            {session?.user?.id && userId !== session.user.id ? (
              <FollowButton 
                userId={userId} 
                isFollowing={isFollowing} 
                onFollowStatusChange={handleFollowUpdate} // Pass the handler
                className="w-full"
              />
            ) : (
              <button 
                disabled
                className="flex items-center justify-center w-full py-2 px-3 rounded-md font-medium text-xs transition-colors duration-150"
                style={{ 
                  backgroundColor: "var(--bg-tertiary)", 
                  color: "var(--text-secondary)",
                  opacity: 0.5
                }}
              >
                FOLLOW
              </button>
            )}
            <button 
              onClick={handleChatClick}
              className="flex items-center justify-center w-full py-2 px-3 rounded-md font-medium text-xs transition-colors duration-150"
              style={{ 
                backgroundColor: "var(--primary-color, #eab308)", 
                color: "var(--text-primary)" 
              }}
              type="button"
            >
              <MessageSquareText size={14} className="mr-1.5" /> CHAT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
