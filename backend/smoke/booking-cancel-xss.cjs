// Run against the local stack; creates and removes only isolated test bookings.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const root = process.env.CAB_BACKEND_ROOT || path.resolve(__dirname, '..');
const { pool } = require(path.join(root, 'services/booking-service/src/db/postgres'));
const { generateToken } = require(path.join(root, 'shared/src/auth/jwt'));
const { escapeHTML } = require(path.join(root, 'shared/src/validation'));
const base = process.env.GATEWAY_URL || 'http://localhost:8000';

async function main() {
  try {
    for (const reason of ["<script>alert('hack')</script>", "'".repeat(255), 'x'.repeat(256)]) {
      const id = crypto.randomUUID();
      const customerId = crypto.randomUUID();
      const headers = { 'content-type': 'application/json', authorization: `Bearer ${generateToken({ sub: customerId, role: 'CUSTOMER' })}` };
      try {
        await pool.query(`INSERT INTO bookings(id,customer_id,vehicle_type,pickup_address,pickup_lat,pickup_lng,
          destination_address,destination_lat,destination_lng,status,search_expires_at)
          VALUES($1,$2,'BIKE','Regression pickup',10.77,106.7,'Regression destination',10.78,106.71,'SEARCHING',NOW()+INTERVAL '30 minutes')`, [id, customerId]);
        const result = await fetch(`${base}/api/v1/bookings/${id}/cancel`, {
          method: 'POST', headers, body: JSON.stringify({ reason }),
        });
        const body = await result.json();
        assert.equal(result.status, reason.length > 255 ? 400 : 200, JSON.stringify(body));
        const stored = (await pool.query('SELECT status,cancel_reason FROM bookings WHERE id=$1', [id])).rows[0];
        if (reason.length > 255) {
          assert.equal(body.code, 'VALIDATION_ERROR');
          assert.equal(stored.status, 'SEARCHING');
        } else {
          assert.equal(body.cancelReason, escapeHTML(reason));
          assert.equal(stored.cancel_reason, escapeHTML(reason));
          assert.equal(stored.status, 'CANCELED');
          const read = await fetch(`${base}/api/v1/bookings/${id}`, { headers });
          assert.equal(read.status, 200);
          assert.equal((await read.json()).cancelReason, escapeHTML(reason));
          const history = await pool.query("SELECT reason FROM booking_status_history WHERE booking_id=$1 AND to_status='CANCELED'", [id]);
          assert.equal(history.rows[0].reason, escapeHTML(reason));
        }
        console.log(`PASS cancellation reason length=${reason.length}, status=${result.status}`);
      } finally {
        await pool.query('DELETE FROM outbox_events WHERE aggregate_id=$1', [id]);
        await pool.query('DELETE FROM booking_status_history WHERE booking_id=$1', [id]);
        await pool.query('DELETE FROM offers WHERE booking_id=$1', [id]);
        await pool.query('DELETE FROM bookings WHERE id=$1', [id]);
      }
    }
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
