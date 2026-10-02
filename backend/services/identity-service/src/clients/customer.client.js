const { generateServiceToken } = require("../../../../shared/src/auth/jwt");
const { SERVICE_NAME, CUSTOMER_SERVICE_URL } = require("../config");

async function notifyCustomerService(accountId, fullName, email, phoneHash, requestId) {
  try {
    const token = generateServiceToken(SERVICE_NAME, "customer-service");
    const res = await fetch(`${CUSTOMER_SERVICE_URL}/internal/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": token,
        "X-Request-Id": requestId,
      },
      body: JSON.stringify({ id: accountId, fullName, email, phoneHash }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok || res.status === 409;
  } catch (err) {
    console.error("[identity] customer-service call failed:", err.message);
    return false;
  }
}

module.exports = { notifyCustomerService };
