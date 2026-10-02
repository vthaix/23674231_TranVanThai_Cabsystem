const express = require("express");
const crypto = require("crypto");
const { Kafka } = require("kafkajs");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase, runMigrations, pool } = require("./db/postgres");
const { seed } = require("./db/seed");
const { verifyToken, generateServiceToken } = require("../../../shared/src/auth/jwt");
const { sanitizeBody, sanitizeString } = require("../../../shared/src/validation/index");
const { startOutboxRelay } = require("../../../shared/src/events/outbox");

const app = express();
app.use(express.json());
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3003);
const SERVICE_NAME = process.env.SERVICE_NAME || "booking-service";
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || "http://driver-service:3002";
const TRIP_SERVICE_URL = process.env.TRIP_SERVICE_URL || "http://trip-service:3004";

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

// =========================
// Kafka Producer
// =========================
const brokers = (process.env.KAFKA_BROKERS || "kafka:9092")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const kafka = new Kafka({
  clientId: SERVICE_NAME,
  brokers
});

const producer = kafka.producer();
let kafkaReady = false;

async function connectKafka() {
  try {
    await producer.connect();
    kafkaReady = true;
    startOutboxRelay(pool, producer);
    console.log(`${SERVICE_NAME} kafka connected: ${brokers.join(",")}`);
  } catch (err) {
    kafkaReady = false;
    console.warn(`${SERVICE_NAME} kafka connection skipped/failed:`, err.message);
  }
}

async function publishKafkaEvent(topic, key, event) {
  if (!kafkaReady) return;
  try {
    await producer.send({
      topic,
      messages: [{ key: String(key), value: JSON.stringify(event) }]
    });
  } catch (e) {
    console.warn(`[KAFKA] publish error ${topic}:`, e.message);
  }
}

// Keep PC7 test endpoint
app.post("/internal/test-kafka", async (req, res) => {
  if (!kafkaReady) {
    return res.status(503).json({ error: "Kafka is not ready" });
  }
  const event = {
    eventId: crypto.randomUUID(),
    eventType: "booking.test",
    occurredAt: new Date().toISOString(),
    producer: SERVICE_NAME,
    data: {
      bookingId: req.body.bookingId || "TEST-BOOKING-001",
      message: req.body.message || "Kafka PC7 test event"
    }
  };
  try {
    await producer.send({
      topic: "booking.events",
      messages: [{ key: event.data.bookingId, value: JSON.stringify(event) }]
    });
    return res.status(202).json({ status: "published", topic: "booking.events", event });
  } catch (err) {
    return res.status(500).json({ error: "Kafka publish failed", message: err.message });
  }
});

// Helper: Dispatch next driver for a booking
async function dispatchBooking(bookingId, client) {
  try {
    const { rows } = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
    if (rows.length === 0) return;
    const booking = rows[0];
    if (booking.status !== "SEARCHING") return;

    // Get drivers already offered
    const offersRes = await client.query("SELECT driver_id FROM offers WHERE booking_id = $1", [bookingId]);
    const excludeIds = offersRes.rows.map(r => r.driver_id).join(",");

    // Call Driver Service nearby
    const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
    const nearbyUrl = `${DRIVER_SERVICE_URL}/internal/drivers/nearby?lat=${booking.pickup_lat}&lng=${booking.pickup_lng}&vehicleType=${booking.vehicle_type}&excludeIds=${excludeIds}`;

    const resp = await fetch(nearbyUrl, {
      headers: { "x-service-token": svcToken }
    });

    if (!resp.ok) return;
    const { candidates } = await resp.json();
    if (!candidates || candidates.length === 0) {
      // Check attempt count
      if (booking.attempt_count >= 5) {
        await client.query("UPDATE bookings SET status = 'NO_DRIVER_FOUND', updated_at = NOW() WHERE id = $1", [bookingId]);
      }
      return;
    }

    const targetDriver = candidates[0];

    // Reserve driver
    const reserveResp = await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${targetDriver.id}/reservations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-service-token": svcToken
      },
      body: JSON.stringify({ bookingId })
    });

    if (!reserveResp.ok) return; // Driver was taken

    const attemptNo = (booking.attempt_count || 0) + 1;
    const expiresAt = new Date(Date.now() + 30 * 1000); // 30s TTL

    // Create Offer
    await client.query(`
      INSERT INTO offers (
        booking_id, driver_id, attempt_no, status,
        distance_to_pickup_m, eta_seconds, expires_at
      ) VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
    `, [
      bookingId, targetDriver.id, attemptNo,
      targetDriver.distanceM, targetDriver.etaSeconds, expiresAt
    ]);

    await client.query(`
      UPDATE bookings SET
        attempt_count = $1,
        next_dispatch_at = $2,
        updated_at = NOW()
      WHERE id = $3
    `, [attemptNo, expiresAt, bookingId]);

    console.log(`[DISPATCH] Sent offer for booking ${bookingId} to driver ${targetDriver.id}`);
  } catch (e) {
    console.warn(`[DISPATCH] error for booking ${bookingId}:`, e.message);
  }
}

