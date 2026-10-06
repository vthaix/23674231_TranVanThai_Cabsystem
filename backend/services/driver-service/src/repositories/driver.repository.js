// PostgreSQL access for the driver service.

function begin(db) {
  return db.query("BEGIN");
}

function insertDrivers(db, params) {
  return db.query(`
      INSERT INTO drivers (
        id, phone_enc, phone_hash,
        full_name, email, license_number_enc, license_class,
        license_expiry_date, status, rating_avg, version
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_APPROVAL', 5.0, 1
      ) ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        status = 'PENDING_APPROVAL'
    `, params);
}

function insertVehicles(db, params) {
  return db.query(`
      INSERT INTO vehicles (
        driver_id, vehicle_type, plate_number, brand, model, color, manufacture_year, seat_count, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, true
      ) ON CONFLICT (plate_number) DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        is_active = true
    `, params);
}

function insertOutboxEvents(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Driver', $1, 'driver.registered', 'driver.events', $1::uuid::text, $2, $3)
    `, params);
}

function commit(db) {
  return db.query("COMMIT");
}

function rollback(db) {
  return db.query("ROLLBACK");
}

function findDrivers(db, params) {
  return db.query(`
      SELECT d.*, v.vehicle_type, v.plate_number, v.brand, v.model, v.color
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = true
      WHERE d.id = $1
    `, params);
}

function findDriverMe(db, id) {
  return db.query(`
    SELECT d.*, v.vehicle_type, v.plate_number, v.brand, v.model, v.color,
           v.manufacture_year, v.seat_count,
           l.latitude, l.longitude, l.heading, l.speed_kmh, l.recorded_at AS location_recorded_at
    FROM drivers d
    LEFT JOIN LATERAL (
      SELECT vehicle_type, plate_number, brand, model, color, manufacture_year, seat_count
      FROM vehicles WHERE driver_id = d.id AND is_active = true
      ORDER BY created_at DESC, id DESC LIMIT 1
    ) v ON true
    LEFT JOIN driver_locations l ON l.driver_id = d.id
    WHERE d.id = $1
  `, [id]);
}

function findDrivers2(db, params) {
  return db.query("SELECT * FROM drivers WHERE id = $1 FOR UPDATE", params);
}

function updateDrivers(db, params) {
  return db.query(`
      UPDATE drivers SET
        status = 'OFFLINE',
        reviewed_by = $1,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $2
    `, params);
}

function insertDriverStatusHistory(db, params) {
  return db.query(`
      INSERT INTO driver_status_history (driver_id, from_status, to_status, changed_by, changed_by_role, reason, request_id)
      VALUES ($1, 'PENDING_APPROVAL', 'OFFLINE', $2, $3, 'Approved by admin', $4)
    `, params);
}

function insertAuditLogs(db, params) {
  return db.query(`
      INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, after_data, request_id)
      VALUES ($1, $2, 'APPROVE_DRIVER', 'Driver', $3, '{"status": "OFFLINE"}', $4)
    `, params);
}

function insertOutboxEvents2(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Driver', $1, 'driver.approved', 'driver.events', $1::uuid::text, $2, $3)
    `, params);
}

function updateDrivers2(db, params) {
  return db.query(`
      UPDATE drivers SET
        status = 'REJECTED',
        rejected_reason = $1,
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, params);
}

function insertDriverStatusHistory2(db, params) {
  return db.query(`
      INSERT INTO driver_status_history (driver_id, from_status, to_status, changed_by, changed_by_role, reason, request_id)
      VALUES ($1, 'PENDING_APPROVAL', 'REJECTED', $2, $3, $4, $5)
    `, params);
}

function insertAuditLogs2(db, params) {
  return db.query(`
      INSERT INTO audit_logs (actor_id, actor_role, action, target_type, target_id, after_data, reason, request_id)
      VALUES ($1, $2, 'REJECT_DRIVER', 'Driver', $3, '{"status": "REJECTED"}', $4, $5)
    `, params);
}

function insertOutboxEvents3(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Driver', $1, 'driver.rejected', 'driver.events', $1::uuid::text, $2, $3)
    `, params);
}

function findDriverLocations(db, params) {
  return db.query("SELECT latitude, longitude FROM driver_locations WHERE driver_id = $1", params);
}

function insertDriverLocations(db, params) {
  return db.query(`
          INSERT INTO driver_locations (driver_id, latitude, longitude, recorded_at, updated_at)
          VALUES ($1, 10.776889, 106.700806, NOW(), NOW())
          ON CONFLICT (driver_id) DO NOTHING
        `, params);
}

