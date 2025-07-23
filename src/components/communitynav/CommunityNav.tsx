"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import {
  User,
  ChevronDown,
  Compass,
  Plus,
  Home,
  BookOpen,
  Calendar,
  Info,
  Users,
  Trophy,
} from "lucide-react";
import { useNotification } from "@/components/Notification";
import { useSettingsModal } from "@/components/modals/SettingsModalProvider";
import { useSession, signOut } from "next-auth/react";
import CommunityIcon from "./CommunityIcon";
import MessageIcon from "../messages/MessageIcon";
import NotificationIcon from "../notifications/NotificationIcon";
import ThemeSwitcher from "../ThemeSwitcher";
import ProfileAvatar from "../ProfileAvatar";
interface Community {
  _id: string;
  name: string;
  slug: string;
  iconImageUrl?: string;
  role: string;
}

// Function to safely validate image URLs
const sanitizeImageUrl = (url?: string): string | null => {
  if (!url || typeof url !== "string") return null;

  // Remove any leading/trailing whitespace
  const cleanUrl = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:"];
  const lowerCaseUrl = cleanUrl.toLowerCase();

  if (
    dangerousProtocols.some((protocol) => lowerCaseUrl.startsWith(protocol))
  ) {
    return null;
  }

  // Only allow http, https, or relative URLs
  if (
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://") ||
    cleanUrl.startsWith("/")
  ) {
    try {
      // For absolute URLs, validate them further
      if (cleanUrl.startsWith("http")) {
        const urlObj = new URL(cleanUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          return cleanUrl;
        }
      } else {
        // For relative URLs, ensure they don't contain dangerous patterns
        if (
          !lowerCaseUrl.includes("javascript:") &&
          !lowerCaseUrl.includes("vbscript:")
        ) {
          return cleanUrl;
        }
      }
    } catch (e) {
      // Invalid URL format
      return null;
    }
  }

  return null;
};

