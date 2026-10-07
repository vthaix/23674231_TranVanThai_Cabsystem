const crypto = require("crypto");
const { verifyToken, verifyServiceToken } = require("../../../../shared/src/auth/jwt");
const { errorResponse } = require("../utils/errorResponse");

function requireAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Bearer token required", requestId);
  }
  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid or expired token", requestId);
  }
}

function requireTripService(req, res, next) {
  try {
    const token = req.headers['x-service-token'];
    if (!token) throw new Error('Missing service token');
    const payload = verifyServiceToken(token, 'booking-service');
    if ((payload.iss === 'trip-service' && req.body.status !== 'CANCELED') ||
        (payload.iss === 'payment-service' && req.body.status !== 'COMPLETED') ||
        !['trip-service', 'payment-service'].includes(payload.iss)) throw new Error('Wrong service or status');
    next();
  } catch {
    return errorResponse(res, 401, 'UNAUTHORIZED', 'Authorized service token required',
      req.headers['x-request-id'] || crypto.randomUUID());
  }
}

module.exports = { requireAuth, requireTripService };
