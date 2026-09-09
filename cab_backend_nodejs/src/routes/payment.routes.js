const express = require("express");
const { v4: uuid } = require("uuid");
const { auth, allowRoles } = require("../middleware/auth");
const { store } = require("../data/store");
const { notify } = require("../services/notification.service");

const router = express.Router();

function completedTrip(id) {
  return store.trips.find(t => t.tripId === id && t.status === "COMPLETED");
}

router.get("/trips/:tripId/fare", auth, allowRoles("CUSTOMER", "OPERATIONS_STAFF", "ADMIN"), (req, res) => {
  const trip = completedTrip(req.params.tripId);

  if (!trip) return res.status(409).json({ code: "TRIP_NOT_COMPLETED", message: "Fare is available only after trip completion" });

  if (trip.fare == null) {
    trip.fare = 20000;
  }

  res.json({
    tripId: trip.tripId,
    amount: trip.fare,
    currency: "VND"
  });
});

router.put("/trips/:tripId/payment-method", auth, allowRoles("CUSTOMER"), (req, res) => {
  const trip = completedTrip(req.params.tripId);

  if (!trip) return res.status(409).json({ code: "TRIP_NOT_COMPLETED", message: "Payment is available only after trip completion" });

  if (!["CASH", "ONLINE"].includes(req.body.method)) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Invalid payment method" });
  }

  trip.paymentMethod = req.body.method;

  res.json({
    tripId: trip.tripId,
    method: trip.paymentMethod
  });
});

router.post("/trips/:tripId/payments/cash", auth, allowRoles("CUSTOMER"), (req, res) => {
  const trip = completedTrip(req.params.tripId);

  if (!trip) return res.status(409).json({ code: "TRIP_NOT_COMPLETED", message: "Trip is not completed" });

  if (store.payments.some(p => p.tripId === trip.tripId && p.status === "SUCCESS")) {
    return res.status(409).json({ code: "ALREADY_PAID", message: "Trip already has a successful payment" });
  }

  const payment = {
    paymentId: uuid(),
    tripId: trip.tripId,
    method: "CASH",
    amount: trip.fare || 20000,
    status: "SUCCESS",
    transactionId: null,
    paidAt: new Date().toISOString()
  };

  store.payments.push(payment);
  notify(trip.customerId, "PAYMENT_SUCCESS", "Payment successful", "Cash payment recorded.");

  res.status(201).json(payment);
});

router.post("/trips/:tripId/payments/online", auth, allowRoles("CUSTOMER"), (req, res) => {
  const trip = completedTrip(req.params.tripId);

  if (!trip) return res.status(409).json({ code: "TRIP_NOT_COMPLETED", message: "Trip is not completed" });

  const payment = {
    paymentId: uuid(),
    tripId: trip.tripId,
    method: "ONLINE",
    amount: trip.fare || 20000,
    status: "PENDING",
    transactionId: null,
    paidAt: null
  };

  store.payments.push(payment);

  res.status(201).json(payment);
});

router.post("/payments/:paymentId/callback", (req, res) => {
  const payment = store.payments.find(p => p.paymentId === req.params.paymentId);

  if (!payment) return res.status(404).json({ code: "NOT_FOUND", message: "Payment not found" });

  payment.status = req.body.status === "SUCCESS" ? "SUCCESS" : "FAILED";
  payment.transactionId = req.body.transactionId || null;
  payment.paidAt = payment.status === "SUCCESS" ? new Date().toISOString() : null;

  const trip = store.trips.find(t => t.tripId === payment.tripId);
  if (trip) notify(
    trip.customerId,
    payment.status === "SUCCESS" ? "PAYMENT_SUCCESS" : "PAYMENT_FAILED",
    "Payment result",
    `Payment status: ${payment.status}`
  );

  res.json(payment);
});

module.exports = router;
