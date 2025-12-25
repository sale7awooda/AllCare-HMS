const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ROLE_PERMISSIONS } = require('../utils/rbac_backend_mirror');

// Strategy: Use DB_PATH env, otherwise /data volume (Railway), otherwise project root
const getDbPath = () => {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  
  // Check if we are in a container with a /data volume
  if (fs.existsSync('/data')) return '/data/allcare.db';
  
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
try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); 
  db.pragma('synchronous = NORMAL'); 
  db.pragma('foreign_keys = ON');
} catch (e) {
  console.error("CRITICAL: Failed to open SQLite database:", e);
  // On Railway, sometimes the mounted volume is ready but permissions are locked
  // We try a fallback in the local folder if root /data fails
  if (dbPath.startsWith('/data')) {
      const fallbackPath = path.resolve(__dirname, '../../allcare.db');
      console.log(`[Database] Attempting fallback to ${fallbackPath}`);
      db = new Database(fallbackPath);
  } else {
      process.exit(1);
  }
}

const initDB = (forceReset = false) => {
  if (forceReset) {
    console.log('[Database] Resetting data...');
    try {
      db.close();
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
      db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
    } catch (e) {
      console.error("[Database] Reset failed:", e);
    }
  }

  console.log('[Database] Verifying schema...');

  // --- Core Tables ---
  db.prepare(`
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
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `).run();

  db.prepare(`
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
      status TEXT CHECK(status IN ('active', 'inactive', 'dismissed', 'onleave')) DEFAULT 'active',
      is_available BOOLEAN DEFAULT 1,
      available_days TEXT,
      available_time_start TEXT,
      available_time_end TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      base_salary REAL DEFAULT 0,
      join_date DATE,
      bank_details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
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
    )
  `).run();

  db.prepare(`
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
      daily_token INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(medical_staff_id) REFERENCES medical_staff(id)
    )
  `).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS hr_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, date DATE NOT NULL, status TEXT, check_in TIME, check_out TIME, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_leaves (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, type TEXT, start_date DATE, end_date DATE, reason TEXT, status TEXT, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();
  db.prepare(`
    CREATE TABLE IF NOT EXISTS hr_payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      staff_id INTEGER NOT NULL, 
      month TEXT, 
      base_salary REAL, 
      total_bonuses REAL, 
      total_fines REAL, 
      net_salary REAL, 
      status TEXT, 
      generated_at DATETIME,
      payment_method TEXT,
      transaction_ref TEXT,
      payment_notes TEXT,
      payment_date DATETIME,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_financials (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, type TEXT, amount REAL, reason TEXT, date DATE, status TEXT, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE,
      patient_id INTEGER,
      total_amount REAL,
      paid_amount REAL DEFAULT 0,
      status TEXT,
      bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_settlement_bill BOOLEAN DEFAULT 0,
      settlement_for_patient_id INTEGER,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    )
  `).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS billing_items (id INTEGER PRIMARY KEY AUTOINCREMENT, billing_id INTEGER, description TEXT, amount REAL, FOREIGN KEY(billing_id) REFERENCES billing(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, category TEXT, amount REAL, method TEXT, reference_id INTEGER, details TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, results_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS specializations (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, related_role TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS tax_rates (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, rate REAL, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY AUTOINCREMENT, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();

  seedData();
};

const seedData = () => {
  const bcrypt = require('bcryptjs');

  console.log('[Seed] Checking for initial data...');

  const tx = db.transaction(() => {
    // 1. RBAC Permissions
    const permCount = db.prepare('SELECT count(*) as count FROM role_permissions').get()?.count || 0;
    if (permCount === 0) {
      const stmt = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
      Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => stmt.run(role, JSON.stringify(perms)));
      console.log('- [Seed] RBAC permissions created.');
    }

    // 2. Default Users
    const userCount = db.prepare('SELECT count(*) as count FROM users').get()?.count || 0;
    if (userCount === 0) {
      const defaultUsers = [
          { u: 'admin', p: 'admin123', n: 'System Administrator', r: 'admin' },
          { u: 'doctor', p: 'doctor123', n: 'Dr. Mohammed Ahmed', r: 'doctor' },
          { u: 'manager', p: 'manager123', n: 'Operational Manager', r: 'manager' },
          { u: 'receptionist', p: 'receptionist123', n: 'Front Desk Reception', r: 'receptionist' },
          { u: 'labtech', p: 'labtech123', n: 'Lab Technician', r: 'technician' },
          { u: 'accountant', p: 'accountant123', n: 'Financial Accountant', r: 'accountant' },
          { u: 'hr', p: 'hr123', n: 'HR Coordinator', r: 'hr' }
      ];
      const stmt = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
      defaultUsers.forEach(d => stmt.run(d.u, bcrypt.hashSync(d.p, 10), d.n, d.r));
      console.log('- [Seed] System users created for all roles.');
    }

    // 3. Medical Staff
    const staffCount = db.prepare('SELECT count(*) as count FROM medical_staff').get()?.count || 0;
    if (staffCount === 0) {
      const initialStaff = [
          { eid: 'DOC-001', n: 'Dr. Omer Khalid', t: 'doctor', d: 'Internal Medicine', s: 'Physician', f: 150, ff: 100, fe: 250, sal: 15000 },
          { eid: 'DOC-002', n: 'Dr. Fatima Idris', t: 'doctor', d: 'Surgery', s: 'Surgical Specialist', f: 300, ff: 200, fe: 500, sal: 20000 },
          { eid: 'NUR-001', n: 'Nurse Hiba Osman', t: 'nurse', d: 'Nursing', s: 'Senior Nurse', f: 0, ff: 0, fe: 0, sal: 6000 }
      ];
      const stmt = db.prepare(`
        INSERT INTO medical_staff (
          employee_id, full_name, type, department, specialization, 
          consultation_fee, consultation_fee_followup, consultation_fee_emergency, base_salary, status, available_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]')
      `);
      initialStaff.forEach(s => stmt.run(s.eid, s.n, s.t, s.d, s.s, s.f, s.ff, s.fe, s.sal));
      console.log('- [Seed] Medical staff loaded.');
    }

    // 4. Demo Patients
    const patientCount = db.prepare('SELECT count(*) as count FROM patients').get()?.count || 0;
    if (patientCount === 0) {
      const demoPatients = [
          { id: 'P250301', n: 'Ahmed Ibrahim', p: '0912345678', a: 'Atbara, Sector 1', age: 45, g: 'male', t: 'outpatient', b: 'O+' },
          { id: 'P250302', n: 'Sara Abdelrahman', p: '0998765432', a: 'Atbara, Market St.', age: 28, g: 'female', t: 'inpatient', b: 'A-' }
      ];
      const stmt = db.prepare(`
        INSERT INTO patients (patient_id, full_name, phone, address, age, gender, type, blood_group, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
      `);
      demoPatients.forEach(p => stmt.run(p.id, p.n, p.p, p.a, p.age, p.g, p.t, p.b));
      console.log('- [Seed] Demo patients loaded.');
    }

    // 5. Beds
    const bedCount = db.prepare('SELECT count(*) as count FROM beds').get()?.count || 0;
    if (bedCount === 0) {
      const beds = [
          { no: '101', t: 'General', c: 50 }, { no: '201', t: 'Private', c: 250 }, { no: '301', t: 'ICU', c: 1200 }
      ];
      const stmt = db.prepare("INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, 'available')");
      beds.forEach(b => stmt.run(b.no, b.t, b.c));
      console.log('- [Seed] Wards configured.');
    }

    // 6. Local Configurations (Settings, Taxes, Methods)
    const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get()?.count || 0;
    if (pmCount === 0) {
      const pms = [['Cash', 'نقدي'], ['Bankak Transfer', 'تحويل بنكك'], ['Insurance', 'تأمين']];
      const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      pms.forEach(p => stmt.run(p[0], p[1]));
      db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run('Standard VAT', 'ضريبة القيمة المضافة', 15, 1);
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalName', 'AllCare General Hospital');
      console.log('- [Seed] Financial methods and system settings configured.');
    }

    // 7. Expanded Catalog (Lab, Nurse, Ops, Departments)
    const deptCount = db.prepare('SELECT count(*) as count FROM departments').get()?.count || 0;
    if (deptCount === 0) {
        db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)').run('Internal Medicine', 'الباطنية');
        db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)').run('Surgery', 'الجراحة');
        db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, cost, normal_range) VALUES (?, ?, ?, ?, ?)').run('CBC', 'عد دم كامل', 'Hematology', 45, 'WBC: 4.0-11.0');
        db.prepare('INSERT INTO nurse_services (name_en, name_ar, cost) VALUES (?, ?, ?)').run('IV Injection', 'حقنة وريدية', 10);
        console.log('- [Seed] Medical catalogs loaded.');
    }

    // 8. Generate Initial Activity (Appointments & Bills)
    const apptCount = db.prepare('SELECT count(*) as count FROM appointments').get()?.count || 0;
    if (apptCount === 0) {
        const pId = db.prepare('SELECT id FROM patients LIMIT 1').get()?.id;
        const sId = db.prepare('SELECT id FROM medical_staff LIMIT 1').get()?.id;
        if (pId && sId) {
            // Bill
            const bInfo = db.prepare("INSERT INTO billing (bill_number, patient_id, total_amount, paid_amount, status) VALUES ('B-1001', ?, 150, 150, 'paid')").run(pId);
            db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, 'Consultation Fee', 150)").run(bInfo.lastInsertRowid);
            // Appointment
            db.prepare(`INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type, status, billing_status, bill_id, daily_token) 
                       VALUES ('APT-1001', ?, ?, datetime('now'), 'Consultation', 'completed', 'paid', ?, 1)`).run(pId, sId, bInfo.lastInsertRowid);
            // Transaction
            db.prepare("INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description) VALUES ('income', 'Bill Payment', 150, 'Cash', ?, '{}', datetime('now'), 'Initial seed payment')").run(bInfo.lastInsertRowid);
            console.log('- [Seed] Live activity logs generated.');
        }
    }
  });

  try {
    tx();
    console.log('[Seed] Database initialization complete.');
  } catch (err) {
    console.error('[Seed] Transaction failed:', err);
  }
};

module.exports = { db, initDB };
