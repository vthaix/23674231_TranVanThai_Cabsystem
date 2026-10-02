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

async function findPermissions(role) {
  const { rows } = await pool.query(
    "SELECT permission_code FROM role_permissions WHERE role_code = $1",
    [role]
  );
  return rows;
}

module.exports = { findByEmail, findByPhoneHash, findPermissions };
