"use client";

import Header from "@/components/Header";
import Communityfeed from "@/components/communitycommponets/Communityfeed";
import { ICommunity } from "@/models/Community";
import { apiClient, PaginationResponse } from "@/lib/api-client";
import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import Pagination from "@/components/ui/Pagination";
import PageFooter from "@/components/PageFooter";

interface Props {
  initialCommunities: ICommunity[];
  initialPagination: PaginationResponse<ICommunity>["pagination"];
  initialPage: number;
}

export default function CommunityFeedClient({
  initialCommunities,
  initialPagination,
  initialPage,
}: Props) {
  const [communities, setCommunities] = useState<ICommunity[]>(
    initialCommunities
  );
  const [filteredCommunities, setFilteredCommunities] =
    useState<ICommunity[]>(initialCommunities);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pagination, setPagination] = useState(
    initialPagination ?? {
      total: initialCommunities.length,
      page: initialPage,
      limit: 30,
      pages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    }
  );

  // Fetch communities for the requested page
  const fetchCommunities = useCallback(
    async (page: number) => {
      if (page === initialPage) return; // already have data
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.getcommunities(page);
        setCommunities(response.communities);
        setPagination(response.pagination);
        // Apply current search term on the new list
        if (searchTerm.trim() === "") {
          setFilteredCommunities(response.communities);
        } else {
          const filtered = response.communities.filter(
            (community) =>
              community.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (community.description &&
                community.description
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()))
          );
          setFilteredCommunities(filtered);
        }
      } catch (err) {
        console.error("Error fetching communities:", err);
        setError("Failed to load communities. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [initialPage, searchTerm]
  );

  // Handle page change
  useEffect(() => {
    if (currentPage !== initialPage) {
      fetchCommunities(currentPage);
    }
  }, [currentPage, initialPage, fetchCommunities]);

  // Filter communities based on search term
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.trim() === "") {
      setFilteredCommunities(communities);
    } else {
      const filtered = communities.filter(
        (community) =>
          community.name.toLowerCase().includes(term.toLowerCase()) ||
          (community.description &&
            community.description.toLowerCase().includes(term.toLowerCase()))
      );
      setFilteredCommunities(filtered);
    }
  };

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}
    >
      <Header />

      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8 px-4 py-6">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Discover communities
          </h1>
          <div className="text-center mt-4">
            <span className="text-gray-600">or </span>
            <a
              href="/communityform"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              create your own
            </a>
          </div>
        </div>

        <div className="max-w-xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              placeholder="Search for anything"
              value={searchTerm}
              onChange={handleSearch}
              className="w-full px-4 py-3 pl-12 pr-10 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-halloween-orange focus:border-transparent"
              style={{
                backgroundColor: "var(--input-bg)",
                color: "var(--text-primary)",
                borderColor: "var(--input-border)",
              }}
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={() => fetchCommunities(currentPage)}
              className="btn btn-primary btn-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <Communityfeed communitys={filteredCommunities} />
        )}

        {pagination && pagination.pages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.pages}
            onPageChange={setCurrentPage}
            className="mt-12"
          />
        )}
      </div>
      <PageFooter />
    </main>
  );
} 