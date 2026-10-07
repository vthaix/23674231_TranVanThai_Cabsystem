const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { runMongoScript } = require('../scripts/mongo-internal');

const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#'))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
const db = name => new Pool({ host: 'localhost', user: name, database: `${name}_db`,
  password: env[`${name.toUpperCase()}_DB_PASSWORD`] });
const bookingDb = db('booking');
const tripDb = db('trip');
const driverDb = db('driver');
const bookingIds = [];
let tripId;
let driverBefore;

async function api(method, route, token, body, key) {
  const response = await fetch(`http://localhost:8000/api/v1${route}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(key ? { 'idempotency-key': key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function cleanup() {
  if (driverBefore) {
    await driverDb.query('UPDATE drivers SET status=$1,current_trip_id=$2 WHERE id=$3',
      [driverBefore.status, driverBefore.current_trip_id,
        '20000000-0000-4000-8000-000000000003']);
    await driverDb.query('DELETE FROM driver_status_history WHERE trip_id=$1', [tripId]);
  }
  if (tripId) {
    await tripDb.query('DELETE FROM trip_status_history WHERE trip_id=$1', [tripId]);
    await tripDb.query('DELETE FROM outbox_events WHERE aggregate_id=$1', [tripId]);
    await tripDb.query('DELETE FROM trips WHERE id=$1', [tripId]);
  }
  if (bookingIds.length) {
    await bookingDb.query('DELETE FROM offers WHERE booking_id=ANY($1::uuid[])', [bookingIds]);
    await bookingDb.query('DELETE FROM booking_status_history WHERE booking_id=ANY($1::uuid[])', [bookingIds]);
    await bookingDb.query('DELETE FROM idempotency_records WHERE resource_id=ANY($1::uuid[])', [bookingIds]);
    await bookingDb.query('DELETE FROM outbox_events WHERE aggregate_id=ANY($1::uuid[])', [bookingIds]);
    await bookingDb.query('DELETE FROM bookings WHERE id=ANY($1::uuid[])', [bookingIds]);
    await new Promise(resolve => setTimeout(resolve, 1000));
    runMongoScript(`db.notifications.deleteMany({body: {$regex: ${JSON.stringify(bookingIds.join('|'))}}});`);
  }
  await Promise.all([bookingDb.end(), tripDb.end(), driverDb.end()]);
}

async function main() {
  try {
    const login = await api('POST', '/auth/login', null,
      { email: 'kh01@gmail.com', password: '12345678' });
    assert.equal(login.status, 200);
    const token = login.body.token;
    const customerId = login.body.accountId;
    const payload = { pickupAddress: 'Temporary smoke pickup', pickupLat: 15, pickupLng: 110,
      destinationAddress: 'Temporary smoke destination', destinationLat: 15.01,
      destinationLng: 110.01, vehicleType: 'BIKE' };
    const first = await api('POST', '/bookings', token, payload, `active-smoke-${crypto.randomUUID()}`);
    assert.equal(first.status, 201, JSON.stringify(first.body));
    bookingIds.push(first.body.id);
    const blocked = await api('POST', '/bookings', token, payload, `active-smoke-${crypto.randomUUID()}`);
    assert.equal(blocked.status, 409, JSON.stringify(blocked.body));
    assert.equal(blocked.body.code, 'ACTIVE_BOOKING_EXISTS');
    await bookingDb.query(`UPDATE bookings SET search_expires_at=NOW()-INTERVAL '1 second' WHERE id=$1`,
      [first.body.id]);
    let expired = false;
    for (let n = 0; n < 30; n++) {
      const status = await bookingDb.query('SELECT status FROM bookings WHERE id=$1', [first.body.id]);
      if (status.rows[0].status === 'EXPIRED') { expired = true; break; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(expired, true, 'Expiry worker did not expire booking');
    const second = await api('POST', '/bookings', token, payload, `active-smoke-${crypto.randomUUID()}`);
    assert.equal(second.status, 201, JSON.stringify(second.body));
    bookingIds.push(second.body.id);
    const canceled = await api('POST', `/bookings/${second.body.id}/cancel`, token,
      { reason: 'Smoke test' });
    assert.equal(canceled.status, 200, JSON.stringify(canceled.body));
    assert.equal(canceled.body.status, 'CANCELED');

    // Exercise the same booking cancellation endpoint after a driver accepted.
    const assignedId = crypto.randomUUID();
    tripId = crypto.randomUUID();
    bookingIds.push(assignedId);
    const driverId = '20000000-0000-4000-8000-000000000003';
    await bookingDb.query(`INSERT INTO bookings(id,customer_id,vehicle_type,pickup_address,pickup_lat,pickup_lng,
      destination_address,destination_lat,destination_lng,status,trip_id,current_driver_id)
      VALUES($1,$2,'BIKE','Smoke pickup',15,110,'Smoke destination',15.01,110.01,'ASSIGNED',$3,$4)`,
      [assignedId, customerId, tripId, driverId]);
    await tripDb.query(`INSERT INTO trips(id,booking_id,customer_id,driver_id,vehicle_type,
      pickup_address,pickup_lat,pickup_lng,destination_address,destination_lat,destination_lng,
      distance_km,base_fare,per_km_fare,fare,status)
      VALUES($1,$2,$3,$4,'BIKE','Smoke pickup',15,110,'Smoke destination',15.01,110.01,
        2,12000,4000,20000,'ASSIGNED')`, [tripId, assignedId, customerId, driverId]);
    driverBefore = (await driverDb.query('SELECT status,current_trip_id FROM drivers WHERE id=$1',
      [driverId])).rows[0];
    await driverDb.query(`UPDATE drivers SET status='BUSY',current_trip_id=$1 WHERE id=$2`,
      [tripId, driverId]);
    const assignedCancel = await api('POST', `/bookings/${assignedId}/cancel`, token,
      { reason: 'Smoke test assigned' });
    assert.equal(assignedCancel.status, 200, JSON.stringify(assignedCancel.body));
    const states = await Promise.all([
      bookingDb.query('SELECT status FROM bookings WHERE id=$1', [assignedId]),
      tripDb.query('SELECT status FROM trips WHERE id=$1', [tripId]),
    ]);
    assert.equal(states[0].rows[0].status, 'CANCELED');
    assert.equal(states[1].rows[0].status, 'CANCELED');
    const releasedDriver = await driverDb.query('SELECT status,current_trip_id FROM drivers WHERE id=$1',
      [driverId]);
    assert.equal(releasedDriver.rows[0].status, 'ONLINE');
    assert.equal(releasedDriver.rows[0].current_trip_id, null);
    console.log('PASS: duplicate blocked, timeout released slot, SEARCHING and ASSIGNED cancel succeeded');
  } finally {
    await cleanup();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
