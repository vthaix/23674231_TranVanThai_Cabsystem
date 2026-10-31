const { pool } = require('../db/postgres');

async function postInternalBookingsIdPaymentStatus(input) {
  if (input.body.status !== 'PAID') {
    return { status: 400, body: { code: 'VALIDATION_ERROR', message: 'status must be PAID' } };
  }
  try {
    const { rows } = await pool.query(`UPDATE bookings SET status='COMPLETED',
      completed_at=COALESCE(completed_at,NOW()),payment_status='PAID',updated_at=NOW()
      WHERE id=$1 AND trip_id=$2 AND status IN ('ASSIGNED','COMPLETED') RETURNING id,payment_status`,
    [input.params.id, input.body.tripId]);
    if (!rows.length) return { status: 409, body: { code: 'BOOKING_NOT_COMPLETED' } };
    return { status: 200, body: { id: rows[0].id, paymentStatus: rows[0].payment_status } };
  } catch (error) {
    console.error('[booking/payment-status]', error.message);
    return { status: 500, body: { code: 'INTERNAL_ERROR' } };
  }
}

module.exports = { postInternalBookingsIdPaymentStatus };
