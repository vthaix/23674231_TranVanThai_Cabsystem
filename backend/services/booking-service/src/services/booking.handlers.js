const repository = require("../repositories/booking.repository");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { escapeHTML } = require("../../../../shared/src/validation/index");
const { SERVICE_NAME, DRIVER_SERVICE_URL, TRIP_SERVICE_URL } = require("../config");
const { producer, isKafkaReady } = require("../events/kafka.producer");
const { dispatchBooking } = require("../services/booking.service");
const { expireCustomerSearches, releaseReservations } = require("../services/booking-expiry");
const { OFFER_TTL_SEC } = require('../config');
const escrowClient = require('./escrow.client');
const { calculateFare } = require('../../../../shared/src/fare');

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

function bookingView(r) {
  const fare = r.fare == null
    ? calculateFare(Number(r.pickup_lat), Number(r.pickup_lng),
      Number(r.destination_lat), Number(r.destination_lng)).amount
    : Number(r.fare);
  return {
    id: r.id,
    customerId: r.customer_id,
    vehicleType: r.vehicle_type,
    paymentMethod: r.payment_method,
    pickup: { address: r.pickup_address, lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) },
    destination: { address: r.destination_address, lat: Number(r.destination_lat), lng: Number(r.destination_lng) },
    fare,
    currency: 'VND',
    paymentStatus: r.payment_status,
    status: r.status,
    searchExpiresAt: r.search_expires_at,
    currentDriverId: r.current_driver_id,
    tripId: r.trip_id,
    cancelReason: r.cancel_reason,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    canceledAt: r.canceled_at
  };
}

async function syncTerminalPayment(client, booking, bookingId, tripId, status) {
  if (booking.payment_method === 'CASH') {
    if (status === 'COMPLETED' && booking.payment_status !== 'PAID') {
      await escrowClient.syncTripPayment(tripId, 'PAID');
      await client.query("UPDATE bookings SET payment_status='PAID' WHERE id=$1", [bookingId]);
    }
    return;
  }
  if (booking.payment_status !== 'HELD') return;
  if (status === 'COMPLETED') await escrowClient.settle(bookingId, tripId, booking.current_driver_id);
  else await escrowClient.refund(bookingId);
  await escrowClient.syncTripPayment(tripId, status === 'COMPLETED' ? 'PAID' : 'REFUNDED');
  await client.query('UPDATE bookings SET payment_status=$2 WHERE id=$1',
    [bookingId, status === 'COMPLETED' ? 'PAID' : 'REFUNDED']);
}

