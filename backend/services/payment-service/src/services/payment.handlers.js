const { rpcRequest } = require('../../../../shared/src/grpc/transport');
const crypto = require('crypto');
const { pool } = require('../db/postgres');
const { generateServiceToken } = require('../../../../shared/src/auth/jwt');
const { SERVICE_NAME } = require('../config');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const response = (status, body) => ({ status, body });
const error = (status, code, message, requestId) => response(status, { code, message, requestId });

async function servicePost(audience, id, body, requestId) {
  const result = await rpcRequest(audience, 'UpdatePaymentStatus', { id }, {
    headers: {
      'content-type': 'application/json',
      'x-service-token': generateServiceToken(SERVICE_NAME, audience),
      'x-request-id': requestId
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
  if (!result.ok) throw new Error(audience + ' returned ' + result.status);
}

async function postPaymentsTrip(input) {
  const { tripId } = input.params;
  const { sub: userId, role } = input.user;
  const { requestId } = input;
  const idempotencyKey = input.headers?.['idempotency-key'];
  if (!uuid.test(tripId)) return error(400, 'VALIDATION_ERROR', 'Valid tripId required', requestId);
  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim() || idempotencyKey.length > 100) {
    return error(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header (1-100 characters) is required', requestId);
  }

  try {
    const tripResponse = await rpcRequest('trip-service', 'GetTrip', { id: tripId }, {
      headers: { 'x-service-token': generateServiceToken(SERVICE_NAME, 'trip-service'), 'x-request-id': requestId },
      signal: AbortSignal.timeout(5000)
    });
    if (!tripResponse.ok) return error(tripResponse.status, 'TRIP_ERROR', 'Trip not found', requestId);
    const trip = await tripResponse.json();
    if (role !== 'ADMIN' &&
        !(role === 'CUSTOMER' && trip.customerId === userId) &&
        !(role === 'DRIVER' && trip.driverId === userId)) {
      return error(403, 'FORBIDDEN', 'Only trip participants can confirm payment', requestId);
    }
    if (trip.status !== 'COMPLETED') {
      return error(409, 'TRIP_NOT_COMPLETED', 'Trip is ' + trip.status, requestId);
    }

    const client = await pool.connect();
    let payment;
    let duplicate;
    let paymentResponse;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [tripId]);
      const scope = String(userId);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${scope}:POST /payments:${idempotencyKey}`]);
      const idemResult = await client.query(`SELECT request_hash, response_body, resource_id
        FROM idempotency_records
        WHERE scope=$1 AND endpoint='POST /payments' AND idempotency_key=$2
        FOR UPDATE`, [scope, idempotencyKey]);
      const requestHash = crypto.createHash('sha256').update(JSON.stringify({ tripId, userId })).digest('hex');
      if (idemResult.rows.length > 0) {
        const idem = idemResult.rows[0];
        if (idem.request_hash !== requestHash) {
          await client.query('ROLLBACK');
          return error(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency-Key was already used for a different request', requestId);
        }
        const paymentResult = await client.query('SELECT * FROM payments WHERE id=$1', [idem.resource_id]);
        if (paymentResult.rows.length === 0) throw new Error('Idempotent payment resource not found');
        payment = paymentResult.rows[0];
        paymentResponse = idem.response_body;
        duplicate = true;
      } else {
        const existing = await client.query("SELECT * FROM payments WHERE trip_id=$1 AND status='COMPLETED'", [tripId]);
        duplicate = existing.rows.length > 0;
        if (duplicate) {
          payment = existing.rows[0];
        } else {
          const inserted = await client.query("INSERT INTO payments (id,trip_id,customer_id,amount,method,status,provider,completed_at,idempotency_key) VALUES($1,$2,$3,$4,$5,'COMPLETED','SIMULATED',NOW(),$6) RETURNING *",
            [crypto.randomUUID(), tripId, trip.customerId, trip.fare, trip.paymentMethod, idempotencyKey]);
          payment = inserted.rows[0];
        }
        paymentResponse = {
          id: payment.id, tripId, bookingId: trip.bookingId, amount: Number(payment.amount),
          currency: 'VND', paymentMethod: trip.paymentMethod, status: 'COMPLETED',
          paymentStatus: 'PAID', duplicate, requestId
        };
        await client.query(`INSERT INTO idempotency_records
          (scope, endpoint, idempotency_key, request_hash, status, response_code, response_body, resource_id)
          VALUES ($1, 'POST /payments', $2, $3, 'COMPLETED', 200, $4, $5)`,
        [scope, idempotencyKey, requestHash, JSON.stringify(paymentResponse), payment.id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    } finally { client.release(); }

    // A repeated request also repairs a status sync interrupted after the insert.
    await servicePost('trip-service', tripId,
      { paymentId: payment.id, status: 'PAID' }, requestId);
    await servicePost('booking-service', trip.bookingId,
      { tripId, status: 'PAID' }, requestId);

    return response(200, paymentResponse);
  } catch (e) {
    console.error('[payments/trip]', e.message);
    return error(503, 'SERVICE_UNAVAILABLE', 'Payment confirmation failed; retry', requestId);
  }
}

async function getPaymentsId(input) {
  const { id } = input.params;
  const { sub: userId, role } = input.user;
  const { requestId } = input;
  if (!uuid.test(id)) return error(400, 'VALIDATION_ERROR', 'Valid payment or trip ID required', requestId);
  try {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id=$1 OR trip_id=$1 LIMIT 1', [id]);
    if (!rows.length) return error(404, 'NOT_FOUND', 'Payment not found', requestId);
    const p = rows[0];
    if (role === 'CUSTOMER' && p.customer_id !== userId) return error(403, 'FORBIDDEN', 'Access denied', requestId);
    if (role === 'DRIVER') {
      const tripResponse = await rpcRequest('trip-service', 'GetTrip', { id: p.trip_id }, {
        headers: { 'x-service-token': generateServiceToken(SERVICE_NAME, 'trip-service') },
        signal: AbortSignal.timeout(5000)
      });
      if (!tripResponse.ok || (await tripResponse.json()).driverId !== userId)
        return error(403, 'FORBIDDEN', 'Access denied', requestId);
    }
    return response(200, { id: p.id, tripId: p.trip_id, customerId: p.customer_id,
      amount: Number(p.amount), currency: p.currency, method: p.method, status: p.status,
      completedAt: p.completed_at, createdAt: p.created_at, requestId });
  } catch (e) {
    return error(503, 'SERVICE_UNAVAILABLE', 'Payment lookup failed', requestId);
  }
}

module.exports = { postPaymentsTrip, getPaymentsId };
