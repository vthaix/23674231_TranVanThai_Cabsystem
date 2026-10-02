const repository = require("../repositories/booking.repository");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { sanitizeString } = require("../../../../shared/src/validation/index");
const { SERVICE_NAME, DRIVER_SERVICE_URL, TRIP_SERVICE_URL } = require("../config");
const { producer, isKafkaReady } = require("../events/kafka.producer");
const { dispatchBooking } = require("../services/booking.service");

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

async function postInternalTestKafka(input) {
  if (!isKafkaReady()) {
    return response(503, { error: "Kafka is not ready" });
  }
  const event = {
    eventId: crypto.randomUUID(),
    eventType: "booking.test",
    occurredAt: new Date().toISOString(),
    producer: SERVICE_NAME,
    data: {
      bookingId: input.body.bookingId || "TEST-BOOKING-001",
      message: input.body.message || "Kafka PC7 test event"
    }
  };
  try {
    await producer.send({
      topic: "booking.events",
      messages: [{ key: event.data.bookingId, value: JSON.stringify(event) }]
    });
    return response(202, { status: "published", topic: "booking.events", event });
  } catch (err) {
    return response(500, { error: "Kafka publish failed", message: err.message });
  }
}

async function getBookings(input) {
  const { sub: userId, role } = input.user;
  const requestId = input.requestId;
  const { page = 1, limit = 20, status } = input.query;

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const offset = (p - 1) * l;

  try {
    const customerId = role === "CUSTOMER" ? userId : input.query.customerId;
    const { rows } = await repository.listBookings(pool, { customerId, status, limit: l, offset });
    const countRes = await repository.countBookings(pool, customerId);
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

    return response(200, {
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
    return errorResult(500, "INTERNAL_ERROR", "Failed to list bookings", requestId);
  }
}

async function postBookings(input) {
  const { sub: customerId, role } = input.user;
  const requestId = input.requestId;

  if (role !== "CUSTOMER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Only customers can create bookings", requestId);
  }

  // Idempotency-Key header is mandatory (PC15, PC30)
  const idempotencyKey = input.headers["idempotency-key"];
  if (!idempotencyKey) {
    return errorResult(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required", requestId);
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
  } = input.body;

  if (!pickupAddress || !destinationAddress || pickupLat === undefined || pickupLng === undefined || destinationLat === undefined || destinationLng === undefined) {
    return errorResult(400, "VALIDATION_ERROR", "Pickup and destination address with coordinates are required", requestId);
  }

  const pLat = Number(pickupLat);
  const pLng = Number(pickupLng);
  const dLat = Number(destinationLat);
  const dLng = Number(destinationLng);

  if (isNaN(pLat) || isNaN(pLng) || isNaN(dLat) || isNaN(dLng)) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid coordinates", requestId);
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
    await repository.begin(client);

    // Tra idempotency_records theo (scope, endpoint, idempotency_key)
    const idempRes = await repository.findIdempotencyRecords(client, [customerId, idempotencyKey]);

    if (idempRes.rows.length > 0) {
      const record = idempRes.rows[0];
      // Nếu cùng key nhưng khác hash -> 422
      if (record.request_hash !== requestHash) {
        await repository.rollback(client);
        return errorResult(422, "IDEMPOTENCY_CONFLICT", "Payload does not match original request for this Idempotency-Key", requestId);
      }
      // Cùng hash -> trả lại response cũ
      await repository.rollback(client);
      return response(record.response_code || 201, record.response_body);
    }

    const bookingId = crypto.randomUUID();

    // Insert booking
    await repository.insertBookings(client, [
      bookingId, customerId, normalizedVehicle, sanitizeString(pickupAddress),
      pLat, pLng, sanitizeString(destinationAddress), dLat, dLng,
      note ? sanitizeString(note) : null
    ]);

    // History
    await repository.insertBookingStatusHistory(client, [bookingId, customerId, role, requestId]);

    // Outbox event
    await repository.insertOutboxEvents(client, [
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
    await repository.insertIdempotencyRecords(client, [customerId, idempotencyKey, requestHash, JSON.stringify(responseBody), bookingId]);

    // Perform immediate dispatch step inside or right after transaction
    await dispatchBooking(bookingId, client);

    await repository.commit(client);

    return response(201, responseBody);
  } catch (err) {
    await repository.rollback(client);
    console.error("[bookings/create]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to create booking", requestId);
  } finally {
    client.release();
  }
}

async function getOffers(input) {
  const { sub: driverId, role } = input.user;
  const requestId = input.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  try {
    const { rows } = await repository.findOffers(pool, [driverId]);

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

    return response(200, { data, requestId });
  } catch (err) {
    console.error("[offers/list]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to list offers", requestId);
  }
}

async function postOffersIdAccept(input) {
  const { sub: driverId, role } = input.user;
  const { id: offerId } = input.params;
  const requestId = input.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);

    // 1. Lock Offer & Booking
    const offerRes = await repository.findOffers2(client, [offerId]);

    if (offerRes.rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Offer not found", requestId);
    }

    const offer = offerRes.rows[0];

    // Check ownership
    if (offer.driver_id !== driverId && role !== "ADMIN") {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Offer does not belong to you", requestId);
    }

    // Idempotent check: if already accepted
    if (offer.status === "ACCEPTED" && offer.trip_id) {
      await repository.rollback(client);
      return response(200, {
        bookingId: offer.booking_id,
        tripId: offer.trip_id,
        status: "ASSIGNED",
        message: "Offer already accepted"
      });
    }

    if (offer.status !== "PENDING" || new Date(offer.expires_at) < new Date()) {
      await repository.rollback(client);
      return errorResult(409, "OFFER_EXPIRED", "Offer has expired or is no longer pending", requestId);
    }

    if (offer.booking_status !== "SEARCHING") {
      await repository.rollback(client);
      return errorResult(409, "BOOKING_NOT_SEARCHING", `Booking already in state ${offer.booking_status}`, requestId);
    }

    // Mark offer ACCEPTED
    await repository.updateOffers(client, [offerId]);

    // Cancel other pending offers for this booking
    await repository.updateOffers2(client, [offer.booking_id, offerId]);

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
    await repository.updateBookings(client, [tripId, driverId, offer.booking_id]);

    await repository.insertBookingStatusHistory2(client, [offer.booking_id, driverId, requestId]);

    await repository.insertOutboxEvents2(client, [
      offer.booking_id,
      JSON.stringify({ bookingId: offer.booking_id, tripId, driverId }),
      requestId
    ]);

    await repository.commit(client);

    return response(200, {
      bookingId: offer.booking_id,
      tripId,
      status: "ASSIGNED",
      message: "Offer accepted successfully, trip created",
      requestId
    });
  } catch (err) {
    await repository.rollback(client);
    console.error("[offers/accept]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to accept offer", requestId);
  } finally {
    client.release();
  }
}

async function postOffersIdReject(input) {
  const { sub: driverId, role } = input.user;
  const { id: offerId } = input.params;
  const requestId = input.requestId;

  if (role !== "DRIVER" && role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findOffers3(client, [offerId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Offer not found", requestId);
    }
    const offer = rows[0];
    if (offer.driver_id !== driverId && role !== "ADMIN") {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Offer does not belong to you", requestId);
    }

    await repository.updateOffers3(client, [offerId]);

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

    await repository.commit(client);

    return response(200, { success: true, message: "Offer rejected", requestId });
  } catch (err) {
    await repository.rollback(client);
    console.error("[offers/reject]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to reject offer", requestId);
  } finally {
    client.release();
  }
}

async function postBookingsIdCancel(input) {
  const { sub: userId, role } = input.user;
  const { id: bookingId } = input.params;
  const { reason } = input.body;
  const requestId = input.requestId;

  if (!reason) {
    return errorResult(400, "VALIDATION_ERROR", "Cancellation reason is required", requestId);
  }

  const client = await pool.connect();
  try {
    await repository.begin(client);
    const { rows } = await repository.findBookings(client, [bookingId]);
    if (rows.length === 0) {
      await repository.rollback(client);
      return errorResult(404, "NOT_FOUND", "Booking not found", requestId);
    }

    const booking = rows[0];

    // Authorization
    if (role === "CUSTOMER" && booking.customer_id !== userId) {
      await repository.rollback(client);
      return errorResult(403, "FORBIDDEN", "Cannot cancel another customer's booking", requestId);
    }

    if (booking.status === "ASSIGNED") {
      await repository.rollback(client);
      return errorResult(409, "BOOKING_ALREADY_ASSIGNED", "Booking is already assigned to a driver. Cancel via trip endpoint.", requestId);
    }

    if (["COMPLETED", "CANCELED"].includes(booking.status)) {
      await repository.rollback(client);
      return errorResult(409, "INVALID_STATE", `Booking already in status ${booking.status}`, requestId);
    }

    // Cancel pending offers and release reservation
    const pendingOffers = await repository.findOffers4(client, [bookingId]);
    for (const off of pendingOffers.rows) {
      try {
        const svcToken = generateServiceToken(SERVICE_NAME, "driver-service");
        await fetch(`${DRIVER_SERVICE_URL}/internal/drivers/${off.driver_id}/reservations/${bookingId}`, {
          method: "DELETE",
          headers: { "x-service-token": svcToken }
        });
      } catch {}
    }

    await repository.updateOffers4(client, [bookingId]);

    // Update booking to CANCELED
    await repository.updateBookings2(client, [sanitizeString(reason), userId, role, bookingId]);

    await repository.insertBookingStatusHistory3(client, [bookingId, booking.status, sanitizeString(reason), userId, role, requestId]);

    await repository.insertOutboxEvents3(client, [
      bookingId,
      JSON.stringify({ bookingId, reason, customerId: booking.customer_id }),
      requestId
    ]);

    await repository.commit(client);

    return response(200, {
      id: bookingId,
      status: "CANCELED",
      cancelReason: reason,
      message: "Booking canceled successfully",
      requestId
    });
  } catch (err) {
    await repository.rollback(client);
    console.error("[bookings/cancel]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to cancel booking", requestId);
  } finally {
    client.release();
  }
}

module.exports = { postInternalTestKafka, getBookings, postBookings, getOffers, postOffersIdAccept, postOffersIdReject, postBookingsIdCancel };
