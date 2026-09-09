const express = require("express");
const { v4: uuid } = require("uuid");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();

router.post("/trips/:tripId/rating", auth, allowRoles("CUSTOMER"), (req, res) => {
  const trip = store.trips.find(
    t => t.tripId === req.params.tripId &&
         t.customerId === req.user.userId
  );

  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });

  if (trip.status !== "COMPLETED") {
    return res.status(409).json({ code: "TRIP_NOT_COMPLETED", message: "Rating is allowed only after completion" });
  }

  if (store.ratings.some(r => r.tripId === trip.tripId)) {
    return res.status(409).json({ code: "ALREADY_RATED", message: "Trip already rated" });
  }

  const ratingValue = Number(req.body.rating);

  if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "rating must be an integer from 1 to 5" });
  }

  const rating = {
    ratingId: uuid(),
    tripId: trip.tripId,
    customerId: trip.customerId,
    driverId: trip.driverId,
    rating: ratingValue,
    comment: req.body.comment || "",
    createdAt: new Date().toISOString()
  };

  store.ratings.push(rating);
  res.status(201).json(rating);
});

router.get("/drivers/:driverId/ratings", auth, (req, res) => {
  res.json(store.ratings.filter(r => r.driverId === req.params.driverId));
});

router.get("/ratings/:ratingId", auth, (req, res) => {
  const rating = store.ratings.find(r => r.ratingId === req.params.ratingId);
  if (!rating) return res.status(404).json({ code: "NOT_FOUND", message: "Rating not found" });
  res.json(rating);
});

module.exports = router;
