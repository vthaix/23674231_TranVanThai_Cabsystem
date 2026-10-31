const path = require('node:path');
const crypto = require('node:crypto');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { verifyServiceToken, verifyToken } = require('../auth/jwt');
const contracts = require('./contracts');
const { invokePublicApi } = require('./public-api');

const definition = protoLoader.loadSync(path.join(__dirname, '../../proto/cab.proto'), {
  longs: String, enums: String, defaults: false, oneofs: true,
});
const proto = grpc.loadPackageDefinition(definition).cab.v1;
const clients = new Map();

function endpoint(service) {
  const key = service.replace(/-/g, '_').toUpperCase() + '_GRPC_ADDRESS';
  return process.env[key] || `${service}:${contracts[service].port}`;
}

// A response facade keeps business error handling independent of the transport.
async function rpcRequest(service, method, request = {}, options = {}) {
  const contract = contracts[service];
  if (!contract || (method !== 'Invoke' && !contract.methods[method])) throw new Error(`Unknown RPC ${service}.${method}`);
  const address = endpoint(service);
  const type = method === 'Invoke' ? 'GatewayApi' : contract.name;
  const key = `${service}@${address}/${type}`;
  if (!clients.has(key)) clients.set(key, new proto[type](address, grpc.credentials.createInsecure()));
  const client = clients.get(key);
  const metadata = new grpc.Metadata();
  for (const [key, value] of Object.entries(options.headers || {})) {
    if (value != null && ['x-service-token', 'x-request-id', 'authorization'].includes(key.toLowerCase())) {
      metadata.set(key.toLowerCase(), String(value));
    }
  }
  const payload = { ...(options.body ? JSON.parse(options.body) : {}), ...request };
  return new Promise((resolve, reject) => {
    const signal = options.signal;
    if (signal?.aborted) return reject(signal.reason);
    const call = client[method](payload, metadata, {
      deadline: new Date(Date.now() + (options.timeoutMs || 5000)),
    }, (error, result) => {
      signal?.removeEventListener('abort', cancel);
      if (error) return reject(error);
      resolve({ status: result.status, ok: result.status >= 200 && result.status < 300,
        headers: new Map(Object.entries(result.headers || {})),
        json: async () => JSON.parse(result.bodyJson || '{}'), text: async () => result.bodyJson || '' });
    });
    const cancel = () => call.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
  });
}

function closeClients() {
  for (const client of clients.values()) client.close();
  clients.clear();
}

async function startGrpcServer(service, handlers, address, app) {
  const contract = contracts[service];
  const server = new grpc.Server();
  const implementation = {};
  for (const [method, spec] of Object.entries(contract.methods)) {
    if (typeof handlers[spec.handler] !== 'function') throw new Error(`Missing RPC handler: ${spec.handler}`);
    implementation[method] = async (call, callback) => {
      try {
        const headers = Object.fromEntries(Object.entries(call.metadata.getMap()).map(([k, v]) => [k, String(v)]));
        let claims;
        try { claims = verifyServiceToken(headers['x-service-token'], service); }
        catch { return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Valid service token required' }); }
        if (!spec.callers.includes(claims.iss)) {
          return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Caller is not allowed for this RPC' });
        }
        const requestId = headers['x-request-id'] || crypto.randomUUID();
        headers['x-request-id'] = requestId;
        const body = { ...call.request };
        const params = {};
        for (const key of spec.params || []) { params[key] = body[key]; delete body[key]; }
        const input = { headers, requestId, params, body, query: spec.query ? body : {}, serviceIssuer: claims.iss };
        if (spec.user) {
          try { input.user = verifyToken((headers.authorization || '').replace(/^Bearer /, '')); }
          catch { return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Valid user token required' }); }
          if (!['CUSTOMER', 'ADMIN'].includes(input.user.role)) {
            return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Customer or admin required' });
          }
        }
        let result;
        if (spec.controller) {
          // Customer uses an existing controller; invoke it in-process, without HTTP.
          const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
            json(body) { result = { status: this.statusCode, body }; return this; } };
          await handlers[spec.handler](input, res);
        } else result = await handlers[spec.handler](input);
        callback(null, { status: result.status, bodyJson: JSON.stringify(result.body) });
      } catch (error) {
        console.error(`[grpc/${service}/${method}]`, error.message);
        callback({ code: grpc.status.INTERNAL, details: 'Internal service error' });
      }
    };
  }
  if (contract.name) server.addService(proto[contract.name].service, implementation);
  if (app) server.addService(proto.GatewayApi.service, {
    Invoke: async (call, callback) => {
      let claims;
      try { claims = verifyServiceToken(String(call.metadata.get('x-service-token')[0] || ''), service); }
      catch { return callback({ code: grpc.status.UNAUTHENTICATED, details: 'Valid gateway token required' }); }
      if (claims.iss !== 'gateway') return callback({ code: grpc.status.PERMISSION_DENIED, details: 'Gateway only' });
      try {
        const requestId = String(call.metadata.get('x-request-id')[0] || crypto.randomUUID());
        callback(null, await invokePublicApi(app, call.request, requestId));
      } catch (error) {
        console.error(`[grpc/${service}/Invoke]`, error.message);
        callback({ code: grpc.status.INTERNAL, details: 'Public API handler failed' });
      }
    },
  });
  const port = await new Promise((resolve, reject) => server.bindAsync(
    address || `0.0.0.0:${process.env.GRPC_PORT || contract.port}`,
    grpc.ServerCredentials.createInsecure(), (error, port) => error ? reject(error) : resolve(port)));
  console.log(`[${service}] gRPC listening on ${port}`);
  return { server, port };
}

module.exports = { rpcRequest, startGrpcServer, closeClients };
