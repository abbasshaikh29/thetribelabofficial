import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkTrialStatus } from "./middleware/trial-check";
import { checkCommunityAccess, createSuspendedCommunityResponse } from "./middleware/community-access-check";

// This middleware runs in the Edge Runtime and doesn't use any Node.js features

// This function can be marked `async` if using `await` inside
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  const isAuthenticated = !!token;

  // Protected routes that require authentication
  const protectedPaths = [
    "/profile",
    "/UserSettings",
    "/communityform",
    "/Newcompage",
  ];

  const path = request.nextUrl.pathname;

  // New check for /admin routes
  if (path.startsWith("/admin")) {
    if (!isAuthenticated) {
      // Not logged in, redirect to login
      return NextResponse.redirect(new URL("/login", request.url));
    }
    // Logged in, check role
    if (token.role !== "platform_admin") {
      // Not a platform admin, redirect to homepage
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Allowed, continue
    return NextResponse.next();
  }

  // Check if the path is protected and user is not authenticated
  const isProtectedPath = protectedPaths.some(
    (protectedPath) =>
      path === protectedPath || path.startsWith(`${protectedPath}/`)
  );

  if (isProtectedPath && !isAuthenticated) {
    // Redirect to login page if trying to access protected route without authentication
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(redirectUrl);
  }

  // If user is already logged in and tries to access login/register pages
  if (isAuthenticated && (path === "/login" || path === "/register")) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  
  // Check for community access paths that require trial activation
  // Example: /Newcompage/communityslug/...
  const communityPathMatch = path.match(/\/Newcompage\/([^\/]+)/);
  
  if (communityPathMatch && isAuthenticated) {
    const communitySlug = communityPathMatch[1];
    
    // Skip billing pages - these should always be accessible
    if (path.includes('/billing/') || path.includes('/communitysetting/1-Billing')) {
      return NextResponse.next();
    }
    
    try {
      // Reuse previously obtained token
      if (!token || !token.sub) {
        return NextResponse.next();
      }

      // First check if community is suspended or accessible
      const accessCheck = await checkCommunityAccess(request, communitySlug);

      if (!accessCheck.allowed) {
        if (accessCheck.reason?.includes('suspended')) {
          // Return suspended community page
          return createSuspendedCommunityResponse(request, communitySlug, accessCheck.reason);
        } else if (accessCheck.redirectUrl) {
          // Redirect to billing page
          console.log(`Redirecting user ${token.sub} to ${accessCheck.redirectUrl} - ${accessCheck.reason}`);
          return NextResponse.redirect(new URL(accessCheck.redirectUrl, request.url));
        }
      }

      // Legacy check for backward compatibility
      const hasActiveTrialOrPayment = await checkTrialStatus(request, token.sub, communitySlug);

      if (!hasActiveTrialOrPayment) {
        // Redirect to billing page if no active trial or payment
        console.log(`Redirecting user ${token.sub} to billing page for community ${communitySlug} - no active trial`);
        return NextResponse.redirect(new URL(`/billing/${communitySlug}`, request.url));
      }
    } catch (error) {
      console.error('Error in community access middleware:', error);
      // In case of error, allow access (fail open)
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    "/profile/:path*",
    "/UserSettings/:path*",
    "/communityform/:path*",
    "/Newcompage/:path*",
    "/login",
    "/register",
    "/admin/:path*",
  ],
};
