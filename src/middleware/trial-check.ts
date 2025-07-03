import { NextRequest, NextResponse } from "next/server";

// Secure function to get base URL for internal API calls
function getSecureInternalBaseUrl(req: NextRequest): string {
  // Define allowed origins for internal API calls
  const ALLOWED_ORIGINS = [
    "https://yourdomain.com", // Replace with your actual domain
    "https://www.yourdomain.com", // Replace with your actual domain
    "http://localhost:3000", // For development
    "http://localhost:3001", // For development
  ];

  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  // First try to use the origin header if it's in our allowlist
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }

  // If no valid origin, construct from host header with validation
  if (host) {
    const protocol = host.includes("localhost") ? "http://" : "https://";
    const fullUrl = `${protocol}${host}`;

    if (ALLOWED_ORIGINS.includes(fullUrl)) {
      return fullUrl;
    }
  }

  // Fallback to a safe default (your production domain)
  return "https://yourdomain.com"; // Replace with your actual domain
}

// This function checks trial status via an API call instead of directly using mongoose
// This avoids Edge Runtime limitations with mongoose
export async function checkTrialStatus(
  req: NextRequest,
  userId: string,
  communitySlug: string
) {
  try {
    const baseUrl = getSecureInternalBaseUrl(req);
    // Call our API endpoint to check trial status instead of using mongoose directly
    const response = await fetch(
      `${baseUrl}/api/community/${communitySlug}/check-trial-status?userId=${userId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error("Error checking trial status via API:", response.status);
      // If API fails, allow access (fail open)
      return true;
    }

    const data = await response.json();
    return data.hasActiveTrialOrPayment;
  } catch (error) {
    console.error("Error checking trial status:", error);
    // In case of error, allow access (fail open)
    return true;
  }
}
