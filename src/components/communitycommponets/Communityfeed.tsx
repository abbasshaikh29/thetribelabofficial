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
  // Function to render the appropriate image component
  const renderImage = (community: ICommunity) => {
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

    // Fallback gradient with Users icon
    return (
      <div className="w-full h-full rounded-t-xl bg-gradient-to-r from-primary/40 to-primary/20 flex items-center justify-center">
        <Users size={48} className="text-primary opacity-70" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {communitys.map((community) => (
        <Link
          key={community._id?.toString()}
          href={community.slug ? `/Newcompage/${community.slug}/about` : "#"}
          className="rounded-xl shadow-sm border h-[400px] overflow-hidden hover:shadow-md transition-all duration-200 block community-card"
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-primary)',
            borderColor: 'var(--card-border)'
          }}
        >
          {/* Banner */}
          <div className="w-full h-40 bg-gray-200 relative overflow-hidden">
            {renderImage(community)}
          </div>
          
          {/* Community Icon and Name */}
          <div className="p-5 flex flex-col h-[calc(400px-160px)]">
            <div className="flex items-center gap-3 mb-3">
              {community.iconImageUrl ? (
                <img
                  src={community.iconImageUrl}
                  alt={`${community.name} icon`}
                  className="w-10 h-10 rounded-md object-cover border border-gray-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-md border border-gray-200 bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <Users size={20} className="text-primary opacity-70" />
                </div>
              )}
              <h2 className="font-bold text-lg truncate">
                {community.name}
              </h2>
            </div>
            
            <p className="text-sm mb-4 flex-grow line-clamp-4" style={{ color: 'var(--text-secondary)' }}>
              {truncateDescription(community.description)}
            </p>
            
            <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-sm font-medium">{community.members.length.toLocaleString()} Members</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {community.price ? (
                    <>
                      <DollarSign className="h-4 w-4" style={{ color: 'var(--text-secondary)' }} />
                      <span className="text-sm font-medium">${community.price}/month</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-green-600">Free</span>
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
