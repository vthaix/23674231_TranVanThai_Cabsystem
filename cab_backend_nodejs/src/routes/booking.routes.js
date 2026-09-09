const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");
const { createTrip } = require("../services/trip.service");

const router = express.Router();

router.post("/trips/estimate", auth, allowRoles("CUSTOMER"), (req, res) => {
    const { pickup, destination, vehicleType } = req.body;

    if (!pickup || !destination || !vehicleType) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "pickup, destination and vehicleType are required" });
    }

    const dx = destination.latitude - pickup.latitude;
    const dy = destination.longitude - pickup.longitude;
    const distanceKm = Math.sqrt(dx * dx + dy * dy) * 111;

    const base = { MOTORBIKE: 12000, CAR_4: 20000, CAR_7: 25000 }[vehicleType];
    const estimatedFare = Math.round(base + distanceKm * 7000);

    res.json({ estimatedFare, currency: "VND", distanceKm: Number(distanceKm.toFixed(2)) });
});

router.post("/trips", auth, allowRoles("CUSTOMER"), (req, res) => {
    const { pickup, destination, vehicleType } = req.body;

    if (!pickup || !destination || !vehicleType) {
        return res.status(400).json({ code: "VALIDATION_ERROR", message: "pickup, destination and vehicleType are required" });
    }

    const trip = createTrip({
        customerId: req.user.userId,
        pickup,
        destination,
        vehicleType
    });

    res.status(201).json(trip);
});

router.get("/trips", auth, allowRoles("CUSTOMER"), (req, res) => {
    res.json(store.trips.filter(t => t.customerId === req.user.userId));
});

router.post("/trips/:tripId/cancel", auth, allowRoles("CUSTOMER"), (req, res) => {
    const trip = store.trips.find(t => t.tripId === req.params.tripId && t.customerId === req.user.userId);

    if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

    if (!["REQUESTED", "SEARCHING_DRIVER", "DRIVER_ASSIGNED"].includes(trip.status)) {
        return res.status(409).json({ code: "INVALID_STATE", message: "Trip cannot be cancelled now" });
    }

    trip.status = "CANCELLED";
    res.json(trip);
});

module.exports = router;