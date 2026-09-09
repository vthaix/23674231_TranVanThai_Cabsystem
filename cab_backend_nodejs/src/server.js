require("dotenv").config();

const express = require("express");

const authRoutes = require("./routes/auth.routes");
const bookingRoutes = require("./routes/booking.routes");
const dispatchRoutes = require("./routes/dispatch.routes");
const tripRoutes = require("./routes/trip.routes");
const trackingRoutes = require("./routes/tracking.routes");
const paymentRoutes = require("./routes/payment.routes");
const notificationRoutes = require("./routes/notification.routes");
const operationsRoutes = require("./routes/operations.routes");
const historyRoutes = require("./routes/history.routes");
const ratingRoutes = require("./routes/rating.routes");
const accountRoutes = require("./routes/account.routes");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "UP",
    service: "CAB System API",
    timestamp: new Date().toISOString()
  });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1", bookingRoutes);
app.use("/api/v1", dispatchRoutes);
app.use("/api/v1", tripRoutes);
app.use("/api/v1", trackingRoutes);
app.use("/api/v1", paymentRoutes);
app.use("/api/v1", notificationRoutes);
app.use("/api/v1", operationsRoutes);
app.use("/api/v1", historyRoutes);
app.use("/api/v1", ratingRoutes);
app.use("/api/v1", accountRoutes);

app.use((req, res) => {
  res.status(404).json({
    code: "NOT_FOUND",
    message: "API endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(err.status || 500).json({
    code: "INTERNAL_SERVER_ERROR",
    message: err.message || "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`CAB API running at http://localhost:${PORT}`);
});
