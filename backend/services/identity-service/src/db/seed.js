const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("./postgres");

// Known UUIDs for seed data (deterministic)
const SEED_IDS = {
  admin: "00000000-0000-4000-8000-000000000001",
  board: "00000000-0000-4000-8000-000000000002",
  ops_staff: "00000000-0000-4000-8000-000000000003",
  user_staff: "00000000-0000-4000-8000-000000000004",
  finance_staff: "00000000-0000-4000-8000-000000000005",
  supervisor: "00000000-0000-4000-8000-000000000006",
  // Customer accounts
  customer1: "10000000-0000-4000-8000-000000000001",
  customer2: "10000000-0000-4000-8000-000000000002",
  // Driver accounts
  driver1: "20000000-0000-4000-8000-000000000001",
  driver2: "20000000-0000-4000-8000-000000000002",
  driver3: "20000000-0000-4000-8000-000000000003",
  driver4: "20000000-0000-4000-8000-000000000004",
  driver5: "20000000-0000-4000-8000-000000000005",
};

function hashPhone(phone) {
  const pepper = process.env.PHONE_HASH_PEPPER || "dev-phone-pepper";
  return crypto.createHmac("sha256", pepper).update(phone).digest("hex");
}

async function seed() {
  if (process.env.SEED_ON_START !== "true") return;
  const client = await pool.connect();
  try {
    console.log("[SEED] Starting identity seed...");

    // Roles
    const roles = [
      { code: "CUSTOMER", name: "Customer" },
      { code: "DRIVER", name: "Driver" },
      { code: "OPERATIONS_STAFF", name: "Operations Staff" },
      { code: "USER_STAFF", name: "User Staff" },
      { code: "FINANCE_STAFF", name: "Finance Staff" },
      { code: "SUPERVISOR", name: "Supervisor" },
      { code: "ADMIN", name: "Administrator" },
      { code: "BOARD", name: "Board of Directors" },
    ];

    for (const r of roles) {
      await client.query(
        `INSERT INTO roles (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
        [r.code, r.name]
      );
    }

    // Permissions
    const permissions = [
      { code: "customer:read", resource: "customer", action: "read" },
      { code: "customer:write", resource: "customer", action: "write" },
      { code: "customer:search", resource: "customer", action: "search" },
      { code: "driver:read", resource: "driver", action: "read" },
      { code: "driver:approve", resource: "driver", action: "approve" },
      { code: "driver:reject", resource: "driver", action: "reject" },
      { code: "booking:read", resource: "booking", action: "read" },
      { code: "booking:cancel", resource: "booking", action: "cancel" },
      { code: "trip:read", resource: "trip", action: "read" },
      { code: "trip:cancel", resource: "trip", action: "cancel" },
      { code: "payment:read", resource: "payment", action: "read" },
      { code: "payment:read_all", resource: "payment", action: "read_all" },
      { code: "account:lock", resource: "account", action: "lock" },
      { code: "role:assign", resource: "role", action: "assign" },
    ];

    for (const p of permissions) {
      await client.query(
        `INSERT INTO permissions (code, resource, action) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
        [p.code, p.resource, p.action]
      );
    }

    // Role-Permission mapping
    const rolePerms = {
      OPERATIONS_STAFF: ["booking:read", "booking:cancel", "trip:read", "trip:cancel", "driver:read"],
      USER_STAFF: ["customer:read", "customer:write", "customer:search", "driver:read"],
      FINANCE_STAFF: ["payment:read", "payment:read_all"],
      SUPERVISOR: ["booking:read", "booking:cancel", "trip:read", "trip:cancel", "driver:read", "customer:read", "payment:read"],
      ADMIN: ["customer:read", "customer:write", "customer:search", "driver:read", "driver:approve", "driver:reject",
              "booking:read", "booking:cancel", "trip:read", "trip:cancel", "payment:read", "payment:read_all",
              "account:lock", "role:assign"],
      BOARD: ["payment:read_all", "customer:read", "driver:read", "booking:read", "trip:read"],
    };

    for (const [role, perms] of Object.entries(rolePerms)) {
      for (const perm of perms) {
        await client.query(
          `INSERT INTO role_permissions (role_code, permission_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [role, perm]
        );
      }
    }

    const password = process.env.SEED_PASSWORD || "Admin@123456";
    const passwordHash = await bcrypt.hash(password, 10);

    // Internal accounts (admin, board, employees)
    const internalAccounts = [
      { id: SEED_IDS.admin, email: "admin@cabsystem.com", phone: "+84900000001", name: "System Admin", role: "ADMIN" },
      { id: SEED_IDS.board, email: "board@cabsystem.com", phone: "+84900000002", name: "Board Director", role: "BOARD" },
      { id: SEED_IDS.ops_staff, email: "ops@cabsystem.com", phone: "+84900000003", name: "Operations Staff", role: "OPERATIONS_STAFF" },
      { id: SEED_IDS.user_staff, email: "userstaff@cabsystem.com", phone: "+84900000004", name: "User Staff", role: "USER_STAFF" },
      { id: SEED_IDS.finance_staff, email: "finance@cabsystem.com", phone: "+84900000005", name: "Finance Staff", role: "FINANCE_STAFF" },
      { id: SEED_IDS.supervisor, email: "supervisor@cabsystem.com", phone: "+84900000006", name: "Supervisor", role: "SUPERVISOR" },
    ];

    for (const acc of internalAccounts) {
      await client.query(
        `INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [acc.id, acc.email, hashPhone(acc.phone), passwordHash, acc.name]
      );
      await client.query(
        `INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, $2, TRUE)
         ON CONFLICT DO NOTHING`,
        [acc.id, acc.role]
      );
    }

    // Customer accounts
    const customers = [
      { id: SEED_IDS.customer1, email: "customer1@example.com", phone: "+84901000001", name: "Nguyen Van A" },
      { id: SEED_IDS.customer2, email: "customer2@example.com", phone: "+84901000002", name: "Tran Thi B" },
    ];

    for (const c of customers) {
      await client.query(
        `INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [c.id, c.email, hashPhone(c.phone), passwordHash, c.name]
      );
      await client.query(
        `INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, 'CUSTOMER', TRUE)
         ON CONFLICT DO NOTHING`,
        [c.id]
      );
    }

    // Driver accounts (approved, so ACTIVE)
    const drivers = [
      { id: SEED_IDS.driver1, phone: "+84902000001", name: "Driver One" },
      { id: SEED_IDS.driver2, phone: "+84902000002", name: "Driver Two" },
      { id: SEED_IDS.driver3, phone: "+84902000003", name: "Driver Three" },
      { id: SEED_IDS.driver4, phone: "+84902000004", name: "Driver Four" },
      { id: SEED_IDS.driver5, phone: "+84902000005", name: "Driver Five" },
    ];

    for (const d of drivers) {
      await client.query(
        `INSERT INTO accounts (id, phone_hash, password_hash, display_name, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (id) DO NOTHING`,
        [d.id, hashPhone(d.phone), passwordHash, d.name]
      );
      await client.query(
        `INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, 'DRIVER', TRUE)
         ON CONFLICT DO NOTHING`,
        [d.id]
      );
    }

    console.log("[SEED] Identity seed completed.");
  } catch (err) {
    console.error("[SEED] Identity seed failed:", err.message);
  } finally {
    client.release();
  }
}

module.exports = { seed, SEED_IDS, hashPhone };
