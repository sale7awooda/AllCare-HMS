
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ROLE_PERMISSIONS } = require('../utils/rbac_backend_mirror');

// Use process.cwd() to reliably target the project root/working directory in containers
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'allcare.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;
try {
  db = new Database(dbPath);
  // STABILITY FIX: Use DELETE journal mode instead of WAL for containerized environments.
  db.pragma('journal_mode = DELETE');
  db.pragma('synchronous = NORMAL'); 
  db.pragma('foreign_keys = ON');
} catch (e) {
  console.error("CRITICAL: Failed to open SQLite database at", dbPath);
  console.error(e);
  process.exit(1);
}

const initDB = (forceReset = false) => {
  if (forceReset) {
    console.log('Resetting database...');
    if (fs.existsSync(dbPath)) {
        try {
          db.close();
          fs.unlinkSync(dbPath);
          db = new Database(dbPath);
          db.pragma('journal_mode = DELETE');
          db.pragma('synchronous = NORMAL'); 
          db.pragma('foreign_keys = ON');
        } catch (e) {
          console.error("Failed to delete DB:", e);
        }
    }
    return initDB(false);
  }

  // --- 1. Core & Access Control ---
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

  // --- 2. Notifications ---
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

  // --- 3. Medical Staff ---
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

  // --- 4. Patient & Clinical Records ---
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

  // --- 5. HR ---
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

  // --- 6. Billing ---
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

  // --- 7. Medical Services ---
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, results_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`).run();

  // --- 8. Config ---
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

  // RBAC Permissions
  const permCount = db.prepare('SELECT count(*) as count FROM role_permissions').get().count;
  if (permCount === 0) {
    const stmt = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
      stmt.run(role, JSON.stringify(perms));
    });
  }

  // Users
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    const defaultUsers = [
        { u: 'admin', p: 'admin123', n: 'System Administrator', r: 'admin' },
        { u: 'manager', p: 'manager123', n: 'Sarah Manager', r: 'manager' },
        { u: 'receptionist', p: 'receptionist123', n: 'Pam Receptionist', r: 'receptionist' },
        { u: 'accountant', p: 'accountant123', n: 'Angela Accountant', r: 'accountant' },
        { u: 'doctor', p: 'doctor123', n: 'Dr. Gregory House', r: 'doctor' },
        { u: 'nurse', p: 'nurse123', n: 'Nurse Jackie', r: 'nurse' },
        { u: 'labtech', p: 'labtech123', n: 'Dexter Lab', r: 'technician' },
        { u: 'hr', p: 'hr123', n: 'Toby Flenderson', r: 'hr' },
        { u: 'pharmacist', p: 'pharmacist123', n: 'Pharma Phil', r: 'pharmacist' },
    ];
    const stmt = db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
    defaultUsers.forEach(d => stmt.run(d.u, bcrypt.hashSync(d.p, 10), d.n, d.r));
  }

  // Beds Infrastructure (8 Beds)
  const bedCount = db.prepare('SELECT count(*) as count FROM beds').get().count;
  if (bedCount === 0) {
    const beds = [
        { no: '101', t: 'General', c: 150 },
        { no: '102', t: 'General', c: 150 },
        { no: '103', t: 'General', c: 150 },
        { no: '201', t: 'Private', c: 450 },
        { no: '202', t: 'Private', c: 450 },
        { no: '301', t: 'ICU', c: 1200 },
        { no: '302', t: 'ICU', c: 1200 },
        { no: 'ER-1', t: 'Emergency', c: 200 }
    ];
    const stmt = db.prepare('INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, "available")');
    beds.forEach(b => stmt.run(b.no, b.t, b.c));
  }

  // Departments
  const deptCount = db.prepare('SELECT count(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    const depts = [
        { en: 'Internal Medicine', ar: 'الباطنية' },
        { en: 'General Surgery', ar: 'الجراحة العامة' },
        { en: 'Pediatrics', ar: 'الأطفال' },
        { en: 'Obstetrics & Gynecology', ar: 'النساء والتوليد' },
        { en: 'Cardiology', ar: 'أمراض القلب' },
        { en: 'Orthopedics', ar: 'العظام' },
        { en: 'Ophthalmology', ar: 'العيون' },
        { en: 'ENT', ar: 'الأنف والأذن والحنجرة' },
        { en: 'Radiology', ar: 'الأشعة' },
        { en: 'Laboratory', ar: 'المختبر' },
        { en: 'Pharmacy', ar: 'الصيدلية' },
        { en: 'Emergency', ar: 'الطوارئ' },
        { en: 'Nursing', ar: 'التمريض' }
    ];
    const stmt = db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)');
    depts.forEach(d => stmt.run(d.en, d.ar));
  }

  // Specializations
  const specCount = db.prepare('SELECT count(*) as count FROM specializations').get().count;
  if (specCount === 0) {
    const specs = [
        { en: 'Physician', ar: 'ممارس عام', r: 'doctor' },
        { en: 'Surgical Specialist', ar: 'أخصائي جراحة', r: 'doctor' },
        { en: 'Pediatrician', ar: 'أخصائي أطفال', r: 'doctor' },
        { en: 'Cardiologist', ar: 'أخصائي قلب', r: 'doctor' },
        { en: 'Anesthesiologist', ar: 'أخصائي تخدير', r: 'doctor' },
        { en: 'Senior Nurse', ar: 'ممرض أول', r: 'nurse' },
        { en: 'ICU Nurse', ar: 'ممرض عناية مكثفة', r: 'nurse' },
        { en: 'Lab Technician', ar: 'فني مختبر', r: 'technician' }
    ];
    const stmt = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
    specs.forEach(s => stmt.run(s.en, s.ar, s.r));
  }

  // Nurse Services
  const nurseCount = db.prepare('SELECT count(*) as count FROM nurse_services').get().count;
  if (nurseCount === 0) {
    const services = [
        { en: 'IV Line Cannulation', ar: 'تركيب كانيولا', c: 15 },
        { en: 'Wound Dressing (Small)', ar: 'غييار جرح صغير', c: 10 },
        { en: 'Wound Dressing (Large)', ar: 'غيار جرح كبير', c: 25 },
        { en: 'Nebulization', ar: 'جلسة بخار', c: 12 },
        { en: 'Vital Signs Monitor', ar: 'قياس العلامات الحيوية', c: 5 },
        { en: 'Catheterization', ar: 'تركيب قسطرة', c: 30 }
    ];
    const stmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, cost) VALUES (?, ?, ?)');
    services.forEach(s => stmt.run(s.en, s.ar, s.c));
  }

  // Operations Catalog (Sudan Context)
  const opsCount = db.prepare('SELECT count(*) as count FROM operations_catalog').get().count;
  if (opsCount === 0) {
    const ops = [
        { en: 'Appendectomy', ar: 'استئصال الزائدة', c: 1500 },
        { en: 'Herniorrhaphy', ar: 'إصلاح فتق', c: 1200 },
        { en: 'Caesarean Section', ar: 'عملية قيصرية', c: 2500 },
        { en: 'Tonsillectomy', ar: 'استئصال اللوزتين', c: 1100 },
        { en: 'Gallbladder removal', ar: 'استئصال المرارة', c: 2800 },
        { en: 'Orthopedic Bone Fixation', ar: 'تثبيت عظام', c: 3500 }
    ];
    const stmt = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
    ops.forEach(o => stmt.run(o.en, o.ar, o.c));
  }

  // Lab Tests (Structured Components)
  const labCount = db.prepare('SELECT count(*) as count FROM lab_tests').get().count;
  if (labCount === 0) {
    const tests = [
        { 
            en: 'Complete Blood Count (CBC)', ar: 'عد دم كامل', cat: 'Hematology', c: 45, 
            range: 'WBC: 4.0 - 11.0; RBC: 4.5 - 5.5; HGB: 12.0 - 16.0; PLT: 150 - 450' 
        },
        { 
            en: 'Blood Sugar (Fasting)', ar: 'سكر صائم', cat: 'Biochemistry', c: 20, 
            range: 'Glucose: 70 - 100' 
        },
        { 
            en: 'Lipid Profile', ar: 'دهون الدم', cat: 'Biochemistry', c: 60, 
            range: 'Cholesterol: 125 - 200; Triglycerides: <150; HDL: >40; LDL: <100' 
        },
        { 
            en: 'Malaria Parasite (BF)', ar: 'ملاريا', cat: 'Parasitology', c: 15, 
            range: 'Result: Negative' 
        },
        { 
            en: 'Widal Test (Typhoid)', ar: 'فحص التيفوئيد', cat: 'Serology', c: 25, 
            range: 'TO: <1:80; TH: <1:80' 
        },
        { 
            en: 'Renal Function (RFT)', ar: 'وظائف كلى', cat: 'Biochemistry', c: 55, 
            range: 'Urea: 10 - 50; Creatinine: 0.6 - 1.2; Uric Acid: 3.5 - 7.2' 
        }
    ];
    const stmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, cost, normal_range) VALUES (?, ?, ?, ?, ?)');
    tests.forEach(t => stmt.run(t.en, t.ar, t.cat, t.c, t.range));
  }

  // Insurance Providers (Sudan)
  const insCount = db.prepare('SELECT count(*) as count FROM insurance_providers').get().count;
  if (insCount === 0) {
    const providers = [
        { en: 'Shiekan Insurance', ar: 'شيكان للتأمين' },
        { en: 'Islamic Insurance', ar: 'التأمين الإسلامية' },
        { en: 'Al-Khartoum Insurance', ar: 'الخرطوم للتأمين' },
        { en: 'NHIF (National Fund)', ar: 'الصندوق القومي للتأمين' },
        { en: 'Blue Nile Insurance', ar: 'النيل الأزرق للتأمين' }
    ];
    const stmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    providers.forEach(p => stmt.run(p.en, p.ar));
  }

  // Banks (Sudan)
  const bankCount = db.prepare('SELECT count(*) as count FROM banks').get().count;
  if (bankCount === 0) {
    const banks = [
        { en: 'Bank of Khartoum (Bankak)', ar: 'بنك الخرطوم (بنكك)' },
        { en: 'Faisal Islamic Bank', ar: 'بنك فيصل الإسلامي' },
        { en: 'Omdurman National Bank', ar: 'بنك أمدرمان الوطني' },
        { en: 'Al Baraka Bank', ar: 'بنك البركة' },
        { en: 'Sudanese Islamic Bank', ar: 'البنك الإسلامي السوداني' }
    ];
    const stmt = db.prepare('INSERT INTO banks (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    banks.forEach(b => stmt.run(b.en, b.ar));
  }

  // Default Tax
  const taxCount = db.prepare('SELECT count(*) as count FROM tax_rates').get().count;
  if (taxCount === 0) {
    db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run('Standard VAT', 'ضريبة القيمة المضافة', 15, 1);
  }

  // Default Payment Methods
  const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get().count;
  if (pmCount === 0) {
    const pms = [
      { en: 'Cash', ar: 'نقدي' },
      { en: 'Bankak Transfer', ar: 'تحويل بنكك' },
      { en: 'ATM/Card', ar: 'بطاقة صراف' },
      { en: 'Insurance', ar: 'تأمين' }
    ];
    const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    pms.forEach(p => stmt.run(p.en, p.ar));
  }
};

module.exports = { db, initDB };
