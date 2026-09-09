const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();

function getTrip(req) {
  return store.trips.find(t => t.tripId === req.params.tripId);
}

router.get("/trips/:tripId", auth, allowRoles("CUSTOMER", "DRIVER", "OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  const trip = getTrip(req);
  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });
  res.json(trip);
});

router.get("/trips/:tripId/driver", auth, (req, res) => {
  const trip = getTrip(req);
  const driver = trip && store.drivers.find(d => d.driverId === trip.driverId);

  if (!driver) return res.status(404).json({ code: "NOT_FOUND", message: "Driver not found" });
  res.json(driver);
});

router.get("/trips/:tripId/vehicle", auth, (req, res) => {
  const trip = getTrip(req);
  const vehicle = trip && store.vehicles.find(v => v.vehicleId === trip.vehicleId);

  if (!vehicle) return res.status(404).json({ code: "NOT_FOUND", message: "Vehicle not found" });
  res.json(vehicle);
});

module.exports = router;
