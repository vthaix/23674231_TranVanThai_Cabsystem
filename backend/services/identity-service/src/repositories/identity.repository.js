// PostgreSQL access for the identity service.

function begin(db) {
  return db.query("BEGIN");
}

function findAccounts(db, params) {
  return db.query("SELECT id FROM accounts WHERE lower(email) = $1 OR phone_hash = $2 LIMIT 1", params);
}

function rollback(db) {
  return db.query("ROLLBACK");
}

function insertAccounts(db, params) {
  return db.query(`INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`, params);
}

function insertAccountRoles(db, params) {
  return db.query(`INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, 'CUSTOMER', TRUE)`, params);
}

function commit(db) {
  return db.query("COMMIT");
}

function deleteAccounts(db, params) {
  return db.query("DELETE FROM accounts WHERE id = $1 AND status = 'PENDING'", params);
}

function updateAccounts(db, params) {
  return db.query(`UPDATE accounts SET status = 'ACTIVE', updated_at = NOW() WHERE id = $1`, params);
}

function insertOutboxEvents(db, params) {
  return db.query(`INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, topic, partition_key, payload, request_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')`, params);
}

function updateAccounts2(db, params) {
  return db.query("UPDATE accounts SET failed_login_count = $1, locked_until = $2, lock_reason = 'Too many failed attempts', updated_at = NOW() WHERE id = $3", params);
}

function updateAccounts3(db, params) {
  return db.query("UPDATE accounts SET failed_login_count = $1, updated_at = NOW() WHERE id = $2", params);
}

function updateAccounts4(db, params) {
  return db.query("UPDATE accounts SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW(), updated_at = NOW() WHERE id = $1", params);
}

function findAccounts2(db, params) {
  return db.query(`SELECT a.id, a.phone_hash, a.status, ar.role_code
    FROM accounts a JOIN account_roles ar ON ar.account_id = a.id AND ar.is_primary = TRUE
    WHERE a.id = $1`, params);
}

function findAccounts3(db, params) {
  return db.query("SELECT id FROM accounts WHERE phone_hash = $1", params);
}

function insertAccounts2(db, params) {
  return db.query(`INSERT INTO accounts (id, email, phone_hash, password_hash, display_name, status)
       VALUES ($1, $2, $3, $4, $5, 'PENDING')`, params);
}

function activateDriverAccount(db, id) {
  return db.query(`UPDATE accounts SET status = 'ACTIVE', updated_at = NOW()
    WHERE id = $1 AND status IN ('PENDING', 'ACTIVE')
      AND EXISTS (SELECT 1 FROM account_roles WHERE account_id = $1 AND role_code = 'DRIVER')
    RETURNING id`, [id]);
}

function deleteDriverAccount(db, id) {
  return db.query(`DELETE FROM accounts
    WHERE id = $1 AND EXISTS (
      SELECT 1 FROM account_roles WHERE account_id = $1 AND role_code = 'DRIVER'
    ) RETURNING id`, [id]);
}

function insertAccountRoles2(db, params) {
  return db.query(`INSERT INTO account_roles (account_id, role_code, is_primary) VALUES ($1, $2, TRUE)`, params);
}

module.exports = { begin, findAccounts, rollback, insertAccounts, insertAccountRoles, commit, deleteAccounts, updateAccounts, insertOutboxEvents, updateAccounts2, updateAccounts3, updateAccounts4, findAccounts2, findAccounts3, insertAccounts2, insertAccountRoles2, activateDriverAccount, deleteDriverAccount };
