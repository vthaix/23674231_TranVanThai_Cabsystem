const { pool } = require("../db/postgres");

async function findById(id) {
  const { rows } = await pool.query("SELECT * FROM customer_profiles WHERE id = $1", [id]);
  return rows[0] || null;
}

async function existsById(id) {
  const { rows } = await pool.query("SELECT id FROM customer_profiles WHERE id = $1", [id]);
  return rows.length > 0;
}

async function createCustomer({ id, fullName, email, phoneEnc, phoneHash }) {
  await pool.query(
    `INSERT INTO customer_profiles (id, full_name, email, phone_enc, phone_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
    [id, fullName, email, phoneEnc, phoneHash]
  );
}

async function listCustomers({ limit, offset }) {
  const { rows } = await pool.query(
    `SELECT id, full_name, email, status, created_at
     FROM customer_profiles
     ORDER BY created_at DESC, id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

async function countCustomers() {
  const { rows } = await pool.query("SELECT COUNT(*) AS total FROM customer_profiles");
  return Number(rows[0].total);
}

module.exports = { findById, existsById, createCustomer, listCustomers, countCustomers };
