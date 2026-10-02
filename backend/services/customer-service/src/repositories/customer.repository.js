const { pool } = require("../db/postgres");

async function findById(id) {
  const { rows } = await pool.query("SELECT * FROM customer_profiles WHERE id = $1", [id]);
  return rows[0] || null;
}

async function existsById(id) {
  const { rows } = await pool.query("SELECT id FROM customer_profiles WHERE id = $1", [id]);
  return rows.length > 0;
}

async function createCustomer({ id, fullName, email, phoneHash }) {
  await pool.query(
    `INSERT INTO customer_profiles (id, full_name, email, phone_hash, status)
     VALUES ($1, $2, $3, $4, 'ACTIVE')`,
    [id, fullName, email, phoneHash]
  );
}

module.exports = { findById, existsById, createCustomer };
