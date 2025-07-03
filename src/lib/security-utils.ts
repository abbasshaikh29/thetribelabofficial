/**
 * Centralized Security Utilities for TheTribeLab
 * 
 * This module provides comprehensive security functions to prevent XSS, injection attacks,
 * and other security vulnerabilities across the application.
 */

/**
 * Sanitizes image URLs to prevent XSS attacks
 * This function validates image URLs and blocks dangerous protocols
 */
export function sanitizeImageUrl(url?: string | null): string {
  if (!url || typeof url !== "string") {
    return "/default-avatar.png";
  }

  // Remove any leading/trailing whitespace
  const cleanUrl = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ["javascript:", "data:", "vbscript:", "file:", "about:"];
  const lowerCaseUrl = cleanUrl.toLowerCase();

  if (dangerousProtocols.some((protocol) => lowerCaseUrl.startsWith(protocol))) {
    console.warn(`Blocked dangerous image URL protocol: ${url}`);
    return "/default-avatar.png";
  }

  // Only allow http, https, or relative URLs
  if (
    cleanUrl.startsWith("http://") ||
    cleanUrl.startsWith("https://") ||
    cleanUrl.startsWith("/")
  ) {
    try {
      // For absolute URLs, validate them further
      if (cleanUrl.startsWith("http")) {
        const urlObj = new URL(cleanUrl);
        if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
          return cleanUrl;
        }
      } else {
        // For relative URLs, ensure they don't contain dangerous patterns
        if (
          !lowerCaseUrl.includes("javascript:") &&
          !lowerCaseUrl.includes("vbscript:") &&
          !lowerCaseUrl.includes("data:")
        ) {
          return cleanUrl;
        }
      }
    } catch (e) {
      // Invalid URL format
      console.warn(`Invalid image URL format: ${url}`);
      return "/default-avatar.png";
    }
  }

  // Fallback to a safe default
  console.warn(`Blocked unsafe image URL: ${url}`);
  return "/default-avatar.png";
}

/**
 * Sanitizes general URLs for href attributes to prevent XSS attacks
 * This function validates URL format and blocks dangerous protocols
 */
export function sanitizeUrl(url?: string | null): string {
  if (!url || typeof url !== "string") {
    return "#";
  }

  // Trim whitespace
  const cleanUrl = url.trim();

  // If empty after trimming, return safe fallback
  if (!cleanUrl) {
    return "#";
  }

  try {
    // Try to parse as URL to validate format
    const parsedUrl = new URL(cleanUrl);

    // Define allowed protocols
    const allowedProtocols = [
      "http:",
      "https:",
      "mailto:",
      "tel:",
      "ftp:",
      "ftps:",
    ];

    // Check if protocol is allowed
    if (!allowedProtocols.includes(parsedUrl.protocol.toLowerCase())) {
      console.warn(`Blocked dangerous URL protocol: ${parsedUrl.protocol}`);
      return "#";
    }

    // Additional checks for specific protocols
    if (parsedUrl.protocol === "mailto:") {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parsedUrl.pathname)) {
        console.warn(`Invalid email format: ${parsedUrl.pathname}`);
        return "#";
      }
    }

    // Return the original URL if it passes all checks
    return cleanUrl;
  } catch (error) {
    // If URL parsing fails, check for relative URLs
    if (
      cleanUrl.startsWith("/") ||
      cleanUrl.startsWith("./") ||
      cleanUrl.startsWith("../")
    ) {
      // Allow relative URLs but ensure they don't contain dangerous patterns
      if (
        cleanUrl.includes("javascript:") ||
        cleanUrl.includes("vbscript:") ||
        cleanUrl.includes("data:")
      ) {
        console.warn(`Blocked dangerous relative URL: ${cleanUrl}`);
        return "#";
      }
      return cleanUrl;
    }

    // If it's not a valid URL and not a relative path, block it
    console.warn(`Invalid URL format: ${cleanUrl}`);
    return "#";
  }
}

/**
 * Sanitizes community slugs to prevent injection attacks
 * This function removes dangerous characters and validates slug format
 */
export function sanitizeSlug(slug?: string | null): string {
  // Input validation
  if (!slug || typeof slug !== "string") {
    return "invalid-slug";
  }

  // Remove any dangerous characters and patterns
  const cleanSlug = slug.replace(/[^a-zA-Z0-9\-_]/g, "");

  // Block dangerous protocol patterns
  const dangerousPatterns = ["javascript", "data", "vbscript", "file", "about"];
  const lowerSlug = cleanSlug.toLowerCase();

  if (dangerousPatterns.some((pattern) => lowerSlug.startsWith(pattern))) {
    console.warn(`Blocked dangerous slug pattern: ${slug}`);
    return "invalid-slug";
  }

  // Ensure minimum length and return safe slug
  return cleanSlug.length > 0 ? cleanSlug : "invalid-slug";
}

/**
 * Sanitizes text input to prevent XSS attacks
 * This function removes or escapes dangerous HTML and JavaScript
 */
export function sanitizeText(text?: string | null): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove script tags and their content
  let sanitized = text.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );

  // Remove dangerous HTML tags
  const dangerousTags = [
    "script",
    "object",
    "embed",
    "form",
    "input",
    "iframe",
    "link",
    "style",
    "meta",
  ];

  dangerousTags.forEach((tag) => {
    const regex = new RegExp(
      `<${tag}\\b[^<]*(?:(?!<\/${tag}>)<[^<]*)*<\/${tag}>`,
      "gi"
    );
    sanitized = sanitized.replace(regex, "");
    // Also remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    sanitized = sanitized.replace(selfClosingRegex, "");
  });

  // Remove javascript: and vbscript: protocols
  sanitized = sanitized.replace(/javascript:/gi, "");
  sanitized = sanitized.replace(/vbscript:/gi, "");

  // Remove on* event handlers
  sanitized = sanitized.replace(
    /\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi,
    ""
  );

  return sanitized;
}

/**
 * Validates and sanitizes email addresses
 */
export function sanitizeEmail(email?: string | null): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(cleanEmail)) {
    return "";
  }

  // Additional security: block potentially dangerous email patterns
  const dangerousPatterns = ["javascript:", "data:", "vbscript:"];
  if (dangerousPatterns.some((pattern) => cleanEmail.includes(pattern))) {
    console.warn(`Blocked dangerous email pattern: ${email}`);
    return "";
  }

  return cleanEmail;
}

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "'unsafe-inline'", // Required for some components, consider removing in future
    "https://checkout.razorpay.com",
    "https://*.razorpay.com",
  ],
  "style-src": ["'self'", "'unsafe-inline'"], // Required for styled components
  "img-src": ["'self'", "data:", "https:", "blob:"],
  "font-src": ["'self'", "data:"],
  "connect-src": [
    "'self'",
    "https://*.razorpay.com",
    "wss:",
    "ws:",
  ],
  "frame-src": [
    "https://checkout.razorpay.com",
    "https://*.razorpay.com",
  ],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
};

/**
 * Generates CSP header value from directives
 */
export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}
