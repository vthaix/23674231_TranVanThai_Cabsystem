const express = require("express");
const crypto = require("crypto");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase, runMigrations, pool } = require("./db/postgres");
const { seed } = require("./db/seed");
const { encrypt, decrypt } = require("../../../shared/src/crypto/index");
const { verifyToken } = require("../../../shared/src/auth/jwt");
const { verifyServiceToken, generateServiceToken } = require("../../../shared/src/auth/jwt");
const { sanitizeBody } = require("../../../shared/src/validation/index");

const app = express();
app.use(express.json());
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3001);
const SERVICE_NAME = process.env.SERVICE_NAME || "customer-service";

registerHealthRoutes(app, SERVICE_NAME);

function errorResponse(res, status, code, message, requestId) {
  return res.status(status).json({ code, message, requestId });
}

function maskPhone(phone) {
  // +84901234567 -> +84•••••567
  if (!phone || phone.length < 6) return "•••••";
  return phone.slice(0, 3) + "•••••" + phone.slice(-3);
}

// Auth middleware for user JWT
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

// =========================
// PC11 — Get Customer By ID
// =========================
app.get("/customers/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { sub: userId, role } = req.user;
  const requestId = req.requestId;

  // Authorization: CUSTOMER can only see own profile; EMPLOYEE/ADMIN can see any
  const allowedRoles = ["EMPLOYEE", "OPERATIONS_STAFF", "USER_STAFF", "SUPERVISOR", "FINANCE_STAFF", "ADMIN", "BOARD"];
  if (role === "CUSTOMER" && userId !== id) {
    return errorResponse(res, 403, "FORBIDDEN", "Access denied", requestId);
  }
  if (!allowedRoles.includes(role) && role !== "CUSTOMER") {
    return errorResponse(res, 403, "FORBIDDEN", "Access denied", requestId);
  }

  try {
    const { rows } = await pool.query(
      "SELECT * FROM customer_profiles WHERE id = $1",
      [id]
    );
    if (rows.length === 0) {
      return errorResponse(res, 404, "NOT_FOUND", "Customer not found", requestId);
    }

    const customer = rows[0];
    let phone = null;
    if (customer.phone_enc) {
      try {
        const decrypted = decrypt(customer.phone_enc);
        // Only return plaintext phone to the owner; mask for others
        phone = (role === "CUSTOMER" && userId === id) ? decrypted : maskPhone(decrypted);
      } catch {
        phone = null;
      }
    }

    return res.json({
      id: customer.id,
      fullName: customer.full_name,
      email: customer.email,
      phone,
      dateOfBirth: customer.date_of_birth,
      gender: customer.gender,
      avatarUrl: customer.avatar_url,
      status: customer.status,
      createdAt: customer.created_at,
    });
  } catch (err) {
    console.error("[customer/get]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get customer", requestId);
  }
});

// =========================
// Internal REST — Create Customer Profile (called by identity-service)
// =========================
app.post("/internal/customers", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  // Verify service token
  const serviceToken = req.headers["x-service-token"];
  if (!serviceToken) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Service token required", requestId);
  }
  try {
    verifyServiceToken(serviceToken, SERVICE_NAME);
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid service token", requestId);
  }

  const { id, fullName, email, phoneHash } = req.body;
  if (!id || !fullName || !email || !phoneHash) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "id, fullName, email, phoneHash required", requestId);
  }

  try {
    // Idempotency: return existing if id already exists
    const existing = await pool.query("SELECT id FROM customer_profiles WHERE id = $1", [id]);
    if (existing.rows.length > 0) {
      return res.status(201).json({ id });
    }

    // phoneHash comes from identity-service (already hashed), we store it as-is
    // For the enc column: we don't have the plaintext phone here, so we skip enc
    await pool.query(
      `INSERT INTO customer_profiles (id, full_name, email, phone_hash, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [id, fullName, email.toLowerCase(), phoneHash]
    );

    return res.status(201).json({ id });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(201).json({ id }); // idempotent
    }
    console.error("[customer/internal/create]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create customer", requestId);
  }
});

// =========================
// Start
// =========================
async function start() {
  try {
    await runMigrations();
    console.log("[customer] Migrations applied");
    await seed();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[customer] Startup error:", err.message);
    process.exit(1);
  }
}

start();