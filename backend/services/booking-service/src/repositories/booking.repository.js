// PostgreSQL access for the booking service.

function begin(db) {
  return db.query("BEGIN");
}

function findIdempotencyRecords(db, params) {
  return db.query(`
      SELECT * FROM idempotency_records
      WHERE scope = $1 AND endpoint = 'POST /bookings' AND idempotency_key = $2
      FOR UPDATE
    `, params);
}

function rollback(db) {
  return db.query("ROLLBACK");
}

function insertBookings(db, params) {
  return db.query(`
      INSERT INTO bookings (
        id, customer_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
        destination_address, destination_lat, destination_lng, note, status,
        next_dispatch_at, attempt_count, search_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'SEARCHING', NOW(), 0,
        NOW() + $11::int * INTERVAL '1 second')
    `, params);
}

function insertBookingStatusHistory(db, params) {
  return db.query(`
      INSERT INTO booking_status_history (booking_id, to_status, actor_id, actor_role, request_id)
      VALUES ($1, 'SEARCHING', $2, $3, $4)
    `, params);
}

function insertOutboxEvents(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.created', 'booking.events', $1::uuid::text, $2, $3)
    `, params);
}

function insertIdempotencyRecords(db, params) {
  return db.query(`
      INSERT INTO idempotency_records (
        scope, endpoint, idempotency_key, request_hash, status, response_code, response_body, resource_id
      ) VALUES ($1, 'POST /bookings', $2, $3, 'COMPLETED', 201, $4, $5)
    `, params);
}

function commit(db) {
  return db.query("COMMIT");
}

function findOffers(db, params) {
  return db.query(`
      SELECT o.*, b.pickup_address, b.pickup_lat, b.pickup_lng,
             b.destination_address, b.destination_lat, b.destination_lng,
             b.vehicle_type, b.note
      FROM offers o
      JOIN bookings b ON o.booking_id = b.id
      WHERE o.driver_id = $1 AND o.status = 'PENDING' AND o.expires_at > NOW()
        AND b.status = 'SEARCHING' AND b.search_expires_at > NOW()
      ORDER BY o.created_at DESC
    `, params);
}

function findOffers2(db, params) {
  return db.query(`
      SELECT o.*, b.customer_id, b.vehicle_type, b.pickup_address, b.pickup_lat, b.pickup_lng,
             b.destination_address, b.destination_lat, b.destination_lng, b.status as booking_status,
             b.trip_id, b.search_expires_at, b.fare
      FROM offers o
      JOIN bookings b ON o.booking_id = b.id
      WHERE o.id = $1 FOR UPDATE OF o, b
    `, params);
}

function findOfferByBookingAndDriver(db, params) {
  return db.query(
    "SELECT id FROM offers WHERE booking_id = $1 AND driver_id = $2",
    params
  );
}

function updateOffers(db, params) {
  return db.query(`
      UPDATE offers SET
        status = 'ACCEPTED',
        responded_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, params);
}

function updateOffers2(db, params) {
  return db.query(`
      UPDATE offers SET status = 'CANCELED', updated_at = NOW()
      WHERE booking_id = $1 AND id <> $2 AND status = 'PENDING'
    `, params);
}

function updateBookings(db, params) {
  return db.query(`
      UPDATE bookings SET
        status = 'ASSIGNED',
        trip_id = $1,
        current_driver_id = $2,
        assigned_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, params);
}

function insertBookingStatusHistory2(db, params) {
  return db.query(`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, actor_id, actor_role, request_id)
      VALUES ($1, 'SEARCHING', 'ASSIGNED', $2, 'DRIVER', $3)
    `, params);
}

function insertOutboxEvents2(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.assigned', 'booking.events', $1::uuid::text, $2, $3)
    `, params);
}

function findOffers3(db, params) {
  return db.query("SELECT * FROM offers WHERE id = $1 FOR UPDATE", params);
}

function updateOffers3(db, params) {
  return db.query(`
      UPDATE offers SET status = 'REJECTED', responded_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, params);
}

function findBookings(db, params) {
  return db.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", params);
}

function findOffers4(db, params) {
  return db.query("SELECT * FROM offers WHERE booking_id = $1 AND status = 'PENDING'", params);
}

function updateOffers4(db, params) {
  return db.query("UPDATE offers SET status = 'CANCELED', updated_at = NOW() WHERE booking_id = $1 AND status = 'PENDING'", params);
}

function updateBookings2(db, params) {
  return db.query(`
      UPDATE bookings SET
        status = 'CANCELED',
        cancel_reason = $1,
        canceled_by_id = $2,
        canceled_by_role = $3,
        canceled_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
    `, params);
}

function insertBookingStatusHistory3(db, params) {
  return db.query(`
      INSERT INTO booking_status_history (booking_id, from_status, to_status, reason, actor_id, actor_role, request_id)
      VALUES ($1, $2, 'CANCELED', $3, $4, $5, $6)
    `, params);
}

function insertOutboxEvents3(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Booking', $1, 'booking.canceled', 'booking.events', $1::uuid::text, $2, $3)
    `, params);
}

function findOffers5(db, params) {
  return db.query("SELECT driver_id FROM offers WHERE booking_id = $1", params);
}

function updateBookings3(db, params) {
  return db.query("UPDATE bookings SET status = 'NO_DRIVER_FOUND', updated_at = NOW() WHERE id = $1", params);
}

function insertOffers(db, params) {
  return db.query(`
      INSERT INTO offers (
        booking_id, driver_id, attempt_no, status,
        distance_to_pickup_m, eta_seconds, expires_at
      ) VALUES ($1, $2, $3, 'PENDING', $4, $5, $6)
    `, params);
}

function updateBookings4(db, params) {
  return db.query(`
      UPDATE bookings SET
        attempt_count = $1,
        next_dispatch_at = $2,
        updated_at = NOW()
      WHERE id = $3
    `, params);
}

function listBookings(db, { customerId, status, limit, offset }) {
  let query = "SELECT * FROM bookings";
  const params = [];
  if (customerId) {
    params.push(customerId);
    query += ` WHERE customer_id = $${params.length}`;
  }
  if (status) {
    const clause = params.length > 0 ? "AND" : "WHERE";
    params.push(status);
    query += ` ${clause} status = $${params.length}`;
  }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  return db.query(query, params);
}

function countBookings(db, customerId) {
  let query = "SELECT COUNT(*) FROM bookings";
  const params = [];
  if (customerId) {
    params.push(customerId);
    query += " WHERE customer_id = $1";
  }
  return db.query(query, params);
}

module.exports = { begin, findIdempotencyRecords, rollback, insertBookings, insertBookingStatusHistory, insertOutboxEvents, insertIdempotencyRecords, commit, findOffers, findOffers2, findOfferByBookingAndDriver, updateOffers, updateOffers2, updateBookings, insertBookingStatusHistory2, insertOutboxEvents2, findOffers3, updateOffers3, findBookings, findOffers4, updateOffers4, updateBookings2, insertBookingStatusHistory3, insertOutboxEvents3, findOffers5, updateBookings3, insertOffers, updateBookings4, listBookings, countBookings };
