const crypto = require("crypto");
const { verifyToken, verifyServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME } = require("../config");
const { errorResponse } = require("../utils/errorResponse");

function requireServiceAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const serviceToken = req.headers["x-service-token"];
  if (!serviceToken) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Service token required", requestId);
  }
  try {
    req.service = verifyServiceToken(serviceToken, SERVICE_NAME);
    next();
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid service token", requestId);
  }
}

function requireDriverService(req, res, next) {
  if (req.service?.iss !== "driver-service") {
    return errorResponse(res, 403, "FORBIDDEN", "Driver service token required", req.requestId);
  }
  next();
}

function requireAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Bearer token required", requestId);
  }
  try {
    req.user = verifyToken(authHeader.slice(7));
    next();
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid or expired token", requestId);
  }
}

module.exports = { requireAuth, requireServiceAuth, requireDriverService };
