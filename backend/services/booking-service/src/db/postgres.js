const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDatabase() {
  const result = await pool.query("SELECT 1 AS ok");
  return result.rows[0];
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const migrationsDir = path.join(__dirname, "migrations");
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query("SELECT 1 FROM _migrations WHERE filename = $1", [file]);
      if (rows.length > 0) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO _migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`[MIGRATION booking] Applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }
  } finally {
    client.release();
  }
}

module.exports = { pool, checkDatabase, runMigrations };
