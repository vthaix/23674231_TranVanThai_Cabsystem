const express = require("express");
const crypto = require("crypto");
const { Kafka } = require("kafkajs");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase, runMigrations, pool } = require("./db/postgres");
const { seed } = require("./db/seed");
const { verifyToken, generateServiceToken, verifyServiceToken } = require("../../../shared/src/auth/jwt");
const { sanitizeBody, sanitizeString } = require("../../../shared/src/validation/index");
const { startOutboxRelay } = require("../../../shared/src/events/outbox");

const app = express();
app.use(express.json());
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3004);
const SERVICE_NAME = process.env.SERVICE_NAME || "trip-service";
const DRIVER_SERVICE_URL = process.env.DRIVER_SERVICE_URL || "http://driver-service:3002";
const producer = new Kafka({ clientId: SERVICE_NAME, brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(",") }).producer();

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

// Internal auth middleware
function requireInternalAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const serviceToken = req.headers["x-service-token"];
  if (!serviceToken) {
    return next(); // allow intra-network
  }
  try {
    verifyServiceToken(serviceToken, SERVICE_NAME);
    next();
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid service token", requestId);
  }
}

// Distance calculation using Haversine formula (km)
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 10) / 10; // 1 decimal place
}

// Valid status transitions (PC17)
const STATUS_TRANSITIONS = {
  ASSIGNED: ["ARRIVED", "CANCELED"],
  ARRIVED: ["IN_PROGRESS", "CANCELED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELED: []
};

// ==========================================
// Internal REST — Create Trip (called by booking-service)
// ==========================================
app.post("/internal/trips", requireInternalAuth, async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const {
    bookingId,
    customerId,
    driverId,
    vehicleType = "BIKE",
    pickupAddress,
    pickupLat,
    pickupLng,
    destinationAddress,
    destinationLat,
    destinationLng
  } = req.body;

  if (!bookingId || !customerId || !driverId) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "bookingId, customerId, driverId required", requestId);
  }

  const client = await pool.connect();
  try {
    // Idempotency: check if trip for this booking already exists
    const existing = await client.query("SELECT * FROM trips WHERE booking_id = $1", [bookingId]);
    if (existing.rows.length > 0) {
      return res.status(200).json(existing.rows[0]);
    }

    // 1. Fetch driver snapshot from driver-service
    let driverSnapshot = null;
    try {
      const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
      const snapResp = await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${driverId}/summary`, {
        headers: { "x-service-token": svcToken }
      });
      if (snapResp.ok) {
        driverSnapshot = await snapResp.json();
      }
    } catch (e) {
      console.warn("[trips/internal] Fetch driver summary warning:", e.message);
    }

    // 2. Calculate distance in km
    const distKm = Math.max(1.0, haversineDistanceKm(Number(pickupLat), Number(pickupLng), Number(destinationLat), Number(destinationLng)));

    // 3. Find active fare rule
    const normalizedVehicle = ["BIKE", "SEDAN", "SUV"].includes(vehicleType.toUpperCase()) ? vehicleType.toUpperCase() : "BIKE";
    const fareRuleRes = await client.query("SELECT * FROM fare_rules WHERE vehicle_type = $1 AND is_active = true LIMIT 1", [normalizedVehicle]);

    const baseFare = fareRuleRes.rows.length > 0 ? Number(fareRuleRes.rows[0].base_fare) : 15000;
    const perKm = fareRuleRes.rows.length > 0 ? Number(fareRuleRes.rows[0].per_km) : 5000;
    const fare = Math.round(baseFare + perKm * distKm);

    const tripId = crypto.randomUUID();

    await client.query("BEGIN");
    await client.query(`
      INSERT INTO trips (
        id, booking_id, customer_id, driver_id, vehicle_type,
        pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng,
        distance_km, base_fare, per_km_fare, fare, status, payment_status, driver_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ASSIGNED', 'UNPAID', $16)
    `, [
      tripId, bookingId, customerId, driverId, normalizedVehicle,
      pickupAddress, pickupLat, pickupLng, destinationAddress, destinationLat, destinationLng,
      distKm, baseFare, perKm, fare, JSON.stringify(driverSnapshot)
    ]);

    await client.query(`
      INSERT INTO trip_status_history (trip_id, to_status, actor_role, request_id)
      VALUES ($1, 'ASSIGNED', 'SYSTEM', $2)
    `, [tripId, requestId]);

    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.assigned', 'trip.events', $1::uuid::text, $2, $3)
    `, [
      tripId,
      JSON.stringify({ tripId, bookingId, customerId, driverId, fare }),
      requestId
    ]);

    await client.query("COMMIT");

    return res.status(201).json({
      id: tripId,
      bookingId,
      customerId,
      driverId,
      vehicleType: normalizedVehicle,
      distanceKm: distKm,
      fare,
      status: "ASSIGNED",
      paymentStatus: "UNPAID",
      driverSnapshot
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[trips/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create trip", requestId);
  } finally {
    client.release();
  }
});

// Internal: Get Trip Details (called by payment-service)
app.get("/internal/trips/:id", requireInternalAuth, async (req, res) => {
  const { id } = req.params;
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  try {
    const { rows } = await pool.query("SELECT * FROM trips WHERE id = $1", [id]);
    if (rows.length === 0) {
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }
    const t = rows[0];
    return res.json({
      id: t.id,
      bookingId: t.booking_id,
      customerId: t.customer_id,
      driverId: t.driver_id,
      fare: Number(t.fare),
      status: t.status,
      paymentStatus: t.payment_status,
      distanceKm: Number(t.distance_km)
    });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get trip", requestId);
  }
});

// Internal: Update Payment Status (called by payment-service)
app.post("/internal/trips/:id/payment-status", requireInternalAuth, async (req, res) => {
  const { id } = req.params;
  const { paymentId, status = "PAID" } = req.body;
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  try {
    await pool.query(`
      UPDATE trips SET
        payment_status = $1,
        payment_id = COALESCE($2, payment_id),
        updated_at = NOW()
      WHERE id = $3
    `, [status, paymentId || null, id]);

    return res.json({ id, paymentStatus: status });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to update payment status", requestId);
  }
});

// ==========================================
// PC17 — Update Trip Status Sequence
// Sequence: ASSIGNED -> ARRIVED -> IN_PROGRESS -> COMPLETED
// ==========================================
app.patch("/trips/:id/status", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id: tripId } = req.params;
  const { status: targetStatus, latitude, longitude } = req.body;
  const requestId = req.requestId;

  if (!targetStatus) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "status is required", requestId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM trips WHERE id = $1 FOR UPDATE", [tripId]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization: only assigned driver or admin can update status
    if (role === "DRIVER" && trip.driver_id !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Only assigned driver can update trip status", requestId);
    }

    // Validate state transition (PC17)
    const allowedNext = STATUS_TRANSITIONS[trip.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "INVALID_STATE_TRANSITION", `Cannot transition from ${trip.status} to ${targetStatus}`, requestId);
    }

    // Set timestamps
    const now = new Date();
    let arrivedAt = trip.arrived_at;
    let startedAt = trip.started_at;
    let completedAt = trip.completed_at;

    if (targetStatus === "ARRIVED") arrivedAt = now;
    if (targetStatus === "IN_PROGRESS") startedAt = now;
    if (targetStatus === "COMPLETED") completedAt = now;

    await client.query(`
      UPDATE trips SET
        status = $1,
        arrived_at = $2,
        started_at = $3,
        completed_at = $4,
        updated_at = NOW()
      WHERE id = $5
    `, [targetStatus, arrivedAt, startedAt, completedAt, tripId]);

    // Record history
    await client.query(`
      INSERT INTO trip_status_history (
        trip_id, from_status, to_status, actor_id, actor_role, latitude, longitude, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      tripId, trip.status, targetStatus, userId, role,
      latitude ? Number(latitude) : null,
      longitude ? Number(longitude) : null,
      requestId
    ]);

    // Outbox event
    const eventType = `trip.${targetStatus.toLowerCase()}`;
    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, $2, 'trip.events', $1::uuid::text, $3, $4)
    `, [
      tripId, eventType,
      JSON.stringify({ tripId, status: targetStatus, driverId: trip.driver_id, customerId: trip.customer_id }),
      requestId
    ]);

    // If trip COMPLETED, notify Driver Service to set driver back to ONLINE
    if (targetStatus === "COMPLETED") {
      try {
        const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
        await fetch(`${DRIVER_SERVICE_URL}/drivers/me/availability`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${generateServiceToken(SERVICE_NAME, "driver-service")}`
          },
          body: JSON.stringify({ status: "ONLINE" })
        });
      } catch {}
    }

    await client.query("COMMIT");

    return res.json({
      id: tripId,
      status: targetStatus,
      previousStatus: trip.status,
      arrivedAt,
      startedAt,
      completedAt,
      message: `Trip status updated to ${targetStatus}`,
      requestId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[trips/update-status]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to update trip status", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// PC18 — Cancel Trip
// ==========================================
app.post("/trips/:id/cancel", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id: tripId } = req.params;
  const { reason } = req.body;
  const requestId = req.requestId;

  if (!reason) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "Cancellation reason is required", requestId);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM trips WHERE id = $1 FOR UPDATE", [tripId]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization: customer, assigned driver, or admin
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Cannot cancel another customer's trip", requestId);
    }
    if (role === "DRIVER" && trip.driver_id !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Cannot cancel another driver's trip", requestId);
    }

    // Cancellation is only allowed before IN_PROGRESS
    if (["IN_PROGRESS", "COMPLETED", "CANCELED"].includes(trip.status)) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "CANNOT_CANCEL", `Trip cannot be canceled in status ${trip.status}`, requestId);
    }

    await client.query(`
      UPDATE trips SET
        status = 'CANCELED',
        cancel_reason = $1,
        canceled_by_id = $2,
        canceled_by_role = $3,
        canceled_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
    `, [sanitizeString(reason), userId, role, tripId]);

    await client.query(`
      INSERT INTO trip_status_history (trip_id, from_status, to_status, reason, actor_id, actor_role, request_id)
      VALUES ($1, $2, 'CANCELED', $3, $4, $5, $6)
    `, [tripId, trip.status, sanitizeString(reason), userId, role, requestId]);

    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.canceled', 'trip.events', $1::uuid::text, $2, $3)
    `, [
      tripId,
      JSON.stringify({ tripId, reason, canceledBy: userId, customerId: trip.customer_id, driverId: trip.driver_id }),
      requestId
    ]);

    await client.query("COMMIT");

    return res.json({
      id: tripId,
      status: "CANCELED",
      cancelReason: reason,
      message: "Trip canceled successfully",
      requestId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[trips/cancel]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to cancel trip", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// PC20 — Review Trip (1-5 stars, comment)
// ==========================================
app.post("/trips/:id/reviews", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id: tripId } = req.params;
  const { stars, comment } = req.body;
  const requestId = req.requestId;

  if (stars === undefined || isNaN(Number(stars)) || Number(stars) < 1 || Number(stars) > 5) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "stars must be an integer between 1 and 5", requestId);
  }

  const numStars = Math.round(Number(stars));
  // PC26: Sanitize comment against XSS
  const sanitizedComment = comment ? sanitizeString(comment.slice(0, 500)) : "";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM trips WHERE id = $1 FOR UPDATE", [tripId]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Check ownership
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      await client.query("ROLLBACK");
      return errorResponse(res, 403, "FORBIDDEN", "Only the customer who took this trip can review it", requestId);
    }

    // Must be COMPLETED
    if (trip.status !== "COMPLETED") {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "TRIP_NOT_COMPLETED", "Can only review completed trips", requestId);
    }

    // Check if already reviewed (unique trip_id)
    const existingRev = await client.query("SELECT id FROM reviews WHERE trip_id = $1", [tripId]);
    if (existingRev.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "ALREADY_REVIEWED", "Trip has already been reviewed", requestId);
    }

    const reviewId = crypto.randomUUID();

    await client.query(`
      INSERT INTO reviews (id, trip_id, customer_id, driver_id, stars, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [reviewId, tripId, trip.customer_id, trip.driver_id, numStars, sanitizedComment]);

    await client.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.reviewed', 'trip.events', $1::uuid::text, $2, $3)
    `, [
      tripId,
      JSON.stringify({ tripId, driverId: trip.driver_id, stars: numStars, reviewId }),
      requestId
    ]);

    await client.query("COMMIT");

    return res.status(201).json({
      id: reviewId,
      tripId,
      driverId: trip.driver_id,
      stars: numStars,
      comment: sanitizedComment,
      message: "Review submitted successfully",
      requestId
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return errorResponse(res, 409, "ALREADY_REVIEWED", "Trip has already been reviewed", requestId);
    }
    console.error("[trips/review]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to submit review", requestId);
  } finally {
    client.release();
  }
});

