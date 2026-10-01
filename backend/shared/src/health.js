function registerHealthRoutes(app, serviceName) {
    app.get("/health", (req, res) => {
        res.status(200).json({
            status: "ok",
            service: serviceName,
            timestamp: new Date().toISOString()
        });
    });

    app.get("/ready", (req, res) => {
        res.status(200).json({
            status: "ready",
            service: serviceName,
            timestamp: new Date().toISOString()
        });
    });
}

module.exports = {
    registerHealthRoutes
};