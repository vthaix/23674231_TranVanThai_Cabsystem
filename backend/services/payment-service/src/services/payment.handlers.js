const repository = require("../repositories/payment.repository");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { TRIP_SERVICE_URL, SERVICE_NAME } = require("../config");
const { hashPaymentRequest, isValidCallbackSignature } = require("../services/payment.service");

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

async function postPayments(input) {
  const { sub: userId, role } = input.user;
  const requestId = input.requestId;

  // Idempotency-Key header is required for safe payment processing
  // But also accept idempotencyKey in body or fallback key
  const idempotencyKey = input.headers["idempotency-key"] || input.body.idempotencyKey || `auto_${userId}_${input.body.tripId}`;

  const { tripId } = input.body;
  if (!tripId) {
    return errorResult(400, "VALIDATION_ERROR", "tripId is required", requestId);
  }

  // Payload hash for idempotency check (PC30)
  const requestHash = hashPaymentRequest(userId, tripId);

  const client = await pool.connect();
  try {
    await repository.begin(client);

    // Check idempotency records
    const idempRes = await repository.findIdempotencyRecords(client, [userId, idempotencyKey]);

    if (idempRes.rows.length > 0) {
      const record = idempRes.rows[0];
      if (record.request_hash !== requestHash) {
        await repository.rollback(client);
        return errorResult(422, "IDEMPOTENCY_CONFLICT", "Payload does not match original request for this Idempotency-Key", requestId);
      }
      // Replay old response without double processing (PC30)
      await repository.rollback(client);
      return response(record.response_code || 200, record.response_body);
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
        await repository.rollback(client);
        return errorResult(tripResp.status, "TRIP_ERROR", "Trip not found or inaccessible", requestId);
      }
      trip = await tripResp.json();
    } catch (e) {
      await repository.rollback(client);
      return errorResult(502, "SERVICE_UNAVAILABLE", "Cannot contact Trip service", requestId);
    }

    // Verify trip status
    if (trip.status !== "COMPLETED") {
      await repository.rollback(client);
      return errorResult(409, "TRIP_NOT_COMPLETED", `Trip is not completed (status: ${trip.status})`, requestId);
    }

    // Verify caller is customer
    if (role === "CUSTOMER" && trip.customerId !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Only customer of this trip can pay", requestId);
    }

    // Verify not already paid
    if (trip.paymentStatus === "PAID") {
      await repository.rollback(client);
      return errorResult(409, "TRIP_ALREADY_PAID", "Trip has already been paid", requestId);
    }

    const amount = Number(trip.fare);
    const paymentId = crypto.randomUUID();
    const providerTransactionId = "txn_" + crypto.randomBytes(16).toString("hex");

    // Insert payment in PENDING
    await repository.insertPayments(client, [paymentId, tripId, userId, amount, providerTransactionId, idempotencyKey]);

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
    await repository.insertIdempotencyRecords(client, [userId, idempotencyKey, requestHash, JSON.stringify(responseBody), paymentId]);

    await repository.commit(client);

    return response(201, responseBody);
  } catch (err) {
    await repository.rollback(client);
    if (err.code === "23505") {
      // Partial unique index violation on active trip payment
      return errorResult(409, "PAYMENT_IN_PROGRESS", "A payment for this trip is already pending or completed", requestId);
    }
    console.error("[payments/create]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to initiate payment", requestId);
  } finally {
    client.release();
  }
}

async function postPaymentsCallback(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const signatureHeader = input.headers["x-signature"];
  const rawBody = input.rawBody || Buffer.from(JSON.stringify(input.body));

  const {
    provider = "MOCK_PAYMENT",
    providerEventId = crypto.randomUUID(),
    providerTransactionId,
    paymentId,
    status: paymentResult = "SUCCESS",
    amount
  } = input.body;

  // 1. Verify HMAC Signature
  const signatureValid = isValidCallbackSignature(signatureHeader, rawBody);

  const client = await pool.connect();
  try {
    await repository.begin(client);

    // Check webhook_events for idempotency (PC19, PC30: prevent replay/double charge)
    const existingEv = await repository.findWebhookEvents(client, [provider, providerEventId]);

    if (existingEv.rows.length > 0) {
      await repository.rollback(client);
      // Already processed, return 200 without re-executing transaction
      return response(200, { status: "ALREADY_PROCESSED", message: "Duplicate callback ignored" });
    }

    if (!signatureValid) {
      await repository.insertWebhookEvents(client, [provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(input.body)]);
      await repository.commit(client);
      return errorResult(401, "INVALID_SIGNATURE", "Invalid callback signature", requestId);
    }

    // Find target payment
    let payment = null;
    if (paymentId) {
      const pRes = await repository.findPayments(client, [paymentId]);
      if (pRes.rows.length > 0) payment = pRes.rows[0];
    } else if (providerTransactionId) {
      const pRes = await repository.findPayments2(client, [providerTransactionId]);
      if (pRes.rows.length > 0) payment = pRes.rows[0];
    }

    if (!payment) {
      await repository.insertWebhookEvents2(client, [provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(input.body)]);
      await repository.commit(client);
      return errorResult(404, "PAYMENT_NOT_FOUND", "Associated payment not found", requestId);
    }

    // If payment already COMPLETED, ignore to prevent double charge
    if (payment.status === "COMPLETED") {
      await repository.insertWebhookEvents3(client, [payment.id, provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(input.body)]);
      await repository.commit(client);
      return response(200, { status: "IGNORED", message: "Payment already completed" });
    }

    // Update payment status
    const targetStatus = paymentResult === "SUCCESS" ? "COMPLETED" : "FAILED";
    await repository.updatePayments(client, [targetStatus, payment.id]);

    // Record webhook event as PROCESSED
    await repository.insertWebhookEvents4(client, [payment.id, provider, providerEventId, providerTransactionId, signatureHeader || "", JSON.stringify(input.body), paymentResult, payment.amount]);

    // Outbox event
    await repository.insertOutboxEvents(client, [
      payment.id,
      targetStatus === "COMPLETED" ? "payment.completed" : "payment.failed",
      JSON.stringify({ paymentId: payment.id, tripId: payment.trip_id, status: targetStatus, amount: payment.amount }),
      requestId
    ]);

    await repository.commit(client);

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

    return response(200, {
      status: targetStatus,
      paymentId: payment.id,
      tripId: payment.trip_id,
      message: `Payment updated to ${targetStatus}`
    });
  } catch (err) {
    await repository.rollback(client);
    console.error("[payments/callback]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Callback processing failed", requestId);
  } finally {
    client.release();
  }
}

async function getPaymentsId(input) {
  const { sub: userId, role } = input.user;
  const { id } = input.params;
  const requestId = input.requestId;

  try {
    const p = await repository.findById(id);
    if (!p) {
      return errorResult(404, "NOT_FOUND", "Payment not found", requestId);
    }

    // Authorization
    if (role === "CUSTOMER" && p.customer_id !== userId) {
      return errorResult(403, "FORBIDDEN", "Access denied", requestId);
    }

    return response(200, {
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
    return errorResult(500, "INTERNAL_ERROR", "Failed to get payment", requestId);
  }
}

module.exports = { postPayments, postPaymentsCallback, getPaymentsId };