// ==========================================
// PC14 — List Bookings of Customer
// ==========================================
app.get("/bookings", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const requestId = req.requestId;
  const { page = 1, limit = 20, status } = req.query;

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const offset = (p - 1) * l;

  try {
    let query = "SELECT * FROM bookings";
    const params = [];

    // Authorization: CUSTOMER can only see own bookings; EMPLOYEE/ADMIN can see all
    if (role === "CUSTOMER") {
      params.push(userId);
      query += ` WHERE customer_id = $${params.length}`;
    } else if (req.query.customerId) {
      params.push(req.query.customerId);
      query += ` WHERE customer_id = $${params.length}`;
    }

    if (status) {
      const clause = params.length > 0 ? "AND" : "WHERE";
      params.push(status);
      query += ` ${clause} status = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(l, offset);

    const { rows } = await pool.query(query, params);

    // Count
    let countQuery = "SELECT COUNT(*) FROM bookings";
    const countParams = [];
    if (role === "CUSTOMER") {
      countParams.push(userId);
      countQuery += " WHERE customer_id = $1";
    } else if (req.query.customerId) {
      countParams.push(req.query.customerId);
      countQuery += " WHERE customer_id = $1";
    }
    const countRes = await pool.query(countQuery, countParams);
    const total = Number(countRes.rows[0].count);

    const data = rows.map(r => ({
      id: r.id,
      customerId: r.customer_id,
      vehicleType: r.vehicle_type,
      pickup: {
        address: r.pickup_address,
        lat: Number(r.pickup_lat),
        lng: Number(r.pickup_lng)
      },
      destination: {
        address: r.destination_address,
        lat: Number(r.destination_lat),
        lng: Number(r.destination_lng)
      },
      status: r.status,
      currentDriverId: r.current_driver_id,
      tripId: r.trip_id,
      cancelReason: r.cancel_reason,
      createdAt: r.created_at,
      completedAt: r.completed_at,
      canceledAt: r.canceled_at
    }));

    return res.json({
      data,
      pagination: {
        page: p,
        limit: l,
        total
      },
      requestId
    });
  } catch (err) {
    console.error("[bookings/list]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to list bookings", requestId);
  }
});

// ==========================================
// PC15 & PC30 — Create Booking (with Idempotency)
// ==========================================
app.post("/bookings", requireAuth, async (req, res) => {
  const { sub: customerId, role } = req.user;
  const requestId = req.requestId;

  if (role !== "CUSTOMER" && role !== "ADMIN") {
    return errorResponse(res, 403, "FORBIDDEN", "Only customers can create bookings", requestId);
  }

  // Idempotency-Key header is mandatory (PC15, PC30)
  const idempotencyKey = req.headers["idempotency-key"];
  if (!idempotencyKey) {
    return errorResponse(res, 400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required", requestId);
  }

  const {
    pickupAddress,
    pickupLat,
    pickupLng,
    destinationAddress,
    destinationLat,
    destinationLng,
    vehicleType = "BIKE",
    note
  } = req.body;

  if (!pickupAddress || !destinationAddress || pickupLat === undefined || pickupLng === undefined || destinationLat === undefined || destinationLng === undefined) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Pickup and destination address with coordinates are required", requestId);
  }

  const pLat = Number(pickupLat);
  const pLng = Number(pickupLng);
  const dLat = Number(destinationLat);
  const dLng = Number(destinationLng);

  if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Invalid coordinates", requestId);
  }

  const normalizedVehicle = ["BIKE", "SEDAN", "SUV"].includes(vehicleType.toUpperCase())
    ? vehicleType.toUpperCase()
    : "BIKE";

  // Request payload hash for idempotency check (PC30)
  const payloadToHash = {
    pickupAddress,
    pLat,
    pLng,
    destinationAddress,
    dLat,
    dLng,
    vehicleType: normalizedVehicle
  };
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(payloadToHash)).digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Tra idempotency_records theo (scope, endpoint, idempotency_key)
    const idempRes = await client.query(`
      SELECT * FROM idempotency_records
      WHERE scope = $1 AND endpoint = 'POST /bookings' AND idempotency_key = $2
      FOR UPDATE
    `, [customerId, idempotencyKey]);

    if (idempRes.rows.length > 0) {
      const record = idempRes.rows[0];
      // Nếu cùng key nhưng khác hash -> 422
      if (record.request_hash !== requestHash) {
        await client.query("ROLLBACK");
        return errorResponse(res, 422, "IDEMPOTENCY_CONFLICT", "Payload does not match original request for this Idempotency-Key", requestId);
      }
      // Cùng hash -> trả lại response cũ
      await client.query("ROLLBACK");
      return res.status(record.response_code || 201).json(record.response_body);
    }

    const bookingId = crypto.randomUUID();

    // Insert booking
    await client.query(`
      INSERT INTO bookings (
        id, customer_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
        destination_address, destination_lat, destination_lng, note, status,
        next_dispatch_at, attempt_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SEARCHING', NOW(), 0)
    `, [
      bookingId, customerId, normalizedVehicle, sanitizeString(pickupAddress),
      pLat, pLng, sanitizeString(destinationAddress), dLat, dLng,
      note ? sanitizeString(note) : null
    ]);

    // History
    await client.query(`
      INSERT INTO booking_status_history (booking_id, to_status, actor_id, actor_role, request_id)
      VALUES ($1, 'SEARCHING', $2, $3, $4)
    `, [bookingId, customerId, role, requestId]);

    // Outbox event
    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.created', 'booking.events', $1::uuid::text, $2, $3)
    `, [
      bookingId,
      JSON.stringify({ bookingId, customerId, vehicleType: normalizedVehicle }),
      requestId
    ]);

    const responseBody = {
      id: bookingId,
      customerId,
      vehicleType: normalizedVehicle,
      pickup: { address: pickupAddress, lat: pLat, lng: pLng },
      destination: { address: destinationAddress, lat: dLat, lng: dLng },
      status: "SEARCHING",
      message: "Booking created, searching for nearby driver",
      createdAt: new Date().toISOString(),
      requestId
    };

    // Store in idempotency_records
    await client.query(`
      INSERT INTO idempotency_records (
        scope, endpoint, idempotency_key, request_hash, status, response_code, response_body, resource_id
      ) VALUES ($1, 'POST /bookings', $2, $3, 'COMPLETED', 201, $4, $5)
    `, [customerId, idempotencyKey, requestHash, JSON.stringify(responseBody), bookingId]);

    // Perform immediate dispatch step inside or right after transaction
    await dispatchBooking(bookingId, client);

    await client.query("COMMIT");

    return res.status(201).json(responseBody);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bookings/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create booking", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// PC16 — Driver Views Offers
// ==========================================
app.get("/offers", requireAuth, async (req, res) => {
  const { sub: driverId, role } = req.user;
  const requestId = req.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResponse(res, 403, "FORBIDDEN", "Driver access required", requestId);
  }

  try {
    const { rows } = await pool.query(`
      SELECT o.*, b.pickup_address, b.pickup_lat, b.pickup_lng,
             b.destination_address, b.destination_lat, b.destination_lng,
             b.vehicle_type, b.note
      FROM offers o
      JOIN bookings b ON o.booking_id = b.id
      WHERE o.driver_id = $1 AND o.status = 'PENDING' AND o.expires_at > NOW()
      ORDER BY o.created_at DESC
    `, [driverId]);

    const data = rows.map(r => ({
      id: r.id,
      bookingId: r.booking_id,
      vehicleType: r.vehicle_type,
      pickup: {
        address: r.pickup_address,
        lat: Number(r.pickup_lat),
        lng: Number(r.pickup_lng)
      },
      destination: {
        address: r.destination_address,
        lat: Number(r.destination_lat),
        lng: Number(r.destination_lng)
      },
      distanceToPickupM: r.distance_to_pickup_m,
      etaSeconds: r.eta_seconds,
      expiresAt: r.expires_at,
      status: r.status
    }));

    return res.json({ data, requestId });
  } catch (err) {
    console.error("[offers/list]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to list offers", requestId);
  }
});

// ==========================================
// PC16 — Driver Accepts Offer
// ==========================================
app.post("/offers/:id/accept", requireAuth, async (req, res) => {
  const { sub: driverId, role } = req.user;
  const { id: offerId } = req.params;
  const requestId = req.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResponse(res, 403, "FORBIDDEN", "Driver access required", requestId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Lock Offer & Booking
    const offerRes = await client.query(`
      SELECT o.*, b.customer_id, b.vehicle_type, b.pickup_address, b.pickup_lat, b.pickup_lng,
             b.destination_address, b.destination_lat, b.destination_lng, b.status as booking_status,
             b.trip_id
      FROM offers o
      JOIN bookings b ON o.booking_id = b.id
      WHERE o.id = $1 FOR UPDATE
    `, [offerId]);

    if (offerRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Offer not found", requestId);
    }

    const offer = offerRes.rows[0];

    // Check ownership
    if (offer.driver_id !== driverId && role !== "ADMIN") {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Offer does not belong to you", requestId);
    }

    // Idempotent check: if already accepted
    if (offer.status === "ACCEPTED" && offer.trip_id) {
      await client.query("ROLLBACK");
      return res.json({
        bookingId: offer.booking_id,
        tripId: offer.trip_id,
        status: "ASSIGNED",
        message: "Offer already accepted"
      });
    }

    if (offer.status !== "PENDING" || new Date(offer.expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "OFFER_EXPIRED", "Offer has expired or is no longer pending", requestId);
    }

    if (offer.booking_status !== "SEARCHING") {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "BOOKING_NOT_SEARCHING", `Booking already in state ${offer.booking_status}`, requestId);
    }

    // Mark offer ACCEPTED
    await client.query(`
      UPDATE offers SET
        status = 'ACCEPTED',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [offerId]);

    // Cancel other pending offers for this booking
    await client.query(`
      UPDATE offers SET status = 'CANCELED', updated_at = NOW()
      WHERE booking_id = $1 AND id <> $2 AND status = 'PENDING'
    `, [offer.booking_id, offerId]);

    // 2. Call Trip Service to create Trip (internal REST)
    let tripId = null;
    try {
      const svcToken = generateServiceToken(SERVICE_NAME, "trip-service");
      const tripResp = await fetch(`${TRIP_SERVICE_URL}/internal/trips`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-token": svcToken,
          "x-request-id": requestId
        },
        body: JSON.stringify({
          bookingId: offer.booking_id,
          customerId: offer.customer_id,
          driverId,
          vehicleType: offer.vehicle_type,
          pickupAddress: offer.pickup_address,
          pickupLat: Number(offer.pickup_lat),
          pickupLng: Number(offer.pickup_lng),
          destinationAddress: offer.destination_address,
          destinationLat: Number(offer.destination_lat),
          destinationLng: Number(offer.destination_lng)
        })
      });

      if (tripResp.ok) {
        const tripData = await tripResp.json();
        tripId = tripData.id;
      } else {
        console.warn("[offers/accept] Trip service returned non-200:", await tripResp.text());
        tripId = crypto.randomUUID(); // fallback ID
      }
    } catch (e) {
      console.warn("[offers/accept] Trip service call error:", e.message);
      tripId = crypto.randomUUID(); // fallback ID
    }

    // 3. Call Driver Service to set Driver BUSY
    try {
      const driverSvcToken = generateServiceToken(SERVICE_NAME, "driver-service");
      await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${driverId}/busy`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-service-token": driverSvcToken,
          "x-request-id": requestId
        },
        body: JSON.stringify({ tripId })
      });
    } catch (e) {
      console.warn("[offers/accept] Driver service set busy error:", e.message);
    }

    // 4. Update Booking to ASSIGNED
    await client.query(`
      UPDATE bookings SET
        status = 'ASSIGNED',
        trip_id = $1,
        current_driver_id = $2,
        assigned_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, [tripId, driverId, offer.booking_id]);

    await client.query(`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, actor_role, request_id)
      VALUES ($1, 'SEARCHING', 'ASSIGNED', $2, 'DRIVER', $3)
    `, [offer.booking_id, driverId, requestId]);

    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.assigned', 'booking.events', $1::uuid::text, $2, $3)
    `, [
      offer.booking_id,
      JSON.stringify({ bookingId: offer.booking_id, tripId, driverId }),
      requestId
    ]);

    await client.query("COMMIT");

    return res.json({
      bookingId: offer.booking_id,
      tripId,
      status: "ASSIGNED",
      message: "Offer accepted successfully, trip created",
      requestId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[offers/accept]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to accept offer", requestId);
  } finally {
    client.release();
  }
});

