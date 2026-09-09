const express = require("express");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");

const router = express.Router();

router.get("/customers/me/trip-history", auth, allowRoles("CUSTOMER"), (req, res) => {
  res.json(store.trips.filter(t => t.customerId === req.user.userId));
});

router.get("/operations/payments", auth, allowRoles("OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  let result = [...store.payments];

  if (req.query.tripId) result = result.filter(p => p.tripId === req.query.tripId);
  if (req.query.status) result = result.filter(p => p.status === req.query.status);

  res.json(result);
});

router.get("/trips/:tripId/history", auth, (req, res) => {
  const trip = store.trips.find(t => t.tripId === req.params.tripId);
  if (!trip) return res.status(404).json({ code: "NOT_FOUND", message: "Trip not found" });
  res.json(trip);
});

router.get("/trips/:tripId/payment", auth, (req, res) => {
  const payment = store.payments.find(p => p.tripId === req.params.tripId);
  if (!payment) return res.status(404).json({ code: "NOT_FOUND", message: "Payment not found" });
  res.json(payment);
});

module.exports = router;
