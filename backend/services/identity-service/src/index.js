const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { registerHealthRoutes } = require("../../../shared/src/health");
const { checkDatabase, runMigrations, pool } = require("./db/postgres");
const { seed } = require("./db/seed");
const { hashPhone } = require("../../../shared/src/crypto/index");
const { generateToken, generateServiceToken } = require("../../../shared/src/auth/jwt");
const {
  isValidEmail,
  isValidPhone,
  isValidPassword,
  sanitizeBody,
} = require("../../../shared/src/validation/index");

const app = express();

app.use(express.json());
app.use(sanitizeBody);

const PORT = Number(process.env.PORT || 3000);
const SERVICE_NAME = process.env.SERVICE_NAME || "identity-service";

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || "http://customer-service:3001";

registerHealthRoutes(app, SERVICE_NAME);

// =========================
// Helpers
// =========================

function errorResponse(res, status, code, message, requestId) {
  return res.status(status).json({ code, message, requestId });
}

async function getAccountRole(client, accountId) {
  const { rows } = await client.query(
    "SELECT role_code FROM account_roles WHERE account_id = $1 AND is_primary = TRUE",
    [accountId]
  );
  return rows[0]?.role_code || null;
}

function generateServiceJwt(audience) {
  return generateServiceToken(SERVICE_NAME, audience);
}

async function notifyCustomerService(accountId, fullName, email, phoneHash, requestId) {
  try {
    const token = generateServiceJwt("customer-service");
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

// =========================
// PC9 — Customer Registration
// =========================
app.post("/auth/register", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const { fullName, email, phone, password } = req.body;

  // Validation (PC25: parameterized queries only, no string interpolation)
  const errors = [];
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    errors.push("fullName is required");
  }
  if (!email || !isValidEmail(email)) {
    errors.push("email must be a valid email address");
  }
  if (!phone || !isValidPhone(phone)) {
    errors.push("phone must be a valid E.164 phone number (e.g. +84901234567)");
  }
  if (!isValidPassword(password)) {
    errors.push("password must be at least 8 characters");
  }

  if (errors.length > 0) {
    return errorResponse(res, 400, "VALIDATION_ERROR", errors.join("; "), requestId);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const phoneHashVal = hashPhone(phone.trim());
  const passwordHash = await bcrypt.hash(password, 10);
  const accountId = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Check uniqueness (parameterized, not string interpolation — PC25)
    const existing = await client.query(
      "SELECT id FROM accounts WHERE lower(email) = $1 OR phone_hash = $2 LIMIT 1",
      [normalizedEmail, phoneHashVal]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return errorResponse(res, 409, "DUPLICATE_ACCOUNT", "Email or phone already registered", requestId);
    }

    // Create account PENDING
    await client.query(
      `INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`,
      [accountId, normalizedEmail, phoneHashVal, passwordHash, fullName.trim()]
    );

    await client.query(
      `INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, 'CUSTOMER', TRUE)`,
      [accountId]
    );

    await client.query("COMMIT");

    // Call customer-service to create profile
    const customerOk = await notifyCustomerService(accountId, fullName.trim(), normalizedEmail, phoneHashVal, requestId);

    if (!customerOk) {
      // Rollback: delete PENDING account
      await pool.query("DELETE FROM accounts WHERE id = $1 AND status = 'PENDING'", [accountId]);
      return errorResponse(res, 503, "DEPENDENCY_ERROR", "Failed to create customer profile. Please retry.", requestId);
    }

    // Activate account + write outbox event
    await pool.query(
      `UPDATE accounts SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`,
      [accountId]
    );

    // Outbox event
    const event = {
      eventId: crypto.randomUUID(),
      eventType: "account.registered",
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      producer: SERVICE_NAME,
      aggregateType: "Account",
      aggregateId: accountId,
      requestId,
      recipientIds: [accountId],
      data: { accountId, role: "CUSTOMER", displayName: fullName.trim() },
    };

    await pool.query(
      `INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')`,
      [event.eventId, "Account", accountId, "account.registered", "identity.events", accountId, JSON.stringify(event), requestId]
    );

    return res.status(201).json({
      id: accountId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[identity/register]", err.message);
    // Check for unique constraint violation
    if (err.code === "23505") {
      return errorResponse(res, 409, "DUPLICATE_ACCOUNT", "Email or phone already registered", requestId);
    }
    return errorResponse(res, 500, "INTERNAL_ERROR", "Registration failed", requestId);
  } finally {
    client.release();
  }
});

// =========================
// PC10 — Login (Customer, Driver, Admin, etc.)
// =========================
app.post("/auth/login", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const { email, phone, password } = req.body;

  if (!password) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "password is required", requestId);
  }
  if (!email && !phone) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "email or phone is required", requestId);
  }

  const client = await pool.connect();
  try {
    let account = null;

    if (email) {
      if (!isValidEmail(email)) {
        return errorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid email or password", requestId);
      }
      const { rows } = await client.query(
        "SELECT a.*, ar.role_code FROM accounts a LEFT JOIN account_roles ar ON a.id = ar.account_id AND ar.is_primary = TRUE WHERE lower(a.email) = $1 LIMIT 1",
        [email.toLowerCase().trim()]
      );
      account = rows[0];
    } else {
      const phoneHashVal = hashPhone(phone.trim());
      const { rows } = await client.query(
        "SELECT a.*, ar.role_code FROM accounts a LEFT JOIN account_roles ar ON a.id = ar.account_id AND ar.is_primary = TRUE WHERE a.phone_hash = $1 LIMIT 1",
        [phoneHashVal]
      );
      account = rows[0];
    }

    // Generic error message to not reveal if account exists (PC10)
    if (!account) {
      return errorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Check lock
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return errorResponse(res, 401, "ACCOUNT_LOCKED", "Account temporarily locked. Please try again later.", requestId);
    }

    if (account.status !== "ACTIVE") {
      return errorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Verify password (bcrypt, not string comparison — PC24)
    const passwordMatch = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatch) {
      const newCount = (account.failed_login_count || 0) + 1;
      if (newCount >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await client.query(
          "UPDATE accounts SET failed_login_count = $1, locked_until = $2, lock_reason = 'Too many failed attempts', updated_at = NOW() WHERE id = $3",
          [newCount, lockedUntil, account.id]
        );
      } else {
        await client.query(
          "UPDATE accounts SET failed_login_count = $1, updated_at = NOW() WHERE id = $2",
          [newCount, account.id]
        );
      }
      return errorResponse(res, 401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Reset failed count on success
    await client.query(
      "UPDATE accounts SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
      [account.id]
    );

    const jti = crypto.randomUUID();
    const token = generateToken({ sub: account.id, role: account.role_code, jti });

    return res.status(200).json({
      token,
      accountId: account.id,
      role: account.role_code,
      displayName: account.display_name,
    });
  } catch (err) {
    console.error("[identity/login]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Login failed", requestId);
  } finally {
    client.release();
  }
});

