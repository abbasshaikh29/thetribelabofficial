/**
 * Security utilities for input validation, sanitization, and protection
 */

import DOMPurify from 'dompurify';
import Joi from 'joi';

// ============================================================================
// INPUT VALIDATION SCHEMAS
// ============================================================================

export const validationSchemas = {
  // User input validation
  userMessage: Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    isImage: Joi.boolean().default(false)
  }),

  // Post content validation
  postContent: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    content: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('text', 'image', 'link', 'file').required(),
        content: Joi.string().min(1).max(10000).required()
      })
    ).max(50).required()
  }),

  // User profile validation
  userProfile: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    bio: Joi.string().max(500).allow(''),
    firstName: Joi.string().max(50).allow(''),
    lastName: Joi.string().max(50).allow('')
  }),

  // File upload validation
  fileUpload: Joi.object({
    fileName: Joi.string().min(1).max(255).required(),
    fileType: Joi.string().valid(
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm', 'video/ogg',
      'application/pdf', 'text/plain'
    ).required(),
    fileSize: Joi.number().max(100 * 1024 * 1024) // 100MB max
  }),

  // MongoDB ObjectId validation
  objectId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).required(),

  // URL validation
  url: Joi.string().uri().required(),

  // Password validation
  password: Joi.string().min(8).max(128).pattern(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
  ).required().messages({
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  })
};

// ============================================================================
// HTML SANITIZATION
// ============================================================================

/**
 * Sanitizes HTML content to prevent XSS attacks
 */
export const sanitizeHtml = (html: string): string => {
  if (typeof window === 'undefined') {
    // Server-side: Use a more restrictive approach
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  // Client-side: Use DOMPurify
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'code', 'pre'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    FORBID_SCRIPT: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'iframe'],
    FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick']
  });
};

/**
 * Sanitizes plain text content
 */
export const sanitizeText = (text: string): string => {
  return text
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
};

// ============================================================================
// INPUT VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates input against a Joi schema
 */
export const validateInput = <T>(data: unknown, schema: Joi.Schema): {
  isValid: boolean;
  data?: T;
  error?: string;
} => {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true 
  });

  if (error) {
    return {
      isValid: false,
      error: error.details.map(detail => detail.message).join(', ')
    };
  }

  return {
    isValid: true,
    data: value as T
  };
};

/**
 * Validates MongoDB ObjectId format
 */
export const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Validates email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates URL format and checks for malicious protocols
 */
export const isValidUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const allowedProtocols = ['http:', 'https:'];
    return allowedProtocols.includes(urlObj.protocol);
  } catch {
    return false;
  }
};

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Rate limiting configuration for different endpoints
 */
export const rateLimitConfig = {
  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later'
  },

  // API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many API requests, please try again later'
  },

  // File upload endpoints
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 uploads per hour
    message: 'Too many file uploads, please try again later'
  },

  // Password reset
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: 'Too many password reset attempts, please try again later'
  }
};

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Security headers configuration
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.razorpay.com wss: ws:",
    "frame-src https://checkout.razorpay.com https://*.razorpay.com",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; ')
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Sanitizes error messages to prevent information disclosure
 */
export const sanitizeError = (error: unknown): string => {
  if (process.env.NODE_ENV === 'production') {
    // In production, return generic error messages
    return 'An error occurred while processing your request';
  }

  // In development, return more detailed errors
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error occurred';
};

/**
 * Logs security events for monitoring
 */
export const logSecurityEvent = (event: {
  type: 'auth_failure' | 'validation_error' | 'rate_limit' | 'suspicious_activity';
  userId?: string;
  ip?: string;
  userAgent?: string;
  details?: string;
}): void => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    ...event
  };

  // In production, this should be sent to a security monitoring service
  console.warn('[SECURITY EVENT]', JSON.stringify(logEntry));
};
