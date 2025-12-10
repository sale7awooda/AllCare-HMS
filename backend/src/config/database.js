
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ROLE_PERMISSIONS: DEFAULT_PERMISSIONS } = require('../utils/rbac_backend_mirror');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });

const initDB = (forceReset = false) => {
  db.pragma('journal_mode = WAL');

  if (forceReset) {
    const tables = [
      'users', 'patients', 'medical_staff', 'appointments', 'billing', 'billing_items',
      'lab_tests', 'lab_requests', 'nurse_services', 'nurse_requests', 'operations_catalog', 'operations',
      'beds', 'admissions', 'inpatient_notes', 'departments', 'specializations', 'system_settings',
      'tax_rates', 'payment_methods', 'hr_attendance', 'hr_leaves', 'hr_payroll', 'hr_adjustments', 'role_permissions',
      'insurance_providers'
    ];
    tables.forEach(t => db.exec(`DROP TABLE IF EXISTS ${t}`));
    console.log('✅ Database reset complete. Rebuilding tables...');
  }
  
  // --- 1. SCHEMA DEFINITIONS ---
  const schema = `
    -- USERS & ROLES
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions TEXT NOT NULL, -- JSON array
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- PATIENTS
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      age INTEGER,
      gender TEXT,
      type TEXT DEFAULT 'outpatient',
      symptoms TEXT,
      medical_history TEXT,
      allergies TEXT,
      blood_group TEXT,
      emergency_contacts TEXT, -- JSON
      has_insurance BOOLEAN DEFAULT 0,
      insurance_details TEXT, -- JSON
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- MEDICAL STAFF (HR)
    CREATE TABLE IF NOT EXISTS medical_staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      type TEXT NOT NULL,
      department TEXT,
      specialization TEXT,
      consultation_fee REAL DEFAULT 0,
      consultation_fee_followup REAL DEFAULT 0,
      consultation_fee_emergency REAL DEFAULT 0,
      status TEXT CHECK(status IN ('active', 'inactive', 'dismissed')) DEFAULT 'active',
      is_available BOOLEAN DEFAULT 1, -- Maintained for some legacy checks, but status is primary
      available_days TEXT, -- JSON array of strings e.g. ["Mon", "Tue"]
      available_time_start TEXT, -- HH:mm
      available_time_end TEXT, -- HH:mm
      email TEXT,
      phone TEXT,
      base_salary REAL DEFAULT 0,
      join_date DATE,
      bank_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- HR TABLES
    CREATE TABLE IF NOT EXISTS hr_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late', 'half_day')) DEFAULT 'present',
      check_in TIME,
      check_out TIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    );

    CREATE TABLE IF NOT EXISTS hr_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('sick', 'vacation', 'casual', 'unpaid')) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    );

    CREATE TABLE IF NOT EXISTS hr_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('bonus', 'fine', 'loan')) NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      date DATE NOT NULL,
      status TEXT DEFAULT 'active', -- For loans: active/repaid/deducted
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    );

    CREATE TABLE IF NOT EXISTS hr_payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      month TEXT NOT NULL, -- Format: YYYY-MM
      base_salary REAL NOT NULL,
      total_bonuses REAL DEFAULT 0,
      total_fines REAL DEFAULT 0,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'draft',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    );

    -- APPOINTMENTS
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      medical_staff_id INTEGER NOT NULL,
      appointment_datetime DATETIME NOT NULL,
      type TEXT DEFAULT 'Consultation',
      status TEXT DEFAULT 'pending',
      billing_status TEXT DEFAULT 'unbilled',
      reason TEXT,
      bill_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(medical_staff_id) REFERENCES medical_staff(id)
    );

    -- BILLING
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

    -- MEDICAL CATALOGS & REQUESTS
    CREATE TABLE IF NOT EXISTS lab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      category_en TEXT, 
      category_ar TEXT, 
      cost REAL NOT NULL, 
      normal_range TEXT
    );

    CREATE TABLE IF NOT EXISTS lab_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      patient_id INTEGER NOT NULL, 
      test_ids TEXT NOT NULL, 
      status TEXT DEFAULT 'pending', 
      projected_cost REAL DEFAULT 0, 
      bill_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nurse_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name_en TEXT NOT NULL, 
      name_ar TEXT NOT NULL, 
      description_en TEXT, 
      description_ar TEXT, 
      cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nurse_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      patient_id INTEGER NOT NULL, 
      staff_id INTEGER, 
      service_name TEXT NOT NULL, 
      cost REAL DEFAULT 0, 
      notes TEXT, 
      status TEXT DEFAULT 'pending', 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    );

    CREATE TABLE IF NOT EXISTS operations_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name_en TEXT NOT NULL, 
      name_ar TEXT NOT NULL, 
      base_cost REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      patient_id INTEGER NOT NULL, 
      operation_name TEXT NOT NULL, 
      doctor_id INTEGER, 
      assistant_name TEXT, 
      anesthesiologist_name TEXT, 
      notes TEXT, 
      status TEXT DEFAULT 'requested', 
      projected_cost REAL DEFAULT 0, 
      bill_id INTEGER DEFAULT NULL,
      cost_details TEXT, -- JSON to store full breakdown
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      room_number TEXT NOT NULL, 
      type TEXT DEFAULT 'General', 
      status TEXT DEFAULT 'available', 
      cost_per_day REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      patient_id INTEGER NOT NULL, 
      bed_id INTEGER NOT NULL, 
      doctor_id INTEGER NOT NULL, 
      entry_date DATETIME NOT NULL, 
      discharge_date DATETIME, 
      actual_discharge_date DATETIME,
      status TEXT DEFAULT 'active', 
      notes TEXT, 
      discharge_notes TEXT, 
      discharge_status TEXT, 
      projected_cost REAL DEFAULT 0, 
      bill_id INTEGER DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inpatient_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admission_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL, 
      note TEXT NOT NULL,
      vitals TEXT, 
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(admission_id) REFERENCES admissions(id),
      FOREIGN KEY(doctor_id) REFERENCES medical_staff(id)
    );

    -- CONFIGURATION TABLES
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL UNIQUE,
      description_en TEXT,
      description_ar TEXT
    );

    CREATE TABLE IF NOT EXISTS specializations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL UNIQUE,
      description_en TEXT,
      description_ar TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      rate REAL NOT NULL, 
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL UNIQUE,
      is_active BOOLEAN DEFAULT 1
    );
    
    CREATE TABLE IF NOT EXISTS insurance_providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL UNIQUE,
      is_active BOOLEAN DEFAULT 1
    );
  `;
  
  db.exec(schema);

  // --- 2. SEED DATA ---

  // Role Permissions Seed
  const permCheck = db.prepare('SELECT COUNT(*) as count FROM role_permissions').get();
  if (permCheck.count === 0) {
    const insertPerm = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    Object.entries(DEFAULT_PERMISSIONS).forEach(([role, perms]) => {
      insertPerm.run(role, JSON.stringify(perms));
    });
    console.log('✅ Role permissions seeded.');
  }

  // Users
  const usersToSeed = [
    { username: 'admin', role: 'admin', fullName: 'System Admin' },
    { username: 'manager', role: 'manager', fullName: 'Hospital Manager' },
    { username: 'receptionist', role: 'receptionist', fullName: 'Front Desk' },
    { username: 'labtech', role: 'technician', fullName: 'Lab Technician' },
    { username: 'accountant', role: 'accountant', fullName: 'Finance Officer' },
  ];

  const bcrypt = require('bcryptjs');
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)');
  
  usersToSeed.forEach(user => {
    const hash = bcrypt.hashSync(`${user.username === 'technician' ? 'labtech' : user.username}123`, 10);
    const dbUsername = user.username === 'labtech' ? 'labtech' : user.username;
    insertUser.run(dbUsername, hash, user.fullName, user.role);
  });
  console.log('✅ Users seeded.');

  // Insurance Providers Seed
  if (db.prepare('SELECT COUNT(*) FROM insurance_providers').get()['COUNT(*)'] === 0) {
    const providers = [
        { name_en: "Shiekan Insurance", name_ar: "شيكان للتأمين وإعادة التأمين" },
        { name_en: "The United Insurance", name_ar: "المتحدة للتأمين" },
        { name_en: "Blue Nile Insurance", name_ar: "النيل الأزرق للتأمين" },
        { name_en: "Al-Salama Insurance", name_ar: "السلامة للتأمين" },
        { name_en: "Juba Insurance", name_ar: "جوبا للتأمين" },
        { name_en: "Prime Health", name_ar: "برايم هيلث" },
        { name_en: "Wataniya Insurance", name_ar: "الوطنية للتأمين" },
        { name_en: "General Insurance Co. (Sudan)", name_ar: "شركة التأمين العامة (السودان)" },
        { name_en: "Islamic Insurance Company", name_ar: "شركة التأمين الإسلامية" },
        { name_en: "National Reinsurance Co. (Sudan)", name_ar: "الشركة الوطنية لإعادة التأمين (السودان)" }
    ];
    const insertProvider = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    providers.forEach(p => {
        try {
            insertProvider.run(p.name_en, p.name_ar);
        } catch (e) {
            // Ignore unique constraint errors on re-runs
        }
    });
    console.log('✅ Insurance providers seeded.');
  }

  // Lab Tests (Extended)
  if (db.prepare('SELECT COUNT(*) FROM lab_tests').get()['COUNT(*)'] === 0) {
    const tests = [
      { name_en: 'CBC (Complete Blood Count)', name_ar: 'تعداد الدم الكامل', category_en: 'Hematology', category_ar: 'أمراض الدم', cost: 15, range: 'N/A' }
    ];
    const insertTest = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost, normal_range) VALUES (?, ?, ?, ?, ?, ?)');
    tests.forEach(t => {
      try {
        insertTest.run(t.name_en, t.name_ar, t.category_en, t.category_ar, t.cost, t.range);
      } catch (e) {}
    });
    console.log('✅ Lab tests seeded.');
  }
};

module.exports = { db, initDB };
