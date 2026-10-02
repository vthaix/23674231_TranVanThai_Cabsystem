const repository = require("../repositories/trip.repository");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { sanitizeString } = require("../../../../shared/src/validation/index");
const { SERVICE_NAME, DRIVER_SERVICE_URL } = require("../config");
const { haversineDistanceKm, STATUS_TRANSITIONS } = require("../services/trip.service");

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

async function postInternalTrips(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
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
  } = input.body;

  if (!bookingId || !customerId || !driverId) {
    return errorResult(400, "VALIDATION_ERROR", "bookingId, customerId, driverId required", requestId);
  }

  const client = await pool.connect();
  try {
    // Idempotency: check if trip for this booking already exists
    const existing = await repository.findTrips(client, [bookingId]);
    if (existing.rows.length > 0) {
      return response(200, existing.rows[0]);
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
    const fareRuleRes = await repository.findFareRules(client, [normalizedVehicle]);

    const baseFare = fareRuleRes.rows.length > 0 ? Number(fareRuleRes.rows[0].base_fare) : 15000;
    const perKm = fareRuleRes.rows.length > 0 ? Number(fareRuleRes.rows[0].per_km) : 5000;
    const fare = Math.round(baseFare + perKm * distKm);

    const tripId = crypto.randomUUID();

    await repository.begin(client);
    await repository.insertTrips(client, [
      tripId, bookingId, customerId, driverId, normalizedVehicle,
      pickupAddress, pickupLat, pickupLng, destinationAddress, destinationLat, destinationLng,
      distKm, baseFare, perKm, fare, JSON.stringify(driverSnapshot)
    ]);

    await repository.insertTripStatusHistory(client, [tripId, requestId]);

    await repository.insertOutboxEvents(client, [
      tripId,
      JSON.stringify({ tripId, bookingId, customerId, driverId, fare }),
      requestId
    ]);

    await repository.commit(client);

    return response(201, {
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
    await repository.rollback(client);
    console.error("[trips/create]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to create trip", requestId);
  } finally {
    client.release();
  }
}

async function getInternalTripsId(input) {
  const { id } = input.params;
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  try {
    const { rows } = await repository.findTrips2(pool, [id]);
    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }
    const t = rows[0];
    return response(200, {
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
    return errorResult(500, "INTERNAL_ERROR", "Failed to get trip", requestId);
  }
}

async function postInternalTripsIdPaymentStatus(input) {
  const { id } = input.params;
  const { paymentId, status = "PAID" } = input.body;
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  try {
    await repository.updateTrips(pool, [status, paymentId || null, id]);

    return response(200, { id, paymentStatus: status });
  } catch (err) {
    return errorResult(500, "INTERNAL_ERROR", "Failed to update payment status", requestId);
  }
}

async function patchTripsIdStatus(input) {
  const { sub: userId, role } = input.user;
  const { id: tripId } = input.params;
  const { status: targetStatus, latitude, longitude } = input.body;
  const requestId = input.requestId;

  if (!targetStatus) {
    return errorResult(400, "VALIDATION_ERROR", "status is required", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findTrips3(client, [tripId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization: only assigned driver or admin can update status
    if (role === "DRIVER" && trip.driver_id !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Only assigned driver can update trip status", requestId);
    }

    // Validate state transition (PC17)
    const allowedNext = STATUS_TRANSITIONS[trip.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      await repository.rollback(client);
      return errorResult(409, "INVALID_STATE_TRANSITION", `Cannot transition from ${trip.status} to ${targetStatus}`, requestId);
    }

    // Set timestamps
    const now = new Date();
    let arrivedAt = trip.arrived_at;
    let startedAt = trip.started_at;
    let completedAt = trip.completed_at;

    if (targetStatus === "ARRIVED") arrivedAt = now;
    if (targetStatus === "IN_PROGRESS") startedAt = now;
    if (targetStatus === "COMPLETED") completedAt = now;

    await repository.updateTrips2(client, [targetStatus, arrivedAt, startedAt, completedAt, tripId]);

    // Record history
    await repository.insertTripStatusHistory2(client, [
      tripId, trip.status, targetStatus, userId, role,
      latitude ? Number(latitude) : null,
      longitude ? Number(longitude) : null,
      requestId
    ]);

    // Outbox event
    const eventType = `trip.${targetStatus.toLowerCase()}`;
    await repository.insertOutboxEvents2(client, [
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

    await repository.commit(client);

    return response(200, {
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
    await repository.rollback(client);
    console.error("[trips/update-status]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to update trip status", requestId);
  } finally {
    client.release();
  }
}

async function postTripsIdCancel(input) {
  const { sub: userId, role } = input.user;
  const { id: tripId } = input.params;
  const { reason } = input.body;
  const requestId = input.requestId;

  if (!reason) {
    return errorResult(400, "VALIDATION_ERROR", "Cancellation reason is required", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findTrips3(client, [tripId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization: customer, assigned driver, or admin
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Cannot cancel another customer's trip", requestId);
    }
    if (role === "DRIVER" && trip.driver_id !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Cannot cancel another driver's trip", requestId);
    }

    // Cancellation is only allowed before IN_PROGRESS
    if (["IN_PROGRESS", "COMPLETED", "CANCELED"].includes(trip.status)) {
      await repository.rollback(client);
      return errorResult(409, "CANNOT_CANCEL", `Trip cannot be canceled in status ${trip.status}`, requestId);
    }

    await repository.updateTrips3(client, [sanitizeString(reason), userId, role, tripId]);

    await repository.insertTripStatusHistory3(client, [tripId, trip.status, sanitizeString(reason), userId, role, requestId]);

    await repository.insertOutboxEvents3(client, [
      tripId,
      JSON.stringify({ tripId, reason, canceledBy: userId, customerId: trip.customer_id, driverId: trip.driver_id }),
      requestId
    ]);

    await repository.commit(client);

    return response(200, {
      id: tripId,
      status: "CANCELED",
      cancelReason: reason,
      message: "Trip canceled successfully",
      requestId
    });
  } catch (err) {
    await repository.rollback(client);
    console.error("[trips/cancel]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to cancel trip", requestId);
  } finally {
    client.release();
  }
}

async function postTripsIdReviews(input) {
  const { sub: userId, role } = input.user;
  const { id: tripId } = input.params;
  const { stars, comment } = input.body;
  const requestId = input.requestId;

  if (stars === undefined || isNaN(Number(stars)) || Number(stars) < 1 || Number(stars) > 5) {
    return errorResult(400, "VALIDATION_ERROR", "stars must be an integer between 1 and 5", requestId);
  }

  const numStars = Math.round(Number(stars));
  // PC26: Sanitize comment against XSS
  const sanitizedComment = comment ? sanitizeString(comment.slice(0, 500)) : "";

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findTrips3(client, [tripId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Check ownership
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Only the customer who took this trip can review it", requestId);
    }

    // Must be COMPLETED
    if (trip.status !== "COMPLETED") {
      await repository.rollback(client);
      return errorResult(409, "TRIP_NOT_COMPLETED", "Can only review completed trips", requestId);
    }

    // Check if already reviewed (unique trip_id)
    const existingRev = await repository.findReviews(client, [tripId]);
    if (existingRev.rows.length > 0) {
      await repository.rollback(client);
      return errorResult(409, "ALREADY_REVIEWED", "Trip has already been reviewed", requestId);
    }

    const reviewId = crypto.randomUUID();

    await repository.insertReviews(client, [reviewId, tripId, trip.customer_id, trip.driver_id, numStars, sanitizedComment]);

    await repository.insertOutboxEvents4(client, [
      tripId,
      JSON.stringify({ tripId, driverId: trip.driver_id, stars: numStars, reviewId }),
      requestId
    ]);

    await repository.commit(client);

    return response(201, {
      id: reviewId,
      tripId,
      driverId: trip.driver_id,
      stars: numStars,
      comment: sanitizedComment,
      message: "Review submitted successfully",
      requestId
    });
  } catch (err) {
    await repository.rollback(client);
    if (err.code === "23505") {
      return errorResult(409, "ALREADY_REVIEWED", "Trip has already been reviewed", requestId);
    }
    console.error("[trips/review]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to submit review", requestId);
  } finally {
    client.release();
  }
}

async function getTripsId(input) {
  const { sub: userId, role } = input.user;
  const { id: tripId } = input.params;
  const requestId = input.requestId;

  try {
    const { rows } = await repository.findTrips2(pool, [tripId]);
    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }

    const trip = rows[0];

    // Authorization
    if (role === "CUSTOMER" && trip.customer_id !== userId) {
      return errorResult(403, "FORBIDDEN", "Access denied", requestId);
    }
    if (role === "DRIVER" && trip.driver_id !== userId) {
      return errorResult(403, "FORBIDDEN", "Access denied", requestId);
    }

    // Get review if any
    const revRes = await repository.findReviews2(pool, [tripId]);

    return response(200, {
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
    return errorResult(500, "INTERNAL_ERROR", "Failed to get trip", requestId);
  }
}

async function getTripsIdLocation(input) {
  const { id: tripId } = input.params;
  const requestId = input.requestId;

  try {
    const { rows } = await repository.findTrips2(pool, [tripId]);
    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "Trip not found", requestId);
    }
    const trip = rows[0];

    // Return pickup coordinates or latest destination coords as simulated progress
    return response(200, {
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
    return errorResult(500, "INTERNAL_ERROR", "Failed to get location", requestId);
  }
}

module.exports = { postInternalTrips, getInternalTripsId, postInternalTripsIdPaymentStatus, patchTripsIdStatus, postTripsIdCancel, postTripsIdReviews, getTripsId, getTripsIdLocation };
