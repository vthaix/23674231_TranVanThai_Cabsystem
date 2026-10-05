const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { hashPhone } = require('../shared/src/crypto');

const adminId = '00000000-0000-4000-8000-000000000001';
const passwordHash = '$2a$10$wrVP5/5ZS.Wi1VFGstA9XuZ7FsvZ1yHG57Od/CLQztbJWCDWOo5g2'; // 12345678
const permissions = [
  ['customer:read', 'customer', 'read'],
  ['customer:write', 'customer', 'write'],
  ['customer:search', 'customer', 'search'],
  ['driver:read', 'driver', 'read'],
  ['driver:approve', 'driver', 'approve'],
  ['driver:reject', 'driver', 'reject'],
  ['booking:read', 'booking', 'read'],
  ['booking:cancel', 'booking', 'cancel'],
  ['trip:read', 'trip', 'read'],
  ['trip:cancel', 'trip', 'cancel'],
  ['payment:read', 'payment', 'read'],
  ['payment:read_all', 'payment', 'read_all'],
  ['account:lock', 'account', 'lock'],
  ['role:assign', 'role', 'assign'],
];

async function ensureDemoAdmin(db) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO roles(code,name) VALUES('ADMIN','Administrator')
      ON CONFLICT(code) DO NOTHING`);
    for (const [code, resource, action] of permissions) {
      await client.query(`INSERT INTO permissions(code,resource,action) VALUES($1,$2,$3)
        ON CONFLICT(code) DO NOTHING`, [code, resource, action]);
      await client.query(`INSERT INTO role_permissions(role_code,permission_code)
        VALUES('ADMIN',$1) ON CONFLICT DO NOTHING`, [code]);
    }
    // The schema requires a phone hash; use the email as a non-phone sentinel.
    await client.query(`INSERT INTO accounts(id,email,phone_hash,password_hash,display_name,status)
      VALUES($1,'admin@gmail.com',$2,$3,'Administrator','ACTIVE')
      ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,phone_hash=EXCLUDED.phone_hash,
      password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name,status='ACTIVE'`,
      [adminId, hashPhone('admin@gmail.com'), passwordHash]);
    await client.query(`INSERT INTO account_roles(account_id,role_code,is_primary)
      VALUES($1,'ADMIN',true) ON CONFLICT(account_id,role_code) DO UPDATE SET is_primary=true`, [adminId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const env = Object.fromEntries(fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8')
    .split(/\r?\n/).filter(line => line && !line.startsWith('#'))
    .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
  const pool = new Pool({ host: 'localhost', port: 5432, user: 'identity', database: 'identity_db',
    password: env.IDENTITY_DB_PASSWORD });
  ensureDemoAdmin(pool)
    .then(() => console.log('Admin account ready: admin@gmail.com'))
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { ensureDemoAdmin, passwordHash, adminId };
