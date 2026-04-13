exports.up = (db) => {
  console.log('[Migration] Creating audit_log table...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      username   TEXT NOT NULL,
      action     TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
      resource   TEXT NOT NULL,
      resource_id TEXT,
      payload    TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id    ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_resource   ON audit_log(resource);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
  `);
};
