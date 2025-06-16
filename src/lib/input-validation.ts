/**
 * Input validation utilities for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateInput, validationSchemas, sanitizeText, sanitizeHtml, logSecurityEvent } from './security';

// ============================================================================
// REQUEST BODY VALIDATION
// ============================================================================

/**
 * Validates and sanitizes request body
 */
export const validateRequestBody = async <T>(
  request: NextRequest,
  schemaName: keyof typeof validationSchemas
): Promise<{
  isValid: boolean;
  data?: T;
  error?: NextResponse;
}> => {
  try {
    const body = await request.json();
    const schema = validationSchemas[schemaName];
    
    const validation = validateInput<T>(body, schema);
    
    if (!validation.isValid) {
      logSecurityEvent({
        type: 'validation_error',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        details: `Validation failed for ${schemaName}: ${validation.error}`
      });

      return {
        isValid: false,
        error: NextResponse.json(
          { error: 'Invalid input data', details: validation.error },
          { status: 400 }
        )
      };
    }

    return {
      isValid: true,
      data: validation.data
    };
  } catch (error) {
    logSecurityEvent({
      type: 'validation_error',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: `JSON parsing failed: ${error}`
    });

    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      )
    };
  }
};

// ============================================================================
// PARAMETER VALIDATION
// ============================================================================

/**
 * Validates URL parameters
 */
export const validateParams = (
  params: Record<string, string>,
  validations: Record<string, (value: string) => boolean>
): {
  isValid: boolean;
  error?: string;
} => {
  for (const [key, validator] of Object.entries(validations)) {
    const value = params[key];
    
    if (!value || !validator(value)) {
      return {
        isValid: false,
        error: `Invalid parameter: ${key}`
      };
    }
  }

  return { isValid: true };
};

/**
 * Validates MongoDB ObjectId parameter
 */
export const validateObjectIdParam = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validates slug parameter
 */
export const validateSlugParam = (slug: string): boolean => {
  return /^[a-z0-9-]+$/.test(slug) && slug.length >= 3 && slug.length <= 50;
};

// ============================================================================
// CONTENT SANITIZATION
// ============================================================================

/**
 * Sanitizes user message content
 */
export const sanitizeMessageContent = (content: string): string => {
  // Remove potentially dangerous content
  const sanitized = sanitizeText(content);
  
  // Limit length
  if (sanitized.length > 5000) {
    return sanitized.substring(0, 5000);
  }
  
  return sanitized;
};

/**
 * Sanitizes post content array
 */
export const sanitizePostContent = (content: Array<{
  type: string;
  content: string;
}>): Array<{ type: string; content: string }> => {
  return content.map(item => {
    switch (item.type) {
      case 'text':
        return {
          type: item.type,
          content: sanitizeText(item.content)
        };
      case 'html':
        return {
          type: item.type,
          content: sanitizeHtml(item.content)
        };
      case 'link':
        // Validate URL and ensure it's safe
        try {
          const url = new URL(item.content);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return { type: 'text', content: '[Invalid URL]' };
          }
          return {
            type: item.type,
            content: url.toString()
          };
        } catch {
          return { type: 'text', content: '[Invalid URL]' };
        }
      default:
        return {
          type: 'text',
          content: sanitizeText(item.content)
        };
    }
  });
};

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validates file upload parameters
 */
export const validateFileUpload = (fileData: {
  fileName: string;
  fileType: string;
  fileSize?: number;
}): {
  isValid: boolean;
  error?: string;
} => {
  const { fileName, fileType, fileSize } = fileData;

  // Validate file name
  if (!fileName || fileName.length > 255) {
    return { isValid: false, error: 'Invalid file name' };
  }

  // Check for dangerous file extensions
  const dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.php', '.asp', '.aspx', '.jsp', '.sh', '.ps1', '.py', '.rb'
  ];

  const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (dangerousExtensions.includes(fileExtension)) {
    return { isValid: false, error: 'File type not allowed' };
  }

  // Validate MIME type
  const allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/ogg',
    'application/pdf', 'text/plain'
  ];

  if (!allowedMimeTypes.includes(fileType)) {
    return { isValid: false, error: 'File type not supported' };
  }

  // Validate file size
  if (fileSize) {
    const maxSize = fileType.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > maxSize) {
      return { isValid: false, error: 'File size too large' };
    }
  }

  return { isValid: true };
};

// ============================================================================
// QUERY PARAMETER VALIDATION
// ============================================================================

/**
 * Validates and sanitizes query parameters
 */
export const validateQueryParams = (
  url: URL,
  allowedParams: Record<string, (value: string) => boolean>
): Record<string, string> => {
  const validParams: Record<string, string> = {};

  for (const [key, validator] of Object.entries(allowedParams)) {
    const value = url.searchParams.get(key);
    if (value && validator(value)) {
      validParams[key] = sanitizeText(value);
    }
  }

  return validParams;
};

/**
 * Common query parameter validators
 */
export const queryValidators = {
  page: (value: string) => /^\d+$/.test(value) && parseInt(value) > 0 && parseInt(value) <= 1000,
  limit: (value: string) => /^\d+$/.test(value) && parseInt(value) > 0 && parseInt(value) <= 100,
  search: (value: string) => value.length >= 1 && value.length <= 100,
  sort: (value: string) => ['asc', 'desc', 'newest', 'oldest', 'popular'].includes(value),
  filter: (value: string) => /^[a-zA-Z0-9_-]+$/.test(value) && value.length <= 50,
  communityId: validateObjectIdParam,
  userId: validateObjectIdParam,
  slug: validateSlugParam
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates a validation error response
 */
export const createValidationError = (message: string, details?: string): NextResponse => {
  return NextResponse.json(
    { 
      error: message,
      ...(details && { details })
    },
    { status: 400 }
  );
};

/**
 * Validates request method
 */
export const validateMethod = (
  request: NextRequest,
  allowedMethods: string[]
): NextResponse | null => {
  if (!allowedMethods.includes(request.method || '')) {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405, headers: { Allow: allowedMethods.join(', ') } }
    );
  }
  return null;
};

/**
 * Validates content length
 */
export const validateContentLength = (
  request: NextRequest,
  maxLength: number = 10 * 1024 * 1024 // 10MB default
): NextResponse | null => {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxLength) {
    logSecurityEvent({
      type: 'suspicious_activity',
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      details: `Content length exceeded: ${contentLength} bytes`
    });

    return NextResponse.json(
      { error: 'Request too large' },
      { status: 413 }
    );
  }

  return null;
};
