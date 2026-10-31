const { IncomingMessage, ServerResponse } = require('node:http');
const { Socket } = require('node:net');

// Reuse the public middleware/controllers in-process. There is no loopback fetch
// or HTTP listener: gRPC is the only transport from Gateway to the service.
function invokePublicApi(app, request, requestId) {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = request.method || 'GET';
    req.url = request.path || '/';
    if (!req.url.startsWith('/') || req.url.startsWith('//') || req.url.split('?')[0].startsWith('/internal')) {
      return resolve({ status: 404, bodyJson: JSON.stringify({ code: 'NOT_FOUND', requestId }) });
    }
    req.headers = {};
    for (const [key, value] of Object.entries(request.headers || {})) {
      if (!['content-length', 'transfer-encoding', 'host', 'x-service-token', 'x-user-id', 'x-user-role'].includes(key.toLowerCase())) {
        req.headers[key.toLowerCase()] = value;
      }
    }
    req.headers['x-request-id'] = requestId;
    req.body = request.bodyJson ? JSON.parse(request.bodyJson) : {};
    req.rawBody = Buffer.from(request.bodyJson || '');
    req.push(null);
    const res = new ServerResponse(req);
    res.end = function (chunk) {
      resolve({ status: this.statusCode, bodyJson: chunk == null ? '' : chunk.toString(),
        headers: Object.fromEntries(Object.entries(this.getHeaders()).map(([k, v]) => [k, String(v)])) });
      return this;
    };
    app.handle(req, res, error => {
      if (error) return reject(error);
      res.statusCode = 404;
      res.end(JSON.stringify({ code: 'NOT_FOUND', requestId }));
    });
  });
}

module.exports = { invokePublicApi };
