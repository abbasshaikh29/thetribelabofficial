"use client";

import Header from "@/components/Header";
import Communityfeed from "@/components/communitycommponets/Communityfeed";
import { ICommunity } from "@/models/Community";
import { apiClient, PaginationResponse } from "@/lib/api-client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Filter, DollarSign, Gift } from "lucide-react";
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
  // Debug logging
  console.log("CommunityFeedClient: Initial communities:", {
    count: initialCommunities?.length || 0,
    sample: initialCommunities?.[0]
      ? {
          name: initialCommunities[0].name,
          members: initialCommunities[0].members,
          membersLength: initialCommunities[0].members?.length,
          bannerImageurl: initialCommunities[0].bannerImageurl,
          price: initialCommunities[0].price,
        }
      : "No communities",
  });

  const [communities, setCommunities] = useState<ICommunity[]>(
    initialCommunities || []
  );
  const [filteredCommunities, setFilteredCommunities] = useState<ICommunity[]>(
    initialCommunities || []
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [filterType, setFilterType] = useState<"all" | "free" | "paid">("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState(
    initialPagination ?? {
      total: (initialCommunities || []).length,
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

  // Apply filters (search + price filter)
  const applyFilters = useCallback(() => {
    let filtered = communities;

    // Apply search filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(
        (community) =>
          community.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (community.description &&
            community.description
              .toLowerCase()
              .includes(searchTerm.toLowerCase()))
      );
    }

    // Apply price filter
    if (filterType === "free") {
      filtered = filtered.filter(
        (community) => !community.price || community.price === 0
      );
    } else if (filterType === "paid") {
      filtered = filtered.filter(
        (community) => community.price && community.price > 0
      );
    }

    setFilteredCommunities(filtered);
  }, [communities, searchTerm, filterType]);

  // Filter communities based on search term
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
  };

  // Handle filter change
  const handleFilterChange = (newFilter: "all" | "free" | "paid") => {
    setFilterType(newFilter);
    setIsFilterOpen(false);
  };

  // Apply filters whenever dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node)
      ) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <main
      className="min-h-screen"
      style={{
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
      }}
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

        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex gap-4 items-center">
            {/* Search Bar */}
            <div className="relative flex-1">
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

            {/* Filter Button */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="flex items-center gap-2 px-4 py-3 text-sm border rounded-lg hover:bg-base-200 transition-colors duration-200"
                style={{
                  backgroundColor:
                    filterType !== "all" ? "var(--primary)" : "var(--input-bg)",
                  color:
                    filterType !== "all"
                      ? "var(--primary-content)"
                      : "var(--text-primary)",
                  borderColor: "var(--input-border)",
                }}
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {filterType === "all"
                    ? "All"
                    : filterType === "free"
                      ? "Free"
                      : "Paid"}
                </span>
                {filterType !== "all" && (
                  <span className="bg-primary-content text-primary rounded-full w-2 h-2"></span>
                )}
              </button>

              {/* Filter Dropdown */}
              {isFilterOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-base-100 border border-base-300 rounded-lg shadow-lg z-10">
                  <div className="p-2">
                    <div className="text-xs font-medium text-base-content/60 mb-2 px-2">
                      Filter by Price
                    </div>
                    <button
                      onClick={() => handleFilterChange("all")}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition-colors ${
                        filterType === "all"
                          ? "bg-primary text-primary-content"
                          : ""
                      }`}
                    >
                      <Filter className="h-4 w-4" />
                      All Communities
                    </button>
                    <button
                      onClick={() => handleFilterChange("free")}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition-colors ${
                        filterType === "free"
                          ? "bg-primary text-primary-content"
                          : ""
                      }`}
                    >
                      <Gift className="h-4 w-4" />
                      Free Communities
                    </button>
                    <button
                      onClick={() => handleFilterChange("paid")}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg hover:bg-base-200 transition-colors ${
                        filterType === "paid"
                          ? "bg-primary text-primary-content"
                          : ""
                      }`}
                    >
                      <DollarSign className="h-4 w-4" />
                      Paid Communities
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filter Status Display */}
          {filterType !== "all" && (
            <div className="mt-4 flex items-center gap-2 text-sm text-base-content/60">
              <span>Showing {filterType} communities</span>
              <button
                onClick={() => handleFilterChange("all")}
                className="text-primary hover:underline"
              >
                Clear filter
              </button>
            </div>
          )}
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
