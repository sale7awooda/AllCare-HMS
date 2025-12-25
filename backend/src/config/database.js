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
          { u: 'hr', p: 'hr123', n: 'HR Coordinator', r: 'hr' },
          { u: 'nurse_hiba', p: 'nurse123', n: 'Nurse Hiba Osman', r: 'nurse' }
      ];
      const stmt = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
      defaultUsers.forEach(d => stmt.run(d.u, bcrypt.hashSync(d.p, 10), d.n, d.r));
      console.log('- [Seed] System users expanded.');
    }

    // 3. Departments
    const deptCount = db.prepare('SELECT count(*) as count FROM departments').get()?.count || 0;
    if (deptCount === 0) {
        const depts = [
          ['Internal Medicine', 'الباطنية'], ['Surgery', 'الجراحة'], ['Pediatrics', 'الأطفال'],
          ['Obstetrics & Gynecology', 'النساء والتوليد'], ['Cardiology', 'القلب'], ['Radiology', 'الأشعة'],
          ['Laboratory', 'المختبر'], ['Pharmacy', 'الصيدلية'], ['Emergency', 'الطوارئ'],
          ['Nursing', 'التمريض'], ['Administration', 'الإدارة'], ['Finance', 'المالية'], ['HR', 'الموارد البشرية']
        ];
        const stmt = db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)');
        depts.forEach(d => stmt.run(d[0], d[1]));
        console.log('- [Seed] Departments expanded.');
    }

    // 4. Specializations
    const specCount = db.prepare('SELECT count(*) as count FROM specializations').get()?.count || 0;
    if (specCount === 0) {
        const specs = [
          ['Physician', 'طبيب باطني', 'doctor'], ['General Surgeon', 'جراح عام', 'doctor'],
          ['Pediatrician', 'طبيب أطفال', 'doctor'], ['Obstetrician', 'طبيب نساء وتوليد', 'doctor'],
          ['Cardiologist', 'طبيب قلب', 'doctor'], ['Radiologist', 'طبيب أشعة', 'doctor'],
          ['Lab Technician', 'فني مختبر', 'technician'], ['Pharmacist', 'صيدلي', 'pharmacist'],
          ['Head Nurse', 'كبير ممرضين', 'nurse'], ['Staff Nurse', 'ممرض', 'nurse'],
          ['Accountant', 'محاسب', 'accountant'], ['HR Specialist', 'اختصاصي موارد بشرية', 'hr']
        ];
        const stmt = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
        specs.forEach(s => stmt.run(s[0], s[1], s[2]));
        console.log('- [Seed] Specializations expanded.');
    }

    // 5. Medical Staff
    const staffCount = db.prepare('SELECT count(*) as count FROM medical_staff').get()?.count || 0;
    if (staffCount === 0) {
      const initialStaff = [
          { eid: 'DOC-001', n: 'Dr. Omer Khalid', t: 'doctor', d: 'Internal Medicine', s: 'Physician', f: 150, ff: 100, fe: 250, sal: 15000 },
          { eid: 'DOC-002', n: 'Dr. Fatima Idris', t: 'doctor', d: 'Surgery', s: 'General Surgeon', f: 300, ff: 200, fe: 500, sal: 20000 },
          { eid: 'DOC-003', n: 'Dr. Yasir Mustafa', t: 'doctor', d: 'Cardiology', s: 'Cardiologist', f: 400, ff: 250, fe: 600, sal: 25000 },
          { eid: 'DOC-004', n: 'Dr. Amna Bakri', t: 'doctor', d: 'Pediatrics', s: 'Pediatrician', f: 120, ff: 80, fe: 200, sal: 14000 },
          { eid: 'NUR-001', n: 'Nurse Hiba Osman', t: 'nurse', d: 'Nursing', s: 'Head Nurse', f: 0, ff: 0, fe: 0, sal: 6000 },
          { eid: 'NUR-002', n: 'Nurse Khalid Ali', t: 'nurse', d: 'Nursing', s: 'Staff Nurse', f: 0, ff: 0, fe: 0, sal: 4500 },
          { eid: 'TEC-001', n: 'Tech Ahmed Adam', t: 'technician', d: 'Laboratory', s: 'Lab Technician', f: 0, ff: 0, fe: 0, sal: 5500 },
          { eid: 'PHM-001', n: 'Pharma Sarah Nour', t: 'pharmacist', d: 'Pharmacy', s: 'Pharmacist', f: 0, ff: 0, fe: 0, sal: 7000 }
      ];
      const stmt = db.prepare(`
        INSERT INTO medical_staff (
          employee_id, full_name, type, department, specialization, 
          consultation_fee, consultation_fee_followup, consultation_fee_emergency, base_salary, status, available_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]')
      `);
      initialStaff.forEach(s => stmt.run(s.eid, s.n, s.t, s.d, s.s, s.f, s.ff, s.fe, s.sal));
      console.log('- [Seed] Medical staff expanded.');
    }

    // 6. Demo Patients
    const patientCount = db.prepare('SELECT count(*) as count FROM patients').get()?.count || 0;
    if (patientCount === 0) {
      const demoPatients = [
          { id: 'P250301', n: 'Ahmed Ibrahim', p: '0912345678', a: 'Atbara, Sector 1', age: 45, g: 'male', t: 'outpatient', b: 'O+' },
          { id: 'P250302', n: 'Sara Abdelrahman', p: '0998765432', a: 'Atbara, Market St.', age: 28, g: 'female', t: 'inpatient', b: 'A-' },
          { id: 'P250303', n: 'Mohamed Saeed', p: '0911223344', a: 'Berber, North', age: 62, g: 'male', t: 'outpatient', b: 'B+' },
          { id: 'P250304', n: 'Laila Hassan', p: '0922334455', a: 'Atbara, Railway St.', age: 10, g: 'female', t: 'outpatient', b: 'O-' },
          { id: 'P250305', n: 'Ibrahim Salih', p: '0933445566', a: 'Ad-Damir', age: 35, g: 'male', t: 'emergency', b: 'AB+' },
          { id: 'P250306', n: 'Nour El-Huda', p: '0944556677', a: 'Atbara, Al-Ushara', age: 5, g: 'female', t: 'outpatient', b: 'A+' },
          { id: 'P250307', n: 'Abdelrahim Ali', p: '0955667788', a: 'Atbara, West', age: 50, g: 'male', t: 'inpatient', b: 'O+' }
      ];
      const stmt = db.prepare(`
        INSERT INTO patients (patient_id, full_name, phone, address, age, gender, type, blood_group, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
      `);
      demoPatients.forEach(p => stmt.run(p.id, p.n, p.p, p.a, p.age, p.g, p.t, p.b));
      console.log('- [Seed] Demo patients expanded.');
    }

    // 7. Beds
    const bedCount = db.prepare('SELECT count(*) as count FROM beds').get()?.count || 0;
    if (bedCount === 0) {
      const beds = [
          { no: '101', t: 'General', c: 50 }, { no: '102', t: 'General', c: 50 }, { no: '103', t: 'General', c: 50 },
          { no: '201', t: 'Private', c: 250 }, { no: '202', t: 'Private', c: 250 }, { no: '203', t: 'Private', c: 250 },
          { no: '301', t: 'ICU', c: 1200 }, { no: '302', t: 'ICU', c: 1200 },
          { no: '401', t: 'Emergency', c: 100 }, { no: '402', t: 'Emergency', c: 100 }
      ];
      const stmt = db.prepare("INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, 'available')");
      beds.forEach(b => stmt.run(b.no, b.t, b.c));
      console.log('- [Seed] Wards configured.');
    }

    // 8. Financial Settings
    const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get()?.count || 0;
    if (pmCount === 0) {
      const pms = [['Cash', 'نقدي'], ['Bankak Transfer', 'تحويل بنكك'], ['Insurance', 'تأمين'], ['Credit Card', 'بطاقة ائتمان']];
      const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      pms.forEach(p => stmt.run(p[0], p[1]));
      
      db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run('Standard VAT', 'ضريبة القيمة المضافة', 15, 1);
      
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalName', 'AllCare General Hospital');
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalAddress', 'Atbara, River Nile State, Sudan');
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalPhone', '+249 123 456 789');
      
      const ins = [['Blue Nile Insurance', 'تأمين النيل الأزرق'], ['Shiekan Insurance', 'تأمين شيكان'], ['United Insurance', 'المتحدة للتأمين']];
      const insStmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      ins.forEach(i => insStmt.run(i[0], i[1]));

      const banks = [['Bank of Khartoum', 'بنك الخرطوم'], ['Faisal Islamic Bank', 'بنك فيصل الإسلامي'], ['Omdurman National Bank', 'بنك أمدرمان الوطني']];
      const bankStmt = db.prepare('INSERT INTO banks (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      banks.forEach(b => bankStmt.run(b[0], b[1]));

      console.log('- [Seed] Financial configurations expanded.');
    }

    // 9. Medical Catalogs (Lab, Nurse, Ops)
    const labTestCount = db.prepare('SELECT count(*) as count FROM lab_tests').get()?.count || 0;
    if (labTestCount === 0) {
        const tests = [
          ['CBC', 'عد دم كامل', 'Hematology', 'WBC: 4.0-11.0; RBC: 4.5-5.5; HGB: 12.0-16.0', 45],
          ['Blood Sugar (Fasting)', 'سكر صائم', 'Biochemistry', 'Result: 70-100 mg/dL', 20],
          ['Lipid Profile', 'دهون كاملة', 'Biochemistry', 'Cholesterol: <200; HDL: >40; LDL: <130', 80],
          ['Liver Function Test', 'وظائف كبد', 'Biochemistry', 'ALT: 7-56; AST: 10-40; Bilirubin: 0.1-1.2', 120],
          ['Renal Function Test', 'وظائف كلى', 'Biochemistry', 'Urea: 15-45; Creatinine: 0.6-1.2', 100],
          ['H. Pylori', 'جرثومة المعدة', 'Serology', 'Result: Negative', 60],
          ['Malaria (Rapid)', 'ملاريا سريع', 'Parasitology', 'Result: Negative', 15],
          ['Widal Test', 'تيفويد', 'Serology', 'Result: Negative', 30],
          ['Urine Analysis', 'فحص بول', 'Microscopy', 'Pus Cells: 0-5; RBCs: 0-2', 25]
        ];
        const stmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, normal_range, cost) VALUES (?, ?, ?, ?, ?)');
        tests.forEach(t => stmt.run(t[0], t[1], t[2], t[3], t[4]));

        const nServices = [
          ['IV Injection', 'حقنة وريدية', 'Administration of intravenous medication', 10],
          ['IM Injection', 'حقنة عضلية', 'Administration of intramuscular medication', 5],
          ['Wound Dressing', 'غيار جرح', 'Cleaning and dressing of surgical or accidental wounds', 25],
          ['Vital Signs Monitoring', 'مراقبة العلامات الحيوية', 'Regular check of BP, Heart Rate, and Temp', 15],
          ['Nebulization', 'جلسة رذاذ', 'Respiratory treatment for asthma/congestion', 20],
          ['Catheterization', 'تركيب قسطرة', 'Urinary catheter insertion', 50]
        ];
        const nStmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, description_en, cost) VALUES (?, ?, ?, ?)');
        nServices.forEach(s => nStmt.run(s[0], s[1], s[2], s[3]));

        const ops = [
          ['Appendectomy', 'استئصال الزائدة الدودية', 1500],
          ['Hernia Repair', 'إصلاح فتق', 1200],
          ['Cesarean Section', 'عملية قيصرية', 2500],
          ['Tonsillectomy', 'استئصال اللوزتين', 800],
          ['Gallbladder Removal', 'استئصال المرارة بالمنظار', 3000]
        ];
        const opStmt = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
        ops.forEach(o => opStmt.run(o[0], o[1], o[2]));

        console.log('- [Seed] Medical catalogs expanded.');
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
