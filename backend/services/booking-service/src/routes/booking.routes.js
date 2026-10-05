const express = require("express");
const controller = require("../controllers/booking.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get("/bookings", requireAuth, controller.getBookings);
router.post("/bookings", requireAuth, controller.postBookings);
router.post("/bookings/:id/accept", requireAuth, controller.postBookingsIdAccept);
router.get("/offers", requireAuth, controller.getOffers);
router.post("/offers/:id/accept", requireAuth, controller.postOffersIdAccept);
router.post("/offers/:id/reject", requireAuth, controller.postOffersIdReject);
router.post("/bookings/:id/cancel", requireAuth, controller.postBookingsIdCancel);

module.exports = router;
