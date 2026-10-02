const crypto = require("crypto");
const { PAYMENT_CALLBACK_SECRET } = require("../config");

function hashPaymentRequest(userId, tripId) {
  return crypto.createHash("sha256")
    .update(JSON.stringify({ userId, tripId }))
    .digest("hex");
}

function isValidCallbackSignature(signatureHeader, rawBody) {
  if (signatureHeader) {
    const expectedSig = crypto.createHmac("sha256", PAYMENT_CALLBACK_SECRET).update(rawBody).digest("hex");
    const expectedSigBase64 = crypto.createHmac("sha256", PAYMENT_CALLBACK_SECRET).update(rawBody).digest("base64");
    return signatureHeader === expectedSig || signatureHeader === expectedSigBase64;
  }
  return process.env.NODE_ENV !== "production";
}

module.exports = { hashPaymentRequest, isValidCallbackSignature };
