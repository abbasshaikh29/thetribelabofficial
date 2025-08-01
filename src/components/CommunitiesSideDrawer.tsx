"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Compass, Plus, Search, Settings } from "lucide-react";
import CommunityIcon from "./communitynav/CommunityIcon";

interface Community {
  _id: string;
  name: string;
  slug: string;
  iconImageUrl?: string;
  role: string;
}

interface CommunitiesSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userCommunities: Community[];
  currentCommunity: Community | null;
}

export default function CommunitiesSideDrawer({
  isOpen,
  onClose,
  userCommunities,
  currentCommunity,
}: CommunitiesSideDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-60 z-[9998] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Side Drawer */}
      <div
        ref={drawerRef}
        className={`fixed left-0 top-0 h-full w-80 max-w-[85vw] z-[9999] flex flex-col transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          backgroundColor: "var(--bg-primary)",
          borderRight: "1px solid var(--border-color)"
        }}
      >
        {/* Content */}
        <div className="flex flex-col h-full px-4 pt-4 relative" style={{ backgroundColor: "var(--bg-primary)" }}>
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted"
            aria-label="Close communities menu"
          >
            <X size={20} style={{ color: "var(--text-secondary)" }} />
          </button>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 rounded-lg border-0 text-sm"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  color: "var(--text-primary)"
                }}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2"
                aria-label="Search settings"
              >
                <Settings size={18} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 border-b border-muted pb-3 mb-3">
            <Link href="/communityform" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted" onClick={onClose}>
              <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg">
                <Plus size={20} />
              </div>
              <span className="text-sm font-medium">Create a community</span>
            </Link>

            <Link href="/community-feed" className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted" onClick={onClose}>
              <div className="w-10 h-10 flex items-center justify-center bg-muted rounded-lg">
                <Compass size={20} />
              </div>
              <span className="text-sm font-medium">Discover communities</span>
            </Link>
          </div>

          {/* Community List */}
          {userCommunities?.length > 0 && (
            <div className="flex-1  space-y-2 pb-4">
              <div className="text-xs text-muted mb-1">{userCommunities.length} communities</div>
              {userCommunities
                .filter((c) => searchTerm === "" || c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((community) => {
                  const isCurrentCommunity = currentCommunity?.slug === community.slug;
                  return (
                    <Link
                      key={community._id}
                      href={`/Newcompage/${community.slug}`}
                      className="flex items-center gap-3 px-2 py-2 rounded-lg transition-colors duration-200"
                      style={{
                        backgroundColor: isCurrentCommunity ? "var(--hover-bg)" : "transparent"
                      }}
                      onMouseEnter={(e) => {
                        if (!isCurrentCommunity) e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isCurrentCommunity) e.currentTarget.style.backgroundColor = "transparent";
                      }}
                      onClick={onClose}
                    >
                      <CommunityIcon
                        iconUrl={community.iconImageUrl}
                        name={community.name}
                        size="sm"
                        className="w-10 h-10 rounded-lg flex-shrink-0"
                        priority={true}
                      />
                      <span className="text-sm truncate">{community.name}</span>
                    </Link>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
