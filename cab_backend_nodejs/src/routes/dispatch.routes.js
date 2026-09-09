const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");
const { findDrivers } = require("../services/dispatch.service");

const router = express.Router();

router.get("/dispatch/drivers/search", auth, allowRoles("CUSTOMER", "OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  const { latitude, longitude, vehicleType } = req.query;

  if (latitude === undefined || longitude === undefined || !vehicleType) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "latitude, longitude and vehicleType are required" });
  }

  const drivers = findDrivers({
    latitude: Number(latitude),
    longitude: Number(longitude)
  }, vehicleType);

  res.json(drivers);
});

router.post("/dispatch/trips/:tripId/assign", auth, allowRoles("OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);
  const driver = store.drivers.find(d => d.driverId === req.body.driverId);
  const vehicle = store.vehicles.find(v => v.driverId === req.body.driverId);

  if (!trip || !driver || !vehicle) {
    return res.status(404).json({ code: "NOT_FOUND", message: "Trip, driver or vehicle not found" });
  }

  if (driver.status !== "AVAILABLE") {
    return res.status(409).json({ code: "DRIVER_UNAVAILABLE", message: "Driver is not available" });
  }

  if (vehicle.vehicleType !== trip.vehicleType) {
    return res.status(409).json({ code: "VEHICLE_MISMATCH", message: "Vehicle type does not match trip" });
  }

  trip.driverId = driver.driverId;
  trip.vehicleId = vehicle.vehicleId;
  trip.status = "DRIVER_ASSIGNED";
  driver.status = "BUSY";

  res.json(trip);
});

router.post("/dispatch/trips/:tripId/retry", auth, allowRoles("OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);

  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

  trip.status = "SEARCHING_DRIVER";
  res.json({
    tripId: trip.tripId,
    status: trip.status,
    message: "Driver dispatch restarted"
  });
});

module.exports = router;
