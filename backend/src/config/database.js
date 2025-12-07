
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
const db = new Database(dbPath, { verbose: console.log });

const initDB = () => {
  db.pragma('journal_mode = WAL');
  
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      age INTEGER,
      gender TEXT,
      type TEXT DEFAULT 'outpatient',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medical_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      type TEXT NOT NULL,
      department TEXT,
      specialization TEXT,
      consultation_fee REAL DEFAULT 0,
      is_available BOOLEAN DEFAULT 1,
      email TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      medical_staff_id INTEGER NOT NULL,
      appointment_datetime DATETIME NOT NULL,
      type TEXT DEFAULT 'Consultation',
      status TEXT DEFAULT 'pending',
      billing_status TEXT DEFAULT 'unbilled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(medical_staff_id) REFERENCES medical_staff(id)
    );

    CREATE TABLE IF NOT EXISTS billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS billing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billing_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY(billing_id) REFERENCES billing(id)
    );
  `;
  
  db.exec(schema);

  // Seed Users for Development
  const usersToSeed = [
    { username: 'admin', role: 'admin', pass: 'admin123', name: 'System Admin' },
    { username: 'receptionist', role: 'receptionist', pass: 'receptionist123', name: 'Front Desk' },
    { username: 'manager', role: 'manager', pass: 'manager123', name: 'Hospital Manager' },
    { username: 'accountant', role: 'accountant', pass: 'accountant123', name: 'Chief Accountant' }
  ];

  const bcrypt = require('bcryptjs');
  const insertUser = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
  const checkUser = db.prepare('SELECT id FROM users WHERE username = ?');

  for (const u of usersToSeed) {
    if (!checkUser.get(u.username)) {
      const hash = bcrypt.hashSync(u.pass, 10);
      insertUser.run(u.username, hash, u.name, u.role);
      console.log(`Seeded user: ${u.username}`);
    }
  }
};

module.exports = { db, initDB };
