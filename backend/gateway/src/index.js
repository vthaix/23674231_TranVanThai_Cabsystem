const express = require("express");

const app = express();

app.use(express.json());

const PORT = Number(process.env.PORT || 8000);

const services = {
    "identity-service": "http://identity-service:3000",
    "customer-service": "http://customer-service:3000",
    "driver-service": "http://driver-service:3000",
    "booking-service": "http://booking-service:3000",
    "trip-service": "http://trip-service:3000",
    "payment-service": "http://payment-service:3000",
    "notification-service": "http://notification-service:3000"
};

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

app.listen(PORT, "0.0.0.0", () => {
    console.log(`gateway listening on port ${PORT}`);
});