/**
 * Example of a secure API route implementation
 * This demonstrates best practices for API security
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  withErrorHandling, 
  authApiMiddleware,
  rateLimit 
} from '@/lib/api-security-middleware';
import { 
  validateRequestBody, 
  validateMethod,
  validateContentLength,
  validateQueryParams,
  queryValidators
} from '@/lib/input-validation';
import { dbconnect } from '@/lib/db';
import { User } from '@/models/User';
import { logSecurityEvent } from '@/lib/security';

// ============================================================================
// GET - Secure data retrieval with validation
// ============================================================================

export const GET = withErrorHandling(async (request: NextRequest) => {
  // 1. Method validation
  const methodError = validateMethod(request, ['GET']);
  if (methodError) return methodError;

  // 2. Rate limiting
  const rateLimitError = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: 'Too many requests, please try again later'
  })(request);
  if (rateLimitError) return rateLimitError;

  // 3. Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // 4. Query parameter validation
  const validParams = validateQueryParams(request.nextUrl, {
    page: queryValidators.page,
    limit: queryValidators.limit,
    search: queryValidators.search,
    sort: queryValidators.sort
  });

  // 5. Database connection
  await dbconnect();

  // 6. Secure data retrieval
  const page = parseInt(validParams.page || '1');
  const limit = Math.min(parseInt(validParams.limit || '10'), 50); // Cap at 50
  const skip = (page - 1) * limit;

  // Build secure query
  const query: any = {};
  if (validParams.search) {
    // Use regex with proper escaping to prevent ReDoS attacks
    const escapedSearch = validParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { username: { $regex: escapedSearch, $options: 'i' } },
      { name: { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  // Execute query with projection to exclude sensitive fields
  const users = await User.find(query)
    .select('username name profileImage createdAt -_id') // Exclude sensitive fields
    .limit(limit)
    .skip(skip)
    .sort({ createdAt: validParams.sort === 'oldest' ? 1 : -1 })
    .lean(); // Use lean() for better performance

  const total = await User.countDocuments(query);

  return NextResponse.json({
    users,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// ============================================================================
// POST - Secure data creation with validation
// ============================================================================

export const POST = withErrorHandling(async (request: NextRequest) => {
  // 1. Method validation
  const methodError = validateMethod(request, ['POST']);
  if (methodError) return methodError;

  // 2. Content length validation
  const lengthError = validateContentLength(request, 1024 * 1024); // 1MB limit
  if (lengthError) return lengthError;

  // 3. Rate limiting (stricter for POST)
  const rateLimitError = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per window
    message: 'Too many creation requests, please try again later'
  })(request);
  if (rateLimitError) return rateLimitError;

  // 4. Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // 5. Input validation and sanitization
  const validation = await validateRequestBody<{
    username: string;
    email: string;
    bio?: string;
  }>(request, 'userProfile');

  if (!validation.isValid) {
    return validation.error!;
  }

  const { username, email, bio } = validation.data!;

  // 6. Additional business logic validation
  await dbconnect();

  // Check for duplicate username/email
  const existingUser = await User.findOne({
    $or: [
      { username: username },
      { email: email }
    ]
  });

  if (existingUser) {
    logSecurityEvent({
      type: 'validation_error',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: `Duplicate user creation attempt: ${username}, ${email}`
    });

    return NextResponse.json(
      { error: 'Username or email already exists' },
      { status: 409 }
    );
  }

  // 7. Create user with sanitized data
  const newUser = await User.create({
    username,
    email,
    bio: bio || '',
    createdAt: new Date(),
    emailVerified: false,
    role: 'user'
  });

  // 8. Return safe response (exclude sensitive fields)
  const safeUser = {
    id: newUser._id,
    username: newUser.username,
    email: newUser.email,
    bio: newUser.bio,
    createdAt: newUser.createdAt
  };

  return NextResponse.json(
    { user: safeUser, message: 'User created successfully' },
    { status: 201 }
  );
});

// ============================================================================
// PUT - Secure data update with validation
// ============================================================================

export const PUT = withErrorHandling(async (request: NextRequest) => {
  // 1. Method validation
  const methodError = validateMethod(request, ['PUT']);
  if (methodError) return methodError;

  // 2. Content length validation
  const lengthError = validateContentLength(request, 1024 * 1024); // 1MB limit
  if (lengthError) return lengthError;

  // 3. Rate limiting
  const rateLimitError = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: 'Too many update requests, please try again later'
  })(request);
  if (rateLimitError) return rateLimitError;

  // 4. Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // 5. Input validation
  const validation = await validateRequestBody<{
    bio?: string;
    timezone?: string;
  }>(request, 'userProfile');

  if (!validation.isValid) {
    return validation.error!;
  }

  const updateData = validation.data!;

  // 6. Database update with proper error handling
  await dbconnect();

  // Get user ID from session (assuming it's available from auth middleware)
  const session = await import('@/lib/auth-helpers').then(m => m.getServerSession());
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID not found in session' },
      { status: 400 }
    );
  }

  // Update user with only allowed fields
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { 
      $set: {
        ...updateData,
        updatedAt: new Date()
      }
    },
    { 
      new: true,
      runValidators: true,
      select: 'username email bio timezone updatedAt -_id' // Exclude sensitive fields
    }
  );

  if (!updatedUser) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    user: updatedUser,
    message: 'User updated successfully'
  });
});

// ============================================================================
// DELETE - Secure data deletion with validation
// ============================================================================

export const DELETE = withErrorHandling(async (request: NextRequest) => {
  // 1. Method validation
  const methodError = validateMethod(request, ['DELETE']);
  if (methodError) return methodError;

  // 2. Rate limiting (very strict for DELETE)
  const rateLimitError = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: 'Too many deletion requests, please try again later'
  })(request);
  if (rateLimitError) return rateLimitError;

  // 3. Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // 4. Additional authorization check for deletion
  const session = await import('@/lib/auth-helpers').then(m => m.getServerSession());
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json(
      { error: 'User ID not found in session' },
      { status: 400 }
    );
  }

  // 5. Soft delete (recommended over hard delete)
  await dbconnect();

  const result = await User.findByIdAndUpdate(
    userId,
    { 
      $set: {
        deletedAt: new Date(),
        isActive: false
      }
    },
    { new: true }
  );

  if (!result) {
    return NextResponse.json(
      { error: 'User not found' },
      { status: 404 }
    );
  }

  // Log the deletion for audit purposes
  logSecurityEvent({
    type: 'suspicious_activity',
    userId,
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
    details: 'User account deleted'
  });

  return NextResponse.json({
    message: 'User deleted successfully'
  });
});
