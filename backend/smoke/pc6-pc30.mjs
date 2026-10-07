#!/usr/bin/env node
// End-to-end smoke checks against the gateway and the Compose infrastructure.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const base = (process.env.CAB_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const runId = crypto.randomBytes(5).toString('hex');
const results = [];
let requestNo = 0;
let customer, customerToken, adminToken, driver, driverToken, booking, trip, customerBalanceBeforeBooking, driverBalanceBeforeCompletion;

function compose(args, input) {
  const r = spawnSync('docker', ['compose', ...args], {
    cwd: new URL('..', import.meta.url).pathname,
    input, encoding: 'utf8', timeout: 30000
  });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || `docker compose ${args.join(' ')} failed`);
  return r.stdout.trim();
}

function dbScalar(service, sql, id) {
  const script = `
    const { Client } = require('pg');
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.connect()
      .then(() => client.query(process.argv[1], [process.argv[2]]))
      .then(result => { console.log(result.rows[0]?.value ?? ''); return client.end(); })
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  `;
  return compose(['exec', '-T', `${service}-service`, 'node', '-e', script, sql, id]);
}

async function call(method, path, body, token, extra = {}) {
  const headers = {
    'x-forwarded-for': `cab-smoke-${runId}-${++requestNo}`,
    ...extra
  };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(`${base}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000), redirect: 'manual'
      });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data, headers: response.headers };
}

function status(response, expected) {
  assert.equal(response.status, expected, JSON.stringify(response.data));
  return response.data;
}

async function check(pc, label, fn) {
  try {
    await fn();
    results.push({ pc, ok: true, label });
    console.log(`PASS PC${pc} ${label}`);
  } catch (error) {
    results.push({ pc, ok: false, label, error: error.message });
    console.error(`FAIL PC${pc} ${label}: ${error.message}`);
  }
}

async function waitReady() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await call('GET', '/health/services');
      if (r.status === 200 && r.data.services?.length === 7) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Gateway/services did not become healthy within 30 seconds');
}

function bookingPayload(lat = 10.7901, lng = 106.7101) {
  return {
    pickupAddress: `Smoke pickup ${runId}`, pickupLat: lat, pickupLng: lng,
    destinationAddress: `Smoke destination ${runId}`, destinationLat: lat + 0.01,
    destinationLng: lng + 0.01, vehicleType: 'BIKE', paymentMethod: 'BANK'
  };
}

async function makeDriver(suffix) {
  const phone = `09${String(BigInt(`0x${runId}`) % 10000000n).padStart(7, '0')}${suffix}`;
  const password = `SmokeDriver@${runId}${suffix}`;
  const otp = status(await call('POST', '/api/v1/drivers/otp/request', { phone }), 200)._dev_otp;
  assert.match(otp, /^\d{6}$/);
  const verified = status(await call('POST', '/api/v1/drivers/otp/verify', { phone, otp }), 200);
  const profile = status(await call('POST', '/api/v1/drivers/register', {
    registrationToken: verified.registrationToken, phone, password, fullName: `Smoke Driver ${runId}${suffix}`,
    nationalId: `0${runId}${suffix}`.slice(0, 12), licenseNumber: `SMOKE-${runId}-${suffix}`,
    licenseClass: 'A1', licenseExpiryDate: '2035-01-01',
    vehicle: { vehicleType: 'BIKE', plateNumber: `SM-${runId}-${suffix}`, brand: 'Honda', model: 'Wave' }
  }), 201);
  return { ...profile, phone, password };
}

await check(6, 'health, ready, seven services', async () => {
  await waitReady();
  assert.equal(status(await call('GET', '/health'), 200).status, 'ok');
  assert.equal(status(await call('GET', '/ready'), 200).status, 'ready');
  const services = status(await call('GET', '/health/services'), 200).services;
  assert.equal(services.length, 7);
  assert(services.every(s => s.status === 'up'));
});

await check(7, 'Kafka publish and consume', async () => {
  const topic = `cab-smoke-${runId}`;
  compose(['exec', '-T', 'kafka', '/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:9092', '--create', '--topic', topic, '--partitions', '1', '--replication-factor', '1']);
  compose(['exec', '-T', 'kafka', '/opt/kafka/bin/kafka-console-producer.sh', '--bootstrap-server', 'localhost:9092', '--topic', topic], `smoke-${runId}\n`);
  const message = compose(['exec', '-T', 'kafka', '/opt/kafka/bin/kafka-console-consumer.sh', '--bootstrap-server', 'localhost:9092', '--topic', topic, '--from-beginning', '--max-messages', '1', '--timeout-ms', '10000']);
  assert(message.includes(`smoke-${runId}`));
});

await check(8, 'only gateway exposes the HTTP API port', async () => {
  const config = JSON.parse(compose(['config', '--format', 'json']));
  const apiServices = ['gateway', 'identity-service', 'customer-service', 'driver-service',
    'booking-service', 'trip-service', 'payment-service', 'notification-service'];
  for (const name of apiServices) {
    const ports = config.services[name]?.ports || [];
    assert.equal(ports.length, name === 'gateway' ? 1 : 0, `${name} host ports`);
  }
  assert.equal(config.services.gateway.ports[0].published, '8000');
});

await check(9, 'register customer', async () => {
  customer = status(await call('POST', '/api/v1/auth/register', {
    fullName: `Smoke Customer ${runId}`, email: `smoke-${runId}@example.test`,
    phone: `08${String(BigInt(`0x${runId}`) % 100000000n).padStart(8, '0')}`,
    password: 'SmokePass@123!'
  }), 201);
  assert.equal(customer.status, 'ACTIVE');
});

await check(10, 'customer and admin login', async () => {
  const login = status(await call('POST', '/api/v1/auth/login', { email: customer.email, password: 'SmokePass@123!' }), 200);
  assert.equal(login.role, 'CUSTOMER');
  customerToken = login.token;
  const admin = status(await call('POST', '/api/v1/auth/login', {
    email: 'admin@cabsystem.com', password: process.env.SEED_PASSWORD || 'Admin@123456'
  }), 200);
  assert.equal(admin.role, 'ADMIN');
  adminToken = admin.token;
  const adminMe = status(await call('GET', '/api/v1/admin/me', undefined, adminToken), 200);
  assert.equal(adminMe.id, admin.accountId);
  assert.equal(adminMe.role, 'ADMIN');
  assert.equal(adminMe.password_hash, undefined);
  status(await call('GET', '/api/v1/admin/me'), 401);
  status(await call('GET', '/api/v1/admin/me', undefined, customerToken), 403);
});

await check(11, 'customer profile via JWT', async () => {
  const profile = status(await call('GET', `/api/v1/customers/${customer.id}`, undefined, customerToken), 200);
  assert.equal(profile.id, customer.id);
  const own = status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200);
  assert.equal(own.id, customer.id);
  assert.equal(own.phone, `08${String(BigInt(`0x${runId}`) % 100000000n).padStart(8, '0')}`);
  assert.equal(own.phone_hash, undefined);
  status(await call('GET', '/api/v1/customers/me'), 401);
  status(await call('GET', '/api/v1/customers/me', undefined, adminToken), 403);
});

await check(12, 'driver profile and masked phone', async () => {
  const profile = status(await call('GET', '/api/v1/drivers/00000000-0000-0000-0000-000000000011', undefined, customerToken), 200);
  assert.equal(profile.id, '00000000-0000-0000-0000-000000000011');
  assert(profile.phone?.includes('•'), 'driver phone should be masked');
});

await check(13, 'five seeded drivers, 1 km radius and paging', async () => {
  const list = status(await call('GET', '/api/v1/drivers?limit=50', undefined, adminToken), 200);
  assert(list.pagination.total >= 5);
  const page1 = status(await call('GET', '/api/v1/drivers/nearby?lat=10.776889&lng=106.700806&radius=1000&limit=1&page=1'), 200);
  const page2 = status(await call('GET', '/api/v1/drivers/nearby?lat=10.776889&lng=106.700806&radius=1000&limit=1&page=2'), 200);
  assert.equal(page1.data.length, 1);
  assert.equal(page2.data.length, 1);
  assert.notEqual(page1.data[0].id, page2.data[0].id);
  assert(page1.data.every(d => d.distanceM <= 1000 && d.status === 'ONLINE'));
});

await check(14, 'five customer bookings with paging', async () => {
  for (let i = 0; i < 5; i++) {
    const b = status(await call('POST', '/api/v1/bookings', bookingPayload(10.85 + i * 0.001, 106.75), customerToken,
      { 'idempotency-key': `smoke-${runId}-list-${i}` }), 201);
    assert.equal(b.customerId, customer.id);
  }
  const p1 = status(await call('GET', '/api/v1/bookings?limit=2&page=1', undefined, customerToken), 200);
  const p2 = status(await call('GET', '/api/v1/bookings?limit=2&page=2', undefined, customerToken), 200);
  assert(p1.pagination.total >= 5);
  assert.equal(p1.data.length, 2);
  assert.equal(p2.data.length, 2);
  assert(p1.data.every(b => b.customerId === customer.id));
  assert.notEqual(p1.data[0].id, p2.data[0].id);
});

await check(21, 'driver OTP and registration', async () => {
  driver = await makeDriver('1');
  assert.equal(driver.status, 'PENDING_APPROVAL');
  status(await call('POST', '/api/v1/auth/login', { phone: driver.phone, password: driver.password }), 401);
});

await check(22, 'admin approves driver', async () => {
  const pending = status(await call('GET', '/api/v1/drivers?status=PENDING_APPROVAL', undefined, adminToken), 200);
  assert(pending.data.some(d => d.id === driver.id));
  status(await call('GET', '/api/v1/drivers', undefined, customerToken), 403);
  status(await call('GET', `/api/v1/drivers/${driver.id}/application`, undefined, customerToken), 403);
  status(await call('POST', `/api/v1/drivers/${driver.id}/approve`, {}, customerToken), 403);
  status(await call('POST', `/api/v1/drivers/${driver.id}/reject`, { reason: 'Not authorized' }, customerToken), 403);
  const application = status(await call('GET', `/api/v1/drivers/${driver.id}/application`, undefined, adminToken), 200);
  assert.equal(application.id, driver.id);
  const approved = status(await call('POST', `/api/v1/drivers/${driver.id}/approve`, {}, adminToken), 200);
  assert.equal(approved.status, 'OFFLINE');
  driverToken = status(await call('POST', '/api/v1/auth/login', { phone: driver.phone, password: driver.password }), 200).token;
  const ownDriver = status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200);
  assert.equal(ownDriver.id, driver.id);
  assert.equal(ownDriver.phone, driver.phone);
  assert(ownDriver.nationalId && ownDriver.licenseNumber);
  assert.equal(ownDriver.phone_hash, undefined);
  status(await call('GET', '/api/v1/drivers/me'), 401);
  status(await call('GET', '/api/v1/drivers/me', undefined, customerToken), 403);
  status(await call('GET', '/api/v1/drivers/me', undefined, adminToken), 403);
  const rejectedDriver = await makeDriver('3');
  status(await call('POST', `/api/v1/drivers/${rejectedDriver.id}/reject`, { reason: 'Smoke rejection' }, adminToken), 200);
  status(await call('POST', '/api/v1/auth/login', { phone: rejectedDriver.phone, password: rejectedDriver.password }), 401);
  assert.equal(dbScalar('identity', 'SELECT id AS value FROM accounts WHERE id = $1', rejectedDriver.id), '');
  let notified = false;
  for (let i = 0; i < 10; i++) {
    const notifications = status(await call('GET', '/api/v1/notifications', undefined, driverToken), 200);
    notified = notifications.data.some(n => n.eventType === 'driver.approved' && n.body.includes(driver.id));
    if (notified) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(notified, 'driver approval notification missing');
});

await check(23, 'driver offline and online availability', async () => {
  const location = status(await call('PUT', '/api/v1/drivers/me/location', { lat: 10.7901, lng: 106.7101 }, driverToken), 200);
  assert.equal(location.lat, 10.7901);
  assert.equal(location.lng, 106.7101);
  status(await call('PUT', '/api/v1/drivers/me/location', { latitude: 10.7901, longitude: 106.7101 }, driverToken), 400);
  assert.equal(status(await call('PUT', '/api/v1/drivers/me/availability', { status: 'ONLINE' }, driverToken), 200).status, 'ONLINE');
  assert.equal(status(await call('PUT', '/api/v1/drivers/me/availability', { status: 'OFFLINE' }, driverToken), 200).status, 'OFFLINE');
  assert.equal(status(await call('PUT', '/api/v1/drivers/me/availability', { status: 'ONLINE' }, driverToken), 200).status, 'ONLINE');
});

await check(15, 'booking dispatches an offer to nearby driver', async () => {
  const pickupLat = 11 + Number.parseInt(runId.slice(0, 4), 16) / 0xffff;
  const pickupLng = 107 + Number.parseInt(runId.slice(4, 8), 16) / 0xffff;
  status(await call('PUT', '/api/v1/drivers/me/location', { lat: pickupLat, lng: pickupLng }, driverToken), 200);
  customerBalanceBeforeBooking = status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance;
  booking = status(await call('POST', '/api/v1/bookings', bookingPayload(pickupLat, pickupLng), customerToken,
    { 'idempotency-key': `smoke-${runId}-ride` }), 201);
  assert.equal(booking.status, 'SEARCHING');
  assert.equal(booking.paymentStatus, 'HELD');
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance,
    customerBalanceBeforeBooking - booking.fare);
  assert.equal(status(await call('GET', `/api/v1/payments/${booking.id}`, undefined, customerToken), 200).status, 'HELD');
  let offer;
  for (let i = 0; i < 20; i++) {
    const offers = status(await call('GET', '/api/v1/offers', undefined, driverToken), 200);
    offer = offers.data.find(o => o.bookingId === booking.id);
    if (offer) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(offer, 'driver did not receive an offer within 5 seconds');
  const ttlSeconds = (new Date(offer.expiresAt).getTime() - Date.now()) / 1000;
  assert(ttlSeconds > 1700 && ttlSeconds <= 1800, `expected 30-minute offer, got ${ttlSeconds}s`);
});

await check(16, 'driver accepts offer and trip is assigned', async () => {
  const offers = status(await call('GET', '/api/v1/offers', undefined, driverToken), 200);
  const offer = offers.data.find(o => o.bookingId === booking.id);
  assert(offer);
  const accepted = status(await call('POST', `/api/v1/bookings/${booking.id}/accept`, {}, driverToken), 200);
  assert.equal(accepted.status, 'ASSIGNED');
  trip = status(await call('GET', `/api/v1/trips/${accepted.tripId}`, undefined, customerToken), 200);
  assert.equal(trip.driverId, driver.id);
  assert.equal(trip.status, 'ASSIGNED');
});

await check(17, 'trip status transition and location', async () => {
  driverBalanceBeforeCompletion = status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance;
  status(await call('PATCH', `/api/v1/trips/${trip.id}/status`, {
    status: 'ARRIVED', latitude: 10.791, longitude: 106.711
  }, driverToken), 400);
  const invalid = await call('PATCH', `/api/v1/trips/${trip.id}/status`, { status: 'COMPLETED' }, driverToken);
  status(invalid, 409);
  status(await call('PATCH', `/api/v1/trips/${trip.id}/status`, { status: 'CANCELED' }, driverToken), 409);
  status(await call('POST', `/api/v1/payments/${trip.id}`, undefined, customerToken), 409);
  for (const next of ['ARRIVED', 'IN_PROGRESS', 'PAYMENT_PENDING']) {
    assert.equal(status(await call('PATCH', `/api/v1/trips/${trip.id}/status`, {
      status: next, lat: 10.791, lng: 106.711
    }, driverToken), 200).status, next);
    if (next === 'IN_PROGRESS') {
      status(await call('POST', `/api/v1/bookings/${booking.id}/cancel`,
        { reason: 'Too late to cancel' }, customerToken), 409);
      assert.equal(status(await call('GET', `/api/v1/payments/${booking.id}`, undefined, customerToken), 200).status, 'HELD');
    }
  }
  assert.equal(status(await call('GET', `/api/v1/trips/${trip.id}`, undefined, customerToken), 200).status, 'PAYMENT_PENDING');
});

await check(19, 'customer payment settles escrow and completes trip', async () => {
  status(await call('POST', `/api/v1/payments/${trip.id}`, undefined, driverToken), 403);
  const paid = status(await call('POST', `/api/v1/payments/${trip.id}`, undefined, customerToken), 200);
  assert.equal(paid.status, 'COMPLETED');
  const payment = status(await call('GET', `/api/v1/payments/${booking.id}`, undefined, customerToken), 200);
  assert.equal(payment.method, 'WALLET');
  assert.equal(payment.status, 'SETTLED');
  assert.equal(payment.amount, booking.fare);
  assert.equal(status(await call('GET', `/api/v1/trips/${trip.id}`, undefined, customerToken), 200).paymentStatus, 'PAID');
  assert.equal(status(await call('GET', `/api/v1/trips/${trip.id}`, undefined, customerToken), 200).status, 'COMPLETED');
  assert.equal(status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance,
    driverBalanceBeforeCompletion + booking.fare);

  const customerBalance = status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance;
  const driverBalance = status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance;
  const cashBooking = status(await call('POST', '/api/v1/bookings', {
    ...bookingPayload(booking.pickup.lat, booking.pickup.lng), paymentMethod: 'CASH'
  }, customerToken, { 'idempotency-key': `smoke-${runId}-cash` }), 201);
  assert.equal(cashBooking.paymentStatus, 'UNPAID');
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance, customerBalance);
  let cashOffer;
  for (let i = 0; i < 20; i++) {
    cashOffer = status(await call('GET', '/api/v1/offers', undefined, driverToken), 200).data
      .find(o => o.bookingId === cashBooking.id);
    if (cashOffer) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(cashOffer, 'cash offer missing');
  const cashTripId = status(await call('POST', `/api/v1/bookings/${cashBooking.id}/accept`, {}, driverToken), 200).tripId;
  for (const next of ['ARRIVED', 'IN_PROGRESS', 'PAYMENT_PENDING']) {
    status(await call('PATCH', `/api/v1/trips/${cashTripId}/status`, { status: next }, driverToken), 200);
  }
  status(await call('POST', `/api/v1/payments/${cashTripId}`, undefined, customerToken), 403);
  assert.equal(status(await call('POST', `/api/v1/payments/${cashTripId}`, undefined, driverToken), 200).status, 'COMPLETED');
  assert.equal(status(await call('GET', `/api/v1/trips/${cashTripId}`, undefined, customerToken), 200).paymentStatus, 'PAID');
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance, customerBalance);
  assert.equal(status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance, driverBalance);
});

await check(20, 'review persists on completed trip', async () => {
  const review = status(await call('POST', `/api/v1/trips/${trip.id}/reviews`, {
    stars: 5, comment: `Great ride ${runId}`
  }, customerToken), 201);
  assert.equal(review.tripId, trip.id);
  assert.equal(status(await call('GET', `/api/v1/trips/${trip.id}`, undefined, customerToken), 200).review.stars, 5);
});

await check(18, 'customer cancels booking and assigned trip; both parties receive notice', async () => {
  const balanceBeforeCancel = status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance;
  const b = status(await call('POST', '/api/v1/bookings', bookingPayload(10.88, 106.78), customerToken,
    { 'idempotency-key': `smoke-${runId}-cancel` }), 201);
  assert.equal(status(await call('GET', `/api/v1/payments/${b.id}`, undefined, customerToken), 200).status, 'HELD');
  const canceled = status(await call('POST', `/api/v1/bookings/${b.id}/cancel`, { reason: 'Smoke customer request' }, customerToken), 200);
  assert.equal(canceled.status, 'CANCELED');
  assert.equal(status(await call('GET', `/api/v1/payments/${b.id}`, undefined, customerToken), 200).status, 'REFUNDED');
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance, balanceBeforeCancel);
  const listed = status(await call('GET', '/api/v1/bookings?limit=50', undefined, customerToken), 200);
  assert.equal(listed.data.find(x => x.id === b.id)?.status, 'CANCELED');

  const cancelDriver = await makeDriver('2');
  status(await call('POST', `/api/v1/drivers/${cancelDriver.id}/approve`, {}, adminToken), 200);
  const cancelToken = status(await call('POST', '/api/v1/auth/login', {
    phone: cancelDriver.phone, password: cancelDriver.password
  }), 200).token;
  status(await call('PUT', '/api/v1/drivers/me/location', { lat: 10.8001, lng: 106.7201 }, cancelToken), 200);
  status(await call('PUT', '/api/v1/drivers/me/availability', { status: 'ONLINE' }, cancelToken), 200);
  const b2 = status(await call('POST', '/api/v1/bookings', bookingPayload(10.8001, 106.7201), customerToken,
    { 'idempotency-key': `smoke-${runId}-cancel-trip` }), 201);
  const offers = status(await call('GET', '/api/v1/offers', undefined, cancelToken), 200);
  const offer = offers.data.find(o => o.bookingId === b2.id);
  assert(offer, 'second driver did not receive cancellation test offer');
  const assigned = status(await call('POST', `/api/v1/bookings/${b2.id}/accept`, {}, cancelToken), 200);
  assert.equal(status(await call('PATCH', `/api/v1/trips/${assigned.tripId}/status`,
    { status: 'ARRIVED' }, cancelToken), 200).status, 'ARRIVED');
  const tripCanceled = status(await call('POST', `/api/v1/trips/${assigned.tripId}/cancel`,
    { reason: 'Smoke cancellation' }, customerToken), 200);
  assert.equal(tripCanceled.status, 'CANCELED');
  assert.equal(status(await call('GET', `/api/v1/trips/${assigned.tripId}`, undefined, customerToken), 200).status, 'CANCELED');
  assert.equal(status(await call('GET', `/api/v1/payments/${b2.id}`, undefined, customerToken), 200).status, 'REFUNDED');
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance, balanceBeforeCancel);

  for (const token of [customerToken, cancelToken]) {
    let found = false;
    for (let i = 0; i < 10; i++) {
      const notifications = status(await call('GET', '/api/v1/notifications', undefined, token), 200);
      found = notifications.data.some(n => n.eventType === 'trip.canceled' && n.body.includes(assigned.tripId));
      if (found) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(found, 'trip cancellation notification missing');
  }
});

await check(24, 'password hash and encrypted sensitive columns at rest', async () => {
  const passwordHash = dbScalar('identity', 'SELECT password_hash AS value FROM accounts WHERE id = $1', customer.id);
  assert(passwordHash.startsWith('$2'), 'password must be bcrypt hashed');
  const sensitive = dbScalar('driver',
    "SELECT phone_enc || '|' || national_id_enc || '|' || license_number_enc AS value FROM drivers WHERE id = $1", driver.id);
  const columns = sensitive.split('|');
  assert.equal(columns.length, 3);
  assert(columns.every(x => x.startsWith('enc:v1:') && !x.includes(driver.phone)));
});

await check(25, 'SQL injection does not bypass login', async () => {
  const r = await call('POST', '/api/v1/auth/login', { email: "' OR 1=1 --", password: 'anything' });
  assert([400, 401].includes(r.status), JSON.stringify(r));
  assert(!r.data.token);
});

await check(26, 'XSS payload is escaped in API output', async () => {
  const b = status(await call('POST', '/api/v1/bookings', {
    ...bookingPayload(10.89, 106.79), pickupAddress: "<script>alert('hack')</script>"
  }, customerToken, { 'idempotency-key': `smoke-${runId}-xss` }), 201);
  const listed = status(await call('GET', '/api/v1/bookings?limit=50', undefined, customerToken), 200);
  const stored = listed.data.find(x => x.id === b.id);
  assert(stored);
  assert(!stored.pickup.address.includes('<script>'));
});

await check(27, 'JWT payload tampering returns 401', async () => {
  const parts = customerToken.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  parts[1] = Buffer.from(JSON.stringify({ ...payload, role: 'ADMIN' })).toString('base64url');
  status(await call('GET', '/api/v1/drivers', undefined, parts.join('.')), 401);
});

await check(28, 'customer cannot use driver-only API', async () => {
  status(await call('PUT', '/api/v1/drivers/me/availability', { status: 'ONLINE' }, customerToken), 403);
  status(await call('GET', '/api/v1/drivers', undefined, customerToken), 403);
  status(await call('GET', '/api/v1/customers', undefined, customerToken), 403);
});

await check(29, 'request flood receives 429', async () => {
  const ip = `cab-smoke-flood-${runId}`;
  let limited = false;
  for (let i = 0; i < 55; i++) {
    const r = await call('GET', '/api/v1/drivers/nearby?limit=1', undefined, undefined, { 'x-forwarded-for': ip });
    if (r.status === 429) { limited = true; break; }
  }
  assert(limited, 'expected 429 within 55 requests');
  status(await call('GET', '/health'), 200);
});

await check(30, 'booking replay preserves one escrow and one charge', async () => {
  const balanceBeforeReplay = status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance;
  const replay = status(await call('POST', '/api/v1/bookings', bookingPayload(booking.pickup.lat, booking.pickup.lng), customerToken,
    { 'idempotency-key': `smoke-${runId}-ride` }), 201);
  assert.equal(replay.id, booking.id);
  assert.equal(replay.fare, booking.fare);
  assert.equal(status(await call('GET', '/api/v1/customers/me', undefined, customerToken), 200).balance, balanceBeforeReplay);
  assert.equal(status(await call('GET', `/api/v1/payments/${booking.id}`, undefined, customerToken), 200).status, 'SETTLED');
  const conflict = await call('POST', '/api/v1/bookings', {
    ...bookingPayload(booking.pickup.lat, booking.pickup.lng), destinationAddress: 'Different destination'
  }, customerToken, { 'idempotency-key': `smoke-${runId}-ride` });
  status(conflict, 422);
  const driverBalanceBeforeReplay = status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance;
  assert.equal(status(await call('POST', `/api/v1/payments/${trip.id}`, undefined, customerToken), 200).duplicate, true);
  assert.equal(status(await call('GET', '/api/v1/drivers/me', undefined, driverToken), 200).balance,
    driverBalanceBeforeReplay);
});

const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} criteria passed`);
process.exitCode = passed === 25 ? 0 : 1;
