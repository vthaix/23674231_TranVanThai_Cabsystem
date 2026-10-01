const express = require("express");
const crypto = require("crypto");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 8000);

const services = {
    "identity-service": "http://identity-service:3000",
    "customer-service": "http://customer-service:3001",
    "driver-service": "http://driver-service:3002",
    "booking-service": "http://booking-service:3003",
    "trip-service": "http://trip-service:3004",
    "payment-service": "http://payment-service:3005",
    "notification-service": "http://notification-service:3006"
};

// =========================
// Health
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

app.get("/health/services", async(req, res) => {
    const results = await Promise.all(
        Object.entries(services).map(async([name, baseUrl]) => {
            try {
                const response = await fetch(`${baseUrl}/health`);

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
// Gateway routing
// =========================

const routeMap = [{
        prefix: "/auth",
        service: "identity-service"
    },
    {
        prefix: "/customers",
        service: "customer-service"
    },
    {
        prefix: "/drivers",
        service: "driver-service"
    },
    {
        prefix: "/bookings",
        service: "booking-service"
    },
    {
        prefix: "/offers",
        service: "booking-service"
    },
    {
        prefix: "/trips",
        service: "trip-service"
    },
    {
        prefix: "/payments",
        service: "payment-service"
    },
    {
        prefix: "/notifications",
        service: "notification-service"
    }
];

function findRoute(pathname) {
    return routeMap.find(
        (route) =>
        pathname === route.prefix ||
        pathname.startsWith(`${route.prefix}/`)
    );
}

function buildForwardHeaders(req, requestId) {
    const headers = {};

    for (const [key, value] of Object.entries(req.headers)) {
        if (
            [
                "host",
                "connection",
                "content-length"
            ].includes(key.toLowerCase())
        ) {
            continue;
        }

        if (value !== undefined) {
            headers[key] = Array.isArray(value) ?
                value.join(",") :
                value;
        }
    }

    headers["x-request-id"] = requestId;
    headers["x-forwarded-by"] = "cab-gateway";

    return headers;
}
app.get("/api/v1/_health/:service", async (req, res) => {
  const serviceName = req.params.service;
  const baseUrl = services[serviceName];

  if (!baseUrl) {
    return res.status(404).json({
      error: "Unknown service"
    });
  }

  try {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.text();

    res.status(response.status);
    res.setHeader(
      "content-type",
      response.headers.get("content-type") ||
        "application/json"
    );

    res.send(body);
  } catch (error) {
    res.status(502).json({
      error: "Bad Gateway",
      service: serviceName,
      message: error.message
    });
  }
});
app.use("/api/v1", async(req, res) => {
    const requestId =
        req.headers["x-request-id"] || crypto.randomUUID();

    const route = findRoute(req.path);

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

    const targetUrl =
        `${baseUrl}${req.path}${req.url.includes("?")
      ? req.url.slice(req.path.length)
      : ""}`;

    try {
        const method = req.method.toUpperCase();

        const options = {
            method,
            headers: buildForwardHeaders(req, requestId)
        };

        if (!["GET", "HEAD"].includes(method)) {
            options.body = JSON.stringify(req.body ?? {});
            options.headers["content-type"] = "application/json";
        }

        const response = await fetch(targetUrl, options);

        res.status(response.status);

        response.headers.forEach((value, key) => {
            if (![
                    "connection",
                    "keep-alive",
                    "transfer-encoding"
                ].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        const body = await response.text();

        res.send(body);
    } catch (error) {
        console.error(
            `[GATEWAY] ${req.method} ${req.originalUrl} -> ${route.service} failed:`,
            error.message
        );

        return res.status(502).json({
            error: "Bad Gateway",
            service: route.service,
            requestId,
            message: error.message
        });
    }
});

// =========================
// Start
// =========================

app.listen(PORT, "0.0.0.0", () => {
    console.log(`gateway listening on port ${PORT}`);
});