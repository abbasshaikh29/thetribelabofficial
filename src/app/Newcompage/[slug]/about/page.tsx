"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ICommunity } from "@/models/Community";
import CommunityAboutcard from "@/components/communitycommponets/CommunityAboutcard";
import About from "@/components/communitynav/About";
import { useSession } from "next-auth/react";
import dynamic from 'next/dynamic';

const CommunityNav = dynamic(() => import('@/components/communitynav/CommunityNav'), {
  loading: () => <div className="h-16 bg-base-200"></div>, // Simple placeholder for nav height
  ssr: false // Optional: if CommunityNav relies heavily on client-side things like window
});

const CompactLeaderboard = dynamic(() => import('@/components/gamification/CompactLeaderboard'), {
  loading: () => <div className="skeleton h-64 w-full"></div>,
  ssr: false
});
async function getCommunity(slug: string): Promise<ICommunity | null> {
  try {
    const response = await fetch(`/api/community/${slug}`);
    if (!response.ok) {
      throw new Error("Failed to fetch community");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching community:", error);
    return null;
  }
}
function Page() {
  const { status } = useSession();
  const router = useRouter();
  const { slug } = useParams<{ slug: string }>();
  const [community, setCommunity] = useState<ICommunity | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (slug) {
      getCommunity(slug)
        .then((data) => {
          setCommunity(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [slug]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!community) {
    return <div>Community not found</div>;
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <CommunityNav />
      <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4 mt-3 sm:mt-6">
        <div className="flex flex-col lg:flex-row justify-center gap-4 lg:gap-8">
          <div className="w-full lg:w-2/3 lg:max-w-3xl">
            <About slug={slug} />
          </div>
          <div className="w-full lg:w-1/4 mt-4 lg:mt-0 space-y-4">
            <CommunityAboutcard slug={slug} />

            {/* Compact Leaderboard */}
            <CompactLeaderboard
              communityId={community?._id?.toString() || ""}
              communitySlug={slug}
              period="30day"
              limit={5}
            />

            <div className="mt-3 sm:mt-4 justify-center flex lg:text-left">
              <h4 className="text-sm sm:text-base  ">
                powered by
                <span className="text-rose-600 ml-2">THETRIBELAB</span>
              </h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;
