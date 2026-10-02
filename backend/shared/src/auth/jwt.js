const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-in-production";
const JWT_ALG = process.env.JWT_ALG || "HS256";
const JWT_TTL_MIN = parseInt(process.env.JWT_TTL_MIN || "15", 10);

const INTERNAL_JWT_SECRET = process.env.INTERNAL_JWT_SECRET || "dev-internal-jwt-secret";
const INTERNAL_JWT_TTL_SEC = parseInt(process.env.INTERNAL_JWT_TTL_SEC || "60", 10);

function generateToken(payload) {
  const { sub, role, jti } = payload;
  return jwt.sign(
    { sub, role, jti: jti || require("crypto").randomUUID() },
    JWT_SECRET,
    {
      algorithm: JWT_ALG,
      expiresIn: JWT_TTL_MIN * 60,
    }
  );
}

function verifyToken(token) {
  // PC27: reject alg=none, only accept HS256
  // Decode header first to check algorithm
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || !decoded.header) {
    throw new Error("INVALID_TOKEN");
  }
  if (decoded.header.alg !== "HS256") {
    throw new Error("INVALID_ALGORITHM");
  }
  return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
}

function generateServiceToken(issuer, audience) {
  return jwt.sign(
    { iss: issuer, aud: audience },
    INTERNAL_JWT_SECRET,
    { algorithm: "HS256", expiresIn: INTERNAL_JWT_TTL_SEC }
  );
}

function verifyServiceToken(token, expectedAudience) {
  return jwt.verify(token, INTERNAL_JWT_SECRET, {
    algorithms: ["HS256"],
    audience: expectedAudience,
  });
}

module.exports = {
  generateToken,
  verifyToken,
  generateServiceToken,
  verifyServiceToken,
  JWT_SECRET,
  JWT_ALG,
};
