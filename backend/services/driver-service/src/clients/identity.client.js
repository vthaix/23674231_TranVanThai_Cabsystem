const { rpcRequest } = require('../../../../shared/src/grpc/transport');
const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME } = require("../config");

async function requestIdentity(method, request, requestId, body) {
  let result;
  try {
    result = await rpcRequest('identity-service', method, request, {
      headers: {
        "x-service-token": generateServiceToken(SERVICE_NAME, "identity-service"),
        "x-request-id": requestId,
        ...(body ? { "content-type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    throw Object.assign(new Error("Identity service unavailable"), { status: 503, code: "DEPENDENCY_ERROR", cause: error });
  }

  const data = await result.json().catch(() => ({}));
  if (!result.ok) {
    throw Object.assign(new Error(data.message || "Identity service request failed"), {
      status: result.status === 409 ? 409 : 503,
      code: result.status === 409 ? data.code || "ALREADY_EXISTS" : "DEPENDENCY_ERROR"
    });
  }
  return data;
}

function createDriverAccount(data, requestId) {
  return requestIdentity("CreateAccount", {}, requestId, data);
}

function activateDriverAccount(id, requestId) {
  return requestIdentity("ActivateAccount", { id }, requestId);
}

function deleteDriverAccount(id, requestId) {
  return requestIdentity("DeleteAccount", { id }, requestId);
}

module.exports = { createDriverAccount, activateDriverAccount, deleteDriverAccount };