function CommunityNav() {
  const { slug } = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { showNotification } = useNotification();
  const { openUserSettings, openCommunitySettings } = useSettingsModal();
  const [Name, setName] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [iconImage, setIconImage] = useState("");
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [communitiesLoading, setCommunitiesLoading] = useState(false);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Debug logging for slug parameter
  useEffect(() => {
    console.log("CommunityNav: slug parameter changed:", slug);
    console.log("CommunityNav: pathname:", pathname);
  }, [slug, pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdown = document.querySelector(".communities-dropdown");
      if (dropdown && !dropdown.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  // Function to check if a link is active
  const isLinkActive = (path: string) => {
    // Exact match
    if (pathname === path) return true;

    // Special case for the main community page
    if (
      path === `/Newcompage/${slug}` &&
      pathname.startsWith(`/Newcompage/${slug}`) &&
      ![
        "/Courses",
        "/Calander",
        "/about",
        "/members",
        "/leaderboard",
        "/communitysetting",
      ].some((suffix) => pathname === `/Newcompage/${slug}${suffix}`)
    ) {
      return true;
    }

    return false;
  };

  const fetchCommunity = async () => {
    // Add validation for slug and session
    if (!session?.user?.id || !slug) {
      console.log(
        "CommunityNav: Skipping fetchCommunity - missing slug or session:",
        { slug, userId: session?.user?.id }
      );
      return;
    }

    try {
      console.log("CommunityNav: Fetching community data for slug:", slug);
      // Add a timestamp to prevent caching
      const timestamp = Date.now();

      // First try to get the community data from the main API with cache busting
      const res = await fetch(`/api/community/${slug}?t=${timestamp}`, {
        cache: "no-store", // Prevent caching
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });

      if (!res.ok) {
        console.error(
          "CommunityNav: Failed to fetch community data:",
          res.status,
          res.statusText
        );
        throw new Error("Failed to fetch community data");
      }

      const data = await res.json();
      console.log(
        "CommunityNav: Successfully fetched community data:",
        data.name
      );
      setName(data.name);

      // Set the icon image URL, ensuring it's a string
      let iconUrl = data.iconImageUrl || "";

      // Try all three approaches in parallel for faster response
      const fetchPromises = [];

      // 1. Try the validation API
      if (!iconUrl || iconUrl.trim() === "") {
        fetchPromises.push(
          fetch(`/api/community/${slug}/validate-icon?t=${timestamp}`, {
            method: "GET",
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.isValid && data?.iconImageUrl) {
                return data.iconImageUrl;
              }
              return null;
            })
            .catch(() => null)
        );
      }

      // 2. Try the dedicated icon API
      fetchPromises.push(
        fetch(`/api/community/${slug}/icon?t=${timestamp}`, {
          method: "GET",
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.iconImageUrl) {
              return data.iconImageUrl;
            }
            return null;
          })
          .catch(() => null)
      );

      // Wait for all fetch attempts and use the first valid result
      const results = await Promise.all(fetchPromises);
      const validResults = results.filter((result) => result !== null);

      if (validResults.length > 0 && !iconUrl) {
        iconUrl = validResults[0];
      }

      // Directly set the icon image URL with a cache-busting parameter
      let finalIconUrl = "";
      if (iconUrl && iconUrl.trim() !== "") {
        // Add cache busting parameter if needed
        finalIconUrl = iconUrl.includes("?")
          ? `${iconUrl}&t=${timestamp}`
          : `${iconUrl}?t=${timestamp}`;
      }

      setIconImage(finalIconUrl);
      setIsMember(data.members?.includes(session?.user?.id) || false);

      // Preload the image
      if (finalIconUrl) {
        const img = new window.Image();
        img.src = finalIconUrl;
      }
    } catch (error) {
      console.error("CommunityNav: Error fetching community data:", error);
      // Silent error handling for UI, but log for debugging
    }
  };

  useEffect(() => {
    // Only fetch if we have a valid slug and session
    if (!slug || !session?.user?.id) {
      console.log(
        "CommunityNav: Skipping useEffect - invalid slug or no session:",
        { slug, userId: session?.user?.id }
      );
      return;
    }

    console.log("CommunityNav: useEffect triggered for slug:", slug);
    // Fetch community data when component mounts or slug changes
    fetchCommunity();

    // Removed auto-reload interval to prevent constant refreshing
    // Users can manually refresh if needed
  }, [slug, session?.user?.id]);

  // Fetch user communities
  // Function to preload community icons
  const preloadCommunityIcons = (communities: Community[]) => {
    communities.forEach((community) => {
      if (community.iconImageUrl && community.iconImageUrl.trim() !== "") {
        const img = new window.Image();
        img.src = community.iconImageUrl;
      }
    });
  };

  useEffect(() => {
    const fetchUserCommunities = async () => {
      if (session?.user && slug) {
        try {
          setCommunitiesLoading(true);
          setCommunitiesError(null);
          console.log(
            "CommunityNav: Fetching user communities, excluding slug:",
            slug
          );

          // Add timeout for user communities fetch
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

          const response = await fetch("/api/user/communities", {
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
            },
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            // Filter out the current community from the dropdown
            const filteredCommunities = data.filter(
              (community: Community) => community.slug !== slug
            );
            setUserCommunities(filteredCommunities);

            // Preload all community icons
            preloadCommunityIcons(filteredCommunities);
          } else {
            throw new Error(`Failed to fetch communities: ${response.status}`);
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            console.warn("User communities fetch timed out");
            setCommunitiesError("Request timed out. Please try again.");
          } else {
            console.error(
              "CommunityNav: Error fetching user communities:",
              error
            );
            setCommunitiesError("Failed to load communities");
          }
        } finally {
          setCommunitiesLoading(false);
        }
      }
    };

    fetchUserCommunities();
  }, [session, slug]);

  const handleSignOut = async () => {
    try {
      await signOut();
      showNotification("Sign out successful", "success");
    } catch (error) {
      showNotification("Sign out failed", "error");
    }
  };

  return (
    <div
      className="sticky top-0 shadow-md z-10 w-full flex justify-center items-center"
      style={{ backgroundColor: "var(--bg-secondary)" }}
    >
      <div className="w-full md:w-2/3">
        <div className="flex flex-col w-full">
          {/* Top Navigation Bar */}
          <div className="flex justify-between items-center w-full pr-2 sm:pr-4 md:pr-8 py-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 rounded-md">
                  <CommunityIcon
                    iconUrl={iconImage}
                    name={Name}
                    size="md"
                    className="hover:scale-105 transition-transform duration-200"
                  />
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  {slug ? (
                    <Link
                      href={`/Newcompage/${slug}`}
                      className="btn btn-ghost text-sm sm:text-lg md:text-xl gap-1 normal-case font-bold p-0 h-auto min-h-0 justify-start max-w-full"
                      prefetch={true}
                      onClick={() =>
                        showNotification("Welcome to TheTribelab", "success")
                      }
                    >
                      <span className="truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                        {Name || "Loading..."}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-sm sm:text-lg md:text-xl font-bold text-muted truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]">
                      {Name || "Invalid Community"}
                    </span>
                  )}
                </div>
              </div>

              {/* Communities Dropdown */}
              {session && (
                <div className="dropdown dropdown-bottom dropdown-end flex-shrink-0 communities-dropdown">
                  <div
                    tabIndex={0}
                    role="button"
                    aria-label="Switch community"
                    title="Switch community"
                    className="btn btn-ghost btn-sm normal-case flex items-center gap-1 hover:bg-base-200 rounded-full"
                    onClick={toggleDropdown}
                  >
                    <ChevronDown size={16} className="text-primary" />
                  </div>
                  {isDropdownOpen && (
                    <ul
                      tabIndex={0}
                      className="dropdown-content z-[50] text-sm sm:text-base menu p-3 shadow-xl bg-base-100 rounded-box w-64 sm:w-72 border border-base-300 mt-2 left-1"
                    >
                      <li>
                        <Link
                          href="/community-feed"
                          className="flex items-center gap-3 hover:bg-base-200 rounded-lg py-3 px-2 transition-colors duration-200"
                          onClick={() => {
                            showNotification(
                              "Opening Community Discovery",
                              "info"
                            );
                            closeDropdown();
                          }}
                        >
                          <div
                            className="rounded-md bg-primary/10 w-10 h-10 flex-shrink-0 hover:scale-105 transition-transform duration-200 flex items-center justify-center"
                            title="Discover Communities"
                          >
                            <Compass size={20} className="text-primary" />
                          </div>
                          <span className="font-medium truncate flex-1">
                            Discover Communities
                          </span>
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/communityform"
                          className="flex items-center gap-3 hover:bg-base-200 rounded-lg py-3 px-2 transition-colors duration-200"
                          onClick={() => {
                            showNotification(
                              "Opening Community Creation",
                              "info"
                            );
                            closeDropdown();
                          }}
                        >
                          <div
                            className="rounded-md bg-primary/10 w-10 h-10 flex-shrink-0 hover:scale-105 transition-transform duration-200 flex items-center justify-center"
                            title="Create Community"
                          >
                            <Plus size={20} className="text-primary" />
                          </div>
                          <span className="font-medium truncate flex-1">
                            Create Community
                          </span>
                        </Link>
                      </li>
                      {/* Divider */}
                      {(userCommunities.length > 0 || communitiesLoading) && (
                        <>
                          <li className="border-t border-base-200 mx-2 my-2"></li>
                          <li>
                            <div className="px-3 py-1 text-xs text-base-content/60 font-medium uppercase tracking-wide">
                              Your Communities
                            </div>
                          </li>
                        </>
                      )}

                      {/* Loading State */}
                      {communitiesLoading && (
                        <li>
                          <div className="flex items-center justify-center py-4">
                            <span className="loading loading-spinner loading-sm"></span>
                            <span className="ml-2 text-sm">
                              Loading communities...
                            </span>
                          </div>
                        </li>
                      )}

                      {/* Error State */}
                      {communitiesError && !communitiesLoading && (
                        <li>
                          <div className="px-4 py-3 text-sm text-error text-center">
                            {communitiesError}
                            <button
                              onClick={() => window.location.reload()}
                              className="btn btn-xs btn-outline btn-error ml-2"
                            >
                              Retry
                            </button>
                          </div>
                        </li>
                      )}

                      {/* Communities List */}
                      {!communitiesLoading &&
                        !communitiesError &&
                        userCommunities.length > 0 && (
                          <ul className="space-y-1">
                            {userCommunities.map((community) => (
                              <li key={community._id}>
                                <Link
                                  href={`/Newcompage/${community.slug}`}
                                  className="flex items-center gap-3 hover:bg-base-200 rounded-lg py-3 px-2 transition-colors duration-200"
                                  onClick={() => {
                                    showNotification(
                                      `Switching to ${community.name}`,
                                      "info"
                                    );
                                    closeDropdown();
                                  }}
                                >
                                  <div
                                    className="rounded-md bg-primary/10 w-10 h-10 flex-shrink-0 hover:scale-105 transition-transform duration-200 flex items-center justify-center overflow-hidden border-2 border-primary/20"
                                    title={community.name}
                                  >
                                    {(() => {
                                      // Explicit inline sanitization for static analysis detection
                                      const rawImageUrl =
                                        community.iconImageUrl;
                                      const sanitizedImageUrl = (() => {
                                        if (
                                          !rawImageUrl ||
                                          typeof rawImageUrl !== "string"
                                        )
                                          return null;
                                        const cleanUrl = rawImageUrl.trim();
                                        // Block dangerous protocols explicitly
                                        if (
                                          cleanUrl
                                            .toLowerCase()
                                            .startsWith("javascript:") ||
                                          cleanUrl
                                            .toLowerCase()
                                            .startsWith("data:") ||
                                          cleanUrl
                                            .toLowerCase()
                                            .startsWith("vbscript:") ||
                                          cleanUrl
                                            .toLowerCase()
                                            .startsWith("file:")
                                        ) {
                                          return null;
                                        }
                                        return sanitizeImageUrl(rawImageUrl);
                                      })();

                                      return sanitizedImageUrl ? (
                                        <img
                                          src={sanitizedImageUrl}
                                          alt={`${community.name} icon`}
                                          className="w-full h-full object-cover rounded-md overflow-hidden"
                                        />
                                      ) : (
                                        <span className="text-primary text-sm font-bold">
                                          {community.name
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="truncate font-medium block text-sm">
                                      {community.name}
                                    </span>
                                  </div>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}

                      {/* Empty State */}
                      {!communitiesLoading &&
                        !communitiesError &&
                        userCommunities.length === 0 && (
                          <li>
                            <div className="px-4 py-3 text-sm text-base-content/60 text-center">
                              You haven't joined any other communities
                            </div>
                          </li>
                        )}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Right side icons */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Message Icon */}
              {session && <MessageIcon />}
              {/* Notification Icon */}
              {session && <NotificationIcon />}
              {/* Theme Switcher */}
              <ThemeSwitcher />
              <div className="dropdown dropdown-end">
                <div
                  tabIndex={0}
                  role="button"
                  aria-label="User menu"
                  title="User menu"
                  className="btn btn-ghost btn-circle avatar"
                >
                  {session?.user ? (
                    <ProfileAvatar
                      imageUrl={session.user.profileImage}
                      name={session.user.name}
                      email={session.user.email}
                      size="md"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full">
                      <User className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] shadow-lg bg-base-100 rounded-box w-64 mt-4 py-2"
                >
                  {session ? (
                    <>
                      <li className="px-4 py-1">
                        <span className="text-sm opacity-70 truncate">
                          {session.user?.email || session.user?.name}
                        </span>
                      </li>
                      <li className="divider my-1"></li>
                      <li>
                        <Link
                          href={"/profile"}
                          className="px-4 py-2 hover:bg-base-200 block w-full"
                          onClick={() =>
                            showNotification("Opening Profile", "info")
                          }
                        >
                          Profile
                        </Link>
                      </li>
                      <li>
                        <Link
                          href={"/communityform"}
                          className="px-4 py-2 hover:bg-base-200 block w-full"
                          onClick={() =>
                            showNotification("Create your Community", "info")
                          }
                        >
                          Create Community
                        </Link>
                      </li>
                      <li>
                        <button
                          type="button"
                          className="px-4 py-2 hover:bg-base-200 block w-full text-left"
                          onClick={() => {
                            openUserSettings();
                            showNotification("Opening Settings", "info");
                          }}
                        >
                          Settings
                        </button>
                      </li>
                      {isMember && slug && (
                        <li>
                          <button
                            type="button"
                            className="px-4 py-2 hover:bg-base-200 block w-full text-left"
                            onClick={() => {
                              openCommunitySettings(slug);
                              showNotification(
                                "Opening Community Settings",
                                "info"
                              );
                            }}
                          >
                            Community Settings
                          </button>
                        </li>
                      )}
                      <li className="divider my-1"></li>
                      <li>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="px-4 py-2 hover:bg-base-200 block w-full text-left"
                        >
                          Sign Out
                        </button>
                      </li>
                    </>
                  ) : (
                    <li>
                      <Link
                        href="/login"
                        className="px-4 py-2 hover:bg-base-200 block w-full"
                      >
                        Login
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="w-full border-t border-base-300">
            {isMember && slug ? (
              <>
                {/* Desktop navigation - centered on larger screens */}
                <div className="hidden md:flex gap-1 justify-start py-2">
                  <Link
                    href={`/Newcompage/${slug}`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    Community
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/Courses`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}/Courses`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    Courses
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/Calander`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}/Calander`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    Events
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/about`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}/about`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    About
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/members`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}/members`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    Members
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/leaderboard`}
                    className={`px-4 py-2 text-lg font-medium transition-all duration-200 border-b-3 relative ${
                      isLinkActive(`/Newcompage/${slug}/leaderboard`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:border-base-content/30 hover:bg-base-200/30"
                    }`}
                  >
                    Leaderboard
                  </Link>
                </div>

                {/* Mobile navigation - full width, icon-based */}
                <div className="md:hidden flex w-full">
                  <Link
                    href={`/Newcompage/${slug}`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="Community"
                  >
                    <Home size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      Home
                    </span>
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/Courses`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}/Courses`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="Courses"
                  >
                    <BookOpen size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      Courses
                    </span>
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/Calander`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}/Calander`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="Events"
                  >
                    <Calendar size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      Events
                    </span>
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/about`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}/about`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="About"
                  >
                    <Info size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      About
                    </span>
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/members`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}/members`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="Members"
                  >
                    <Users size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      Members
                    </span>
                  </Link>
                  <Link
                    href={`/Newcompage/${slug}/leaderboard`}
                    className={`flex-1 flex flex-col items-center py-2 px-1 transition-all duration-200 border-b-3 ${
                      isLinkActive(`/Newcompage/${slug}/leaderboard`)
                        ? "text-base-content border-base-content font-semibold bg-base-200/50"
                        : "text-base-content/70 hover:text-base-content border-transparent hover:bg-base-200/30"
                    }`}
                    title="Leaderboard"
                  >
                    <Trophy size={16} />
                    <span className="text-sm mt-1 truncate font-medium">
                      Ranking
                    </span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-2"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityNav;
