const crypto = require("crypto");
const { verifyToken, verifyServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME } = require("../config");
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

function requireServiceAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  const serviceToken = req.headers["x-service-token"];
  if (!serviceToken) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Service token required", requestId);
  }
  try {
    verifyServiceToken(serviceToken, SERVICE_NAME);
    next();
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid service token", requestId);
  }
}

module.exports = { requireAuth, requireServiceAuth };
