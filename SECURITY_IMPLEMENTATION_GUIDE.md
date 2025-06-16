# Security Implementation Guide

## Quick Start

### 1. Install Security Dependencies

```bash
npm install dompurify joi helmet express-rate-limit
```

### 2. Import Security Utilities

```typescript
// In your API routes
import { 
  withErrorHandling, 
  authApiMiddleware,
  rateLimit 
} from '@/lib/api-security-middleware';

import { 
  validateRequestBody, 
  sanitizeText,
  validateObjectIdParam
} from '@/lib/input-validation';

import { sanitizeHtml } from '@/lib/security';
```

### 3. Secure API Route Template

```typescript
// src/app/api/your-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling, authApiMiddleware } from '@/lib/api-security-middleware';
import { validateRequestBody } from '@/lib/input-validation';

export const POST = withErrorHandling(async (request: NextRequest) => {
  // 1. Authentication check
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // 2. Input validation
  const validation = await validateRequestBody(request, 'userMessage');
  if (!validation.isValid) return validation.error!;

  // 3. Your business logic here
  const { content } = validation.data!;
  
  // 4. Return secure response
  return NextResponse.json({ success: true });
});
```

## Security Checklist

### ✅ Authentication & Authorization
- [ ] Use `authApiMiddleware` for protected routes
- [ ] Validate user permissions for sensitive operations
- [ ] Implement proper session management
- [ ] Use secure cookie settings

### ✅ Input Validation
- [ ] Validate all user inputs with Joi schemas
- [ ] Sanitize text content with `sanitizeText()`
- [ ] Sanitize HTML content with `sanitizeHtml()`
- [ ] Validate MongoDB ObjectIds with `validateObjectIdParam()`

### ✅ XSS Prevention
- [ ] Never use `dangerouslySetInnerHTML` without sanitization
- [ ] Use DOMPurify for HTML sanitization
- [ ] Escape user content in templates
- [ ] Validate and sanitize all dynamic content

### ✅ CSRF Protection
- [ ] Implement origin validation
- [ ] Use SameSite cookie attributes
- [ ] Validate referer headers for state-changing operations

### ✅ Rate Limiting
- [ ] Apply rate limiting to all API endpoints
- [ ] Use stricter limits for sensitive operations
- [ ] Implement different limits for different user types

### ✅ File Upload Security
- [ ] Validate file types and extensions
- [ ] Limit file sizes appropriately
- [ ] Scan uploaded files for malware
- [ ] Store files in secure locations

### ✅ Error Handling
- [ ] Use `withErrorHandling` wrapper for all API routes
- [ ] Sanitize error messages in production
- [ ] Log security events for monitoring
- [ ] Never expose sensitive information in errors

## Common Security Patterns

### 1. Secure Message Creation

```typescript
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // Input validation
  const validation = await validateRequestBody<{
    content: string;
    recipientId: string;
  }>(request, 'userMessage');
  
  if (!validation.isValid) return validation.error!;

  // Parameter validation
  if (!validateObjectIdParam(validation.data!.recipientId)) {
    return NextResponse.json(
      { error: 'Invalid recipient ID' },
      { status: 400 }
    );
  }

  // Content sanitization
  const sanitizedContent = sanitizeText(validation.data!.content);
  
  // Business logic
  await createMessage({
    content: sanitizedContent,
    recipientId: validation.data!.recipientId
  });

  return NextResponse.json({ success: true });
});
```

### 2. Secure File Upload

```typescript
export const POST = withErrorHandling(async (request: NextRequest) => {
  // Authentication
  const authResult = await authApiMiddleware(request);
  if (authResult) return authResult;

  // File validation
  const validation = await validateRequestBody<{
    fileName: string;
    fileType: string;
    fileSize: number;
  }>(request, 'fileUpload');
  
  if (!validation.isValid) return validation.error!;

  const { fileName, fileType, fileSize } = validation.data!;

  // Additional file security checks
  const fileValidation = validateFileUpload({ fileName, fileType, fileSize });
  if (!fileValidation.isValid) {
    return NextResponse.json(
      { error: fileValidation.error },
      { status: 400 }
    );
  }

  // Generate secure upload URL
  const uploadUrl = await generateSecureUploadUrl(fileName, fileType);
  
  return NextResponse.json({ uploadUrl });
});
```

### 3. Secure Content Display

```tsx
// For HTML content
function SecureContentDisplay({ htmlContent }: { htmlContent: string }) {
  const sanitizedHtml = sanitizeHtml(htmlContent);
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      className="prose"
    />
  );
}

// For text content with links
function SecureTextDisplay({ textContent }: { textContent: string }) {
  const sanitizedText = sanitizeText(textContent);
  
  return (
    <p>
      {sanitizedText.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a 
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
  );
}
```

## Environment Security

### Development Environment
```bash
# .env.development
NEXTAUTH_SECRET=your-dev-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
```

### Production Environment
```bash
# .env.production
NEXTAUTH_SECRET=your-production-secret-min-32-chars
NEXTAUTH_URL=https://yourdomain.com
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
```

## Security Headers Configuration

```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  }
];
```

## Testing Security

### Run Security Tests
```bash
# Install test dependencies
npm install --save-dev node-fetch

# Run security tests
node scripts/security-tests.js
```

### Manual Testing Checklist
- [ ] Test XSS payloads in all input fields
- [ ] Test CSRF with cross-origin requests
- [ ] Test rate limiting with rapid requests
- [ ] Test file upload with malicious files
- [ ] Test authentication bypass attempts
- [ ] Test SQL injection in all parameters

## Monitoring & Alerting

### Security Event Logging
```typescript
import { logSecurityEvent } from '@/lib/security';

// Log suspicious activity
logSecurityEvent({
  type: 'suspicious_activity',
  userId: session?.user?.id,
  ip: request.headers.get('x-forwarded-for') || 'unknown',
  userAgent: request.headers.get('user-agent') || 'unknown',
  details: 'Multiple failed login attempts'
});
```

### Production Monitoring
- Set up alerts for security events
- Monitor rate limiting triggers
- Track authentication failures
- Monitor file upload patterns
- Set up intrusion detection

## Common Vulnerabilities to Avoid

### ❌ Don't Do This
```typescript
// Vulnerable to XSS
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// Vulnerable to injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// Vulnerable to CSRF
// No origin validation on state-changing operations

// Information disclosure
catch (error) {
  return NextResponse.json({ error: error.message });
}
```

### ✅ Do This Instead
```typescript
// Safe HTML rendering
<div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />

// Safe database queries
const user = await User.findById(userId);

// CSRF protection
const origin = request.headers.get('origin');
if (!allowedOrigins.includes(origin)) {
  return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
}

// Safe error handling
catch (error) {
  console.error('Error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Joi Validation](https://joi.dev/api/)

## Support

For security questions or to report vulnerabilities:
1. Check the security utilities in `src/lib/security.ts`
2. Review the example secure API route in `src/app/api/secure-example/route.ts`
3. Run the security test suite with `node scripts/security-tests.js`
4. Refer to the detailed audit report in `SECURITY_AUDIT_REPORT.md`
