import CommunityFeedClient from "./CommunityFeedClient";
import { PaginationResponse } from "@/lib/api-client";
import { ICommunity } from "@/models/Community";

// Server component
interface PageProps {
  /**
   * In Next.js 15 `searchParams` is provided as a Promise when the route is
   * rendered on the server. See: https://github.com/vercel/next.js/issues/57912
   */
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CommunityFeedPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const pageParam = Array.isArray(resolvedSearchParams?.page)
    ? resolvedSearchParams?.page[0]
    : resolvedSearchParams?.page;
  const page = pageParam ? parseInt(pageParam, 10) || 1 : 1;
  const limit = 30;

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000";
  let initialData: PaginationResponse<ICommunity> = {
    communities: [],
    pagination: {
      total: 0,
      page,
      limit,
      pages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    },
  };

  try {
    const res = await fetch(
      `${baseUrl}/api/community?page=${page}&limit=${limit}`,
      {
        next: { revalidate: 60 }, // cache for 1 minute in production
      }
    );
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (err) {
    console.error("Failed to fetch communities on server", err);
  }

  return (
    <CommunityFeedClient
      initialCommunities={initialData.communities}
      initialPagination={initialData.pagination}
      initialPage={page}
    />
  );
}
