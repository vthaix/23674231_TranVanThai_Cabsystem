const express = require("express");
const controller = require("../controllers/booking.controller");
const { requireTripService } = require('../middlewares/auth.middleware');
const { verifyServiceToken } = require('../../../../shared/src/auth/jwt');
const { pool } = require('../db/postgres');

const router = express.Router();
router.post("/internal/test-kafka", controller.postInternalTestKafka);
router.post('/internal/bookings/:id/trip-status', requireTripService, controller.postInternalBookingsIdTripStatus);
router.post('/internal/bookings/:id/payment-status', async (req, res) => {
  try {
    const token = verifyServiceToken(req.headers['x-service-token'], 'booking-service');
    if (token.iss !== 'payment-service' || req.body.status !== 'PAID')
      return res.status(401).json({ code: 'UNAUTHORIZED' });
    const { rows } = await pool.query(`UPDATE bookings SET status='COMPLETED',
      completed_at=COALESCE(completed_at,NOW()),payment_status='PAID',updated_at=NOW()
      WHERE id=$1 AND trip_id=$2 AND status IN ('ASSIGNED','COMPLETED') RETURNING id,payment_status`,
      [req.params.id, req.body.tripId]);
    if (!rows.length) return res.status(409).json({ code: 'BOOKING_NOT_COMPLETED' });
    return res.json({ id: rows[0].id, paymentStatus: rows[0].payment_status });
  } catch (error) {
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  }
});

module.exports = router;
