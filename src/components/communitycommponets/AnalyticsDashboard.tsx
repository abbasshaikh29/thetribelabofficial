"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotification } from "@/components/Notification";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Calendar,
  TrendingUp,
  Users,
  UserPlus,
  AlertCircle,
  DollarSign,
  CreditCard,
} from "lucide-react";

interface AnalyticsData {
  period: string;
  activeMembers: number;
  newMembers: number;
  date: string;
  revenue: number;
  transactionCount: number;
  totalPosts: number;
  totalComments: number;
}

interface AnalyticsSummary {
  currentActiveMembers: number;
  totalNewMembers: number;
  averageNewMembers: number;
  growthRate: number;
  monthlyRecurringRevenue: number;
  totalRevenue: number;
  paidMembers: number;
  conversionRate: number;
}

interface AnalyticsResponse {
  period: string;
  data: AnalyticsData[];
  summary: AnalyticsSummary;
}

type TimePeriod = "daily" | "weekly" | "monthly" | "7d" | "30d" | "90d";

// Loading skeleton component for dashboard cards
const DashboardCardSkeleton = () => (
  <Card className="@container/card">
    <CardHeader className="relative pb-2">
      <Skeleton className="h-4 w-32 mb-2" />
      <Skeleton className="h-8 w-24" />
      <div className="absolute right-4 top-4">
        <Skeleton className="h-6 w-16 rounded-lg" />
      </div>
    </CardHeader>
    <CardFooter className="flex-col items-start gap-1 text-sm pt-0">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-32" />
    </CardFooter>
  </Card>
);

