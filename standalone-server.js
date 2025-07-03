const express = require("express");
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");
const next = require("next");
const cors = require("cors");

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();

  // Security: Disable X-Powered-By header to prevent information exposure
  expressApp.disable("x-powered-by");

  // Security: Add security headers middleware
  expressApp.use((req, res, next) => {
    // Security headers to prevent various attacks
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );

    // Only set HSTS in production with HTTPS
    if (process.env.NODE_ENV === "production" && req.secure) {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }

    next();
  });

  // Security: Set up CORS with proper origin restrictions
  const allowedOrigins = dev
    ? ["http://localhost:3000", "https://localhost:3000"]
    : ["https://thetribelab.com", "https://www.thetribelab.com"];

  expressApp.use(
    cors({
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true, // Enable credentials for authenticated requests
      optionsSuccessStatus: 200, // Some legacy browsers choke on 204
    })
  );

  // Create server with conditional HTTPS support for production
  let server;
  const isProduction = process.env.NODE_ENV === "production";
  const useHttps = isProduction && process.env.HTTPS_ENABLED === "true";

  if (useHttps) {
    // HTTPS configuration for production
    try {
      const httpsOptions = {
        key: fs.readFileSync(
          process.env.HTTPS_KEY_PATH ||
            path.join(process.cwd(), "certs", "key.pem")
        ),
        cert: fs.readFileSync(
          process.env.HTTPS_CERT_PATH ||
            path.join(process.cwd(), "certs", "cert.pem")
        ),
        // Additional security options
        secureProtocol: "TLS_method",
        ciphers: [
          "TLS_AES_128_GCM_SHA256",
          "TLS_AES_256_GCM_SHA384",
          "TLS_CHACHA20_POLY1305_SHA256",
          "ECDHE-RSA-AES128-GCM-SHA256",
          "ECDHE-RSA-AES256-GCM-SHA384",
        ].join(":"),
        honorCipherOrder: true,
        minVersion: "TLSv1.2",
      };
      server = https.createServer(httpsOptions, expressApp);
      console.log("✅ HTTPS server configured for production");
    } catch (error) {
      console.warn(
        "⚠️  HTTPS certificates not found, falling back to HTTP:",
        error.message
      );
      server = http.createServer(expressApp);
    }
  } else {
    // HTTP server for development or when HTTPS is not enabled
    server = http.createServer(expressApp);
    if (isProduction) {
      console.log(
        "⚠️  Production server using HTTP. Set HTTPS_ENABLED=true to enable HTTPS."
      );
    }
  }

  // Initialize Socket.io with secure CORS configuration
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    allowEIO3: true,
  });

  // Socket.io connection handler
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Join a post room to receive updates for that post
    socket.on("join-post", (postId) => {
      socket.join(`post:${postId}`);
      console.log(`Socket ${socket.id} joined post:${postId}`);
    });

    // Leave a post room
    socket.on("leave-post", (postId) => {
      socket.leave(`post:${postId}`);
      console.log(`Socket ${socket.id} left post:${postId}`);
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Make io accessible to our API routes
  expressApp.use((req, res, next) => {
    req.io = io;
    next();
  });

  // Export io for use in API routes
  global.io = io;

  // Handle all other routes with Next.js
  expressApp.all("*", (req, res) => {
    return handle(req, res);
  });

  // Start the server
  server.listen(port, (err) => {
    if (err) throw err;

    const protocol = useHttps ? "https" : "http";
    console.log(`> Ready on ${protocol}://localhost:${port}`);
    console.log(`> Socket.io server running on port ${port}`);

    if (useHttps) {
      console.log("🔒 HTTPS server running with TLS encryption");
    } else if (isProduction) {
      console.log(
        "⚠️  Production server using HTTP. Set HTTPS_ENABLED=true and provide certificates to enable HTTPS."
      );
    } else {
      console.log("🔓 Development server running on HTTP");
    }
  });
});
