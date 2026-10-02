const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 8000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";

const services = {
  "identity-service": process.env.IDENTITY_SERVICE_URL || "http://identity-service:3000",
  "customer-service": process.env.CUSTOMER_SERVICE_URL || "http://customer-service:3001",
  "driver-service": process.env.DRIVER_SERVICE_URL || "http://driver-service:3002",
  "booking-service": process.env.BOOKING_SERVICE_URL || "http://booking-service:3003",
  "trip-service": process.env.TRIP_SERVICE_URL || "http://trip-service:3004",
  "payment-service": process.env.PAYMENT_SERVICE_URL || "http://payment-service:3005",
  "notification-service": process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3006"
};

// =========================
// PC6 — Health Check Endpoints
// =========================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "gateway",
    timestamp: new Date().toISOString()
  });
});

app.get("/ready", (req, res) => {
  res.status(200).json({
    status: "ready",
    service: "gateway",
    timestamp: new Date().toISOString()
  });
});

app.get("/health/services", async (req, res) => {
  const results = await Promise.all(
    Object.entries(services).map(async ([name, baseUrl]) => {
      try {
        const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
        return {
          service: name,
          status: response.ok ? "up" : "down"
        };
      } catch (error) {
        return {
          service: name,
          status: "down",
          error: error.message
        };
      }
    })
  );

  const allUp = results.every((item) => item.status === "up");
  res.status(allUp ? 200 : 503).json({
    status: allUp ? "ok" : "degraded",
    services: results,
    timestamp: new Date().toISOString()
  });
});

// =========================
// PC29 — Rate Limiter (Token bucket / window per IP)
// =========================
const rateLimitWindowMs = 10 * 1000; // 10 seconds window
const maxRequestsPerWindow = 50; // max 50 requests per 10 seconds per IP
const ipRequestCounts = new Map(); // ip -> [timestamps]

// Clean up stale IP timestamps every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequestCounts.entries()) {
    const valid = timestamps.filter(t => now - t < rateLimitWindowMs);
    if (valid.length === 0) {
      ipRequestCounts.delete(ip);
    } else {
      ipRequestCounts.set(ip, valid);
    }
  }
}, 30000);

function rateLimiter(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();

  const timestamps = (ipRequestCounts.get(ip) || []).filter(t => now - t < rateLimitWindowMs);

  // If endpoint is POST /bookings or POST /booking, apply strict rate limit
  const isBookingPost = (req.path === "/bookings" || req.path === "/booking") && req.method === "POST";
  const limit = isBookingPost ? 30 : maxRequestsPerWindow;

  if (timestamps.length >= limit) {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    res.setHeader("Retry-After", "10");
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", "0");
    return res.status(429).json({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too Many Requests - rate limit exceeded",
      requestId
    });
  }

  timestamps.push(now);
  ipRequestCounts.set(ip, timestamps);
  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - timestamps.length));
  next();
}

// =========================
// Gateway Routing Configuration
// =========================
const routeMap = [
  { prefix: "/auth", service: "identity-service" },
  { prefix: "/customers", service: "customer-service" },
  { prefix: "/drivers", service: "driver-service" },
  { prefix: "/admin/drivers", service: "driver-service" },
  { prefix: "/admin", service: "driver-service" },
  { prefix: "/bookings", service: "booking-service" },
  { prefix: "/booking", service: "booking-service", rewrite: "/bookings" },
  { prefix: "/offers", service: "booking-service" },
  { prefix: "/trips", service: "trip-service" },
  { prefix: "/payments", service: "payment-service" },
  { prefix: "/notifications", service: "notification-service" }
];

function findRoute(pathname) {
  return routeMap.find(
    (route) =>
      pathname === route.prefix ||
      pathname.startsWith(`${route.prefix}/`)
  );
}

function buildForwardHeaders(req, requestId, user) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) {
      continue;
    }
    if (value !== undefined) {
      headers[key] = Array.isArray(value) ? value.join(",") : value;
    }
  }

  headers["x-request-id"] = requestId;
  headers["x-forwarded-by"] = "cab-gateway";
  if (user) {
    headers["x-user-id"] = user.sub;
    headers["x-user-role"] = user.role;
  }

  return headers;
}

// =========================
// API Proxy Middleware (/api/v1/...)
// =========================
app.use("/api/v1", rateLimiter, async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  // 1. JWT verification and tampering detection (PC27)
  let user = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      // Reject alg=none or tampered signature
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.header || decoded.header.alg !== "HS256") {
        return res.status(401).json({
          code: "UNAUTHORIZED",
          message: "Invalid token algorithm or malformed token",
          requestId
        });
      }
      user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    } catch (err) {
      return res.status(401).json({
        code: "UNAUTHORIZED",
        message: "Invalid or tampered token: signature verification failed",
        requestId
      });
    }
  }

  // 2. RBAC check (PC28)
  // Customer role cannot call driver-only routes:
  // /drivers/me/**, /offers/**, /admin/**
  const pathname = req.path;
  if (user && user.role === "CUSTOMER") {
    if (
      pathname.startsWith("/drivers/me") ||
      pathname.startsWith("/offers") ||
      pathname.startsWith("/admin")
    ) {
      return res.status(403).json({
        code: "FORBIDDEN",
        message: "Customer is not authorized to access Driver or Admin API",
        requestId
      });
    }
  }

  // 3. Find matching route
  const route = findRoute(pathname);
  if (!route) {
    return res.status(404).json({
      error: "Route not found",
      requestId
    });
  }

  const baseUrl = services[route.service];
  if (!baseUrl) {
    return res.status(502).json({
      error: "Target service not configured",
      service: route.service,
      requestId
    });
  }

  // Handle route rewrite (e.g. /booking -> /bookings)
  let targetPath = req.path;
  if (route.rewrite && pathname.startsWith(route.prefix)) {
    targetPath = route.rewrite + pathname.slice(route.prefix.length);
  }

  const queryString = req.url.includes("?") ? req.url.slice(req.path.length) : "";
  const targetUrl = `${baseUrl}${targetPath}${queryString}`;

  try {
    const method = req.method.toUpperCase();
    const options = {
      method,
      headers: buildForwardHeaders(req, requestId, user)
    };

    if (!["GET", "HEAD"].includes(method)) {
      options.body = JSON.stringify(req.body ?? {});
      options.headers["content-type"] = "application/json";
    }

    const response = await fetch(targetUrl, options);

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (!["connection", "keep-alive", "transfer-encoding"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const body = await response.text();
    res.send(body);
  } catch (error) {
    console.error(`[GATEWAY] ${req.method} ${req.originalUrl} -> ${route.service} failed:`, error.message);
    return res.status(502).json({
      error: "Bad Gateway",
      service: route.service,
      requestId,
      message: error.message
    });
  }
});

// Also expose /booking or /bookings on root if client calls without /api/v1 prefix
app.all(/^\/bookings?(?:\/.*)?$/, (req, res) => {
  res.redirect(307, `/api/v1${req.originalUrl}`);
});

// Start Gateway
app.listen(PORT, "0.0.0.0", () => {
  console.log(`gateway listening on port ${PORT}`);
});
