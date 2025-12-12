
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ROLE_PERMISSIONS } = require('../utils/rbac_backend_mirror');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// STABILITY FIX: Use DELETE journal mode instead of WAL for containerized environments (Railway/Heroku).
db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL'); 
db.pragma('foreign_keys = ON');

const initDB = (forceReset = false) => {
  if (forceReset) {
    console.log('Resetting database...');
    if (fs.existsSync(dbPath)) {
        try {
          db.close();
          fs.unlinkSync(dbPath);
          return new Database(dbPath);
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
      permissions TEXT NOT NULL, -- JSON array
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // --- 2. Medical Staff ---
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
      status TEXT CHECK(status IN ('active', 'inactive', 'dismissed')) DEFAULT 'active',
      is_available BOOLEAN DEFAULT 1,
      available_days TEXT, -- JSON array
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

  // Migration for address column
  try {
    db.prepare('SELECT address FROM medical_staff LIMIT 1').get();
  } catch (error) {
    if (error.message.includes('no such column')) {
        try { db.prepare('ALTER TABLE medical_staff ADD COLUMN address TEXT').run(); } catch (e) {}
    }
  }

  // --- 3. Patient & Clinical Records ---
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

  // --- 4. HR ---
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, date DATE NOT NULL, status TEXT, check_in TIME, check_out TIME, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_leaves (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, type TEXT, start_date DATE, end_date DATE, reason TEXT, status TEXT, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_payroll (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, month TEXT, base_salary REAL, total_bonuses REAL, total_fines REAL, net_salary REAL, status TEXT, generated_at DATETIME, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS hr_financials (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, type TEXT, amount REAL, reason TEXT, date DATE, status TEXT, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`).run();

  // --- 5. Billing ---
  db.prepare(`CREATE TABLE IF NOT EXISTS billing (id INTEGER PRIMARY KEY AUTOINCREMENT, bill_number TEXT UNIQUE, patient_id INTEGER, total_amount REAL, paid_amount REAL DEFAULT 0, status TEXT, bill_date DATETIME, FOREIGN KEY(patient_id) REFERENCES patients(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS billing_items (id INTEGER PRIMARY KEY AUTOINCREMENT, billing_id INTEGER, description TEXT, amount REAL, FOREIGN KEY(billing_id) REFERENCES billing(id))`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, category TEXT, amount REAL, method TEXT, reference_id INTEGER, details TEXT, date DATETIME, description TEXT)`).run();

  // --- 6. Medical Services ---
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`).run();

  // --- 7. Config ---
  db.prepare(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS specializations (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, related_role TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS tax_rates (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, rate REAL, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY AUTOINCREMENT, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();

  seedData();
};

const seedData = () => {
  const bcrypt = require('bcryptjs');

  // 1. Seed Role Permissions
  const permCount = db.prepare('SELECT count(*) as count FROM role_permissions').get().count;
  if (permCount === 0) {
    const stmt = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
      stmt.run(role, JSON.stringify(perms));
    });
    console.log('Seeded role permissions.');
  }

  // 2. Seed Users
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    // Admin
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, full_name, role) VALUES ('admin', ?, 'System Administrator', 'admin')").run(hash);
    
    // Demo Accounts
    const demos = [
      { u: 'manager', p: 'manager123', n: 'Sarah Manager', r: 'manager' },
      { u: 'receptionist', p: 'receptionist123', n: 'Pam Receptionist', r: 'receptionist' },
      { u: 'technician', p: 'technician123', n: 'Tom Technician', r: 'technician' }, // maps to labtech in frontend login
      { u: 'labtech', p: 'labtech123', n: 'Tom Technician', r: 'technician' }, // Duplicate for safety if frontend hardcodes 'labtech'
      { u: 'accountant', p: 'accountant123', n: 'Angela Accountant', r: 'accountant' },
      { u: 'hr', p: 'hr123', n: 'Toby HR', r: 'hr' },
      { u: 'pharmacist', p: 'pharmacist123', n: 'Phil Pharmacist', r: 'pharmacist' },
      { u: 'doctor', p: 'doctor123', n: 'Dr. John Doe', r: 'doctor' },
      { u: 'nurse', p: 'nurse123', n: 'Nurse Mary', r: 'nurse' }
    ];

    const stmt = db.prepare("INSERT OR IGNORE INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
    demos.forEach(d => {
        const h = bcrypt.hashSync(d.p, 10);
        stmt.run(d.u, h, d.n, d.r);
    });
    console.log('Seeded demo users.');
  }

  // 3. Departments
  const deptCount = db.prepare('SELECT count(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    const depts = [
      { en: 'Cardiology', ar: 'أمراض القلب' },
      { en: 'Neurology', ar: 'الأعصاب' },
      { en: 'Orthopedics', ar: 'العظام' },
      { en: 'Pediatrics', ar: 'الأطفال' },
      { en: 'General Surgery', ar: 'الجراحة العامة' },
      { en: 'Internal Medicine', ar: 'الباطنية' },
      { en: 'Emergency', ar: 'الطوارئ' },
      { en: 'Radiology', ar: 'الأشعة' },
      { en: 'Laboratory', ar: 'المختبر' },
      { en: 'Pharmacy', ar: 'الصيدلية' }
    ];
    const stmt = db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)');
    depts.forEach(d => stmt.run(d.en, d.ar));
    console.log('Seeded departments.');
  }

  // 4. Lab Tests (Expanded)
  const labCount = db.prepare('SELECT count(*) as count FROM lab_tests').get().count;
  if (labCount === 0) {
    const tests = [
      // Hematology
      { en: 'Complete Blood Count (CBC)', ar: 'صورة دم كاملة', cat: 'Hematology', cost: 15 },
      { en: 'ESR', ar: 'سرعة الترسيب', cat: 'Hematology', cost: 5 },
      { en: 'Blood Grouping & Rh', ar: 'فصيلة الدم', cat: 'Hematology', cost: 5 },
      { en: 'Prothrombin Time (PT)', ar: 'زمن البروثرومبين', cat: 'Hematology', cost: 10 },
      // Parasitology
      { en: 'Malaria Blood Film', ar: 'فحص الملاريا (شريحة)', cat: 'Parasitology', cost: 8 },
      { en: 'Malaria Rapid Test', ar: 'فحص الملاريا السريع', cat: 'Parasitology', cost: 12 },
      { en: 'Stool General', ar: 'فحص براز عام', cat: 'Parasitology', cost: 5 },
      { en: 'Urine General', ar: 'فحص بول عام', cat: 'Parasitology', cost: 5 },
      // Biochemistry
      { en: 'Fasting Blood Sugar (FBS)', ar: 'سكر صائم', cat: 'Biochemistry', cost: 5 },
      { en: 'HbA1c', ar: 'السكر التراكمي', cat: 'Biochemistry', cost: 20 },
      { en: 'Lipid Profile', ar: 'دهون الدم', cat: 'Biochemistry', cost: 25 },
      { en: 'Liver Function Test (LFT)', ar: 'وظائف كبد كاملة', cat: 'Biochemistry', cost: 30 },
      { en: 'Renal Function Test (RFT)', ar: 'وظائف كلى كاملة', cat: 'Biochemistry', cost: 30 },
      { en: 'Uric Acid', ar: 'حمض اليوريك', cat: 'Biochemistry', cost: 10 },
      { en: 'Serum Electrolytes (Na, K, Cl)', ar: 'شوارد الدم', cat: 'Biochemistry', cost: 25 },
      // Hormones
      { en: 'Thyroid Profile (T3, T4, TSH)', ar: 'وظائف الغدة الدرقية', cat: 'Hormones', cost: 40 },
      { en: 'Vitamin D', ar: 'فيتامين د', cat: 'Hormones', cost: 50 },
      { en: 'Beta HCG (Pregnancy)', ar: 'اختبار الحمل الرقمي', cat: 'Hormones', cost: 15 },
      // Serology & Immunology
      { en: 'Widal Test (Typhoid)', ar: 'تفاعل فيدال (تيفود)', cat: 'Serology', cost: 10 },
      { en: 'Brucella Test', ar: 'فحص البروسيلا', cat: 'Serology', cost: 12 },
      { en: 'H. Pylori Ag (Stool)', ar: 'جرثومة المعدة (براز)', cat: 'Serology', cost: 15 },
      { en: 'Hepatitis B Surface Ag', ar: 'فيروس بي', cat: 'Serology', cost: 15 },
      { en: 'Hepatitis C Ab', ar: 'فيروس سي', cat: 'Serology', cost: 15 },
      { en: 'HIV Combo', ar: 'فحص المناعة', cat: 'Serology', cost: 20 },
      { en: 'CRP', ar: 'بروتين سي التفاعلي', cat: 'Serology', cost: 10 },
      // Microbiology
      { en: 'Urine Culture & Sensitivity', ar: 'مزرعة بول', cat: 'Microbiology', cost: 25 },
      { en: 'Blood Culture', ar: 'مزرعة دم', cat: 'Microbiology', cost: 35 }
    ];
    const stmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost) VALUES (?, ?, ?, ?, ?)');
    tests.forEach(t => stmt.run(t.en, t.ar, t.cat, t.cat, t.cost));
    console.log('Seeded lab tests.');
  }

  // 5. Nurse Services
  const nurseCount = db.prepare('SELECT count(*) as count FROM nurse_services').get().count;
  if (nurseCount === 0) {
    const services = [
      { en: 'Injection (IM/IV)', ar: 'حقن', cost: 5 },
      { en: 'Cannula Insertion', ar: 'تركيب كانيولا', cost: 10 },
      { en: 'Wound Dressing', ar: 'غيار على جرح', cost: 15 },
      { en: 'Nebulizer', ar: 'جلسة بخار', cost: 10 },
      { en: 'ECG', ar: 'رسم قلب', cost: 20 }
    ];
    const stmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, cost) VALUES (?, ?, ?)');
    services.forEach(s => stmt.run(s.en, s.ar, s.cost));
    console.log('Seeded nurse services.');
  }

  // 6. Operations (Expanded)
  const opCount = db.prepare('SELECT count(*) as count FROM operations_catalog').get().count;
  if (opCount === 0) {
    const ops = [
      // General Surgery
      { en: 'Appendectomy', ar: 'استئصال الزائدة الدودية', cost: 800 },
      { en: 'Laparoscopic Cholecystectomy', ar: 'استئصال المرارة بالمنظار', cost: 1500 },
      { en: 'Inguinal Hernia Repair', ar: 'إصلاح فتق إربي', cost: 900 },
      { en: 'Hemorrhoidectomy', ar: 'استئصال البواسير', cost: 700 },
      { en: 'Thyroidectomy', ar: 'استئصال الغدة الدرقية', cost: 1200 },
      // OB/GYN
      { en: 'Cesarean Section', ar: 'ولادة قيصرية', cost: 1200 },
      { en: 'Normal Delivery', ar: 'ولادة طبيعية', cost: 500 },
      { en: 'Hysterectomy', ar: 'استئصال الرحم', cost: 1800 },
      { en: 'Dilation and Curettage (D&C)', ar: 'توسيع وكحت', cost: 400 },
      // Orthopedics
      { en: 'Knee Arthroscopy', ar: 'منظار ركبة', cost: 1100 },
      { en: 'Total Hip Replacement', ar: 'استبدال مفصل الورك', cost: 3500 },
      { en: 'Fracture Fixation (ORIF)', ar: 'تثبيت كسور', cost: 1300 },
      // ENT
      { en: 'Tonsillectomy', ar: 'استئصال اللوزتين', cost: 600 },
      { en: 'Septoplasty', ar: 'تجميل الحاجز الأنفي', cost: 900 },
      // Ophthalmology
      { en: 'Cataract Surgery (Phaco)', ar: 'إزالة المياه البيضاء (فاكو)', cost: 1000 },
      { en: 'LASIK', ar: 'ليزك', cost: 800 }
    ];
    const stmt = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
    ops.forEach(o => stmt.run(o.en, o.ar, o.cost));
    console.log('Seeded operations.');
  }

  // 7. Beds
  const bedCount = db.prepare('SELECT count(*) as count FROM beds').get().count;
  if (bedCount === 0) {
    const stmt = db.prepare('INSERT INTO beds (room_number, type, status, cost_per_day) VALUES (?, ?, ?, ?)');
    for (let i = 1; i <= 5; i++) stmt.run(`10${i}`, 'General', 'available', 50);
    for (let i = 1; i <= 3; i++) stmt.run(`20${i}`, 'Private', 'available', 120);
    for (let i = 1; i <= 2; i++) stmt.run(`30${i}`, 'ICU', 'available', 300);
    console.log('Seeded beds.');
  }

  // 8. Payment Methods
  const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get().count;
  if (pmCount === 0) {
    const pms = [
      { en: 'Cash', ar: 'نقدي' },
      { en: 'Credit Card', ar: 'بطاقة ائتمان' },
      { en: 'Bank Transfer', ar: 'تحويل بنكي' },
      { en: 'Insurance', ar: 'تأمين' }
    ];
    const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    pms.forEach(p => stmt.run(p.en, p.ar));
    console.log('Seeded payment methods.');
  }

  // 9. Insurance Providers (Sudan Context)
  const insCount = db.prepare('SELECT count(*) as count FROM insurance_providers').get().count;
  if (insCount === 0) {
      const providers = [
          { en: 'National Health Insurance Fund', ar: 'الصندوق القومي للتأمين الصحي' },
          { en: 'Shiekan Insurance', ar: 'شيكان للتأمين وإعادة التأمين' },
          { en: 'Blue Nile Insurance', ar: 'النيل الأزرق للتأمين' },
          { en: 'United Insurance', ar: 'المتحدة للتأمين' },
          { en: 'Al-Salama Insurance', ar: 'شركة السلامة للتأمين' },
          { en: 'Juba Insurance', ar: 'جوبا للتأمين' },
          { en: 'General Insurance', ar: 'العامة للتأمين' },
          { en: 'Savanna Insurance', ar: 'سافانا للتأمين' },
          { en: 'Africa Reinsurance', ar: 'الشركة الأفريقية لإعادة التأمين' }
      ];
      const stmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      providers.forEach(p => stmt.run(p.en, p.ar));
      console.log('Seeded insurance providers.');
  }

  // 10. Medical Staff
  const staffCount = db.prepare('SELECT count(*) as count FROM medical_staff').get().count;
  if (staffCount === 0) {
      const staffList = [
          { name: 'Dr. Shaun Murphy', type: 'doctor', dept: 'General Surgery', spec: 'General Surgery', fee: 200 },
          { name: 'Dr. Meredith Grey', type: 'doctor', dept: 'General Surgery', spec: 'General Surgery', fee: 180 },
          { name: 'Dr. Gregory House', type: 'doctor', dept: 'Internal Medicine', spec: 'Diagnostic Medicine', fee: 300 },
          { name: 'Dr. Derek Shepherd', type: 'doctor', dept: 'Neurology', spec: 'Neurosurgery', fee: 250 },
          { name: 'Dr. Doug Ross', type: 'doctor', dept: 'Pediatrics', spec: 'Pediatrics', fee: 150 },
          { name: 'Dr. Lisa Cuddy', type: 'doctor', dept: 'Administration', spec: 'Endocrinology', fee: 220 },
          { name: 'Nurse Carla Espinosa', type: 'nurse', dept: 'General Surgery', spec: 'Head Nurse', fee: 0 },
          { name: 'Nurse Jackie', type: 'nurse', dept: 'Emergency', spec: 'ER Nurse', fee: 0 },
          { name: 'John Dorian', type: 'doctor', dept: 'Internal Medicine', spec: 'Internal Medicine', fee: 120 }
      ];

      const stmt = db.prepare(`
        INSERT INTO medical_staff (
            employee_id, full_name, type, department, specialization, consultation_fee, 
            status, available_days, available_time_start, available_time_end, base_salary
        ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, '08:00', '17:00', ?)
      `);

      staffList.forEach((s, i) => {
          const id = `${s.type === 'doctor' ? 'DOC' : 'NUR'}${1000 + i}`;
          stmt.run(id, s.name, s.type, s.dept, s.spec, s.fee, JSON.stringify(['Mon','Tue','Wed','Thu','Fri']), 5000 + (s.fee * 10));
      });
      console.log('Seeded medical staff.');
  }
};

module.exports = { db, initDB };