function updateDrivers3(db, params) {
  return db.query(`
      UPDATE drivers SET
        status = $1::varchar(20),
        last_online_at = CASE WHEN $1::varchar(20) = 'ONLINE' THEN NOW() ELSE last_online_at END,
        updated_at = NOW()
      WHERE id = $2
    `, params);
}

function insertDriverStatusHistory3(db, params) {
  return db.query(`
      INSERT INTO driver_status_history (driver_id, from_status, to_status, changed_by, changed_by_role, request_id)
      VALUES ($1, $2, $3, $4, 'DRIVER', $5)
    `, params);
}

function insertOutboxEvents4(db, params) {
  return db.query(`
      INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id)
      VALUES ('Driver', $1, $2, 'driver.events', $1::uuid::text, $3, $4)
    `, params);
}

function insertDriverLocations2(db, params) {
  return db.query(`
      INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed_kmh, recorded_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (driver_id) DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        heading = EXCLUDED.heading,
        speed_kmh = EXCLUDED.speed_kmh,
        updated_at = NOW()
    `, params);
}

function updateDrivers4(db, params) {
  return db.query(`
      UPDATE drivers SET
        status = 'BUSY',
        current_trip_id = $1,
        updated_at = NOW()
      WHERE id = $2
    `, params);
}

function insertDriverStatusHistory4(db, params) {
  return db.query(`
      INSERT INTO driver_status_history (driver_id, to_status, trip_id, request_id)
      VALUES ($1, 'BUSY', $2, $3)
    `, params);
}

function findDrivers3(db, params) {
  return db.query(`
      SELECT d.id, d.full_name, d.avatar_url, d.rating_avg, d.completed_trips,
             v.vehicle_type, v.plate_number, v.brand, v.model, v.color
      FROM drivers d
      LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = true
      WHERE d.id = $1
    `, params);
}

function listAdminDrivers(db, { status, limit, offset }) {
  let query = `
    SELECT d.*, v.vehicle_type, v.plate_number, v.brand, v.model, v.color
    FROM drivers d
    LEFT JOIN LATERAL (
      SELECT vehicle_type, plate_number, brand, model, color
      FROM vehicles
      WHERE driver_id = d.id AND is_active = true
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) v ON true
  `;
  const params = [];
  if (status) {
    params.push(status);
    query += ` WHERE d.status = $${params.length}`;
  }
  query += ` ORDER BY d.created_at DESC, d.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  return db.query(query, params);
}

function countAdminDrivers(db, status) {
  const query = status
    ? "SELECT COUNT(*) FROM drivers WHERE status = $1"
    : "SELECT COUNT(*) FROM drivers";
  return db.query(query, status ? [status] : []);
}

function listNearbyDrivers(db, { status, vehicleType }) {
  let query = `
    SELECT d.id, d.full_name, d.status, d.rating_avg, d.completed_trips,
           l.latitude, l.longitude,
           v.vehicle_type, v.plate_number, v.brand, v.model, v.color
    FROM drivers d
    JOIN driver_locations l ON d.id = l.driver_id
    LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = true
    WHERE d.status = $1
  `;
  const params = [status];
  if (vehicleType) {
    params.push(vehicleType.toUpperCase());
    query += ` AND v.vehicle_type = $${params.length}`;
  }
  return db.query(query, params);
}

function listDispatchCandidates(db, vehicleType) {
  let query = `
    SELECT d.id, d.full_name, d.status, d.rating_avg,
           l.latitude, l.longitude,
           v.vehicle_type, v.plate_number, v.brand, v.model, v.color
    FROM drivers d
    JOIN driver_locations l ON d.id = l.driver_id
    LEFT JOIN vehicles v ON d.id = v.driver_id AND v.is_active = true
    WHERE d.status = 'ONLINE'
  `;
  const params = [];
  if (vehicleType) {
    params.push(vehicleType.toUpperCase());
    query += ` AND v.vehicle_type = $${params.length}`;
  }
  return db.query(query, params);
}

module.exports = { begin, insertDrivers, insertVehicles, insertOutboxEvents, commit, rollback, findDrivers, findDriverMe, findDrivers2, updateDrivers, insertDriverStatusHistory, insertAuditLogs, insertOutboxEvents2, updateDrivers2, insertDriverStatusHistory2, insertAuditLogs2, insertOutboxEvents3, findDriverLocations, insertDriverLocations, updateDrivers3, insertDriverStatusHistory3, insertOutboxEvents4, insertDriverLocations2, updateDrivers4, insertDriverStatusHistory4, findDrivers3, listAdminDrivers, countAdminDrivers, listNearbyDrivers, listDispatchCandidates };
