"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { User, ChevronDown, Compass, Plus } from "lucide-react";
import { useNotification } from "@/components/Notification";
import { useSettingsModal } from "@/components/modals/SettingsModalProvider";
import { useSession, signOut } from "next-auth/react";
import CommunityIcon from "./CommunityIcon";
import MessageIcon from "../messages/MessageIcon";
import NotificationIcon from "../notifications/NotificationIcon";
import ProfileAvatar from "../ProfileAvatar";
interface Community {
  _id: string;
  name: string;
  slug: string;
  iconImageUrl?: string;
  role: string;
}

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

  // Debug logging for slug parameter
  useEffect(() => {
    console.log('CommunityNav: slug parameter changed:', slug);
    console.log('CommunityNav: pathname:', pathname);
  }, [slug, pathname]);

  // No debug logging in production

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
    if (!session?.user?.id || !slug || slug === 'undefined') {
      console.log('CommunityNav: Skipping fetchCommunity - missing slug or session:', { slug, userId: session?.user?.id });
      return;
    }

    try {
      console.log('CommunityNav: Fetching community data for slug:', slug);
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
        console.error('CommunityNav: Failed to fetch community data:', res.status, res.statusText);
        throw new Error("Failed to fetch community data");
      }

      const data = await res.json();
      console.log('CommunityNav: Successfully fetched community data:', data.name);
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
      console.error('CommunityNav: Error fetching community data:', error);
      // Silent error handling for UI, but log for debugging
    }
  };

  useEffect(() => {
    // Only fetch if we have a valid slug and session
    if (!slug || slug === 'undefined' || !session?.user?.id) {
      console.log('CommunityNav: Skipping useEffect - invalid slug or no session:', { slug, userId: session?.user?.id });
      return;
    }

    console.log('CommunityNav: useEffect triggered for slug:', slug);
    // Fetch community data when component mounts or slug changes
    fetchCommunity();

    // Set up an interval to periodically check for updates
    const intervalId = setInterval(() => {
      fetchCommunity();
    }, 10000); // Check every 10 seconds

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
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
      if (session?.user && slug && slug !== 'undefined') {
        try {
          console.log('CommunityNav: Fetching user communities, excluding slug:', slug);
          const response = await fetch("/api/user/communities");
          if (response.ok) {
            const data = await response.json();
            // Filter out the current community from the dropdown
            const filteredCommunities = data.filter(
              (community: Community) => community.slug !== slug
            );
            setUserCommunities(filteredCommunities);

            // Preload all community icons
            preloadCommunityIcons(filteredCommunities);
          }
        } catch (error) {
          console.error('CommunityNav: Error fetching user communities:', error);
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
    <div className="navbar sticky top-0 shadow-md z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="flex flex-col justify-center w-full">
        <div className="container mx-auto flex justify-between px-4 sm:px-8 md:px-16 items-center">
          <div className="flex-1 px-2 lg:flex-none flex items-center gap-2">
            <div className="flex items-center">
              <div className="mr-2 flex-shrink-0">
                <CommunityIcon
                  iconUrl={iconImage}
                  name={Name}
                  size="md"
                  className="hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="flex flex-col">
                {slug && slug !== 'undefined' ? (
                  <Link
                    href={`/Newcompage/${slug}`}
                    className="btn btn-ghost text-sm sm:text-lg md:text-xl gap-1 sm:gap-2 normal-case font-bold p-0 h-auto min-h-0"
                    prefetch={true}
                    onClick={() =>
                      showNotification("Welcome to TheTribelab", "success")
                    }
                  >
                    <span className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
                      {Name || 'Loading...'}
                    </span>
                  </Link>
                ) : (
                  <span className="text-sm sm:text-lg md:text-xl font-bold text-gray-500">
                    {Name || 'Invalid Community'}
                  </span>
                )}
              </div>
            </div>

            {/* Communities Dropdown */}
            {session && (
              <div className="dropdown dropdown-bottom">
                <div
                  tabIndex={0}
                  role="button"
                  aria-label="Switch community"
                  title="Switch community"
                  className="btn btn-ghost btn-sm normal-case flex items-center gap-1 hover:bg-base-200 rounded-full"
                >
                  <ChevronDown size={20} className="text-primary" />
                </div>
                <ul
                  tabIndex={0}
                  className="dropdown-content z-[1] text-lg menu p-2 shadow-lg bg-base-100 rounded-box w-72 border border-base-300"
                >
                  <li className="mt-2">
                    <Link
                      href="/community-feed"
                      className="flex items-center gap-2 hover:bg-base-200 rounded-lg py-2"
                    >
                      <div
                        className={` rounded-md overflow-hidden w-8 h-8 sm:w-10 sm:h-10 min-w-8 min-h-8 sm:min-w-10 sm:min-h-10 flex-shrink-0 hover:scale-105 transition-transform duration-200  flex items-center justify-center`}
                        title="compass"
                      >
                        <Compass size={25} className="text-primary" />
                      </div>
                      <span className="font-medium">Discover Communities</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/communityform"
                      className="flex items-center gap-2 hover:bg-base-200 rounded-lg py-2"
                    >
                      <div
                        className={` rounded-md overflow-hidden w-8 h-8 sm:w-10 sm:h-10 min-w-8 min-h-8 sm:min-w-10 sm:min-h-10 flex-shrink-0 hover:scale-105 transition-transform duration-200  flex items-center justify-center`}
                        title="compass"
                      >
                        <Plus size={25} className="text-primary" />
                      </div>
                      <span className="font-medium">Create Community</span>
                    </Link>
                  </li>
                  {userCommunities.length > 0 ? (
                    userCommunities.map((community) => (
                      <li key={community._id}>
                        <Link
                          href={`/Newcompage/${community.slug}`}
                          className="flex justify-between hover:bg-base-200 rounded-lg py-2"
                        >
                          <div className="flex items-center gap-3">
                            <CommunityIcon
                              iconUrl={community.iconImageUrl}
                              name={community.name}
                              size="md"
                              className="hover:scale-105 transition-transform duration-200"
                              priority={true}
                            />
                            <span className="truncate font-medium">
                              {community.name}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-2 text-sm text-gray-500">
                      You haven't joined any other communities
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <div className="flex flex-1 justify-end px-2">
            <div className="flex items-stretch gap-2">
              {/* Message Icon */}
              {session && <MessageIcon />}
              {/* Notification Icon */}
              {session && <NotificationIcon />}
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
                        <span className="text-sm opacity-70">
                          {session.user?.id}
                        </span>
                      </li>
                      <li className="divider my-1"></li>
                      <li>
                        <Link
                          href={"/profile"}
                          className="px-4 py-2 hover:bg-base-200 block w-full"
                          onClick={() =>
                            showNotification("Create your Community", "info")
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
                          CreateCommunity
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
                      {isMember && slug && slug !== 'undefined' && (
                        <li>
                          <button
                            type="button"
                            className="px-4 py-2 hover:bg-base-200 block w-full text-left"
                            onClick={() => {
                              openCommunitySettings(slug);
                              showNotification("Opening Community Settings", "info");
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
                          className="px-4 py-2 hover:bg-base-200 block w-full"
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
        </div>

        <div className="w-full overflow-x-auto">
          {isMember && slug && slug !== 'undefined' ? (
            <>
              {/* Desktop navigation - centered on larger screens */}
              <div className="hidden md:flex gap-2 justify-center">
                <Link
                  href={`/Newcompage/${slug}`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Community
                </Link>
                <Link
                  href={`/Newcompage/${slug}/Courses`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}/Courses`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Courses
                </Link>
                <Link
                  href={`/Newcompage/${slug}/Calander`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}/Calander`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Calander
                </Link>
                <Link
                  href={`/Newcompage/${slug}/about`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}/about`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  About
                </Link>
                <Link
                  href={`/Newcompage/${slug}/members`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}/members`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Members
                </Link>
                <Link
                  href={`/Newcompage/${slug}/leaderboard`}
                  className={`btn text-lg btn-ghost ${
                    isLinkActive(`/Newcompage/${slug}/leaderboard`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Leaderboard
                </Link>
              </div>

              {/* Mobile navigation - scrollable, centered content */}
              <div className="md:hidden flex gap-1 overflow-x-auto pb-2 scrollbar-thin justify-center">
                <Link
                  href={`/Newcompage/${slug}`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Community
                </Link>
                <Link
                  href={`/Newcompage/${slug}/Courses`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}/Courses`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Courses
                </Link>
                <Link
                  href={`/Newcompage/${slug}/Calander`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}/Calander`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Calander
                </Link>
                <Link
                  href={`/Newcompage/${slug}/about`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}/about`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  About
                </Link>
                <Link
                  href={`/Newcompage/${slug}/members`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}/members`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Members
                </Link>
                <Link
                  href={`/Newcompage/${slug}/leaderboard`}
                  className={`btn btn-sm text-sm btn-ghost whitespace-nowrap ${
                    isLinkActive(`/Newcompage/${slug}/leaderboard`)
                      ? "bg-primary text-primary-content"
                      : "hover:text-primary"
                  }`}
                >
                  Leaderboard
                </Link>
              </div>
            </>
          ) : (
            <div></div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommunityNav;
