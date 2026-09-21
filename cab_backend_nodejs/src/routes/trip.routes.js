const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");
const { updateStatus } = require("../services/trip.service");
const { findDrivers } = require("../services/dispatch.service");

const router = express.Router();

router.post("/trips/:tripId/accept", auth, allowRoles("DRIVER"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);

  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

  if (trip.status !== "SEARCHING_DRIVER" && trip.status !== "DRIVER_ASSIGNED") {
    return res.status(409).json({ code: "TRIP_UNAVAILABLE", message: "Trip is not available" });
  }

  const driver = store.drivers.find(d => d.driverId === req.user.userId);
  const vehicle = store.vehicles.find(v => v.driverId === req.user.userId);

  if (!driver || driver.status !== "AVAILABLE") {
    return res.status(409).json({ code: "DRIVER_UNAVAILABLE", message: "Driver is not available" });
  }

  if (!vehicle || vehicle.vehicleType !== trip.vehicleType) {
    return res.status(409).json({ code: "VEHICLE_MISMATCH", message: "Vehicle is not suitable" });
  }

  trip.driverId = driver.driverId;
  trip.vehicleId = vehicle.vehicleId;
  trip.status = "DRIVER_ASSIGNED";
  driver.status = "BUSY";

  res.json(trip);
});

router.post("/trips/:tripId/reject", auth, allowRoles("DRIVER"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);

  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

  trip.driverId = null;
  trip.vehicleId = null;
  trip.status = "SEARCHING_DRIVER";

  res.json(trip);
});

router.patch("/trips/:tripId/status", auth, allowRoles("DRIVER"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);

  if (!trip || trip.driverId !== req.user.userId) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });
  }

  try {
    res.json(updateStatus(trip, req.body.status));
  } catch (error) {
    res.status(error.status || 500).json({
      code: "INVALID_TRIP_STATE",
      message: error.message
    });
  }
});

router.post("/trips/:tripId/cancel-by-driver", auth, allowRoles("DRIVER"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId && t.driverId === req.user.userId);

  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

  trip.status = "CANCELLED";

  const driver = store.drivers.find(d => d.driverId === req.user.userId);
  if (driver) driver.status = "AVAILABLE";

  res.json(trip);
});

router.patch("/drivers/me/status", auth, allowRoles("DRIVER"), (req, res) => {
  const driver = store.drivers.find(d => d.driverId === req.user.userId);

  if (!driver) return res.status(404).json({ code: "NOT_FOUND", message: "Driver not found" });

  if (!["AVAILABLE", "BUSY", "OFFLINE"].includes(req.body.status)) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid driver status" });
  }

  driver.status = req.body.status;
  driver.updatedAt = new Date().toISOString();

  res.json(driver);
});

module.exports = router;