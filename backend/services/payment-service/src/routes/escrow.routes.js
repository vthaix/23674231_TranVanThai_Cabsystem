const express = require('express');
const { pool } = require('../db/postgres');
const { verifyServiceToken, generateServiceToken } = require('../../../../shared/src/auth/jwt');
const { SERVICE_NAME, CUSTOMER_SERVICE_URL, DRIVER_SERVICE_URL } = require('../config');

const router = express.Router();
router.use('/internal/escrows', (req, res, next) => {
  try {
    const token = verifyServiceToken(req.headers['x-service-token'], SERVICE_NAME);
    if (token.iss !== 'booking-service') throw new Error('Invalid issuer');
    next();
  }
  catch { res.status(401).json({ code: 'UNAUTHORIZED' }); }
});

async function wallet(service, url, operationId, amount) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-service-token': generateServiceToken(SERVICE_NAME, service) },
    body: JSON.stringify({ operationId, amount }),
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) {
    const error = new Error(`Wallet ${service} returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
}

async function customerHoldApplied(customerId, bookingId) {
  const response = await fetch(`${CUSTOMER_SERVICE_URL}/internal/customers/${customerId}/wallet/hold:${bookingId}`, {
    headers: { 'x-service-token': generateServiceToken(SERVICE_NAME, 'customer-service') },
    signal: AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Cannot verify customer wallet operation');
  const result = await response.json();
  return result.applied;
}

router.post('/internal/escrows', async (req, res) => {
  const { bookingId, customerId, amount } = req.body;
  if (!bookingId || !customerId || !Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR' });
  }
  const db = await pool.connect();
  try {
    await db.query(`INSERT INTO booking_escrows(booking_id,customer_id,amount,status)
      VALUES($1,$2,$3,'PENDING') ON CONFLICT (booking_id) DO NOTHING`, [bookingId, customerId, amount]);
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM booking_escrows WHERE booking_id=$1 FOR UPDATE', [bookingId]);
    const escrow = rows[0];
    if (escrow.customer_id !== customerId || Number(escrow.amount) !== amount ||
        !['PENDING', 'HELD'].includes(escrow.status)) {
      await db.query('ROLLBACK');
      return res.status(409).json({ code: 'ESCROW_CONFLICT' });
    }
    if (escrow.status === 'PENDING') {
      await wallet('customer-service', `${CUSTOMER_SERVICE_URL}/internal/customers/${customerId}/wallet`,
        `hold:${bookingId}`, -amount);
      await db.query(`UPDATE booking_escrows SET status='HELD',updated_at=NOW() WHERE booking_id=$1`, [bookingId]);
    }
    await db.query('COMMIT');
    return res.json({ bookingId, amount, status: 'HELD' });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    return res.status(error.status || 503).json({ code: error.status === 409 ? 'INSUFFICIENT_BALANCE' : 'ESCROW_FAILED' });
  } finally { db.release(); }
});

router.post('/internal/escrows/:bookingId/release', async (req, res) => {
  const { bookingId } = req.params;
  const { action, driverId, tripId } = req.body;
  if (!['REFUND', 'SETTLE'].includes(action) || (action === 'SETTLE' && (!driverId || !tripId))) {
    return res.status(400).json({ code: 'VALIDATION_ERROR' });
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const { rows } = await db.query('SELECT * FROM booking_escrows WHERE booking_id=$1 FOR UPDATE', [bookingId]);
    if (!rows.length) { await db.query('ROLLBACK'); return res.status(404).json({ code: 'ESCROW_NOT_FOUND' }); }
    const escrow = rows[0];
    const target = action === 'REFUND' ? 'REFUNDED' : 'SETTLED';
    if (escrow.status === target) {
      if (action === 'SETTLE' && (escrow.driver_id !== driverId || escrow.trip_id !== tripId)) {
        await db.query('ROLLBACK');
        return res.status(409).json({ code: 'ESCROW_CONFLICT' });
      }
      await db.query('COMMIT');
      return res.json({ bookingId, status: target, amount: Number(escrow.amount), duplicate: true });
    }
    if (escrow.status === 'PENDING' && action === 'REFUND') {
      if (await customerHoldApplied(escrow.customer_id, bookingId)) {
        await wallet('customer-service', `${CUSTOMER_SERVICE_URL}/internal/customers/${escrow.customer_id}/wallet`,
          `refund:${bookingId}`, Number(escrow.amount));
      }
      await db.query("UPDATE booking_escrows SET status='REFUNDED',updated_at=NOW() WHERE booking_id=$1", [bookingId]);
      await db.query('COMMIT');
      return res.json({ bookingId, status: 'REFUNDED', amount: Number(escrow.amount) });
    }
    if (escrow.status !== 'HELD') { await db.query('ROLLBACK'); return res.status(409).json({ code: 'ESCROW_CONFLICT' }); }
    const amount = Number(escrow.amount);
    if (action === 'REFUND') {
      await wallet('customer-service', `${CUSTOMER_SERVICE_URL}/internal/customers/${escrow.customer_id}/wallet`,
        `refund:${bookingId}`, amount);
    } else {
      await wallet('driver-service', `${DRIVER_SERVICE_URL}/internal/drivers/${driverId}/wallet`,
        `settle:${bookingId}`, amount);
    }
    await db.query(`UPDATE booking_escrows SET status=$2,driver_id=$3,trip_id=$4,updated_at=NOW()
      WHERE booking_id=$1`, [bookingId, target, action === 'SETTLE' ? driverId : null, action === 'SETTLE' ? tripId : null]);
    await db.query('COMMIT');
    return res.json({ bookingId, status: target, amount });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    return res.status(error.status || 503).json({ code: 'ESCROW_RELEASE_FAILED' });
  } finally { db.release(); }
});

router.get('/internal/escrows/:bookingId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM booking_escrows WHERE booking_id=$1', [req.params.bookingId]);
  if (!rows.length) return res.status(404).json({ code: 'ESCROW_NOT_FOUND' });
  const e = rows[0];
  return res.json({ bookingId: e.booking_id, customerId: e.customer_id, driverId: e.driver_id,
    tripId: e.trip_id, amount: Number(e.amount), status: e.status });
});

module.exports = router;
