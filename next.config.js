/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly list file extensions for pages
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Specify external packages for server components
  serverExternalPackages: [],
  images: {
    // For Next.js 13+ compatibility
    remotePatterns: [
      // Google authentication profile images
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        port: "",
        pathname: "/**",
      },
      // GitHub avatars
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/**",
      },
      // Cloudinary
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        port: "",
        pathname: "/**",
      },
      // Placeholder images
      {
        protocol: "https",
        hostname: "placehold.co",
        port: "",
        pathname: "/**",
      },
      // Cloudflare R2
      {
        protocol: "https",
        hostname: "*.r2.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pub-thetribelab.r2.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pub-fa626969086b44f788fa6d3ad94f6b2f.r2.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "pub-895f71ea78c843b59c97073ccfe523c5.r2.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        port: "",
        pathname: "/**",
      },
      // AWS S3 bucket
      {
        protocol: "https",
        hostname: "thetribelabbucket.s3.ap-southeast-1.amazonaws.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-southeast-1.amazonaws.com",
        port: "",
        pathname: "/**",
      },
    ],
    // For backward compatibility
    domains: [
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      "res.cloudinary.com",
      "placehold.co",
      // Cloudflare R2 domains
      "r2.dev",
      "r2.cloudflarestorage.com",
      "public.r2.dev",
      "pub-895f71ea78c843b59c97073ccfe523c5.r2.dev",
      "pub-fa626969086b44f788fa6d3ad94f6b2f.r2.dev",
      "pub-thetribelab.r2.dev",
      // AWS S3 domains (for transition period)
      "thetribelabbucket.s3.ap-southeast-1.amazonaws.com",
      "s3.ap-southeast-1.amazonaws.com",
    ],
    deviceSizes: [
      96, 128, 256, 384, 512, 640, 750, 828, 1080, 1200, 1920, 2048,
    ],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/webp"],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://*.razorpay.com; frame-src https://checkout.razorpay.com https://*.razorpay.com; connect-src 'self' https://*.razorpay.com;",
  },
  // Enable strict mode for better development experience
  reactStrictMode: true,
  // Disable x-powered-by header for security
  poweredByHeader: false,
  // Add security headers and controlled CORS
  async headers() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const allowedOrigins = isDevelopment
      ? ['http://localhost:3000', 'https://localhost:3000']
      : ['https://thetribelab.com', 'https://www.thetribelab.com'];

    return [
      {
        source: "/(.*)",
        headers: [
          // Security headers
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // CORS headers (more restrictive)
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "X-Requested-With, Content-Type, Authorization, X-CSRF-Token",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
        ],
      },
      // API routes with stricter CORS
      {
        source: "/api/(.*)",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: isDevelopment ? "http://localhost:3000" : "https://thetribelab.com",
          },
          {
            key: "Access-Control-Allow-Credentials",
            value: "true",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
