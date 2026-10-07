const express = require("express");
const controller = require("../controllers/trip.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

const router = express.Router();
router.get('/trips', requireAuth, controller.getTrips);
router.patch("/trips/:id/status", requireAuth, controller.patchTripsIdStatus);
router.post("/trips/:id/cancel", requireAuth, controller.postTripsIdCancel);
router.post("/trips/:id/reviews", requireAuth, controller.postTripsIdReviews);
router.get("/trips/:id", requireAuth, controller.getTripsId);
router.get("/trips/:id/location", requireAuth, controller.getTripsIdLocation);

module.exports = router;
