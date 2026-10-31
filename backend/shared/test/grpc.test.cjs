const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const express = require('express');
const grpc = require('@grpc/grpc-js');
const contracts = require('../src/grpc/contracts');
const { startGrpcServer, rpcRequest, closeClients } = require('../src/grpc/transport');
const { generateServiceToken, generateToken } = require('../src/auth/jwt');

const headers = (issuer, audience, extra = {}) => ({
  'x-service-token': generateServiceToken(issuer, audience), 'x-request-id': 'grpc-test', ...extra,
});

test('real service assemblies load and serve public health over gRPC', async t => {
  process.env.MONGO_URL ||= 'mongodb://127.0.0.1:27017/cab_transport_test';
  const servers = [];
  t.after(() => { closeClients(); for (const server of servers) server.forceShutdown(); });
  for (const service of Object.keys(contracts)) {
    const base = `../../services/${service}/src/`;
    const app = require(base + 'app');
    let handlers = {};
    if (service === 'customer-service') handlers = require(base + 'controllers/customer.controller');
    else if (!['payment-service', 'notification-service'].includes(service)) {
      handlers = require(base + 'services/' + service.replace('-service', '') + '.handlers');
      if (service === 'booking-service') handlers = { ...handlers, ...require(base + 'services/booking-payment') };
    }
    const { server, port } = await startGrpcServer(service, handlers, '127.0.0.1:0', app);
    servers.push(server);
    process.env[service.replace(/-/g, '_').toUpperCase() + '_GRPC_ADDRESS'] = `127.0.0.1:${port}`;
    const result = await rpcRequest(service, 'Invoke', { method: 'GET', path: '/health' }, {
      headers: headers('gateway', service),
    });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).service, service);
  }

  await t.test('real driver reservation and release handlers receive protobuf IDs', async () => {
    const options = { headers: headers('booking-service', 'driver-service') };
    const reserve = await rpcRequest('driver-service', 'ReserveDriver', { id: 'driver-transport-test', bookingId: 'booking-1' }, options);
    assert.equal(reserve.status, 200);
    assert.equal((await reserve.json()).bookingId, 'booking-1');
    const conflict = await rpcRequest('driver-service', 'ReserveDriver', { id: 'driver-transport-test', bookingId: 'booking-2' }, options);
    assert.equal(conflict.status, 409);
    const release = await rpcRequest('driver-service', 'ReleaseReservation', { id: 'driver-transport-test', bookingId: 'booking-1' }, options);
    assert.equal(release.status, 200);
  });

  await t.test('real booking REST validation works through its gRPC adapter', async () => {
    const invoke = body => rpcRequest('booking-service', 'Invoke', { method: 'POST', path: '/bookings',
      bodyJson: JSON.stringify(body), headers: {
        authorization: `Bearer ${generateToken({ sub: 'customer-1', role: 'CUSTOMER' })}`,
        'idempotency-key': 'validation-test',
      } }, { headers: headers('gateway', 'booking-service') });
    const invalid = await invoke({ pickup: { lat: null, lng: 106.7 }, destination: { lat: 10.78, lng: 106.71 }, vehicleType: 'BIKE' });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).code, 'VALIDATION_ERROR');
    const flat = await invoke({ pickupLat: 10.77, pickupLng: 106.7, destinationLat: 10.78, destinationLng: 106.71 });
    assert.equal(flat.status, 400);
  });
});
const sample = {
  id: 'driver-1', bookingId: 'booking-1', tripId: 'trip-1', paymentId: 'payment-1',
  customerId: 'customer-1', driverId: 'driver-1', status: 'PAID', reason: 'Customer canceled',
  fullName: 'Customer', displayName: 'Driver', email: 'driver@example.com', phone: '0391234561',
  password: '12345678', phoneHash: 'hash', lat: 0, lng: 106.7008, vehicleType: 'BIKE', excludeIds: '',
  paymentMethod: 'BANK', pickupAddress: 'Pickup', pickupLat: 10.77, pickupLng: 106.7,
  destinationAddress: 'Destination', destinationLat: 10.78, destinationLng: 106.71, fare: 15000,
};

