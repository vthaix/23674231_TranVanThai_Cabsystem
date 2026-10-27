// Apply schema migrations before rebuilding the demo dataset.
const fs = require('fs');
const path = require('path');

const backendDir = path.join(__dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(backendDir, '.env'), 'utf8')
  .split(/\r?\n/)
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1)];
  }));

async function main() {
  for (const name of ['identity', 'customer', 'driver', 'booking', 'trip', 'payment']) {
    const password = env[`${name.toUpperCase()}_DB_PASSWORD`];
    if (!password) throw new Error(`Missing ${name.toUpperCase()}_DB_PASSWORD in backend/.env`);
    process.env.DATABASE_URL = `postgresql://${name}:${encodeURIComponent(password)}@127.0.0.1:5432/${name}_db`;
    const { pool, runMigrations } = require(path.join(backendDir, 'services', `${name}-service`, 'src', 'db', 'postgres'));
    try {
      await runMigrations();
      console.log(`${name}_db: migrations ready`);
    } finally {
      await pool.end();
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