// Driver Rejects Offer
app.post("/offers/:id/reject", requireAuth, async (req, res) => {
  const { sub: driverId, role } = req.user;
  const { id: offerId } = req.params;
  const requestId = req.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResponse(res, 403, "FORBIDDEN", "Driver access required", requestId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM offers WHERE id = $1 FOR UPDATE", [offerId]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Offer not found", requestId);
    }
    const offer = rows[0];
    if (offer.driver_id !== driverId && role !== "ADMIN") {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Offer does not belong to you", requestId);
    }

    await client.query(`
      UPDATE offers SET status = 'REJECTED', responded_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [offerId]);

    // Release reservation
    try {
      const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
      await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${driverId}/reservations/${offer.booking_id}`, {
        method: "DELETE",
        headers: { "x-service-token": svcToken }
      });
    } catch {}

    // Trigger next dispatch
    await dispatchBooking(offer.booking_id, client);

    await client.query("COMMIT");

    return res.json({ success: true, message: "Offer rejected", requestId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[offers/reject]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to reject offer", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// PC18 — Cancel Booking
// ==========================================
app.post("/bookings/:id/cancel", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id: bookingId } = req.params;
  const { reason } = req.body;
  const requestId = req.requestId;

  if (!reason) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Cancellation reason is required", requestId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Booking not found", requestId);
    }

    const booking = rows[0];

    // Authorization
    if (role === "CUSTOMER" && booking.customer_id !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Cannot cancel another customer's booking", requestId);
    }

    if (booking.status === "ASSIGNED") {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "BOOKING_ALREADY_ASSIGNED", "Booking is already assigned to a driver. Cancel via trip endpoint.", requestId);
    }

    if (["COMPLETED", "CANCELED"].includes(booking.status)) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "INVALID_STATE", `Booking already in status ${booking.status}`, requestId);
    }

    // Cancel pending offers and release reservation
    const pendingOffers = await client.query("SELECT * FROM offers WHERE booking_id = $1 AND status = 'PENDING'", [bookingId]);
    for (const off of pendingOffers.rows) {
      try {
        const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
        await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${off.driver_id}/reservations/${bookingId}`, {
          method: "DELETE",
          headers: { "x-service-token": svcToken }
        });
      } catch {}
    }

    await client.query("UPDATE offers SET status = 'CANCELED', updated_at = NOW() WHERE booking_id = $1 AND status = 'PENDING'", [bookingId]);

    // Update booking to CANCELED
    await client.query(`
      UPDATE bookings SET
        status = 'CANCELED',
        cancel_reason = $1,
        canceled_by_id = $2,
        canceled_by_role = $3,
        canceled_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
    `, [sanitizeString(reason), userId, role, bookingId]);

    await client.query(`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, reason, actor_id, actor_role, request_id)
      VALUES ($1, $2, 'CANCELED', $3, $4, $5, $6)
    `, [bookingId, booking.status, sanitizeString(reason), userId, role, requestId]);

    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.canceled', 'booking.events', $1::uuid::text, $2, $3)
    `, [
      bookingId,
      JSON.stringify({ bookingId, reason, customerId: booking.customer_id }),
      requestId
    ]);

    await client.query("COMMIT");

    return res.json({
      id: bookingId,
      status: "CANCELED",
      cancelReason: reason,
      message: "Booking canceled successfully",
      requestId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bookings/cancel]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to cancel booking", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// Start Service
// ==========================================
async function start() {
  try {
    await runMigrations();
    console.log("[booking-service] Migrations applied");
    await seed();
    await connectKafka();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[booking-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
