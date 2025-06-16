/**
 * Security middleware for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth-helpers';
import { logSecurityEvent, securityHeaders, sanitizeError } from './security';

// ============================================================================
// RATE LIMITING STORE (In-memory for demo - use Redis in production)
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================================================
// MIDDLEWARE FUNCTIONS
// ============================================================================

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: {
  windowMs: number;
  max: number;
  message: string;
}) => {
  return (req: NextRequest): NextResponse | null => {
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    const key = `rate_limit:${ip}:${req.nextUrl.pathname}`;
    const now = Date.now();
    const windowStart = now - options.windowMs;

    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + options.windowMs };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    if (entry.count > options.max) {
      logSecurityEvent({
        type: 'rate_limit',
        ip,
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: `Rate limit exceeded for ${req.nextUrl.pathname}`
      });

      return NextResponse.json(
        { error: options.message },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
            'X-RateLimit-Limit': options.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString()
          }
        }
      );
    }

    return null; // Continue to next middleware
  };
};

/**
 * Authentication middleware
 */
export const requireAuth = async (req: NextRequest): Promise<{
  session: any;
  response?: NextResponse;
}> => {
  const session = await getServerSession();
  
  if (!session?.user?.id) {
    logSecurityEvent({
      type: 'auth_failure',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: `Unauthorized access attempt to ${req.nextUrl.pathname}`
    });

    return {
      session: null,
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    };
  }

  return { session };
};

/**
 * Admin authorization middleware
 */
export const requireAdmin = async (req: NextRequest): Promise<{
  session: any;
  response?: NextResponse;
}> => {
  const { session, response } = await requireAuth(req);
  
  if (response) return { session, response };

  if (session.user.role !== 'admin' && session.user.role !== 'platform_admin') {
    logSecurityEvent({
      type: 'auth_failure',
      userId: session.user.id,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: `Unauthorized admin access attempt to ${req.nextUrl.pathname}`
    });

    return {
      session,
      response: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    };
  }

  return { session };
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: NextRequest): NextResponse | null => {
  // Skip CSRF for GET requests
  if (req.method === 'GET') return null;

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const host = req.headers.get('host');

  // Check if request is from same origin
  const allowedOrigins = [
    `https://${host}`,
    `http://${host}`,
    process.env.NEXTAUTH_URL
  ].filter(Boolean);

  const isValidOrigin = origin && allowedOrigins.includes(origin);
  const isValidReferer = referer && allowedOrigins.some(allowed => 
    referer.startsWith(allowed)
  );

  if (!isValidOrigin && !isValidReferer) {
    logSecurityEvent({
      type: 'suspicious_activity',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: `CSRF attempt detected: origin=${origin}, referer=${referer}`
    });

    return NextResponse.json(
      { error: 'Invalid request origin' },
      { status: 403 }
    );
  }

  return null;
};

/**
 * Security headers middleware
 */
export const addSecurityHeaders = (response: NextResponse): NextResponse => {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

/**
 * Input validation middleware
 */
export const validateContentType = (req: NextRequest): NextResponse | null => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
    const contentType = req.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }
  }

  return null;
};

/**
 * Request size limiting middleware
 */
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: NextRequest): NextResponse | null => {
    const contentLength = req.headers.get('content-length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      logSecurityEvent({
        type: 'suspicious_activity',
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: `Request size limit exceeded: ${contentLength} bytes`
      });

      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      );
    }

    return null;
  };
};

// ============================================================================
// MIDDLEWARE COMPOSER
// ============================================================================

/**
 * Composes multiple middleware functions
 */
export const composeMiddleware = (...middlewares: Array<(req: NextRequest) => NextResponse | Promise<NextResponse> | null>) => {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    for (const middleware of middlewares) {
      const result = await middleware(req);
      if (result) return result;
    }
    return null;
  };
};

/**
 * Error handling wrapper for API routes
 */
export const withErrorHandling = (
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) => {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    try {
      const response = await handler(req, ...args);
      return addSecurityHeaders(response);
    } catch (error) {
      console.error('API Error:', error);
      
      logSecurityEvent({
        type: 'suspicious_activity',
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown',
        details: `API error in ${req.nextUrl.pathname}: ${sanitizeError(error)}`
      });

      const response = NextResponse.json(
        { error: sanitizeError(error) },
        { status: 500 }
      );

      return addSecurityHeaders(response);
    }
  };
};

// ============================================================================
// COMMON MIDDLEWARE COMBINATIONS
// ============================================================================

/**
 * Standard API middleware (rate limiting + CSRF + content type validation)
 */
export const standardApiMiddleware = composeMiddleware(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests, please try again later'
  }),
  csrfProtection,
  validateContentType,
  limitRequestSize()
);

/**
 * Auth API middleware (standard + authentication)
 */
export const authApiMiddleware = async (req: NextRequest) => {
  const standardResult = await standardApiMiddleware(req);
  if (standardResult) return standardResult;

  const { response } = await requireAuth(req);
  return response || null;
};

/**
 * Admin API middleware (auth + admin authorization)
 */
export const adminApiMiddleware = async (req: NextRequest) => {
  const standardResult = await standardApiMiddleware(req);
  if (standardResult) return standardResult;

  const { response } = await requireAdmin(req);
  return response || null;
};
