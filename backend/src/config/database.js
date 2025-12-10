
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });

const initDB = () => {
  db.pragma('journal_mode = WAL');

  // --- SMART RESET LOGIC ---
  let shouldReset = false;
  try {
    // 1. Check for hr_attendance table
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hr_attendance'").get();
    if (!tableCheck) {
      console.log('⚠️  OUTDATED SCHEMA DETECTED (Missing HR tables). Resetting database...');
      shouldReset = true;
    }
    
    // 2. Check Medical Staff for base_salary and available_days
    if (!shouldReset) {
         const staffTableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='medical_staff'").get();
         if (staffTableCheck) {
             const columns = db.pragma('table_info(medical_staff)');
             const hasSalary = columns.some(col => col.name === 'base_salary');
             const hasSchedule = columns.some(col => col.name === 'available_days');
             const hasEmergencyFee = columns.some(col => col.name === 'consultation_fee_emergency');
             
             if (!hasSalary || !hasSchedule || !hasEmergencyFee) {
                console.log('⚠️  OUTDATED SCHEMA DETECTED (Missing staff fields). Resetting database...');
                shouldReset = true;
             }
         }
    }

  } catch (e) {
    console.log('Database check failed, proceeding with initialization.', e);
  }

  if (shouldReset) {
    const tables = [
      'users', 'patients', 'medical_staff', 'appointments', 'billing', 'billing_items',
      'lab_tests', 'lab_requests', 'nurse_services', 'operations_catalog', 'operations',
      'beds', 'admissions', 'inpatient_notes', 'departments', 'system_settings',
      'tax_rates', 'payment_methods', 'hr_attendance', 'hr_leaves', 'hr_payroll', 'hr_adjustments'
    ];
    tables.forEach(t => db.exec(`DROP TABLE IF EXISTS ${t}`));
    console.log('✅ Database reset complete. Rebuilding tables...');
  }
  
  // --- 1. PERFECT SCHEMA DEFINITIONS ---
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
      is_available BOOLEAN DEFAULT 1,
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
      name TEXT NOT NULL, 
      category TEXT, 
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
      name TEXT NOT NULL, 
      description TEXT, 
      cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operations_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      name TEXT NOT NULL, 
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
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tax_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      rate REAL NOT NULL, 
      is_active BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      is_active BOOLEAN DEFAULT 1
    );
  `;
  
  db.exec(schema);

  // --- 2. SEED DATA ---

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

  // Lab Tests
  if (db.prepare('SELECT COUNT(*) FROM lab_tests').get()['COUNT(*)'] === 0) {
    const tests = [
      { name: 'CBC (Complete Blood Count)', category: 'Hematology', cost: 15, range: 'N/A' },
      { name: 'Hemoglobin', category: 'Hematology', cost: 5, range: 'M: 13.5-17.5 g/dL' },
      { name: 'WBC Count', category: 'Hematology', cost: 5, range: '4.5-11 K/mcL' },
      { name: 'Platelet Count', category: 'Hematology', cost: 5, range: '150-450 K/mcL' },
      { name: 'Blood Group & Rh', category: 'Hematology', cost: 10, range: 'N/A' },
      { name: 'Fasting Blood Sugar', category: 'Biochemistry', cost: 8, range: '70-100 mg/dL' },
      { name: 'Lipid Profile', category: 'Biochemistry', cost: 35, range: '< 200 mg/dL' },
      { name: 'Liver Function Test', category: 'Biochemistry', cost: 30, range: 'ALT 7-56' },
      { name: 'Kidney Function Test', category: 'Biochemistry', cost: 30, range: 'Creatinine 0.6-1.3' },
      { name: 'Thyroid Profile', category: 'Hormones', cost: 45, range: 'TSH 0.4-4.0' },
      { name: 'Urinalysis', category: 'Microbiology', cost: 10, range: 'N/A' },
      { name: 'Malaria Smear', category: 'Microbiology', cost: 12, range: 'Negative' }
    ];
    const insertTest = db.prepare('INSERT INTO lab_tests (name, category, cost, normal_range) VALUES (?, ?, ?, ?)');
    tests.forEach(t => insertTest.run(t.name, t.category, t.cost, t.range));
    console.log('✅ Lab tests seeded.');
  }

  // Nurse Services
  if (db.prepare('SELECT COUNT(*) FROM nurse_services').get()['COUNT(*)'] === 0) {
    const services = [
      { name: 'Injection / IV', desc: 'Medication administration', cost: 5 },
      { name: 'Dressing Change', desc: 'Wound care', cost: 10 },
      { name: 'Nebulization', desc: 'Respiratory therapy', cost: 8 },
      { name: 'Vitals Check', desc: 'BP, Pulse, Temp', cost: 3 },
      { name: 'Cannula Insertion', desc: 'IV access', cost: 7 }
    ];
    const insertService = db.prepare('INSERT INTO nurse_services (name, description, cost) VALUES (?, ?, ?)');
    services.forEach(s => insertService.run(s.name, s.desc, s.cost));
  }

  // Beds
  if (db.prepare('SELECT COUNT(*) FROM beds').get()['COUNT(*)'] === 0) {
    const insertBed = db.prepare('INSERT INTO beds (room_number, type, status, cost_per_day) VALUES (?, ?, ?, ?)');
    for(let i=1; i<=8; i++) insertBed.run(`10${i}`, 'General', 'available', 20);
    for(let i=1; i<=4; i++) insertBed.run(`20${i}`, 'Private', 'available', 50);
    for(let i=1; i<=2; i++) insertBed.run(`ICU-${i}`, 'ICU', 'available', 150);
    console.log('✅ Beds seeded.');
  }

  // Operations
  if (db.prepare('SELECT COUNT(*) FROM operations_catalog').get()['COUNT(*)'] === 0) {
    const ops = [
      { name: 'Appendectomy', cost: 500 },
      { name: 'Hernia Repair', cost: 400 },
      { name: 'C-Section', cost: 800 },
      { name: 'Tonsillectomy', cost: 300 }
    ];
    const insertOp = db.prepare('INSERT INTO operations_catalog (name, base_cost) VALUES (?, ?)');
    ops.forEach(o => insertOp.run(o.name, o.cost));
  }

  // Medical Staff
  const existingStaff = db.prepare('SELECT COUNT(*) as count FROM medical_staff').get();
  if (existingStaff.count === 0) {
    const staff = [
      { employee_id: 'DOC-001', full_name: 'Dr. Sarah Wilson', type: 'doctor', department: 'Cardiology', specialization: 'Cardiologist', consultation_fee: 100, consultation_fee_followup: 50, consultation_fee_emergency: 150, email: 'sarah@allcare.com', phone: '555-0101', base_salary: 5000, available_days: '["Mon","Tue","Wed","Thu","Fri"]', available_time_start: '09:00', available_time_end: '17:00' },
      { employee_id: 'NUR-001', full_name: 'Nurse Emily Clarke', type: 'nurse', department: 'General Ward', specialization: 'General Care', consultation_fee: 0, consultation_fee_followup: 0, consultation_fee_emergency: 0, email: 'emily@allcare.com', phone: '555-0102', base_salary: 2000, available_days: '["Mon","Tue","Wed","Thu","Fri"]', available_time_start: '07:00', available_time_end: '15:00' },
      { employee_id: 'TEC-001', full_name: 'Technician Alex', type: 'technician', department: 'Laboratory', specialization: 'Medical Imaging', consultation_fee: 0, consultation_fee_followup: 0, consultation_fee_emergency: 0, email: 'alex@allcare.com', phone: '555-0104', base_salary: 2200, available_days: '["Mon","Tue","Wed","Thu","Fri","Sat"]', available_time_start: '08:00', available_time_end: '16:00' },
      { employee_id: 'ANS-001', full_name: 'Dr. John Anest', type: 'anesthesiologist', department: 'Anesthesiology', specialization: 'General Anesthesia', consultation_fee: 200, consultation_fee_followup: 100, consultation_fee_emergency: 300, email: 'anest@allcare.com', phone: '555-0108', base_salary: 4800, available_days: '["Tue","Thu"]', available_time_start: '10:00', available_time_end: '14:00' },
    ];
    const insertStaff = db.prepare(`
      INSERT INTO medical_staff (employee_id, full_name, type, department, specialization, consultation_fee, consultation_fee_followup, consultation_fee_emergency, email, phone, base_salary, available_days, available_time_start, available_time_end, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE('now'))
    `);
    staff.forEach(s => insertStaff.run(s.employee_id, s.full_name, s.type, s.department, s.specialization, s.consultation_fee, s.consultation_fee_followup, s.consultation_fee_emergency, s.email, s.phone, s.base_salary, s.available_days, s.available_time_start, s.available_time_end));
    console.log('✅ Medical staff seeded.');
  }

  // System Settings
  if (db.prepare('SELECT COUNT(*) FROM system_settings').get()['COUNT(*)'] === 0) {
    const insertSetting = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
    insertSetting.run('hospitalName', 'AllCare Hospital');
    insertSetting.run('hospitalAddress', '123 Health Ave, Med City');
    insertSetting.run('hospitalPhone', '555-0100');
    insertSetting.run('currency', '$');
  }
};

module.exports = { initDB, db };
