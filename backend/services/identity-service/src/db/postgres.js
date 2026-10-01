const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0];
}

module.exports = {
  pool,
  checkDatabase,
};