test('gRPC transport and REST Gateway integration', async t => {
  const servers = [];
  const received = new Map();
  const app = express();
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.post('/bookings', (req, res) => res.status(201).json({
    ...req.body, key: req.headers['idempotency-key'], authorization: req.headers.authorization,
    requestId: req.headers['x-request-id'],
  }));
  app.get('/drivers/:id', (req, res) => res.json({ id: req.params.id, page: req.query.page }));
  app.get('/auth/error', (req, res) => res.status(409).json({ code: 'CONFLICT' }));
  // Raw callback bytes must survive REST -> gRPC -> handler unchanged.
  app.post('/payments/callback', (req, res) => res.json({ raw: req.rawBody.toString(), signature: req.headers['x-signature'] }));
  t.after(() => { closeClients(); for (const server of servers) server.forceShutdown(); });

  for (const [service, contract] of Object.entries(contracts)) {
    const handlers = {};
    for (const [method, spec] of Object.entries(contract.methods)) {
      handlers[spec.handler] = async (input, res) => {
        received.set(`${service}.${method}`, input);
        if (input.body.id === 'slow') await new Promise(resolve => setTimeout(resolve, 150));
        if (input.query.excludeIds === 'slow') await new Promise(resolve => setTimeout(resolve, 150));
        const result = { status: 200, body: { success: true, input } };
        return res ? res.status(result.status).json(result.body) : result;
      };
    }
    const { server, port } = await startGrpcServer(service, handlers, '127.0.0.1:0', app);
    servers.push(server);
    process.env[service.replace(/-/g, '_').toUpperCase() + '_GRPC_ADDRESS'] = `127.0.0.1:${port}`;
  }

  await t.test('all named RPCs serialize fields and dispatch to the business handler', async () => {
    for (const [service, contract] of Object.entries(contracts)) {
      for (const [method, spec] of Object.entries(contract.methods)) {
        const auth = spec.user ? { authorization: `Bearer ${generateToken({ sub: 'customer-1', role: 'CUSTOMER' })}` } : {};
        const result = await rpcRequest(service, method, sample, { headers: headers(spec.callers[0], service, auth) });
        assert.equal(result.status, 200, `${service}.${method}`);
        const input = received.get(`${service}.${method}`);
        assert.equal(input.requestId, 'grpc-test');
        assert.equal(input.serviceIssuer, spec.callers[0]);
        for (const key of spec.params || []) assert.equal(input.params[key], sample[key]);
        if (method === 'FindNearby') { assert.equal(input.query.lat, 0); assert.equal(input.query.radius, undefined); }
        if (method === 'CreateAccount') assert.equal(input.body.displayName, 'Driver');
        if (method === 'CreateTrip') assert.equal(input.body.fare, 15000);
        if (spec.user) assert.equal(input.user.sub, 'customer-1');
      }
    }
  });

  await t.test('missing token, wrong audience and wrong caller are rejected', async () => {
    await assert.rejects(rpcRequest('driver-service', 'FindNearby', sample), { code: grpc.status.UNAUTHENTICATED });
    await assert.rejects(rpcRequest('driver-service', 'FindNearby', sample, { headers: headers('booking-service', 'trip-service') }), { code: grpc.status.UNAUTHENTICATED });
    await assert.rejects(rpcRequest('driver-service', 'FindNearby', sample, { headers: headers('payment-service', 'driver-service') }), { code: grpc.status.PERMISSION_DENIED });
    await assert.rejects(rpcRequest('trip-service', 'CancelTrip', sample, { headers: headers('booking-service', 'trip-service') }), { code: grpc.status.UNAUTHENTICATED });
    await assert.rejects(rpcRequest('booking-service', 'Invoke', { method: 'GET', path: '/health' }, { headers: headers('trip-service', 'booking-service') }), { code: grpc.status.PERMISSION_DENIED });
  });

  await t.test('deadline and abort stop waiting for an unresponsive dependency', async () => {
    await assert.rejects(rpcRequest('driver-service', 'FindNearby', { ...sample, excludeIds: 'slow' }, {
      headers: headers('booking-service', 'driver-service'), timeoutMs: 25,
    }), { code: grpc.status.DEADLINE_EXCEEDED });
    const controller = new AbortController();
    const call = rpcRequest('driver-service', 'FindNearby', { ...sample, excludeIds: 'slow' }, {
      headers: headers('booking-service', 'driver-service'), signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(call, { code: grpc.status.CANCELLED });
  });

  await t.test('public adapter preserves JSON, headers, query, params and raw body', async () => {
    const invoke = (service, request) => rpcRequest(service, 'Invoke', request, { headers: headers('gateway', service) });
    const body = { pickup: { lat: 10.772853, lng: 106.7008 }, destination: { lat: 10.78, lng: 106.71 }, vehicleType: 'BIKE' };
    const result = await invoke('booking-service', { method: 'POST', path: '/bookings', bodyJson: JSON.stringify(body), headers: { 'content-type': 'application/json', 'idempotency-key': 'key-1' } });
    assert.equal(result.status, 201);
    assert.deepEqual((await result.json()).pickup, body.pickup);
    assert.equal((await result.json()).key, 'key-1');
    assert.equal((await result.json()).requestId, 'grpc-test');
    const driver = await invoke('driver-service', { method: 'GET', path: '/drivers/driver-1?page=2' });
    assert.deepEqual(await driver.json(), { id: 'driver-1', page: '2' });
    const raw = '{ "paymentId": "p-1" }';
    const callback = await invoke('payment-service', { method: 'POST', path: '/payments/callback', bodyJson: raw, headers: { 'x-signature': 'signature' } });
    assert.deepEqual(await callback.json(), { raw, signature: 'signature' });
    const hidden = await invoke('booking-service', { method: 'POST', path: '/internal/test-kafka' });
    assert.equal(hidden.status, 404);
  });

  await t.test('HTTP client reaches real Gateway then gRPC services', async () => {
    const port = await new Promise(resolve => {
      const server = net.createServer();
      server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
    });
    const child = spawn(process.execPath, [require.resolve('../../gateway/src/index.js')], {
      env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => child.kill());
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Gateway startup timed out')), 10000);
      child.once('error', reject);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Gateway exited: ${code}`)); });
      child.stdout.on('data', chunk => { if (chunk.toString().includes('listening')) { clearTimeout(timer); resolve(); } });
    });
    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(base + '/health/services');
    assert.equal(health.status, 200);
    assert.equal((await health.json()).services.length, 7);
    const booking = await fetch(base + '/api/v1/bookings', { method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'gateway-key' },
      body: JSON.stringify({ pickup: { lat: 0, lng: 0 }, vehicleType: 'BIKE' }) });
    assert.equal(booking.status, 201);
    assert.equal((await booking.json()).key, 'gateway-key');
    const driver = await fetch(base + '/api/v1/drivers/driver-1?page=3');
    assert.deepEqual(await driver.json(), { id: 'driver-1', page: '3' });
    const conflict = await fetch(base + '/api/v1/auth/error');
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).code, 'CONFLICT');
    const badToken = await fetch(base + '/api/v1/bookings', { headers: { authorization: 'Bearer invalid' } });
    assert.equal(badToken.status, 401);
    const customerToken = generateToken({ sub: 'customer-1', role: 'CUSTOMER' });
    const forbidden = await fetch(base + '/api/v1/drivers/me', { headers: { authorization: `Bearer ${customerToken}` } });
    assert.equal(forbidden.status, 403);
    child.kill();
  });
});
