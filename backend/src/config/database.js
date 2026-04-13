const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Strategy: Use DB_PATH env, otherwise project root
const getDbPath = () => {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  return path.resolve(__dirname, '../../allcare.db');
};

const dbPath = getDbPath();
const dbDir = path.dirname(dbPath);

// Ensure the directory exists
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    console.warn(`[Database] Could not create directory ${dbDir}, falling back to current dir.`);
  }
}

console.log(`[Database] Target path: ${dbPath}`);

let db;

function openDb() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('foreign_keys = ON');
    return db;
  } catch (e) {
    console.error("CRITICAL: Failed to open SQLite database:", e);
    process.exit(1);
  }
}

const runMigrations = (db) => {
  console.log('[Migrate] Checking for unapplied migrations...');
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(__dirname, '../migrations');
  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

  for (const file of files) {
    const isApplied = db.prepare('SELECT id FROM migrations WHERE name = ?').get(file);
    if (!isApplied) {
      console.log(`[Migrate] Running migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      try {
        // Run migration in a transaction
        const runTx = db.transaction(() => {
          migration.up(db);
          db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
        });
        runTx();
        console.log(`[Migrate] Successfully applied: ${file}`);
      } catch (e) {
        console.error(`[Migrate] Failed to apply ${file}:`, e);
        process.exit(1);
      }
    }
  }
  
  console.log('[Migrate] Database schema is up to date.');
};

const initDB = (forceReset = false) => {
  if (!db) openDb();
  
  if (forceReset) {
    console.log('[Database] Resetting data...');
    try {
      db.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      openDb();
    } catch (e) {
      console.error("[Database] Reset failed:", e);
    }
  }

  runMigrations(db);
};

module.exports = { openDb, initDB, getDb: () => db };
