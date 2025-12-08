const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');

// Ensure the directory exists (Critical for Railway Volumes)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: console.log });

const initDB = () => {
  db.pragma('journal_mode = WAL');
  
  // 1. Define Schema (Keep all tables as patient actions still use them)
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
      symptoms TEXT,
      medical_history TEXT,
      allergies TEXT,
      blood_group TEXT,
      emergency_contacts TEXT,
      has_insurance BOOLEAN DEFAULT 0,
      insurance_details TEXT,
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
      reason TEXT,
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

    -- NEW MEDICAL TABLES (Keeping these for data storage, even without dedicated screens)
    CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT, cost REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, test_ids TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT, cost REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, base_cost REAL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, operation_name TEXT NOT NULL, doctor_id INTEGER, assistant_name TEXT, anesthesiologist_name TEXT, notes TEXT, status TEXT DEFAULT 'scheduled', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY AUTOINCREMENT, room_number TEXT NOT NULL, type TEXT DEFAULT 'General', status TEXT DEFAULT 'available', cost_per_day REAL NOT NULL);
    CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL, bed_id INTEGER NOT NULL, doctor_id INTEGER NOT NULL, entry_date DATETIME NOT NULL, discharge_date DATETIME, status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `;
  
  db.exec(schema);

  // 2. Auto-Migrations (Ensure columns exist in legacy DBs)
  const columnsToAdd = [
    { table: 'patients', name: 'symptoms', type: 'TEXT' },
    { table: 'patients', name: 'medical_history', type: 'TEXT' },
    { table: 'patients', name: 'allergies', type: 'TEXT' },
    { table: 'patients', name: 'blood_group', type: 'TEXT' },
    { table: 'patients', name: 'emergency_contacts', type: 'TEXT' },
    { table: 'patients', name: 'has_insurance', type: 'BOOLEAN DEFAULT 0' },
    { table: 'patients', name: 'insurance_details', type: 'TEXT' },
    { table: 'appointments', name: 'reason', type: 'TEXT' },
    { table: 'beds', name: 'cost_per_day', type: 'REAL DEFAULT 0' }
  ];

  columnsToAdd.forEach(col => {
    try {
      const tableInfo = db.pragma(`table_info(${col.table})`);
      const exists = tableInfo.some(info => info.name === col.name);
      if (!exists) {
        console.log(`Migrating: Adding ${col.name} to ${col.table}`);
        db.prepare(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.type}`).run();
      }
    } catch (err) {
      // Table might not exist yet if fresh install, handled by schema above
    }
  });

  // 3. Seed Users (Include all expanded roles)
  const usersToSeed = [
    { username: 'admin', role: 'admin', fullName: 'System Admin' },
    { username: 'manager', role: 'manager', fullName: 'Hospital Manager' },
    { username: 'receptionist', role: 'receptionist', fullName: 'Front Desk' },
    { username: 'accountant', role: 'accountant', fullName: 'Chief Accountant' },
    { username: 'labtech', role: 'technician', fullName: 'Lab Technician' },
    { username: 'doctor', role: 'doctor', fullName: 'General Doctor' }, 
    { username: 'nurse', role: 'nurse', fullName: 'Head Nurse' },       
    { username: 'pharmacist', role: 'pharmacist', fullName: 'Chief Pharmacist' },
    { username: 'hr', role: 'hr', fullName: 'HR Manager' },             
  ];

  const bcrypt = require('bcryptjs');
  const insertUser = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
  const checkUser = db.prepare('SELECT id FROM users WHERE username = ?');

  usersToSeed.forEach(user => {
    if (!checkUser.get(user.username)) {
      const hash = bcrypt.hashSync(`${user.username}123`, 10);
      insertUser.run(user.username, hash, user.fullName, user.role);
      console.log(`Seeded user: ${user.username}`);
    }
  });

  // 4. Seed Medical Catalogs (Keep existing seeding, as patient actions still use them)
  if (db.prepare('SELECT COUNT(*) FROM lab_tests').get()['COUNT(*)'] === 0) {
    const tests = [
      { name: 'CBC (Complete Blood Count)', cost: 15, category: 'Hematology' },
      { name: 'Lipid Profile', cost: 25, category: 'Biochemistry' },
      { name: 'Liver Function Test', cost: 30, category: 'Biochemistry' },
      { name: 'Thyroid Panel', cost: 40, category: 'Hormones' },
      { name: 'Urinalysis', cost: 10, category: 'Microbiology' },
      { name: 'Blood Sugar (Fasting)', cost: 8, category: 'Biochemistry' },
      { name: 'Malaria Smear', cost: 12, category: 'Microbiology' }
    ];
    const insertTest = db.prepare('INSERT INTO lab_tests (name, category, cost) VALUES (?, ?, ?)');
    tests.forEach(t => insertTest.run(t.name, t.category, t.cost));
    console.log('Seeded lab tests.');
  }

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
    console.log('Seeded nurse services.');
  }

  if (db.prepare('SELECT COUNT(*) FROM beds').get()['COUNT(*)'] === 0) {
    const insertBed = db.prepare('INSERT INTO beds (room_number, type, status, cost_per_day) VALUES (?, ?, ?, ?)');
    for(let i=1; i<=8; i++) insertBed.run(`10${i}`, 'General', 'available', 20);
    for(let i=1; i<=4; i++) insertBed.run(`20${i}`, 'Private', 'available', 50);
    for(let i=1; i<=2; i++) insertBed.run(`ICU-${i}`, 'ICU', 'available', 150);
    console.log('Seeded beds.');
  }

  if (db.prepare('SELECT COUNT(*) FROM operations_catalog').get()['COUNT(*)'] === 0) {
    const ops = [
      { name: 'Appendectomy', cost: 500 },
      { name: 'Hernia Repair', cost: 400 },
      { name: 'C-Section', cost: 800 },
      { name: 'Tonsillectomy', cost: 300 }
    ];
    const insertOp = db.prepare('INSERT INTO operations_catalog (name, base_cost) VALUES (?, ?)');
    ops.forEach(o => insertOp.run(o.name, o.cost));
    console.log('Seeded operations catalog.');
  }

  // 5. Seed Medical Staff (Include all expanded types)
  const existingStaff = db.prepare('SELECT COUNT(*) as count FROM medical_staff').get();
  
  if (existingStaff.count === 0) {
    const staff = [
      { employee_id: 'DOC-001', full_name: 'Dr. Sarah Wilson', type: 'doctor', department: 'Cardiology', specialization: 'Cardiologist', consultation_fee: 100, email: 'sarah@allcare.com', phone: '555-0101' },
      { employee_id: 'NUR-001', full_name: 'Nurse Emily Clarke', type: 'nurse', department: 'General Ward', specialization: 'General Care', consultation_fee: 0, email: 'emily@allcare.com', phone: '555-0102' },
      { employee_id: 'TEC-001', full_name: 'Technician Alex', type: 'technician', department: 'Laboratory', specialization: 'Medical Imaging', consultation_fee: 0, email: 'alex@allcare.com', phone: '555-0104' },
      { employee_id: 'ANS-001', full_name: 'Dr. John Anest', type: 'anesthesiologist', department: 'Anesthesiology', specialization: 'General Anesthesia', consultation_fee: 200, email: 'anest@allcare.com', phone: '555-0108' },
      { employee_id: 'MAS-001', full_name: 'Assistant Maria', type: 'medical_assistant', department: 'General', specialization: 'Patient Support', consultation_fee: 0, email: 'maria@allcare.com', phone: '555-0109' },
      { employee_id: 'PHR-001', full_name: 'Pharmacist Ben', type: 'pharmacist', department: 'Pharmacy', specialization: 'Clinical Pharmacy', consultation_fee: 0, email: 'ben@allcare.com', phone: '555-0105' },
      { employee_id: 'HRM-001', full_name: 'HR Mark Lee', type: 'hr_manager', department: 'Human Resources', specialization: 'HR Specialist', consultation_fee: 0, email: 'mark@allcare.com', phone: '555-0107' },
    ];
    const insertStaff = db.prepare(`
      INSERT INTO medical_staff (employee_id, full_name, type, department, specialization, consultation_fee, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    staff.forEach(s => insertStaff.run(s.employee_id, s.full_name, s.type, s.department, s.specialization, s.consultation_fee, s.email, s.phone));
    console.log('Seeded initial medical staff.');
  }
};