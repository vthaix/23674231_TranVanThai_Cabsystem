const express = require("express");
const crypto = require("crypto");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase, runMigrations, pool } = require("./db/postgres");
const { verifyToken, generateServiceToken } = require("../../../shared/src/auth/jwt");
const { sanitizeBody } = require("../../../shared/src/validation/index");

const app = express();

// Use express.json with verify to capture raw body for HMAC check (PC19)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3005);
const SERVICE_NAME = process.env.SERVICE_NAME || "payment-service";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://trip-service:3004";
const PAYMENT_CALLBACK_SECRET = process.env.PAYMENT_CALLBACK_SECRET || "dev-callback-secret-key-32b!";

registerHealthRoutes(app, SERVICE_NAME);

function errorResponse(res, status, code, message, requestId) {
  return res.status(status).json({ code, message, requestId });
}

// Auth middleware for user JWT
function requireAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Bearer token required", requestId);
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid or expired token", requestId);
  }
}

// ==========================================
// PC19 & PC30 — Create Payment (with Idempotency)
// ==========================================
app.post("/payments", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const requestId = req.requestId;

  // Idempotency-Key header is required for safe payment processing
  // But also accept idempotencyKey in body or fallback key
  const idempotencyKey = req.headers["idempotency-key"] || req.body.idempotencyKey || `auto_${userId}_${req.body.tripId}`;

  const { tripId } = req.body;
  if (!tripId) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "tripId is required", requestId);
  }

  // Payload hash for idempotency check (PC30)
  const payloadToHash = { userId, tripId };
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(payloadToHash)).digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check idempotency records
    const idempRes = await client.query(`
      SELECT * FROM idempotency_records
      WHERE scope = $1 AND endpoint = 'POST /payments' AND idempotency_key = $2
      FOR UPDATE
    `, [userId, idempotencyKey]);

    if (idempRes.rows.length > 0) {
      const record = idempRes.rows[0];
      if (record.request_hash !== requestHash) {
        await client.query("ROLLBACK");
        return errorResponse(res, 422, "IDEMPOTENCY_CONFLICT", "Payload does not match original request for this Idempotency-Key", requestId);
      }
      // Replay old response without double processing (PC30)
      await client.query("ROLLBACK");
      return res.status(record.response_code || 200).json(record.response_body);
    }

    // Call Trip Service to verify trip (internal REST)
    let trip = null;
    try {
      const svcToken = generateServiceToken(SERVICE_NAME, "trip-service");
      const tripResp = await fetch(`${TRIP_SERVICE_URL}/internal/trips/${tripId}`, {
        headers: {
          "x-service-token": svcToken,
          "x-request-id": requestId
        }
      });
      if (!tripResp.ok) {
        await client.query("ROLLBACK");
        return errorResponse(res, tripResp.status, "TRIP_ERROR", "Trip not found or inaccessible", requestId);
      }
      trip = await tripResp.json();
    } catch (e) {
      await client.query("ROLLBACK");
      return errorResponse(res, 502, "SERVICE_UNAVAILABLE", "Cannot contact Trip service", requestId);
    }

    // Verify trip status
    if (trip.status !== "COMPLETED") {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "TRIP_NOT_COMPLETED", `Trip is not completed (status: ${trip.status})`, requestId);
    }

    // Verify caller is customer
    if (role === "CUSTOMER" && trip.customerId !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Only customer of this trip can pay", requestId);
    }

    // Verify not already paid
    if (trip.paymentStatus === "PAID") {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "TRIP_ALREADY_PAID", "Trip has already been paid", requestId);
    }

    const amount = Number(trip.fare);
    const paymentId = crypto.randomUUID();
    const providerTransactionId = "txn_" + crypto.randomBytes(16).toString("hex");

    // Insert payment in PENDING
    await client.query(`
      INSERT INTO payments (
        id, trip_id, customer_id, amount, currency, method, status,
        provider, provider_transaction_id, idempotency_key
      ) VALUES ($1, $2, $3, $4, 'VND', 'ONLINE', 'PENDING', 'MOCK_PAYMENT', $5, $6)
    `, [paymentId, tripId, userId, amount, providerTransactionId, idempotencyKey]);

    const responseBody = {
      id: paymentId,
      tripId,
      customerId: userId,
      amount,
      currency: "VND",
      status: "PENDING",
      provider: "MOCK_PAYMENT",
      providerTransactionId,
      callbackUrl: "/api/v1/payments/callback",
      createdAt: new Date().toISOString(),
      requestId
    };

    // Save in idempotency_records
    await client.query(`
      INSERT INTO idempotency_records (
        scope, endpoint, idempotency_key, request_hash, status, response_code, response_body, resource_id
      ) VALUES ($1, 'POST /payments', $2, $3, 'COMPLETED', 201, $4, $5)
    `, [userId, idempotencyKey, requestHash, JSON.stringify(responseBody), paymentId]);

    await client.query("COMMIT");

    return res.status(201).json(responseBody);
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      // Partial unique index violation on active trip payment
      return errorResponse(res, 409, "PAYMENT_IN_PROGRESS", "A payment for this trip is already pending or completed", requestId);
    }
    console.error("[payments/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to initiate payment", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// PC19 — Payment Provider Callback
// ==========================================
app.post("/payments/callback", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const signatureHeader = req.headers["x-signature"];
  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));

  const {
    provider = "MOCK_PAYMENT",
    providerEventId = crypto.randomUUID(),
    providerTransactionId,
    paymentId,
    status: paymentResult = "SUCCESS",
    amount
  } = req.body;

  // 1. Verify HMAC Signature
  let signatureValid = false;
  if (signatureHeader) {
    const expectedSig = crypto.createHmac("sha256", PAYMENT_CALLBACK_SECRET).update(rawBody).digest("hex");
    // Also accept base64 or hex
    const expectedSigBase64 = crypto.createHmac("sha256", PAYMENT_CALLBACK_SECRET).update(rawBody).digest("base64");
    if (signatureHeader === expectedSig || signatureHeader === expectedSigBase64) {
      signatureValid = true;
    }
  } else if (process.env.NODE_ENV !== "production") {
    // In dev mode allow if testing without signature
    signatureValid = true;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check webhook_events for idempotency (PC19, PC30: prevent replay/double charge)
    const existingEv = await client.query(`
      SELECT * FROM webhook_events
      WHERE provider = $1 AND provider_event_id = $2 AND signature_valid = true
    `, [provider, providerEventId]);

    if (existingEv.rows.length > 0) {
      await client.query("ROLLBACK");
      // Already processed, return 200 without re-executing transaction
      return res.status(200).json({ status: "ALREADY_PROCESSED", message: "Duplicate callback ignored" });
    }

    if (!signatureValid) {
      await client.query(`
        INSERT INTO webhook_events (
          provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status, error_message
        ) VALUES ($1, $2, $3, $4, false, $5, 'REJECTED', 'Invalid signature')
      `, [provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(req.body)]);
      await client.query("COMMIT");
      return errorResponse(res, 401, "INVALID_SIGNATURE", "Invalid callback signature", requestId);
    }

    // Find target payment
    let payment = null;
    if (paymentId) {
      const pRes = await client.query("SELECT * FROM payments WHERE id = $1 FOR UPDATE", [paymentId]);
      if (pRes.rows.length > 0) payment = pRes.rows[0];
    } else if (providerTransactionId) {
      const pRes = await client.query("SELECT * FROM payments WHERE provider_transaction_id = $1 FOR UPDATE", [providerTransactionId]);
      if (pRes.rows.length > 0) payment = pRes.rows[0];
    }

    if (!payment) {
      await client.query(`
        INSERT INTO webhook_events (
          provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status, error_message
        ) VALUES ($1, $2, $3, $4, true, $5, 'REJECTED', 'Payment not found')
      `, [provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(req.body)]);
      await client.query("COMMIT");
      return errorResponse(res, 404, "PAYMENT_NOT_FOUND", "Associated payment not found", requestId);
    }

    // If payment already COMPLETED, ignore to prevent double charge
    if (payment.status === "COMPLETED") {
      await client.query(`
        INSERT INTO webhook_events (
          payment_id, provider, provider_event_id, provider_transaction_id,
          signature, signature_valid, payload, status
        ) VALUES ($1, $2, $3, $4, $5, true, $6, 'IGNORED')
      `, [payment.id, provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(req.body)]);
      await client.query("COMMIT");
      return res.status(200).json({ status: "IGNORED", message: "Payment already completed" });
    }

    // Update payment status
    const targetStatus = paymentResult === "SUCCESS" ? "COMPLETED" : "FAILED";
    await client.query(`
      UPDATE payments SET
        status = $1::varchar(20),
        completed_at = CASE WHEN $1::varchar(20) = 'COMPLETED' THEN NOW() ELSE completed_at END,
        failed_at = CASE WHEN $1::varchar(20) = 'FAILED' THEN NOW() ELSE failed_at END,
        updated_at = NOW()
      WHERE id = $2
    `, [targetStatus, payment.id]);

    // Record webhook event as PROCESSED
    await client.query(`
      INSERT INTO webhook_events (
        payment_id, provider, provider_event_id, provider_transaction_id,
        signature, signature_valid, payload, status, result, amount, processed_at
      ) VALUES ($1, $2, $3, $4, $5, true, $6, 'PROCESSED', $7, $8, NOW())
    `, [payment.id, provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(req.body), paymentResult, payment.amount]);

    // Outbox event
    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Payment', $1, $2, 'payment.events', $1::uuid::text, $3, $4)
    `, [
      payment.id,
      targetStatus === "COMPLETED" ? "payment.completed" : "payment.failed",
      JSON.stringify({ paymentId: payment.id, tripId: payment.trip_id, status: targetStatus, amount: payment.amount }),
      requestId
    ]);

    await client.query("COMMIT");

    // If COMPLETED, notify Trip Service (best effort)
    if (targetStatus === "COMPLETED") {
      try {
        const svcToken = generateServiceToken(SERVICE_NAME, "trip-service");
        await fetch(`${TRIP_SERVICE_URL}/internal/trips/${payment.trip_id}/payment-status`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-service-token": svcToken,
            "x-request-id": requestId
          },
          body: JSON.stringify({ paymentId: payment.id, status: "PAID" })
        });
      } catch (e) {
        console.warn("[payment/callback] Trip update payment status warning:", e.message);
      }
    }

    return res.status(200).json({
      status: targetStatus,
      paymentId: payment.id,
      tripId: payment.trip_id,
      message: `Payment updated to ${targetStatus}`
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[payments/callback]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Callback processing failed", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// Get Payment Details
// ==========================================
app.get("/payments/:id", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id } = req.params;
  const requestId = req.requestId;

  try {
    const { rows } = await pool.query("SELECT * FROM payments WHERE id = $1", [id]);
    if (rows.length === 0) {
      return errorResponse(res, 404, "NOT_FOUND", "Payment not found", requestId);
    }
    const p = rows[0];

    // Authorization
    if (role === "CUSTOMER" && p.customer_id !== userId) {
      return errorResponse(res, 403, "FORBIDDEN", "Access denied", requestId);
    }

    return res.json({
      id: p.id,
      tripId: p.trip_id,
      customerId: p.customer_id,
      amount: Number(p.amount),
      currency: p.currency,
      method: p.method,
      status: p.status,
      provider: p.provider,
      providerTransactionId: p.provider_transaction_id,
      completedAt: p.completed_at,
      createdAt: p.created_at,
      requestId
    });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get payment", requestId);
  }
});

// ==========================================
// Start Service
// ==========================================
async function start() {
  try {
    await runMigrations();
    console.log("[payment-service] Migrations applied");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[payment-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
