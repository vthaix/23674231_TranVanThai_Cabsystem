// PostgreSQL access for the trip service.

function findTrips(db, params) {
  return db.query("SELECT * FROM trips WHERE booking_id = $1", params);
}

function findFareRules(db, params) {
  return db.query("SELECT * FROM fare_rules WHERE vehicle_type = $1 AND is_active = true LIMIT 1", params);
}

function begin(db) {
  return db.query("BEGIN");
}

function insertTrips(db, params) {
  return db.query(`
      INSERT INTO trips (
        id, booking_id, customer_id, driver_id, vehicle_type,
        pickup_address, pickup_lat, pickup_lng, destination_address, destination_lat, destination_lng,
        distance_km, base_fare, per_km_fare, fare, status, payment_status, driver_snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'ASSIGNED', 'HELD', $16)
    `, params);
}

function insertTripStatusHistory(db, params) {
  return db.query(`
      INSERT INTO trip_status_history (trip_id, to_status, actor_role, request_id)
      VALUES ($1, 'ASSIGNED', 'SYSTEM', $2)
    `, params);
}

function insertOutboxEvents(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.assigned', 'trip.events', $1::uuid::text, $2, $3)
    `, params);
}

function commit(db) {
  return db.query("COMMIT");
}

function rollback(db) {
  return db.query("ROLLBACK");
}

function findTrips2(db, params) {
  return db.query("SELECT * FROM trips WHERE id = $1", params);
}

function updateTrips(db, params) {
  return db.query(`
      UPDATE trips SET
        payment_status = $1,
        payment_id = COALESCE($2, payment_id),
        updated_at = NOW()
      WHERE id = $3
    `, params);
}

function findTrips3(db, params) {
  return db.query("SELECT * FROM trips WHERE id = $1 FOR UPDATE", params);
}

function updateTrips2(db, params) {
  return db.query(`
      UPDATE trips SET
        status = $1,
        arrived_at = $2,
        started_at = $3,
        completed_at = $4,
        updated_at = NOW()
      WHERE id = $5
    `, params);
}

function insertTripStatusHistory2(db, params) {
  return db.query(`
      INSERT INTO trip_status_history (
        trip_id, from_status, to_status, actor_id, actor_role, latitude, longitude, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, params);
}

function insertOutboxEvents2(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, $2, 'trip.events', $1::uuid::text, $3, $4)
    `, params);
}

function updateTrips3(db, params) {
  return db.query(`
      UPDATE trips SET
        status = 'CANCELED',
        cancel_reason = $1,
        canceled_by_id = $2,
        canceled_by_role = $3,
        canceled_at = NOW(),
        updated_at = NOW()
      WHERE id = $4
    `, params);
}

function insertTripStatusHistory3(db, params) {
  return db.query(`
      INSERT INTO trip_status_history (trip_id, from_status, to_status, reason, actor_id, actor_role, request_id)
      VALUES ($1, $2, 'CANCELED', $3, $4, $5, $6)
    `, params);
}

function insertOutboxEvents3(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.canceled', 'trip.events', $1::uuid::text, $2, $3)
    `, params);
}

function findReviews(db, params) {
  return db.query("SELECT id FROM reviews WHERE trip_id = $1", params);
}

function insertReviews(db, params) {
  return db.query(`
      INSERT INTO reviews (id, trip_id, customer_id, driver_id, stars, comment)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, params);
}

function insertOutboxEvents4(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Trip', $1, 'trip.reviewed', 'trip.events', $1::uuid::text, $2, $3)
    `, params);
}

function findReviews2(db, params) {
  return db.query("SELECT stars, comment, created_at FROM reviews WHERE trip_id = $1", params);
}

module.exports = { findTrips, findFareRules, begin, insertTrips, insertTripStatusHistory, insertOutboxEvents, commit, rollback, findTrips2, updateTrips, findTrips3, updateTrips2, insertTripStatusHistory2, insertOutboxEvents2, updateTrips3, insertTripStatusHistory3, insertOutboxEvents3, findReviews, insertReviews, insertOutboxEvents4, findReviews2 };
