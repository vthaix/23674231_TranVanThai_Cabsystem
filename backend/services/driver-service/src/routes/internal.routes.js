const express = require("express");
const controller = require("../controllers/driver.controller");
const { requireInternalAuth } = require("../middlewares/auth.middleware");
const { pool } = require("../db/postgres");
const { verifyServiceToken } = require('../../../../shared/src/auth/jwt');

const router = express.Router();
router.get("/internal/drivers/nearby", requireInternalAuth, controller.getInternalDriversNearby);
router.post("/internal/drivers/:id/reservations", requireInternalAuth, controller.postInternalDriversIdReservations);
router.delete("/internal/drivers/:id/reservations/:bookingId", requireInternalAuth, controller.deleteInternalDriversIdReservationsBookingid);
router.post("/internal/drivers/:id/busy", requireInternalAuth, controller.postInternalDriversIdBusy);
router.post('/internal/drivers/:id/available', requireInternalAuth, controller.postInternalDriversIdAvailable);
router.get("/internal/drivers/:id/summary", requireInternalAuth, controller.getInternalDriversIdSummary);
router.post('/internal/drivers/:id/wallet', (req, res, next) => {
  try {
    const token = verifyServiceToken(req.headers['x-service-token'], 'driver-service');
    if (token.iss !== 'payment-service') throw new Error('Invalid issuer');
    next();
  } catch { res.status(401).json({ code: 'UNAUTHORIZED' }); }
}, async (req, res) => {
  const { operationId, amount } = req.body;
  if (typeof operationId !== 'string' || !operationId || !Number.isSafeInteger(amount) || amount <= 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR' });
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const existing = await db.query('SELECT * FROM wallet_operations WHERE operation_id=$1', [operationId]);
    if (existing.rows.length) {
      if (existing.rows[0].driver_id !== req.params.id || Number(existing.rows[0].amount) !== amount) {
        await db.query('ROLLBACK');
        return res.status(409).json({ code: 'OPERATION_CONFLICT' });
      }
      const current = await db.query('SELECT balance FROM drivers WHERE id=$1', [req.params.id]);
      await db.query('COMMIT');
      return res.json({ balance: Number(current.rows[0].balance), duplicate: true });
    }
    const updated = await db.query('UPDATE drivers SET balance=balance+$2,updated_at=NOW() WHERE id=$1 RETURNING balance',
      [req.params.id, amount]);
    if (!updated.rows.length) {
      await db.query('ROLLBACK');
      return res.status(404).json({ code: 'DRIVER_NOT_FOUND' });
    }
    await db.query('INSERT INTO wallet_operations(operation_id,driver_id,amount) VALUES($1,$2,$3)',
      [operationId, req.params.id, amount]);
    await db.query('COMMIT');
    return res.json({ balance: Number(updated.rows[0].balance) });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  } finally { db.release(); }
});

module.exports = router;
