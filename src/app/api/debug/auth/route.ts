import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authoptions";

export async function GET(request: NextRequest) {
  try {
    // Get token using getToken
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET 
    });

    // Get session using getServerSession
    const session = await getServerSession(authOptions);

    // Get cookies
    const cookies = Array.from(request.cookies.getAll()).map(cookie => ({
      name: cookie.name,
      hasValue: !!cookie.value
    }));

    // Check for specific auth cookies
    const sessionCookie = process.env.NODE_ENV === "production"
      ? request.cookies.get("__Secure-next-auth.session-token")
      : request.cookies.get("next-auth.session-token");

    const debugInfo = {
      environment: process.env.NODE_ENV,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      nextAuthUrl: process.env.NEXTAUTH_URL,
      token: {
        exists: !!token,
        userId: token?.sub || null,
        email: token?.email || null
      },
      session: {
        exists: !!session,
        userId: session?.user?.id || null,
        email: session?.user?.email || null
      },
      cookies: {
        all: cookies,
        sessionCookie: {
          exists: !!sessionCookie,
          name: sessionCookie?.name || null
        }
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json({
      error: "Debug failed",
      message: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
