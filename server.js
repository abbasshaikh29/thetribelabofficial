const express = require("express");
const next = require("next");
const errorHandler = require("./src/lib/errorHandler").default;
const { createServer } = require("http");
const { createServer: createHttpsServer } = require("https");
const fs = require("fs");
const path = require("path");
const { initSocketIO } = require("./src/lib/socket");

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressServer = express();

  // Security: Disable X-Powered-By header to prevent information exposure
  expressServer.disable("x-powered-by");

  // Security: Add security headers middleware
  expressServer.use((req, res, next) => {
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
      server = createHttpsServer(httpsOptions, expressServer);
      console.log("✅ HTTPS server configured for production");
    } catch (error) {
      console.warn(
        "⚠️  HTTPS certificates not found, falling back to HTTP:",
        error.message
      );
      server = createServer(expressServer);
    }
  } else {
    // HTTP server for development or when HTTPS is not enabled
    server = createServer(expressServer);
    if (isProduction) {
      console.log(
        "⚠️  Production server using HTTP. Set HTTPS_ENABLED=true to enable HTTPS."
      );
    }
  }

  // Initialize Socket.io with our global instance
  initSocketIO(server);

  // No need to make io accessible to our API routes anymore
  // as we'll use the global instance directly

  expressServer.use(errorHandler);

  expressServer.all("*", (req, res) => {
    return handle(req, res);
  });

  server.listen(port, (err) => {
    if (err) throw err;

    const protocol = useHttps ? "https" : "http";
    console.log(`> Ready on ${protocol}://localhost:${port}`);

    if (useHttps) {
      console.log("🔒 HTTPS server running with TLS encryption");
    } else if (isProduction) {
      console.log(
        "⚠️  Production server running on HTTP. Set HTTPS_ENABLED=true and provide certificates to enable HTTPS."
      );
    } else {
      console.log("🔓 Development server running on HTTP");
    }
  });
});
