const { pool } = require("../db/postgres");

async function findByEmail(client, email) {
  const { rows } = await client.query(
    "SELECT a.*, ar.role_code FROM accounts a LEFT JOIN account_roles ar ON a.id = ar.account_id AND ar.is_primary = TRUE WHERE lower(a.email) = $1 LIMIT 1",
    [email]
  );
  return rows[0];
}

async function findByPhoneHash(client, phoneHash) {
  const { rows } = await client.query(
    "SELECT a.*, ar.role_code FROM accounts a LEFT JOIN account_roles ar ON a.id = ar.account_id AND ar.is_primary = TRUE WHERE a.phone_hash = $1 LIMIT 1",
    [phoneHash]
  );
  return rows[0];
}

async function findPublicById(id) {
  const { rows } = await pool.query(
    `SELECT a.id, a.email, a.display_name, a.status, a.last_login_at,
            a.created_at, a.updated_at, ar.role_code
     FROM accounts a
     JOIN account_roles ar ON ar.account_id = a.id AND ar.is_primary = TRUE
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
}

async function findPermissions(role) {
  const { rows } = await pool.query(
    "SELECT permission_code FROM role_permissions WHERE role_code = $1",
    [role]
  );
  return rows;
}

module.exports = { findByEmail, findByPhoneHash, findPublicById, findPermissions };
