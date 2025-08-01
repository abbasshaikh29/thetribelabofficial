"use client";

import React from "react";
import Link from "next/link";
import { ICommunity } from "@/models/Community";
import { Users, DollarSign } from "lucide-react";

interface CommunityfeedProps {
  communitys: ICommunity[];
}

function truncateDescription(description: string | undefined): string {
  if (!description) {
    return "";
  }
  const words = description.split(" ");
  if (words.length > 30) {
    return words.slice(0, 30).join(" ") + "...";
  }
  return description;
}

export default function Communityfeed({ communitys }: CommunityfeedProps) {
  // Early return if communitys is undefined or null
  if (!communitys || !Array.isArray(communitys)) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No communities available.</p>
      </div>
    );
  }

  // Function to render the appropriate banner image component
  const renderBannerImage = (community: ICommunity) => {
    if (community?.bannerImageurl) {
      return (
        <div
          className="w-full h-full rounded-t-xl"
          style={{
            backgroundImage: `url(${community.bannerImageurl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          aria-label={`${community.name} banner`}
        />
      );
    }

    // Enhanced fallback gradient with community name initial and pattern
    const firstLetter = community.name?.charAt(0).toUpperCase() || "C";
    const gradients = [
      "from-primary/20 via-primary/10 to-primary/20",
      "from-primary/20 via-primary/10 to-primary/20",
      "from-primary/20 via-primary/10 to-primary/20",
      "from-primary/20 via-primary/10 to-primary/20",
      "from-primary/20 via-primary/10 to-primary/20",
    ];

    const gradientIndex = community.name
      ? community.name.length % gradients.length
      : 0;
    const selectedGradient = gradients[gradientIndex];

    return (
      <div
        className={`w-full h-full rounded-t-xl bg-gradient-to-br ${selectedGradient} relative overflow-hidden`}
      >
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-4 w-16 h-16 border-2 border-primary rounded-full"></div>
          <div className="absolute top-8 right-8 w-8 h-8 border border-primary rounded-full"></div>
          <div className="absolute bottom-6 left-8 w-12 h-12 border border-primary rounded-full"></div>
          <div className="absolute bottom-4 right-4 w-6 h-6 border border-primary rounded-full"></div>
        </div>

        {/* Main content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 bg-primary/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-primary/30">
              <span className="text-2xl font-bold text-primary">
                {firstLetter}
              </span>
            </div>
            <div className="text-center">
              <div className="text-primary/80 text-sm font-medium truncate max-w-32">
                {community.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Function to render the appropriate icon image component
  const renderIconImage = (community: ICommunity) => {
    if (community.iconImageUrl) {
      return (
        <img
          src={community.iconImageUrl}
          alt={`${community.name} icon`}
          className="w-10 h-10 rounded-md object-cover border border-gray-200 shadow-sm"
        />
      );
    }

    // Enhanced fallback icon with community initial and gradient
    const firstLetter = community.name?.charAt(0).toUpperCase() || "C";
    const iconGradients = [
      "from-primary/90 to-primary",
      "from-primary/90 to-primary",
      "from-primary/90 to-primary",
      "from-primary/90 to-primary",
      "from-primary/90 to-primary",
    ];

    const gradientIndex = community.name
      ? community.name.length % iconGradients.length
      : 0;
    const selectedGradient = iconGradients[gradientIndex];

    return (
      <div
        className={`w-10 h-10 rounded-md bg-gradient-to-br ${selectedGradient} flex items-center justify-center border border-primary/20 shadow-sm`}
      >
        <span className="text-primary-foreground text-sm font-bold">
          {firstLetter}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 px-2 sm:px-0">
      {communitys.map((community) => (
        <Link
          key={community._id?.toString()}
          href={community.slug ? `/Newcompage/${community.slug}/about` : "#"}
          className="rounded-xl shadow-sm border h-[350px] sm:h-[400px] overflow-hidden hover:shadow-md transition-all duration-200 block community-card"
          style={{
            backgroundColor: "var(--card-bg)",
            color: "var(--text-primary)",
            borderColor: "var(--card-border)",
          }}
        >
          {/* Banner */}
          <div className="w-full h-32 sm:h-40 bg-primary/5 relative overflow-hidden">
            {renderBannerImage(community)}
          </div>

          {/* Community Icon and Name */}
          <div className="p-3 sm:p-5 flex flex-col h-[calc(350px-128px)] sm:h-[calc(400px-160px)]">
            <div className="flex items-center gap-2 sm:gap-3 mb-3">
              {renderIconImage(community)}
              <h2 className="font-bold text-base sm:text-lg truncate">{community.name}</h2>
            </div>

            <p
              className="text-sm mb-4 flex-grow line-clamp-4"
              style={{ color: "var(--text-secondary)" }}
            >
              {truncateDescription(community.description)}
            </p>

            <div
              className="mt-auto pt-4 border-t"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Users
                    className="h-4 w-4"
                    style={{ color: "var(--text-secondary)" }}
                  />
                  <span className="text-sm font-medium">
                    {(community.members?.length || 0).toLocaleString()} Members
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {community.price ? (
                    <>
                      <DollarSign
                        className="h-4 w-4"
                        style={{ color: "var(--text-secondary)" }}
                      />
                      <span className="text-sm font-medium">
                        ${community.price}/month
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-green-600">
                      Free
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