async function postInternalBookingsIdTripStatus(input) {
  const { id } = input.params;
  const { tripId, status, reason } = input.body;
  const requestId = input.requestId || crypto.randomUUID();
  if (!['COMPLETED', 'CANCELED'].includes(status) || !tripId) {
    return errorResult(400, 'VALIDATION_ERROR', 'tripId and terminal trip status required', requestId);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await repository.findBookings(client, [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return errorResult(404, 'NOT_FOUND', 'Booking not found', requestId);
    }
    const booking = rows[0];
    if (booking.trip_id !== tripId) {
      await client.query('ROLLBACK');
      return errorResult(409, 'TRIP_MISMATCH', 'Trip does not belong to booking', requestId);
    }
    if (booking.status === status) {
      await client.query('ROLLBACK');
      await syncTerminalPayment(client, booking, id, tripId, status);
      return response(200, { id, status, requestId });
    }
    if (booking.status !== 'ASSIGNED') {
      await client.query('ROLLBACK');
      return errorResult(409, 'INVALID_STATE', `Booking is ${booking.status}`, requestId);
    }
    if (status === 'COMPLETED') {
      await client.query(`UPDATE bookings SET status='COMPLETED',completed_at=NOW(),
        updated_at=NOW() WHERE id=$1`, [id]);
    } else {
      await client.query(`UPDATE bookings SET status='CANCELED',canceled_at=NOW(),
        cancel_reason=LEFT($1,40),updated_at=NOW() WHERE id=$2`,
        [reason || 'TRIP_CANCELED', id]);
    }
    await client.query(`INSERT INTO booking_status_history(booking_id,from_status,to_status,reason,request_id)
      VALUES($1,'ASSIGNED',$2,$3,$4)`, [id, status, reason || null, requestId]);
    await client.query('COMMIT');
    await syncTerminalPayment(client, booking, id, tripId, status);
    return response(200, { id, status, requestId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[booking/trip-status]', error.message);
    return errorResult(500, 'INTERNAL_ERROR', 'Failed to sync booking status', requestId);
  } finally { client.release(); }
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
      message: escapeHTML(input.body.message || "Kafka PC7 test event")
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
  if (!['CUSTOMER', 'ADMIN'].includes(role)) {
    return errorResult(403, 'FORBIDDEN', 'Access denied', requestId);
  }
  const { page = 1, limit = 20, status } = input.query;

  const p = Math.max(1, Number(page));
  const l = Math.min(50, Math.max(1, Number(limit)));
  const offset = (p - 1) * l;

  try {
    const customerId = role === "CUSTOMER" ? userId : input.query.customerId;
    const { rows } = await repository.listBookings(pool, { customerId, status, limit: l, offset });
    const countRes = await repository.countBookings(pool, customerId);
    const total = Number(countRes.rows[0].count);

    const data = rows.map(bookingView);

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

async function getBookingsId(input) {
  const { id } = input.params;
  const { sub: userId, role } = input.user;
  const requestId = input.requestId;
  try {
    const { rows } = await pool.query('SELECT * FROM bookings WHERE id=$1', [id]);
    if (!rows.length) return errorResult(404, 'NOT_FOUND', 'Booking not found', requestId);
    if (role === 'CUSTOMER' && rows[0].customer_id !== userId) {
      return errorResult(403, 'FORBIDDEN', 'Access denied', requestId);
    }
    if (!['CUSTOMER', 'ADMIN'].includes(role)) {
      return errorResult(403, 'FORBIDDEN', 'Access denied', requestId);
    }
    return response(200, { ...bookingView(rows[0]), requestId });
  } catch (error) {
    if (error.code === '22P02') return errorResult(400, 'VALIDATION_ERROR', 'Invalid booking ID', requestId);
    console.error('[bookings/get]', error.message);
    return errorResult(500, 'INTERNAL_ERROR', 'Failed to get booking', requestId);
  }
}

async function postBookings(input) {
  const { sub: customerId, role } = input.user;
  const requestId = input.requestId;

  if (role !== "CUSTOMER") {
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
    paymentMethod = "BANK",
    note
  } = input.body;

  if (typeof pickupAddress !== "string" || !pickupAddress.trim() ||
      typeof destinationAddress !== "string" || !destinationAddress.trim() ||
      pickupLat === undefined || pickupLng === undefined || destinationLat === undefined || destinationLng === undefined) {
    return errorResult(400, "VALIDATION_ERROR", "Pickup and destination address with coordinates are required", requestId);
  }
  if (note != null && typeof note !== "string") {
    return errorResult(400, "VALIDATION_ERROR", "note must be a string", requestId);
  }
  if (typeof vehicleType !== "string") {
    return errorResult(400, "VALIDATION_ERROR", "vehicleType must be a string", requestId);
  }

  const pLat = Number(pickupLat);
  const pLng = Number(pickupLng);
  const dLat = Number(destinationLat);
  const dLng = Number(destinationLng);

  if (![pLat, pLng, dLat, dLng].every(Number.isFinite) ||
      Math.abs(pLat) > 90 || Math.abs(dLat) > 90 || Math.abs(pLng) > 180 || Math.abs(dLng) > 180) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid coordinates", requestId);
  }

  if (!['CASH', 'BANK'].includes(paymentMethod)) {
    return errorResult(400, 'VALIDATION_ERROR', 'paymentMethod must be CASH or BANK', requestId);
  }
  const safePickupAddress = escapeHTML(pickupAddress);
  const safeDestinationAddress = escapeHTML(destinationAddress);
  const safeNote = note ? escapeHTML(note) : null;

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
    vehicleType: normalizedVehicle,
    paymentMethod
  };
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(payloadToHash)).digest("hex");

  const client = await pool.connect();
  let heldBookingId = null;
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

    const releases = await expireCustomerSearches(client, customerId);
    await releaseReservations(releases);
    const active = await client.query(`SELECT id,status FROM bookings
      WHERE customer_id=$1 AND status IN ('SEARCHING','ASSIGNED') LIMIT 1`, [customerId]);
    if (active.rows.length) {
      await repository.rollback(client);
      return errorResult(409, 'ACTIVE_BOOKING_EXISTS',
        `Customer already has an active booking (${active.rows[0].status})`, requestId);
    }

    const digest = crypto.createHash('sha256').update(`${customerId}:${idempotencyKey}`).digest('hex');
    const bookingId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const fare = calculateFare(pLat, pLng, dLat, dLng).amount;
    if (paymentMethod === 'BANK') {
      heldBookingId = bookingId;
      await escrowClient.hold(bookingId, customerId, fare);
    }

    // Insert booking
    await repository.insertBookings(client, [
      bookingId, customerId, normalizedVehicle, safePickupAddress,
      pLat, pLng, safeDestinationAddress, dLat, dLng,
      safeNote, paymentMethod, OFFER_TTL_SEC
    ]);
    await client.query("UPDATE bookings SET fare=$2,payment_status=$3 WHERE id=$1",
      [bookingId, fare, paymentMethod === 'BANK' ? 'HELD' : 'UNPAID']);

    // History
    await repository.insertBookingStatusHistory(client, [bookingId, customerId, role, requestId]);

    // Outbox event
    await repository.insertOutboxEvents(client, [
      bookingId,
      JSON.stringify({ bookingId, customerId, vehicleType: normalizedVehicle, paymentMethod }),
      requestId
    ]);

    const responseBody = {
      id: bookingId,
      customerId,
      vehicleType: normalizedVehicle,
      paymentMethod,
      pickup: { address: safePickupAddress, lat: pLat, lng: pLng },
      destination: { address: safeDestinationAddress, lat: dLat, lng: dLng },
      status: "SEARCHING",
      fare,
      currency: 'VND',
      paymentStatus: paymentMethod === 'BANK' ? 'HELD' : 'UNPAID',
      searchExpiresAt: new Date(Date.now() + OFFER_TTL_SEC * 1000).toISOString(),
      message: "Booking created, searching for nearby driver",
      createdAt: new Date().toISOString(),
      requestId
    };

    // Store in idempotency_records
    await repository.insertIdempotencyRecords(client, [customerId, idempotencyKey, requestHash, JSON.stringify(responseBody), bookingId]);

    // Perform immediate dispatch step inside or right after transaction
    await dispatchBooking(bookingId, client);

    await repository.commit(client);
    heldBookingId = null;

    return response(201, responseBody);
  } catch (err) {
    await repository.rollback(client);
    if (heldBookingId) await escrowClient.refund(heldBookingId).catch(error => console.error('[booking/refund]', error.message));
    if (err.status === 409) return errorResult(409, err.message, 'Insufficient balance or escrow conflict', requestId);
    if (err.code === '23505' && err.constraint === 'bookings_one_active_per_customer') {
      return errorResult(409, 'ACTIVE_BOOKING_EXISTS', 'Customer already has an active booking', requestId);
    }
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

    if (offer.status !== "PENDING" || new Date(offer.expires_at) < new Date() ||
        new Date(offer.search_expires_at) <= new Date()) {
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
          paymentMethod: offer.payment_method,
          pickupAddress: offer.pickup_address,
          pickupLat: Number(offer.pickup_lat),
          pickupLng: Number(offer.pickup_lng),
          destinationAddress: offer.destination_address,
          destinationLat: Number(offer.destination_lat),
          destinationLng: Number(offer.destination_lng),
          fare: Number(offer.fare)
        })
      });

      if (tripResp.ok) {
        const tripData = await tripResp.json();
        tripId = tripData.id;
      } else {
        throw new Error(`Trip service returned ${tripResp.status}: ${await tripResp.text()}`);
      }
    } catch (e) {
      throw e;
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

async function postBookingsIdAccept(input) {
  const { sub: driverId, role } = input.user;
  const { id: bookingId } = input.params;
  const requestId = input.requestId;

  if (role !== "DRIVER") {
    return errorResult(403, "FORBIDDEN", "Driver access required", requestId);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return errorResult(400, "VALIDATION_ERROR", "Invalid booking id", requestId);
  }

  try {
    const { rows } = await repository.findOfferByBookingAndDriver(pool, [bookingId, driverId]);
    if (rows.length === 0) {
      return errorResult(404, "NOT_FOUND", "No offer for this booking and driver", requestId);
    }
    return postOffersIdAccept({ ...input, params: { id: rows[0].id } });
  } catch (err) {
    console.error("[bookings/accept]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to accept booking", requestId);
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

  if (typeof reason !== "string" || !reason.trim()) {
    return errorResult(400, "VALIDATION_ERROR", "Cancellation reason is required", requestId);
  }
  const safeReason = escapeHTML(reason);
  if (role !== 'CUSTOMER' && role !== 'ADMIN') {
    return errorResult(403, 'FORBIDDEN', 'Customer or admin access required', requestId);
  }

  // A real ASSIGNED booking owns a trip. Let Trip Service cancel it first;
  // its terminal-status callback updates the booking before this endpoint returns.
  const snapshot = await pool.query('SELECT * FROM bookings WHERE id=$1', [bookingId]);
  if (snapshot.rows.length && snapshot.rows[0].status === 'ASSIGNED' && snapshot.rows[0].trip_id) {
    const booking = snapshot.rows[0];
    if (role === 'CUSTOMER' && booking.customer_id !== userId) {
      return errorResult(403, 'FORBIDDEN', "Cannot cancel another customer's booking", requestId);
    }
    try {
      const tripResponse = await fetch(`${TRIP_SERVICE_URL}/trips/${booking.trip_id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: input.headers.authorization,
          'x-request-id': requestId },
        body: JSON.stringify({ reason }),
        signal: AbortSignal.timeout(5000),
      });
      const tripBody = await tripResponse.json();
      if (!tripResponse.ok) return response(tripResponse.status, tripBody);
      const synced = await postInternalBookingsIdTripStatus({
        params: { id: bookingId }, body: { tripId: booking.trip_id, status: 'CANCELED', reason: safeReason }, requestId
      });
      if (synced.status !== 200) return synced;
      return response(200, { id: bookingId, status: 'CANCELED', tripId: booking.trip_id,
        cancelReason: safeReason, requestId });
    } catch (error) {
      console.error('[bookings/cancel-trip]', error.message);
      return errorResult(503, 'DEPENDENCY_ERROR', 'Failed to cancel assigned trip', requestId);
    }
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

    if (booking.status === "ASSIGNED" && booking.trip_id) {
      await repository.rollback(client);
      return errorResult(409, "BOOKING_ALREADY_ASSIGNED", "Booking is already assigned to a driver. Cancel via trip endpoint.", requestId);
    }

    if (["COMPLETED", "CANCELED", "EXPIRED"].includes(booking.status)) {
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
    await repository.updateBookings2(client, [safeReason, userId, role, bookingId]);

    await repository.insertBookingStatusHistory3(client, [bookingId, booking.status, safeReason, userId, role, requestId]);

    await repository.insertOutboxEvents3(client, [
      bookingId,
      JSON.stringify({ bookingId, reason: safeReason, customerId: booking.customer_id }),
      requestId
    ]);

    await repository.commit(client);
    let paymentStatus = booking.payment_status;
    if (paymentStatus === 'HELD') {
      await escrowClient.refund(bookingId);
      await pool.query("UPDATE bookings SET payment_status='REFUNDED' WHERE id=$1", [bookingId]);
      paymentStatus = 'REFUNDED';
    }

    return response(200, {
      id: bookingId,
      status: "CANCELED",
      paymentStatus,
      cancelReason: safeReason,
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

module.exports = { postInternalTestKafka, postInternalBookingsIdTripStatus, getBookings, getBookingsId, postBookings, getOffers, postBookingsIdAccept, postOffersIdAccept, postOffersIdReject, postBookingsIdCancel };
