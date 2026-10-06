const express = require("express");
const controller = require("../controllers/booking.controller");
const { requireTripService } = require('../middlewares/auth.middleware');

const router = express.Router();
router.post("/internal/test-kafka", controller.postInternalTestKafka);
router.post('/internal/bookings/:id/trip-status', requireTripService, controller.postInternalBookingsIdTripStatus);

module.exports = router;
