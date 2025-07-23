"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface CommunityStatusDebugProps {
  slug: string;
}

interface DebugData {
  statusEndpoint?: any;
  communityEndpoint?: any;
  timestamp: string;
}

export default function CommunityStatusDebug({
  slug,
}: CommunityStatusDebugProps) {
  const { data: session } = useSession();
  const [debugData, setDebugData] = useState<DebugData>({
    timestamp: new Date().toISOString(),
  });
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchDebugData = async () => {
    if (!slug || !session?.user?.id) return;

    setLoading(true);
    try {
      // Fetch from status endpoint
      const statusResponse = await fetch(`/api/community/${slug}/status`);
      const statusData = await statusResponse.json();

      // Fetch from community endpoint
      const communityResponse = await fetch(`/api/community/${slug}`);
      const communityData = await communityResponse.json();

      setDebugData({
        statusEndpoint: statusData,
        communityEndpoint: communityData,
        timestamp: new Date().toISOString(),
      });

      // Also log to console for easy copying
      console.log("🐛 Community Status Debug Data:", {
        slug,
        userId: session.user.id,
        statusEndpoint: statusData,
        communityEndpoint: communityData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Debug fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      fetchDebugData();
    }
  }, [isVisible, slug, session?.user?.id]);

  // Only show in development or if user is admin
  if (
    process.env.NODE_ENV === "production" &&
    !session?.user?.email?.includes("admin")
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="bg-red-500 text-white px-3 py-2 rounded-lg text-sm font-mono hover:bg-red-600 transition-colors"
      >
        🐛 Debug
      </button>

      {isVisible && (
        <div className="absolute bottom-12 right-0 w-96 max-h-96 bg-black text-green-400 p-4 rounded-lg shadow-lg overflow-auto font-mono text-xs">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-white font-bold">Community Status Debug</h3>
            <div className="flex gap-2">
              <button
                onClick={fetchDebugData}
                disabled={loading}
                className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "..." : "🔄"}
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="bg-gray-600 text-white px-2 py-1 rounded text-xs hover:bg-gray-700"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-yellow-400 font-bold">Basic Info:</div>
              <div>Slug: {slug}</div>
              <div>User ID: {session?.user?.id}</div>
              <div>Timestamp: {debugData.timestamp}</div>
            </div>

            {debugData.statusEndpoint && (
              <div>
                <div className="text-yellow-400 font-bold">
                  Status Endpoint (/api/community/{slug}/status):
                </div>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  <div className="text-cyan-400">
                    hasActiveSubscription:{" "}
                    {String(debugData.statusEndpoint.hasActiveSubscription)}
                  </div>
                  <div className="text-cyan-400">
                    hasActiveTrial:{" "}
                    {String(debugData.statusEndpoint.hasActiveTrial)}
                  </div>
                  <div className="text-cyan-400">
                    hasPendingSubscription:{" "}
                    {String(debugData.statusEndpoint.hasPendingSubscription)}
                  </div>
                  <div className="text-cyan-400">
                    daysRemaining: {debugData.statusEndpoint.daysRemaining}
                  </div>
                  <div className="text-cyan-400">
                    paymentStatus: {debugData.statusEndpoint.paymentStatus}
                  </div>
                  <div className="text-cyan-400">
                    hasActiveTrialOrPayment:{" "}
                    {String(debugData.statusEndpoint.hasActiveTrialOrPayment)}
                  </div>

                  {debugData.statusEndpoint.community && (
                    <div className="mt-2">
                      <div className="text-purple-400">Community Data:</div>
                      <div className="ml-2">
                        <div>
                          paymentStatus:{" "}
                          {debugData.statusEndpoint.community.paymentStatus}
                        </div>
                        <div>
                          subscriptionId:{" "}
                          {debugData.statusEndpoint.community.subscriptionId}
                        </div>
                        <div>
                          subscriptionStatus:{" "}
                          {
                            debugData.statusEndpoint.community
                              .subscriptionStatus
                          }
                        </div>
                        <div>
                          subscriptionEndDate:{" "}
                          {
                            debugData.statusEndpoint.community
                              .subscriptionEndDate
                          }
                        </div>
                        <div>
                          freeTrialActivated:{" "}
                          {String(
                            debugData.statusEndpoint.community
                              .freeTrialActivated
                          )}
                        </div>
                        {/* Legacy trial system only - no adminTrialInfo needed */}
                      </div>
                    </div>
                  )}

                  {debugData.statusEndpoint.debug && (
                    <div className="mt-2">
                      <div className="text-red-400">Debug Info:</div>
                      <pre className="text-xs overflow-x-auto">
                        {JSON.stringify(
                          debugData.statusEndpoint.debug,
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {debugData.communityEndpoint && (
              <div>
                <div className="text-yellow-400 font-bold">
                  Community Endpoint (/api/community/{slug}):
                </div>
                <div className="bg-gray-900 p-2 rounded mt-1">
                  <div>
                    paymentStatus: {debugData.communityEndpoint.paymentStatus}
                  </div>
                  <div>
                    subscriptionEndDate:{" "}
                    {debugData.communityEndpoint.subscriptionEndDate}
                  </div>
                  <div>
                    freeTrialActivated:{" "}
                    {String(debugData.communityEndpoint.freeTrialActivated)}
                  </div>
                  {/* Legacy trial system only - no adminTrialInfo needed */}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