export default function AnalyticsDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const { showNotification } = useNotification();

  const [analyticsData, setAnalyticsData] = useState<AnalyticsResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("weekly");

  // Load saved period preference
  useEffect(() => {
    const savedPeriod = localStorage.getItem("analytics-period") as TimePeriod;
    if (
      savedPeriod &&
      ["daily", "weekly", "monthly", "7d", "30d", "90d"].includes(savedPeriod)
    ) {
      setSelectedPeriod(savedPeriod);
    }
  }, []);

  // Fetch analytics data
  const fetchAnalytics = async (period: TimePeriod) => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await fetch(
        `/api/community/${slug}/analytics?period=${period}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch analytics");
      }

      const data: AnalyticsResponse = await response.json();
      setAnalyticsData(data);
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      const errorMessage = error.message || "Failed to load analytics";
      setError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle period change
  const handlePeriodChange = (period: TimePeriod) => {
    setSelectedPeriod(period);
    localStorage.setItem("analytics-period", period);
    fetchAnalytics(period);
  };

  // Calculate Y-axis domain to ensure it starts from zero
  const getYAxisDomain = (
    data: AnalyticsData[],
    dataKey: keyof AnalyticsData
  ) => {
    if (!data || data.length === 0) return [0, 10];

    const maxValue = Math.max(...data.map((item) => item[dataKey] as number));
    const padding = Math.max(1, Math.ceil(maxValue * 0.1)); // Add 10% padding

    return [0, maxValue + padding];
  };

  // Initial data fetch
  useEffect(() => {
    if (slug && session?.user?.id) {
      fetchAnalytics(selectedPeriod);
    }
  }, [slug, session?.user?.id, selectedPeriod]);

  // Format period label for display
  const formatPeriodLabel = (period: string, type: TimePeriod) => {
    try {
      switch (type) {
        case "daily":
          // Format: "2024-01-15 14:00" -> "2:00 PM"
          if (period.includes(" ")) {
            const [datePart, timePart] = period.split(" ");
            const [hour] = timePart.split(":");
            const hourNum = parseInt(hour);
            const ampm = hourNum >= 12 ? "PM" : "AM";
            const displayHour =
              hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
            return `${displayHour}:00 ${ampm}`;
          }
          return new Date(period).toLocaleDateString();
        case "weekly":
        case "monthly":
        case "7d":
        case "30d":
        case "90d":
          // Format: "2024-01-15" -> "Jan 15"
          const date = new Date(period + "T00:00:00");
          return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        default:
          return period;
      }
    } catch (error) {
      return period;
    }
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
          <p className="text-sm font-medium mb-2 text-gray-900">
            {formatPeriodLabel(label, selectedPeriod)}
          </p>
          {payload.map((entry: any, index: number) => (
            <p
              key={index}
              className="text-sm text-gray-700"
              style={{ color: entry.color }}
            >
              {entry.name}:{" "}
              <span className="font-semibold">{Math.floor(entry.value)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center items-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <p className="text-base-content/70">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Loading State */}
      {loading && (
        <div className="p-6 space-y-8">
          {/* Loading Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
          </div>

          {/* Loading Charts */}
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-halloween-orange mx-auto mb-4"></div>
              <p className="text-gray-600">Loading analytics data...</p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Analytics Content */}
      {!loading && !error && analyticsData && (
        <div
          className="p-6 space-y-8"
          style={{
            backgroundColor: "var(--bg-primary)",
            color: "var(--text-primary)",
          }}
        >
          {/* Enhanced Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Monthly Recurring Revenue */}
            <Card
              className="@container/card shadow-sm"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--brand-primary)",
                borderWidth: "1px",
                borderStyle: "solid",
                background: `linear-gradient(to top, var(--brand-primary)10, var(--card-bg))`,
              }}
            >
              <CardHeader className="relative pb-2">
                <CardDescription
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Monthly Recurring Revenue
                </CardDescription>
                <CardTitle
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "600",
                    color: "var(--brand-primary)",
                  }}
                >
                  ₹{analyticsData.summary.monthlyRecurringRevenue.toFixed(2)}
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge
                    variant="outline"
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      borderColor: "var(--brand-primary)",
                      color: "var(--brand-primary)",
                      backgroundColor: "transparent",
                    }}
                  >
                    <TrendingUp className="size-3" />
                    +12.5%
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm pt-0">
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    fontWeight: "500",
                    color: "var(--brand-primary)",
                  }}
                >
                  Trending up this month <TrendingUp className="size-4" />
                </div>
                <div
                  style={{
                    color: "var(--text-secondary)",
                  }}
                >
                  Revenue from paid memberships
                </div>
              </CardFooter>
            </Card>

            {/* Total Members */}
            <Card
              className="@container/card shadow-sm"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--brand-primary)",
                borderWidth: "1px",
                borderStyle: "solid",
                background: `linear-gradient(to top, var(--brand-primary)10, var(--card-bg))`,
              }}
            >
              <CardHeader className="relative pb-2">
                <CardDescription
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                  }}
                >
                  Total Members
                </CardDescription>
                <CardTitle
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: "600",
                    color: "var(--brand-primary)",
                  }}
                >
                  {analyticsData.summary.currentActiveMembers.toLocaleString()}
                </CardTitle>
                <div className="absolute right-4 top-4">
                  <Badge
                    variant="outline"
                    style={{
                      display: "flex",
                      gap: "0.25rem",
                      borderRadius: "0.5rem",
                      fontSize: "0.75rem",
                      borderColor: "var(--brand-primary)",
                      color: "var(--brand-primary)",
                      backgroundColor: "transparent",
                    }}
                  >
                    <UserPlus className="size-3" />+
                    {analyticsData.summary.totalNewMembers}
                  </Badge>
                </div>
              </CardHeader>
              <CardFooter className="flex-col items-start gap-1 text-sm pt-0">
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    fontWeight: "500",
                    color: "var(--brand-primary)",
                  }}
                >
                  All-time members <Users className="size-4" />
                </div>
                <div
                  style={{
                    color: "var(--text-secondary)",
                  }}
                >
                  {analyticsData.summary.totalNewMembers} new this period
                </div>
              </CardFooter>
            </Card>
          </div>
          {/* Active Members Chart */}
          <Card
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "0.5rem",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle
                    style={{
                      fontSize: "1.125rem",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                    }}
                  >
                    Active members
                  </CardTitle>
                  <CardDescription
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--brand-primary)",
                      fontWeight: "500",
                      marginTop: "0.25rem",
                    }}
                  >
                    Weekly active
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedPeriod === "90d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("90d")}
                    style={{
                      height: "2rem",
                      padding: "0 0.75rem",
                      fontSize: "0.75rem",
                      backgroundColor:
                        selectedPeriod === "90d"
                          ? "var(--brand-primary)"
                          : "var(--bg-secondary)",
                      color:
                        selectedPeriod === "90d"
                          ? "white"
                          : "var(--text-secondary)",
                      borderColor:
                        selectedPeriod === "90d"
                          ? "var(--brand-primary)"
                          : "var(--border-color)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    Last 3 months
                  </Button>
                  <Button
                    variant={selectedPeriod === "30d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("30d")}
                    style={{
                      height: "2rem",
                      padding: "0 0.75rem",
                      fontSize: "0.75rem",
                      backgroundColor:
                        selectedPeriod === "30d"
                          ? "var(--brand-primary)"
                          : "var(--bg-secondary)",
                      color:
                        selectedPeriod === "30d"
                          ? "white"
                          : "var(--text-secondary)",
                      borderColor:
                        selectedPeriod === "30d"
                          ? "var(--brand-primary)"
                          : "var(--border-color)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant={selectedPeriod === "7d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("7d")}
                    style={{
                      height: "2rem",
                      padding: "0 0.75rem",
                      fontSize: "0.75rem",
                      backgroundColor:
                        selectedPeriod === "7d"
                          ? "var(--brand-primary)"
                          : "var(--bg-secondary)",
                      color:
                        selectedPeriod === "7d"
                          ? "white"
                          : "var(--text-secondary)",
                      borderColor:
                        selectedPeriod === "7d"
                          ? "var(--brand-primary)"
                          : "var(--border-color)",
                      transition: "var(--theme-transition)",
                    }}
                  >
                    Last 7 days
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analyticsData.data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        formatPeriodLabel(value, selectedPeriod)
                      }
                      stroke="#94a3b8"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={getYAxisDomain(
                        analyticsData.data,
                        "activeMembers"
                      )}
                      allowDataOverflow={false}
                      includeHidden={false}
                      tickFormatter={(value) => Math.floor(value).toString()}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="activeMembers"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      name="Active Members"
                      dot={false}
                      activeDot={{
                        r: 5,
                        stroke: "#3b82f6",
                        strokeWidth: 2,
                        fill: "#ffffff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Recurring Revenue Chart */}
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Monthly Recurring Revenue
                  </CardTitle>
                  <CardDescription className="text-sm text-halloween-orange font-medium mt-1">
                    Revenue trends
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedPeriod === "90d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("90d")}
                    className={`h-8 px-3 text-xs ${
                      selectedPeriod === "90d"
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300"
                    }`}
                  >
                    Last 3 months
                  </Button>
                  <Button
                    variant={selectedPeriod === "30d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("30d")}
                    className={`h-8 px-3 text-xs ${
                      selectedPeriod === "30d"
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300"
                    }`}
                  >
                    Last 30 days
                  </Button>
                  <Button
                    variant={selectedPeriod === "7d" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange("7d")}
                    className={`h-8 px-3 text-xs ${
                      selectedPeriod === "7d"
                        ? "bg-gray-900 text-white hover:bg-gray-800"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300"
                    }`}
                  >
                    Last 7 days
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={analyticsData.data}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        formatPeriodLabel(value, selectedPeriod)
                      }
                      stroke="#94a3b8"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={getYAxisDomain(analyticsData.data, "revenue")}
                      allowDataOverflow={false}
                      includeHidden={false}
                      tickFormatter={(value) => `₹${Math.floor(value)}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#ff6b35"
                      strokeWidth={3}
                      name="Revenue"
                      dot={false}
                      activeDot={{
                        r: 5,
                        stroke: "#ff6b35",
                        strokeWidth: 2,
                        fill: "#ffffff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
