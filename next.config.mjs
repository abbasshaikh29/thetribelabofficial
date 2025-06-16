/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* config options here */
  // Memory optimization settings
  experimental: {
    // Reduce memory usage during development
    turbo: {
      memoryLimit: 6144, // 6GB limit for Turbopack
    },
    // Enable webpack memory optimization
    webpackMemoryOptimizations: true,
  },
  // Webpack configuration for memory optimization
  webpack: (config, { dev, isServer }) => {
    // Memory optimization for development
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ['**/node_modules', '**/.next'],
      };
    }

    // Optimize memory usage
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
        },
      },
    };

    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        port: "",
      },
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
      {
        protocol: "https",
        hostname: "*.s3.amazonaws.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com", // Changed to wildcard
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
        hostname: "*.r2.cloudflarestorage.com",
        port: "",
        pathname: "/**",
      },
    ],
    // Enable Next.js image optimization
    deviceSizes: [96, 128, 256, 384, 512, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ["image/webp", "image/avif"],
    minimumCacheTTL: 3600, // 1 hour cache
    // Only disable optimization for Google profile images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; img-src 'self' *.googleusercontent.com data:; script-src 'none'; sandbox;",
  },
  // Improve performance with compression
  compress: true,
};

export default nextConfig;
