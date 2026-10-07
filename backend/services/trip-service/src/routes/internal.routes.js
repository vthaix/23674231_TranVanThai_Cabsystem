const express = require("express");
const controller = require("../controllers/trip.controller");
const { requireInternalAuth } = require("../middlewares/auth.middleware");
const { verifyServiceToken } = require('../../../../shared/src/auth/jwt');

const router = express.Router();
router.post("/internal/trips", requireInternalAuth, controller.postInternalTrips);
router.get("/internal/trips/:id", requireInternalAuth, controller.getInternalTripsId);
router.post("/internal/trips/:id/payment-status", (req, res, next) => {
  try {
    const payload = verifyServiceToken(req.headers['x-service-token'], 'trip-service');
    if (!['booking-service', 'payment-service'].includes(payload.iss)) throw new Error('Invalid issuer');
    req.serviceIssuer = payload.iss;
    next();
  } catch { res.status(401).json({ code: 'UNAUTHORIZED' }); }
}, controller.postInternalTripsIdPaymentStatus);

module.exports = router;
