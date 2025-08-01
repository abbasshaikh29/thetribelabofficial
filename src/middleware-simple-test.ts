import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Skip middleware for API routes, static files, and auth routes
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/favicon.ico') ||
    path.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // Protected routes that require authentication
  const protectedPaths = [
    "/profile",
    "/UserSettings", 
    "/communityform",
    "/Newcompage",
  ];

  // Check if current path is protected
  const isProtectedPath = protectedPaths.some(
    (protectedPath) =>
      path === protectedPath || path.startsWith(`${protectedPath}/`)
  );

  // If not a protected path, allow access
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  // For protected paths, check authentication
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    // Check for session cookies as fallback
    const sessionCookie = process.env.NODE_ENV === "production"
      ? request.cookies.get("__Secure-next-auth.session-token")
      : request.cookies.get("next-auth.session-token");

    const isAuthenticated = !!(token || sessionCookie);

    console.log("Auth check:", {
      path,
      hasToken: !!token,
      hasSessionCookie: !!sessionCookie,
      isAuthenticated,
      environment: process.env.NODE_ENV
    });

    if (!isAuthenticated) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("callbackUrl", encodeURI(request.url));
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    // In case of error, redirect to login for protected routes
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("callbackUrl", encodeURI(request.url));
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/UserSettings/:path*", 
    "/communityform/:path*",
    "/Newcompage/:path*",
  ],
};
