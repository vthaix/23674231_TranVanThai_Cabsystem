const repository = require("../repositories/identity.repository");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { pool } = require("../db/postgres");
const { hashPhone } = require("../../../../shared/src/crypto/index");
const { generateToken } = require("../../../../shared/src/auth/jwt");
const { isValidEmail, isValidPhone, isValidPassword } = require("../../../../shared/src/validation/index");
const { SERVICE_NAME } = require("../config");
const { notifyCustomerService } = require("../clients/customer.client");
const { validateRegistration } = require("../services/identity.service");
const accountRepository = require("../repositories/account.repository");

function response(status, body) { return { status, body }; }
function errorResult(status, code, message, requestId) {
  return response(status, { code, message, requestId });
}

async function postAuthRegister(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { fullName, email, phone, password } = input.body;

  const errors = validateRegistration({ fullName, email, phone, password });

  if (errors.length > 0) {
    return errorResult(400, "VALIDATION_ERROR", errors.join("; "), requestId);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const phoneHashVal = hashPhone(phone.trim());
  const passwordHash = await bcrypt.hash(password, 10);
  const accountId = crypto.randomUUID();

  const client = await pool.connect();
  try {
    await repository.begin(client);

    // Check uniqueness (parameterized, not string interpolation — PC25)
    const existing = await repository.findAccounts(client, [normalizedEmail, phoneHashVal]);
    if (existing.rows.length > 0) {
      await repository.rollback(client);
      return errorResult(409, "DUPLICATE_ACCOUNT", "Email or phone already registered", requestId);
    }

    // Create account PENDING
    await repository.insertAccounts(client, [accountId, normalizedEmail, phoneHashVal, passwordHash, fullName.trim()]);

    await repository.insertAccountRoles(client, [accountId]);

    await repository.commit(client);

    // Call customer-service to create profile
    const customerOk = await notifyCustomerService(accountId, fullName.trim(), normalizedEmail, phone.trim(), phoneHashVal, requestId);

    if (!customerOk) {
      // Rollback: delete PENDING account
      await repository.deleteAccounts(pool, [accountId]);
      return errorResult(503, "DEPENDENCY_ERROR", "Failed to create customer profile. Please retry.", requestId);
    }

    // Activate account + write outbox event
    await repository.updateAccounts(pool, [accountId]);

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

    await repository.insertOutboxEvents(pool, [event.eventId, "Account", accountId, "account.registered", "identity.events", accountId, JSON.stringify(event), requestId]);

    return response(201, {
      id: accountId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  } catch (err) {
    await repository.rollback(client).catch(() => {});
    console.error("[identity/register]", err.message);
    // Check for unique constraint violation
    if (err.code === "23505") {
      return errorResult(409, "DUPLICATE_ACCOUNT", "Email or phone already registered", requestId);
    }
    return errorResult(500, "INTERNAL_ERROR", "Registration failed", requestId);
  } finally {
    client.release();
  }
}

async function postAuthLogin(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { email, phone, password } = input.body;

  if (!password) {
    return errorResult(400, "VALIDATION_ERROR", "password is required", requestId);
  }
  if (!email && !phone) {
    return errorResult(400, "VALIDATION_ERROR", "email or phone is required", requestId);
  }
  if (phone !== undefined && !isValidPhone(phone)) {
    return errorResult(400, "VALIDATION_ERROR", "phone must contain exactly 10 digits", requestId);
  }

  const client = await pool.connect();
  try {
    let account = null;

    if (email) {
      if (!isValidEmail(email)) {
        return errorResult(401, "INVALID_CREDENTIALS", "Invalid email or password", requestId);
      }
      account = await accountRepository.findByEmail(client, email.toLowerCase().trim());
    } else {
      const phoneHashVal = hashPhone(phone.trim());
      account = await accountRepository.findByPhoneHash(client, phoneHashVal);
    }

    // Generic error message to not reveal if account exists (PC10)
    if (!account) {
      return errorResult(401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Check lock
    if (account.locked_until && new Date(account.locked_until) > new Date()) {
      return errorResult(401, "ACCOUNT_LOCKED", "Account temporarily locked. Please try again later.", requestId);
    }

    if (account.status !== "ACTIVE") {
      return errorResult(401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Verify password (bcrypt, not string comparison — PC24)
    const passwordMatch = await bcrypt.compare(password, account.password_hash);
    if (!passwordMatch) {
      const newCount = (account.failed_login_count || 0) + 1;
      if (newCount >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await repository.updateAccounts2(client, [newCount, lockedUntil, account.id]);
      } else {
        await repository.updateAccounts3(client, [newCount, account.id]);
      }
      return errorResult(401, "INVALID_CREDENTIALS", "Invalid credentials", requestId);
    }

    // Reset failed count on success
    await repository.updateAccounts4(client, [account.id]);

    const jti = crypto.randomUUID();
    const token = generateToken({ sub: account.id, role: account.role_code, jti });

    return response(200, {
      token,
      accountId: account.id,
      role: account.role_code,
      displayName: account.display_name,
    });
  } catch (err) {
    console.error("[identity/login]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Login failed", requestId);
  } finally {
    client.release();
  }
}

async function getAdminMe(input) {
  const requestId = input.requestId;
  if (input.user.role !== "ADMIN") {
    return errorResult(403, "FORBIDDEN", "Admin access required", requestId);
  }
  try {
    const account = await accountRepository.findPublicById(input.user.sub);
    if (!account || account.status !== "ACTIVE" || account.role_code !== "ADMIN") {
      return errorResult(403, "FORBIDDEN", "Active admin account required", requestId);
    }
    return response(200, {
      id: account.id,
      email: account.email,
      displayName: account.display_name,
      role: account.role_code,
      status: account.status,
      lastLoginAt: account.last_login_at,
      createdAt: account.created_at,
      updatedAt: account.updated_at
    });
  } catch (err) {
    console.error("[identity/admin/me]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to get admin profile", requestId);
  }
}

async function postInternalAccounts(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();

  const targetId = input.body.accountId || input.body.id;
  const { phone, email } = input.body;
  const targetName = input.body.displayName || input.body.fullName || "Driver";
  const targetPassword = input.body.password;
  const targetRole = "DRIVER";

  if (!targetId || !isValidPhone(phone) || !isValidPassword(targetPassword)) {
    return errorResult(400, "VALIDATION_ERROR", "accountId/id, 10-digit phone and password (8-128 characters) required", requestId);
  }

  const phoneHashVal = hashPhone(phone.trim());
  const passwordHash = await bcrypt.hash(targetPassword, 10);

  const client = await pool.connect();
  try {
    // Idempotency: return existing if targetId already exists
    const existing = await repository.findAccounts2(client, [targetId]);
    if (existing.rows.length > 0) {
      const account = existing.rows[0];
      if (account.phone_hash !== phoneHashVal || account.role_code !== "DRIVER") {
        return errorResult(409, "ACCOUNT_CONFLICT", "Account ID already belongs to another user", requestId);
      }
      return response(201, { id: targetId, status: account.status });
    }

    // Check phone uniqueness
    const phoneConflict = await repository.findAccounts3(client, [phoneHashVal]);
    if (phoneConflict.rows.length > 0) {
      return errorResult(409, "PHONE_TAKEN", "Phone already registered", requestId);
    }

    await repository.begin(client);
    await repository.insertAccounts2(client, [targetId, email || null, phoneHashVal, passwordHash, targetName]);
    await repository.insertAccountRoles2(client, [targetId, targetRole]);
    await repository.commit(client);

    return response(201, { id: targetId, status: "PENDING" });
  } catch (err) {
    await repository.rollback(client).catch(() => {});
    if (err.code === "23505") {
      return errorResult(409, "DUPLICATE_ACCOUNT", "Phone or email already registered", requestId);
    }
    console.error("[identity/internal/accounts]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to create account", requestId);
  } finally {
    client.release();
  }
}

async function postInternalAccountsIdActivate(input) {
  const requestId = input.requestId;
  try {
    const result = await repository.activateDriverAccount(pool, input.params.id);
    if (result.rowCount === 0) {
      return errorResult(404, "NOT_FOUND", "Pending driver account not found", requestId);
    }
    return response(200, { id: input.params.id, status: "ACTIVE" });
  } catch (err) {
    console.error("[identity/internal/activate]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to activate driver account", requestId);
  }
}

async function deleteInternalAccountsId(input) {
  const requestId = input.requestId;
  try {
    const result = await repository.deleteDriverAccount(pool, input.params.id);
    return response(200, { id: input.params.id, deleted: result.rowCount > 0 });
  } catch (err) {
    console.error("[identity/internal/delete]", err.message);
    return errorResult(500, "INTERNAL_ERROR", "Failed to delete driver account", requestId);
  }
}

async function getInternalRolesRolePermissions(input) {
  const requestId = input.headers["x-request-id"] || crypto.randomUUID();
  const { role } = input.params;

  try {
    const rows = await accountRepository.findPermissions(role);
    return response(200, {
      role,
      permissions: rows.map(r => r.permission_code),
    });
  } catch (err) {
    return errorResult(500, "INTERNAL_ERROR", "Failed to get permissions", requestId);
  }
}

module.exports = { postAuthRegister, postAuthLogin, getAdminMe, postInternalAccounts, postInternalAccountsIdActivate, deleteInternalAccountsId, getInternalRolesRolePermissions };
