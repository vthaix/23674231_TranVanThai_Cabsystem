// PostgreSQL access for the payment service.
const { pool } = require("../db/postgres");

async function findById(id) {
  const { rows } = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
  return rows[0] || null;
}

function begin(db) {
  return db.query("BEGIN");
}

function findIdempotencyRecords(db, params) {
  return db.query(`
      SELECT * FROM idempotency_records
      WHERE scope = $1 AND endpoint = 'POST /payments' AND idempotency_key = $2
      FOR UPDATE
    `, params);
}

function rollback(db) {
  return db.query("ROLLBACK");
}

function insertPayments(db, params) {
  return db.query(`
      INSERT INTO payments (
        id, trip_id, customer_id, amount, currency, method, status,
        provider, provider_transaction_id, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'VND', 'ONLINE', 'PENDING', 'MOCK_PAYMENT', $5, $6)
    `, params);
}

function insertIdempotencyRecords(db, params) {
  return db.query(`
      INSERT INTO idempotency_records (
        scope, endpoint, idempotency_key, request_hash, status, response_code, response_body, resource_id
      ) VALUES ($1, 'POST /payments', $2, $3, 'COMPLETED', 201, $4, $5)
    `, params);
}

function commit(db) {
  return db.query("COMMIT");
}

function findWebhookEvents(db, params) {
  return db.query(`
      SELECT * FROM webhook_events
      WHERE provider = $1 AND provider_event_id = $2 AND signature_valid = true
    `, params);
}

function insertWebhookEvents(db, params) {
  return db.query(`
        INSERT INTO webhook_events (
          provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status, error_message
        ) VALUES ($1, $2, $3, $4, false, $5, 'REJECTED', 'Invalid signature')
      `, params);
}

function findPayments(db, params) {
  return db.query("SELECT * FROM payments WHERE id = $1 FOR UPDATE", params);
}

function findPayments2(db, params) {
  return db.query("SELECT * FROM payments WHERE provider_transaction_id = $1 FOR UPDATE", params);
}

function insertWebhookEvents2(db, params) {
  return db.query(`
        INSERT INTO webhook_events (
          provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status, error_message
        ) VALUES ($1, $2, $3, $4, true, $5, 'REJECTED', 'Payment not found')
      `, params);
}

function insertWebhookEvents3(db, params) {
  return db.query(`
        INSERT INTO webhook_events (
          payment_id, provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status
        ) VALUES ($1, $2, $3, $4, $5, true, $6, 'IGNORED')
      `, params);
}

function updatePayments(db, params) {
  return db.query(`
      UPDATE payments SET
        status = $1::varchar(20),
        completed_at = CASE WHEN $1::varchar(20) = 'COMPLETED' THEN NOW() ELSE completed_at END,
        failed_at = CASE WHEN $1::varchar(20) = 'FAILED' THEN NOW() ELSE failed_at END,
        updated_at = NOW()
      WHERE id = $2
    `, params);
}

function insertWebhookEvents4(db, params) {
  return db.query(`
      INSERT INTO webhook_events (
        payment_id, provider, provider_event_id, provider_transaction_id,
        signature, signature_valid, payload, status, result, amount, processed_at
      ) VALUES ($1, $2, $3, $4, $5, true, $6, 'PROCESSED', $7, $8, NOW())
    `, params);
}

function insertOutboxEvents(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Payment', $1, $2, 'payment.events', $1::uuid::text, $3, $4)
    `, params);
}

module.exports = { findById, begin, findIdempotencyRecords, rollback, insertPayments, insertIdempotencyRecords, commit, findWebhookEvents, insertWebhookEvents, findPayments, findPayments2, insertWebhookEvents2, insertWebhookEvents3, updatePayments, insertWebhookEvents4, insertOutboxEvents };
