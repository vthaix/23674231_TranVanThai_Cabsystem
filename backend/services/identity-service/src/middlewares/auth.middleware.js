const crypto = require("crypto");
const { verifyServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME } = require("../config");
const { errorResponse } = require("../utils/errorResponse");

function requireServiceAuth(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
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

module.exports = { requireServiceAuth };
