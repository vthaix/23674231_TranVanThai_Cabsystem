const express = require("express");
const { requireServiceAuth } = require("../middlewares/auth.middleware");
const { createCustomer } = require("../controllers/customer.controller");
const { pool } = require("../db/postgres");
const { verifyServiceToken } = require('../../../../shared/src/auth/jwt');

const router = express.Router();
router.post("/internal/customers", requireServiceAuth, createCustomer);
function requirePaymentService(req, res, next) {
  try {
    const token = verifyServiceToken(req.headers['x-service-token'], 'customer-service');
    if (token.iss !== 'payment-service') throw new Error('Invalid issuer');
    next();
  } catch { res.status(401).json({ code: 'UNAUTHORIZED' }); }
}
router.get('/internal/customers/:id/wallet/:operationId', requirePaymentService, async (req, res) => {
  const { rows } = await pool.query('SELECT amount FROM wallet_operations WHERE operation_id=$1 AND customer_id=$2',
    [req.params.operationId, req.params.id]);
  return res.json({ applied: rows.length > 0, amount: rows.length ? Number(rows[0].amount) : null });
});
router.post("/internal/customers/:id/wallet", requirePaymentService, async (req, res) => {
  const { operationId, amount } = req.body;
  if (typeof operationId !== 'string' || !operationId || !Number.isSafeInteger(amount) || amount === 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR' });
  }
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const existing = await db.query('SELECT * FROM wallet_operations WHERE operation_id=$1', [operationId]);
    if (existing.rows.length) {
      if (existing.rows[0].customer_id !== req.params.id || Number(existing.rows[0].amount) !== amount) {
        await db.query('ROLLBACK');
        return res.status(409).json({ code: 'OPERATION_CONFLICT' });
      }
      const current = await db.query('SELECT balance FROM customer_profiles WHERE id=$1', [req.params.id]);
      await db.query('COMMIT');
      return res.json({ balance: Number(current.rows[0].balance), duplicate: true });
    }
    const updated = await db.query(`UPDATE customer_profiles SET balance=balance+$2,updated_at=NOW()
      WHERE id=$1 AND balance+$2>=0 RETURNING balance`, [req.params.id, amount]);
    if (!updated.rows.length) {
      await db.query('ROLLBACK');
      return res.status(409).json({ code: 'INSUFFICIENT_BALANCE_OR_NOT_FOUND' });
    }
    await db.query('INSERT INTO wallet_operations(operation_id,customer_id,amount) VALUES($1,$2,$3)',
      [operationId, req.params.id, amount]);
    await db.query('COMMIT');
    return res.json({ balance: Number(updated.rows[0].balance) });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  } finally { db.release(); }
});

module.exports = router;
