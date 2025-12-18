
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

// STABILITY FIX: Use DELETE journal mode instead of WAL for containerized environments.
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
      permissions TEXT NOT NULL,
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

  // --- 5. Billing ---
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
  db.prepare(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY AUTOINCREMENT, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();

  seedData();
};

const seedData = () => {
  const bcrypt = require('bcryptjs');

  const permCount = db.prepare('SELECT count(*) as count FROM role_permissions').get().count;
  if (permCount === 0) {
    const stmt = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
      stmt.run(role, JSON.stringify(perms));
    });
  }

  const defaultUsers = [
    { u: 'admin', p: 'admin123', n: 'System Administrator', r: 'admin' },
    { u: 'manager', p: 'manager123', n: 'Sarah Manager', r: 'manager' },
    { u: 'receptionist', p: 'receptionist123', n: 'Pam Receptionist', r: 'receptionist' },
    { u: 'accountant', p: 'accountant123', n: 'Angela Accountant', r: 'accountant' },
  ];

  const stmt = db.prepare("INSERT OR REPLACE INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
  defaultUsers.forEach(d => {
      const h = bcrypt.hashSync(d.p, 10);
      stmt.run(d.u, h, d.n, d.r);
  });

  // --- 1. SUDANESE BANKS ---
  const bankCount = db.prepare('SELECT count(*) as count FROM banks').get().count;
  if (bankCount === 0) {
    const banks = [
      { en: 'Bank of Khartoum (BOK)', ar: 'بنك الخرطوم' },
      { en: 'Faisal Islamic Bank', ar: 'بنك فيصل الإسلامي' },
      { en: 'Omdurman National Bank', ar: 'بنك أمدرمان الوطني' },
      { en: 'Al Salam Bank', ar: 'بنك السلام' },
      { en: 'Sudanese Egyptian Bank', ar: 'البنك السوداني المصري' },
      { en: 'Blue Nile Mashreq Bank', ar: 'بنك النيل الأزرق المشرق' },
      { en: 'United Capital Bank', ar: 'بنك المال المتحد' },
      { en: 'Al Baraka Bank', ar: 'بنك البركة' },
      { en: 'Sudanese French Bank', ar: 'البنك السوداني الفرنسي' },
      { en: 'Byblos Bank Africa', ar: 'بنك بيبولوس أفريقيا' }
    ];
    const bStmt = db.prepare('INSERT INTO banks (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    banks.forEach(b => bStmt.run(b.en, b.ar));
  }

  // --- 2. SUDANESE INSURANCE COMPANIES ---
  const insCount = db.prepare('SELECT count(*) as count FROM insurance_providers').get().count;
  if (insCount === 0) {
    const providers = [
      { en: 'Shiekan Insurance & Reinsurance', ar: 'شيكان للتأمين وإعادة التأمين' },
      { en: 'United Insurance Company', ar: 'شركة المتحدة للتأمين' },
      { en: 'Islamic Insurance Company', ar: 'شركة التأمين الإسلامية' },
      { en: 'National Health Insurance Fund (NHIF)', ar: 'الصندوق القومي للتأمين الصحي' },
      { en: 'Savanna Insurance Company', ar: 'شركة سافانا للتأمين' },
      { en: 'Sudanese Insurance & Reinsurance', ar: 'السودانية للتأمين وإعادة التأمين' },
      { en: 'Blue Nile Insurance', ar: 'شركة النيل الأزرق للتأمين' },
      { en: 'Takaful Insurance', ar: 'التكافل للتأمين' },
      { en: 'General Insurance Company', ar: 'شركة التأمينات العامة' }
    ];
    const iStmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    providers.forEach(p => iStmt.run(p.en, p.ar));
  }

  // --- 3. DEPARTMENTS ---
  const deptCount = db.prepare('SELECT count(*) as count FROM departments').get().count;
  if (deptCount === 0) {
    const depts = [
      { en: 'Internal Medicine', ar: 'الطب الباطني' },
      { en: 'General Surgery', ar: 'الجراحة العامة' },
      { en: 'Pediatrics', ar: 'طب الأطفال' },
      { en: 'Obstetrics and Gynecology', ar: 'النساء والتوليد' },
      { en: 'Cardiology', ar: 'طب القلب' },
      { en: 'Neurology', ar: 'طب الأعصاب' },
      { en: 'Orthopedics', ar: 'جراحة العظام' },
      { en: 'Radiology', ar: 'الأشعة' },
      { en: 'Laboratory', ar: 'المختبر' },
      { en: 'Emergency', ar: 'الطوارئ' },
      { en: 'Pharmacy', ar: 'الصيدلية' },
      { en: 'Ophthalmology', ar: 'طب العيون' },
      { en: 'ENT (Otolaryngology)', ar: 'الأنف والأذن والحنجرة' },
      { en: 'Dermatology', ar: 'الجلدية' },
      { en: 'Urology', ar: 'المسالك البولية' },
      { en: 'Nephrology', ar: 'طب الكلى' },
      { en: 'Physiotherapy', ar: 'العلاج الطبيعي' },
      { en: 'Anesthesiology', ar: 'التخدير' },
      { en: 'Oncology', ar: 'الأورام' },
      { en: 'Psychiatry', ar: 'الطب النفسي' },
      { en: 'Administration', ar: 'الإدارة' }
    ];
    const dStmt = db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)');
    depts.forEach(d => dStmt.run(d.en, d.ar));
  }

  // --- 4. SPECIALIZATIONS ---
  const specCount = db.prepare('SELECT count(*) as count FROM specializations').get().count;
  if (specCount === 0) {
    const specs = [
      { en: 'Consultant Cardiologist', ar: 'استشاري أمراض القلب', role: 'doctor' },
      { en: 'Consultant Neurologist', ar: 'استشاري مخ وأعصاب', role: 'doctor' },
      { en: 'Consultant General Surgeon', ar: 'استشاري جراحة عامة', role: 'doctor' },
      { en: 'Consultant Orthopedic Surgeon', ar: 'استشاري جراحة عظام', role: 'doctor' },
      { en: 'Consultant Pediatrician', ar: 'استشاري طب أطفال', role: 'doctor' },
      { en: 'Consultant OB-GYN', ar: 'استشاري نساء وتوليد', role: 'doctor' },
      { en: 'Consultant Radiologist', ar: 'استشاري أشعة', role: 'doctor' },
      { en: 'Consultant Anesthesiologist', ar: 'استشاري تخدير', role: 'doctor' },
      { en: 'Consultant Ophthalmologist', ar: 'استشاري عيون', role: 'doctor' },
      { en: 'Consultant ENT Surgeon', ar: 'استشاري أنف وأذن وحنجرة', role: 'doctor' },
      { en: 'Consultant Urologist', ar: 'استشاري مسالك بولية', role: 'doctor' },
      { en: 'Consultant Nephrologist', ar: 'استشاري كلى', role: 'doctor' },
      { en: 'Consultant Dermatologist', ar: 'استشاري جلدية', role: 'doctor' },
      { en: 'Clinical Pathologist', ar: 'أخصائي علم أمراض', role: 'doctor' },
      { en: 'Endocrinologist', ar: 'أخصائي غدد صماء', role: 'doctor' },
      { en: 'Hematologist', ar: 'أخصائي أمراض دم', role: 'doctor' },
      { en: 'Lab Technician', ar: 'فني مختبرات', role: 'technician' },
      { en: 'Radiology Technician', ar: 'فني أشعة', role: 'technician' },
      { en: 'Clinical Pharmacist', ar: 'صيدلي إكلينيكي', role: 'pharmacist' },
      { en: 'General Nurse', ar: 'ممرض عام', role: 'nurse' },
      { en: 'Surgical Nurse', ar: 'ممرض عمليات', role: 'nurse' },
      { en: 'ICU Nurse', ar: 'ممرض عناية مركزة', role: 'nurse' },
      { en: 'ER Nurse', ar: 'ممرض طوارئ', role: 'nurse' }
    ];
    const sStmt = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
    specs.forEach(s => sStmt.run(s.en, s.ar, s.role));
  }

  // --- 5. LAB TESTS (Expanded Catalog) ---
  const labCount = db.prepare('SELECT count(*) as count FROM lab_tests').get().count;
  if (labCount === 0) {
    const tests = [
      // Hematology
      { en: 'Complete Blood Count (CBC)', ar: 'صورة دم كاملة', catEn: 'Hematology', cost: 25 },
      { en: 'ESR (Erythrocyte Sedimentation Rate)', ar: 'سرعة الترسيب', catEn: 'Hematology', cost: 10 },
      { en: 'Blood Grouping & Rh', ar: 'فصيلة الدم', catEn: 'Hematology', cost: 15 },
      { en: 'PT / PTT / INR (Coagulation Profile)', ar: 'سيولة الدم', catEn: 'Hematology', cost: 30 },
      { en: 'Reticulocyte Count', ar: 'عد الخلايا الشبكية', catEn: 'Hematology', cost: 15 },
      { en: 'Peripheral Blood Film', ar: 'لطاخة دم', catEn: 'Hematology', cost: 20 },
      // Biochemistry
      { en: 'Random Blood Sugar (RBS)', ar: 'سكر عشوائي', catEn: 'Biochemistry', cost: 10 },
      { en: 'Fasting Blood Sugar (FBS)', ar: 'سكر صائم', catEn: 'Biochemistry', cost: 10 },
      { en: 'HbA1c (Glycated Hemoglobin)', ar: 'السكر التراكمي', catEn: 'Biochemistry', cost: 35 },
      { en: 'Liver Function Test (LFT)', ar: 'وظائف كبد كامله', catEn: 'Biochemistry', cost: 40 },
      { en: 'Renal Function Test (RFT)', ar: 'وظائف كلى كامله', catEn: 'Biochemistry', cost: 35 },
      { en: 'Lipid Profile (Cholesterol/Triglycerides)', ar: 'دهون الدم', catEn: 'Biochemistry', cost: 45 },
      { en: 'Serum Electrolytes (Na, K, Cl)', ar: 'الأملاح والمعادن', catEn: 'Biochemistry', cost: 30 },
      { en: 'Serum Calcium / Magnesium', ar: 'الكالسيوم والمغنيسيوم', catEn: 'Biochemistry', cost: 20 },
      { en: 'Serum Amylase / Lipase', ar: 'أنزيمات البنكرياس', catEn: 'Biochemistry', cost: 40 },
      { en: 'Uric Acid', ar: 'حمض اليوريك (النقرس)', catEn: 'Biochemistry', cost: 15 },
      // Serology & Immunology
      { en: 'Malaria Parasite (MP - Film/Rapid)', ar: 'فحص الملاريا', catEn: 'Serology', cost: 15 },
      { en: 'Typhoid (Widal) Test', ar: 'فحص التيفويد', catEn: 'Serology', cost: 20 },
      { en: 'HIV I & II Screening', ar: 'فحص فيروس نقص المناعة', catEn: 'Serology', cost: 35 },
      { en: 'HBsAg (Hepatitis B)', ar: 'التهاب الكبد الوبائي ب', catEn: 'Serology', cost: 25 },
      { en: 'HCV (Hepatitis C)', ar: 'التهاب الكبد الوبائي ج', catEn: 'Serology', cost: 30 },
      { en: 'VDRL / Syphilis', ar: 'فحص الزهري', catEn: 'Serology', cost: 15 },
      { en: 'Rheumatoid Factor (RF)', ar: 'فحص الروماتويد', catEn: 'Serology', cost: 25 },
      { en: 'C-Reactive Protein (CRP)', ar: 'البروتين التفاعلي سي', catEn: 'Serology', cost: 25 },
      { en: 'Pregnancy Test (Serum/Urine)', ar: 'فحص الحمل', catEn: 'Serology', cost: 15 },
      // Hormones
      { en: 'Thyroid Profile (T3, T4, TSH)', ar: 'وظائف الغدة الدرقية', catEn: 'Hormones', cost: 60 },
      { en: 'Serum Prolactin', ar: 'هرمون الحليب', catEn: 'Hormones', cost: 40 },
      { en: 'Testosterone', ar: 'هرمون الذكورة', catEn: 'Hormones', cost: 45 },
      { en: 'FSH / LH', ar: 'هرمونات الخصوبة', catEn: 'Hormones', cost: 50 },
      { en: 'Serum Cortisol', ar: 'هرمون الكورتيزول', catEn: 'Hormones', cost: 45 },
      // Microbiology & Urinalysis
      { en: 'Urine Analysis (Routine)', ar: 'فحص بول روتيني', catEn: 'Microbiology', cost: 15 },
      { en: 'Stool Analysis (Routine)', ar: 'فحص براز روتيني', catEn: 'Microbiology', cost: 15 },
      { en: 'Semen Analysis', ar: 'فحص السائل المنوي', catEn: 'Microbiology', cost: 35 },
      { en: 'Urine Culture & Sensitivity', ar: 'مزرعة بول', catEn: 'Microbiology', cost: 55 },
      { en: 'Wound / Pus Culture', ar: 'مزرعة جروح', catEn: 'Microbiology', cost: 60 },
      { en: 'H. Pylori (Antigen/Antibody)', ar: 'جرثومة المعدة', catEn: 'Microbiology', cost: 35 }
    ];
    const lStmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, cost) VALUES (?, ?, ?, ?)');
    tests.forEach(t => lStmt.run(t.en, t.ar, t.catEn, t.cost));
  }

  // --- 6. NURSE SERVICES (Expanded) ---
  const nurseCount = db.prepare('SELECT count(*) as count FROM nurse_services').get().count;
  if (nurseCount === 0) {
    const services = [
      { en: 'IM Injection', ar: 'حقنة عضل', cost: 10 },
      { en: 'IV Cannulation', ar: 'تركيب كانيولا', cost: 25 },
      { en: 'Wound Dressing (Simple)', ar: 'غيار جروح بسيط', cost: 20 },
      { en: 'Wound Dressing (Major)', ar: 'غيار جروح كبير', cost: 45 },
      { en: 'Vital Signs Monitoring', ar: 'مراقبة العلامات الحيوية', cost: 15 },
      { en: 'ECG Recording', ar: 'رسم قلب', cost: 50 },
      { en: 'Nebulizer Therapy', ar: 'جلسة بخار', cost: 20 },
      { en: 'Catheterization (Male/Female)', ar: 'تركيب قسطرة بولية', cost: 40 },
      { en: 'NG Tube Insertion', ar: 'تركيب أنبوب تغذية', cost: 45 },
      { en: 'Suture Removal', ar: 'فك غرز', cost: 25 },
      { en: 'Blood Pressure Check', ar: 'قياس ضغط الدم', cost: 5 },
      { en: 'Oxygen Administration (per hr)', ar: 'إعطاء أكسجين', cost: 15 },
      { en: 'Suctioning', ar: 'شفط سوائل', cost: 30 }
    ];
    const nStmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, cost) VALUES (?, ?, ?)');
    services.forEach(s => nStmt.run(s.en, s.ar, s.cost));
  }

  // --- 7. OPERATIONS (Expanded Catalog) ---
  const opsCount = db.prepare('SELECT count(*) as count FROM operations_catalog').get().count;
  if (opsCount === 0) {
    const ops = [
      // General Surgery
      { en: 'Appendectomy (Open/Laps)', ar: 'استئصال الزائدة الدودية', cost: 500 },
      { en: 'Hernia Repair (Inguinal/Umbilical)', ar: 'إصلاح الفتق', cost: 450 },
      { en: 'Cholecystectomy (Gallbladder)', ar: 'استئصال المرارة', cost: 650 },
      { en: 'Laparotomy (Exploratory)', ar: 'فتح بطن استكشافي', cost: 800 },
      { en: 'Mastectomy (Partial/Total)', ar: 'استئصال الثدي', cost: 900 },
      { en: 'Thyroidectomy', ar: 'استئصال الغدة الدرقية', cost: 850 },
      { en: 'Hemorrhoidectomy', ar: 'استئصال البواسير', cost: 400 },
      // Orthopedics
      { en: 'ORIF (Fracture Fixation)', ar: 'تثبيت كسور داخلي', cost: 1200 },
      { en: 'Total Hip Replacement', ar: 'تبديل مفصل الورك', cost: 3500 },
      { en: 'Total Knee Replacement', ar: 'تبديل مفصل الركبة', cost: 3200 },
      { en: 'Arthroscopy (Knee/Shoulder)', ar: 'منظار مفصل', cost: 1500 },
      { en: 'Amputation (Major/Minor)', ar: 'عملية بتر', cost: 1000 },
      // OB-GYN
      { en: 'Cesarean Section (C-Section)', ar: 'عملية قيصرية', cost: 1200 },
      { en: 'Hysterectomy (Total/Subtotal)', ar: 'استئصال الرحم', cost: 1800 },
      { en: 'D&C (Dilatation & Curettage)', ar: 'عملية تنظيف', cost: 400 },
      { en: 'Ovarian Cystectomy', ar: 'استئصال كيس مبيض', cost: 800 },
      // Urology
      { en: 'TURP (Prostate)', ar: 'تجريف البروستاتا', cost: 1200 },
      { en: 'Nephrectomy', ar: 'استئصال الكلية', cost: 2000 },
      { en: 'Cystoscopy', ar: 'منظار مثانة', cost: 600 },
      { en: 'Ureteric Stent Insertion', ar: 'تركيب دعامة حالب', cost: 700 },
      // ENT & Eye
      { en: 'Tonsillectomy & Adenoidectomy', ar: 'استئصال اللوزتين واللحمية', cost: 500 },
      { en: 'Septoplasty', ar: 'تعديل حاجز أنفي', cost: 700 },
      { en: 'Cataract Surgery (Phaco)', ar: 'عملية المياه البيضاء', cost: 1200 },
      { en: 'Tympanoplasty', ar: 'ترقيع طبلة الأذن', cost: 900 }
    ];
    const oStmt = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
    ops.forEach(o => oStmt.run(o.en, o.ar, o.cost));
  }

  // Default Tax and Payment
  const taxCount = db.prepare('SELECT count(*) as count FROM tax_rates').get().count;
  if (taxCount === 0) {
    db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run('Standard VAT', 'ضريبة القيمة المضافة', 15, 1);
  }

  const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get().count;
  if (pmCount === 0) {
    const pms = [
      { en: 'Cash', ar: 'نقدي' },
      { en: 'Bankak (BOK)', ar: 'بنكك' },
      { en: 'ATM/Card', ar: 'بطاقة صراف' },
      { en: 'Insurance', ar: 'تأمين' },
      { en: 'Cheque', ar: 'شيك' },
      { en: 'Bank Transfer', ar: 'تحويل بنكي' }
    ];
    const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    pms.forEach(p => stmt.run(p.en, p.ar));
  }
};

module.exports = { db, initDB };