// =========================
// Internal REST — Create Account (for Driver registration)
// =========================
app.post("/internal/accounts", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();

  // Verify service token
  const serviceToken = req.headers["x-service-token"];
  if (!serviceToken) {
    return errorResponse(res, 401, "UNAUTHORIZED", "Service token required", requestId);
  }
  try {
    const { verifyServiceToken } = require("../../../shared/src/auth/jwt");
    verifyServiceToken(serviceToken, SERVICE_NAME);
  } catch {
    return errorResponse(res, 401, "UNAUTHORIZED", "Invalid service token", requestId);
  }

  const targetId = req.body.accountId || req.body.id;
  const { phone, email } = req.body;
  const targetName = req.body.displayName || req.body.fullName || "Driver";
  const targetPassword = req.body.password || "DriverPass@123";
  const targetRole = req.body.role || "DRIVER";

  if (!targetId || !phone) {
    return errorResponse(res, 400, "VALIDATION_ERROR", "accountId/id and phone required", requestId);
  }

  const phoneHashVal = hashPhone(phone.trim());
  const passwordHash = await bcrypt.hash(targetPassword, 10);

  const client = await pool.connect();
  try {
    // Idempotency: return existing if targetId already exists
    const existing = await client.query("SELECT id FROM accounts WHERE id = $1", [targetId]);
    if (existing.rows.length > 0) {
      return res.status(201).json({ id: targetId, status: "ACTIVE" });
    }

    // Check phone uniqueness
    const phoneConflict = await client.query("SELECT id FROM accounts WHERE phone_hash = $1", [phoneHashVal]);
    if (phoneConflict.rows.length > 0) {
      return errorResponse(res, 409, "PHONE_TAKEN", "Phone already registered", requestId);
    }

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
      [targetId, email || null, phoneHashVal, passwordHash, targetName]
    );
    await client.query(
      `INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, $2, TRUE)`,
      [targetId, targetRole]
    );
    await client.query("COMMIT");

    return res.status(201).json({ id: targetId, status: "ACTIVE" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return errorResponse(res, 409, "DUPLICATE_ACCOUNT", "Phone or email already registered", requestId);
    }
    console.error("[identity/internal/accounts]", err.message);
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to create account", requestId);
  } finally {
    client.release();
  }
});

// =========================
// Internal REST — Get Role Permissions (for Gateway RBAC cache)
// =========================
app.get("/internal/roles/:role/permissions", async (req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const { role } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT permission_code FROM role_permissions WHERE role_code = $1",
      [role]
    );
    return res.json({
      role,
      permissions: rows.map(r => r.permission_code),
    });
  } catch (err) {
    return errorResponse(res, 500, "INTERNAL_ERROR", "Failed to get permissions", requestId);
  }
});

// =========================
// Start
// =========================
async function start() {
  try {
    await runMigrations();
    console.log("[identity] Migrations applied");
    await seed();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("[identity] Startup error:", err.message);
    process.exit(1);
  }
}

start();