// ==========================================
// Get Trip By ID
// ==========================================
app.get("/trips/:id", requireAuth, async (req, res) => {
  const { sub: userId, role } = req.user;
  const { id: tripId } = req.params;
  const requestId = req.requestId;

  try {
    const { rows } = await pool.query("SELECT * FROM trips WHERE id = $1", [tripId]);
    if (rows.length === 0) {
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      return errorResponse(res, 403, "FORBIDDEN", "Access denied", requestId);
    }
    if (role === "DRIVER" && trip.driver_id !== userId) {
      return errorResponse(res, 403, "FORBIDDEN", "Access denied", requestId);
    }

    // Get review if any
    const revRes = await pool.query("SELECT stars, comment, created_at FROM reviews WHERE trip_id = $1", [tripId]);

    return res.json({
      id: trip.id,
      bookingId: trip.booking_id,
      customerId: trip.customer_id,
      driverId: trip.driver_id,
      vehicleType: trip.vehicle_type,
      pickup: {
        address: trip.pickup_address,
        lat: Number(trip.pickup_lat),
        lng: Number(trip.pickup_lng)
      },
      destination: {
        address: trip.destination_address,
        lat: Number(trip.destination_lat),
        lng: Number(trip.destination_lng)
      },
      distanceKm: Number(trip.distance_km),
      fare: Number(trip.fare),
      currency: trip.currency,
      status: trip.status,
      paymentStatus: trip.payment_status,
      driverSnapshot: trip.driver_snapshot,
      review: revRes.rows[0] || null,
      assignedAt: trip.assigned_at,
      arrivedAt: trip.arrived_at,
      startedAt: trip.started_at,
      completedAt: trip.completed_at,
      canceledAt: trip.canceled_at,
      requestId
    });
  } catch (err) {
    console.error("[trips/get]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get trip", requestId);
  }
});

// Trip Location
app.get("/trips/:id/location", requireAuth, async (req, res) => {
  const { id: tripId } = req.params;
  const requestId = req.requestId;

  try {
    const { rows } = await pool.query("SELECT * FROM trips WHERE id = $1", [tripId]);
    if (rows.length === 0) {
      return errorResponse(res, 404, "NOT_FOUND", "Trip not found", requestId);
    }
    const trip = rows[0];

    // Return pickup coordinates or latest destination coords as simulated progress
    return res.json({
      tripId,
      location: {
        latitude: Number(trip.pickup_lat),
        longitude: Number(trip.pickup_lng)
      },
      status: trip.status,
      updatedAt: trip.updated_at,
      requestId
    });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get location", requestId);
  }
});

// ==========================================
// Start Service
// ==========================================
async function start() {
  try {
    await runMigrations();
    console.log("[trip-service] Migrations applied");
    await seed();
    try {
      await producer.connect();
      startOutboxRelay(pool, producer);
    } catch (error) {
      console.warn(`[trip-service] Kafka relay unavailable: ${error.message}`);
    }
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[trip-service] Startup error:", err.message);
    process.exit(1);
  }
}

start();
