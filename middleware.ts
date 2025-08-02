import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Use environment variable for secret
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only log in development environment to avoid performance impact and information disclosure
  const isDevelopment = process.env.NODE_ENV === "development";

  // First try to get token using getToken
  let token;
  try {
    token = await getToken({
      req,
      secret: NEXTAUTH_SECRET,
    });
  } catch (error) {
    if (isDevelopment) {
      console.error("Error getting token:", error);
    }
    token = null;
  }

  // If token method fails, check for cookies directly
  if (!token) {
    const allCookies = Array.from(req.cookies.getAll());

    // Check for any auth-related cookie
    const authCookie =
      req.cookies.get("next-auth.session-token") ||
      req.cookies.get("__Secure-next-auth.session-token") ||
      req.cookies.get("__Host-next-auth.session-token");

    // Also check for callback URL cookie which might indicate an ongoing auth flow
    const callbackCookie = req.cookies.get("next-auth.callback-url");

    // Check for CSRF token which might indicate a valid session
    const csrfCookie = req.cookies.get("next-auth.csrf-token");

    if (authCookie) {
      return NextResponse.next();
    }

    if (callbackCookie) {
      // Allow access during auth flow
      return NextResponse.next();
    }

    if (csrfCookie) {
      // If we have a CSRF token, the user might be in an auth flow
      return NextResponse.next();
    }

    // If we have any cookies at all, be more permissive in production
    if (process.env.NODE_ENV === "production" && allCookies.length > 0) {
      return NextResponse.next();
    }
  }

  // Allow all URLs if the user is logged in or if it's a public route
  if (token) {
    return NextResponse.next();
  }

  // Allow specific public routes
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/" ||
    pathname.startsWith("/api/community") ||
    pathname === "/api/community/posts"
  ) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated and not a public route
  return NextResponse.redirect(new URL("/login", req.url));
}
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api/auth (NextAuth API routes)
     * - uploads (uploaded files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/auth|uploads).*)",
  ],
};
