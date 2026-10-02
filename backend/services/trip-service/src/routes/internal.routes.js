const express = require("express");
const controller = require("../controllers/trip.controller");
const { requireInternalAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.post("/internal/trips", requireInternalAuth, controller.postInternalTrips);
router.get("/internal/trips/:id", requireInternalAuth, controller.getInternalTripsId);
router.post("/internal/trips/:id/payment-status", requireInternalAuth, controller.postInternalTripsIdPaymentStatus);

module.exports = router;
