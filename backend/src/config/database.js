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
          ['Nursing', 'التمريض'], ['Administration', 'الإدارة'], ['Finance', 'المالية'], ['HR', 'الموارد البشرية'],
          ['Orthopedics', 'العظام'], ['Ophthalmology', 'العيون'], ['ENT', 'الأنف والأذن والحنجرة'], ['Urology', 'المسالك البولية']
        ];
        const stmt = db.prepare('INSERT INTO departments (name_en, name_ar) VALUES (?, ?)');
        depts.forEach(d => stmt.run(d[0], d[1]));
        console.log('- [Seed] Departments expanded.');
    }

    // 4. Specializations
    const specCount = db.prepare('SELECT count(*) as count FROM specializations').get()?.count || 0;
    if (specCount === 0) {
        const specs = [
          ['Physician', 'طبيب باطني', 'doctor'], 
          ['General Surgeon', 'جراح عام', 'doctor'],
          ['Pediatrician', 'طبيب أطفال', 'doctor'], 
          ['Obstetrician', 'طبيب نساء وتوليد', 'doctor'],
          ['Cardiologist', 'طبيب قلب', 'doctor'], 
          ['Radiologist', 'طبيب أشعة', 'doctor'],
          ['Orthopedic Surgeon', 'جراح عظام', 'doctor'],
          ['Ophthalmologist', 'طبيب عيون', 'doctor'],
          ['ENT Specialist', 'أخصائي أنف وأذن وحنجرة', 'doctor'],
          ['Urologist', 'طبيب مسالك بولية', 'doctor'],
          ['Neurologist', 'طبيب أعصاب', 'doctor'],
          ['Dermatologist', 'طبيب جلدية', 'doctor'],
          ['Psychiatrist', 'طبيب نفسي', 'doctor'],
          ['Anesthesiologist', 'طبيب تخدير', 'doctor'],
          ['Lab Technician', 'فني مختبر', 'technician'], 
          ['Pharmacist', 'صيدلي', 'pharmacist'],
          ['Head Nurse', 'كبير ممرضين', 'nurse'], 
          ['Staff Nurse', 'ممرض', 'nurse'],
          ['Accountant', 'محاسب', 'accountant'], 
          ['HR Specialist', 'اختصاصي موارد بشرية', 'hr']
        ];
        const stmt = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
        specs.forEach(s => stmt.run(s[0], s[1], s[2]));
        console.log('- [Seed] Specializations expanded.');
    }

    // 5. Lab Tests
    const labTestCount = db.prepare('SELECT count(*) as count FROM lab_tests').get()?.count || 0;
    if (labTestCount === 0) {
        const tests = [
          // Hematology
          ['CBC', 'عد دم كامل', 'Hematology', 'WBC: 4.0-11.0; RBC: 4.5-5.5; HGB: 12.0-16.0; PLT: 150-450', 45],
          ['PT / INR', 'زمن التخثر', 'Hematology', 'PT: 11-13.5s; INR: 0.8-1.1', 35],
          ['Blood Group & Rh', 'فصيلة الدم', 'Hematology', 'Result: A/B/AB/O; Rh: +/-', 20],
          ['ESR', 'سرعة الترسيب', 'Hematology', 'Male: 0-15 mm/hr; Female: 0-20 mm/hr', 15],
          ['Reticulocyte Count', 'عدد الخلايا الشبكية', 'Hematology', '0.5-2.5%', 30],
          ['Ferritin', 'الفيريتين', 'Hematology', 'Male: 24-336 ng/mL; Female: 11-307 ng/mL', 80],
          ['Iron Profile', 'ملف الحديد', 'Hematology', 'Iron: 60-170; TIBC: 240-450', 100],

          // Biochemistry
          ['Blood Sugar (Fasting)', 'سكر صائم', 'Biochemistry', 'Result: 70-100 mg/dL', 20],
          ['Blood Sugar (Random)', 'سكر عشوائي', 'Biochemistry', 'Result: < 200 mg/dL', 20],
          ['HbA1c', 'السكر التراكمي', 'Biochemistry', 'Normal: <5.7%; Pre-diabetes: 5.7-6.4%; Diabetes: >=6.5%', 50],
          ['Lipid Profile', 'دهون كاملة', 'Biochemistry', 'Cholesterol: <200; HDL: >40; LDL: <130; Trig: <150', 80],
          ['Liver Function Test (LFT)', 'وظائف كبد', 'Biochemistry', 'ALT: 7-56; AST: 10-40; Bilirubin: 0.1-1.2; Albumin: 3.4-5.4', 120],
          ['Renal Function Test (RFT)', 'وظائف كلى', 'Biochemistry', 'Urea: 15-45; Creatinine: 0.6-1.2; Sodium: 135-145; Potassium: 3.5-5.0', 100],
          ['Uric Acid', 'حمض اليوريك', 'Biochemistry', 'Male: 3.4-7.0; Female: 2.4-6.0 mg/dL', 25],
          ['Troponin I', 'إنزيمات القلب', 'Biochemistry', 'Normal: <0.04 ng/mL', 150],
          ['Calcium', 'الكالسيوم', 'Biochemistry', '8.6-10.3 mg/dL', 25],
          ['Magnesium', 'المغنيسيوم', 'Biochemistry', '1.7-2.2 mg/dL', 30],
          ['Phosphorus', 'الفوسفور', 'Biochemistry', '2.5-4.5 mg/dL', 30],
          ['Amylase', 'الأميليز', 'Biochemistry', '30-110 U/L', 60],
          ['Lipase', 'الليباز', 'Biochemistry', '0-160 U/L', 65],
          ['LDH', 'نازعة هيدروجين اللاكتات', 'Biochemistry', '140-280 U/L', 40],
          ['CK (Creatine Kinase)', 'كيناز الكرياتين', 'Biochemistry', 'Male: 39-308 U/L; Female: 26-192 U/L', 50],
          ['CK-MB', 'كيناز الكرياتين القلبي', 'Biochemistry', '< 5.0 ng/mL', 70],
          ['Total Protein', 'البروتين الكلي', 'Biochemistry', '6.0-8.3 g/dL', 30],
          ['Albumin', 'الألبومين', 'Biochemistry', '3.4-5.4 g/dL', 30],
          ['GGT', 'ناقلة جاما جلوتاميل', 'Biochemistry', '5-40 U/L', 45],
          ['Alkaline Phosphatase (ALP)', 'الفوسفاتاز القلوي', 'Biochemistry', '44-147 IU/L', 40],

          // Serology / Immunology
          ['H. Pylori (Antigen)', 'جرثومة المعدة', 'Serology', 'Result: Negative', 60],
          ['CRP (Quantitative)', 'البروتين التفاعلي', 'Serology', 'Normal: <1.0 mg/dL', 40],
          ['Rheumatoid Factor', 'عامل الروماتويد', 'Serology', 'Normal: <14 IU/mL', 45],
          ['HIV 1&2 (Rapid)', 'فيروس نقص المناعة', 'Serology', 'Result: Non-reactive', 100],
          ['HBsAg (Hepatitis B)', 'فيروس الكبد ب', 'Serology', 'Result: Negative', 70],
          ['HCV (Hepatitis C)', 'فيروس الكبد ج', 'Serology', 'Result: Negative', 70],
          ['ASO Titre', 'عيار ASO', 'Serology', '< 200 IU/mL', 50],
          ['ANA', 'الأجسام المضادة للنواة', 'Serology', 'Negative', 120],
          ['VDRL / RPR', 'فحص الزهري', 'Serology', 'Non-reactive', 40],
          ['TPHA', 'تأكيد الزهري', 'Serology', 'Non-reactive', 80],
          ['Dengue NS1/IgM/IgG', 'حمى الضنك', 'Serology', 'Negative', 150],
          ['Brucella Ab', 'الحمى المالطية', 'Serology', 'Negative', 60],
          ['Anti-CCP', 'الأجسام المضادة للببتيد', 'Serology', '< 20.0 U', 130],

          // Microbiology / Parasitology
          ['Malaria (Rapid)', 'ملاريا سريع', 'Parasitology', 'Result: Negative', 15],
          ['Malaria (Blood Film)', 'ملاريا فيلم', 'Parasitology', 'Result: No parasites seen', 25],
          ['Widal Test', 'تيفويد', 'Serology', 'Result: Negative', 30],
          ['Urine Analysis', 'فحص بول', 'Microscopy', 'Pus Cells: 0-5; RBCs: 0-2; Crystals: None', 25],
          ['Stool Analysis', 'فحص براز', 'Microscopy', 'Parasites: None seen; Occult Blood: Negative', 30],
          ['Blood Culture', 'مزرعة دم', 'Microbiology', 'No growth', 200],
          ['Urine Culture', 'مزرعة بول', 'Microbiology', 'No growth', 150],
          ['Stool Culture', 'مزرعة براز', 'Microbiology', 'No growth of pathogens', 150],
          ['Gram Stain', 'صبغة جرام', 'Microbiology', 'Result based on sample', 40],

          // Hormones
          ['TSH', 'هرمون الغدة الدرقية', 'Hormones', 'Normal: 0.4-4.0 mIU/L', 60],
          ['Free T4', 'ثايروكسين حر', 'Hormones', 'Normal: 0.8-1.8 ng/dL', 60],
          ['Free T3', 'ثلاثي يودوثيرونين حر', 'Hormones', 'Normal: 2.0-4.4 pg/mL', 65],
          ['Prolactin', 'البرولاكتين', 'Hormones', 'Male: 4-15 ng/mL; Female: 5-23 ng/mL', 70],
          ['LH', 'الهرمون الملوتن', 'Hormones', 'Varies with cycle', 70],
          ['FSH', 'الهرمون المنبه للجريب', 'Hormones', 'Varies with cycle', 70],
          ['Estradiol (E2)', 'استراديول', 'Hormones', 'Varies with cycle', 80],
          ['Progesterone', 'البروجسترون', 'Hormones', 'Varies with cycle', 80],
          ['Testosterone (Total)', 'التستوستيرون الكلي', 'Hormones', 'Male: 280-1100 ng/dL', 90],
          ['Cortisol (AM)', 'الكورتيزول صباحا', 'Hormones', '6-23 mcg/dL', 100],
          ['beta-hCG (Pregnancy Test)', 'اختبار حمل بالدم', 'Hormones', 'Negative: <5 mIU/mL', 50],

          // Tumor Markers
          ['PSA (Total)', 'مستضد البروستاتا النوعي', 'Tumor Markers', 'Normal: <4.0 ng/mL', 120],
          ['AFP', 'ألفا فيتو بروتين', 'Tumor Markers', '< 10 ng/mL', 110],
          ['CEA', 'المستضد السرطاني المضغي', 'Tumor Markers', '< 5.0 ng/mL', 110],
          ['CA 125', 'دلالة أورام المبيض', 'Tumor Markers', '< 35 U/mL', 140],
          ['CA 19-9', 'دلالة أورام البنكرياس', 'Tumor Markers', '< 37 U/mL', 140],
          ['CA 15-3', 'دلالة أورام الثدي', 'Tumor Markers', '< 30 U/mL', 140],

          // Vitamins & Minerals
          ['Vitamin D (25-OH)', 'فيتامين د', 'Vitamins', 'Deficiency: <20; Insufficiency: 20-29; Sufficiency: 30-100 ng/mL', 150],
          ['Vitamin B12', 'فيتامين ب12', 'Vitamins', '190-950 pg/mL', 100],
          ['Folic Acid', 'حمض الفوليك', 'Vitamins', '> 5.4 ng/mL', 90],
          
          // Coagulation
          ['D-Dimer', 'دي-دايمر', 'Coagulation', '< 0.50 mcg/mL', 180],
          ['Fibrinogen', 'الفيبرينوجين', 'Coagulation', '200-400 mg/dL', 70],
          ['APTT', 'زمن الثرومبوبلاستين الجزئي', 'Coagulation', '25-35 seconds', 40]
        ];
        const stmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, normal_range, cost) VALUES (?, ?, ?, ?, ?)');
        tests.forEach(t => stmt.run(t[0], t[1], t[2], t[3], t[4]));
        console.log('- [Seed] Lab tests catalog expanded.');
    }

    // 6. Nurse Services
    const nurseServiceCount = db.prepare('SELECT count(*) as count FROM nurse_services').get()?.count || 0;
    if (nurseServiceCount === 0) {
        const services = [
          ['Injection', 'حقنة', 'Administering medication via injection.', 'إعطاء الدواء عن طريق الحقن.', 10],
          ['Wound Dressing', 'تضميد جرح', 'Cleaning and dressing a wound.', 'تنظيف وتضميد الجرح.', 25],
          ['IV Drip', 'محلول وريدي', 'Setting up and monitoring an IV drip.', 'تركيب ومراقبة المحلول الوريدي.', 50],
          ['Blood Pressure Check', 'فحص ضغط الدم', 'Measuring blood pressure.', 'قياس ضغط الدم.', 5]
        ];
        const stmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, description_en, description_ar, cost) VALUES (?, ?, ?, ?, ?)');
        services.forEach(s => stmt.run(s[0], s[1], s[2], s[3], s[4]));
        console.log('- [Seed] Nurse services catalog created.');
    }

    // 7. Operations Catalog
    const opCount = db.prepare('SELECT count(*) as count FROM operations_catalog').get()?.count || 0;
    if (opCount === 0) {
        const ops = [
          ['Appendectomy', 'استئصال الزائدة الدودية', 1500],
          ['Hernia Repair', 'إصلاح فتق', 1200],
          ['Cesarean Section', 'عملية قيصرية', 2500],
          ['Tonsillectomy', 'استئصال اللوزتين', 800],
          ['Gallbladder Removal (Laparoscopic)', 'استئصال المرارة بالمنظار', 3000],
          ['Total Knee Replacement', 'تبديل مفصل الركبة كامل', 6000],
          ['Total Hip Replacement', 'تبديل مفصل الحوض كامل', 6500],
          ['Cataract Surgery', 'إزالة المياه البيضاء', 1000],
          ['Rhinoplasty', 'عملية تجميل الأنف', 2000],
          ['Hysterectomy', 'استئصال الرحم', 3500],
          ['Coronary Artery Bypass (CABG)', 'عملية قلب مفتوح', 15000],
          ['Mastectomy', 'استئصال الثدي', 4000],
          ['Lumbar Discectomy', 'عملية غضروف الظهر', 4500],
          ['Thyroidectomy', 'استئصال الغدة الدرقية', 2800],
          ['Gastric Bypass', 'تحويل مسار المعدة', 8000],
          ['Kidney Stone Removal (Laser)', 'إزالة حصى الكلى بالليزر', 2200],
          ['Prostatectomy', 'استئصال البروستاتا', 4000],
          ['Skin Grafting', 'زراعة الجلد', 1800],
          ['Splenectomy', 'استئصال الطحال', 3200],
          ['Arthrocentesis', 'بزل المفصل', 500],
          ['Carpal Tunnel Release', 'تسليك عصب اليد', 1100],
          ['Hemorrhoidectomy', 'استئصال البواسير', 900],
          ['Fistulectomy', 'استئصال الناصور', 1000],
          ['Breast Augmentation', 'عملية تكبير الثدي', 3000]
        ];
        const stmt = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
        ops.forEach(o => stmt.run(o[0], o[1], o[2]));
        console.log('- [Seed] Operations catalog expanded.');
    }

    // 8. Medical Staff
    const staffCount = db.prepare('SELECT count(*) as count FROM medical_staff').get()?.count || 0;
    if (staffCount === 0) {
      const initialStaff = [
          { eid: 'DOC-001', n: 'Dr. Omer Khalid', t: 'doctor', d: 'Internal Medicine', s: 'Physician', f: 150, ff: 100, fe: 250, sal: 15000 },
          { eid: 'DOC-002', n: 'Dr. Fatima Idris', t: 'doctor', d: 'Surgery', s: 'General Surgeon', f: 300, ff: 200, fe: 500, sal: 20000 },
          { eid: 'DOC-003', n: 'Dr. Yasir Mustafa', t: 'doctor', d: 'Cardiology', s: 'Cardiologist', f: 400, ff: 250, fe: 600, sal: 25000 },
          { eid: 'DOC-004', n: 'Dr. Amna Bakri', t: 'doctor', d: 'Pediatrics', s: 'Pediatrician', f: 120, ff: 80, fe: 200, sal: 14000 },
          { eid: 'NUR-001', n: 'Nurse Hiba Osman', t: 'nurse', d: 'Nursing', s: 'Head Nurse', f: 0, ff: 0, fe: 0, sal: 6000 },
          { eid: 'TEC-001', n: 'Tech Ahmed Adam', t: 'technician', d: 'Laboratory', s: 'Lab Technician', f: 0, ff: 0, fe: 0, sal: 5500 }
      ];
      const stmt = db.prepare(`
        INSERT INTO medical_staff (
          employee_id, full_name, type, department, specialization, 
          consultation_fee, consultation_fee_followup, consultation_fee_emergency, base_salary, status, available_days
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', '["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]')
      `);
      initialStaff.forEach(s => stmt.run(s.eid, s.n, s.t, s.d, s.s, s.f, s.ff, s.fe, s.sal));
      console.log('- [Seed] Initial staff created.');
    }

    // 9. Demo Patients
    const patientCount = db.prepare('SELECT count(*) as count FROM patients').get()?.count || 0;
    if (patientCount === 0) {
      // Data seeding for patients has been removed as per user request.
      console.log('- [Seed] Demo patients seeding skipped.');
    }

    // 10. Beds
    const bedCount = db.prepare('SELECT count(*) as count FROM beds').get()?.count || 0;
    if (bedCount === 0) {
      const beds = [
          { no: '101', t: 'General', c: 50 }, { no: '102', t: 'General', c: 50 },
          { no: '201', t: 'Private', c: 250 }, { no: '301', t: 'ICU', c: 1200 },
          { no: '401', t: 'Emergency', c: 100 }
      ];
      const stmt = db.prepare("INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, 'available')");
      beds.forEach(b => stmt.run(b.no, b.t, b.c));
      console.log('- [Seed] Ward beds initialized.');
    }

    // 11. Financial Settings
    const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get()?.count || 0;
    if (pmCount === 0) {
      const pms = [['Cash', 'نقدي'], ['Bank Transfer', 'تحويل بنكي'], ['Insurance', 'تأمين']];
      const stmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      pms.forEach(p => stmt.run(p[0], p[1]));
      
      db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run('Standard VAT', 'ضريبة القيمة المضافة', 15, 1);
      
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalName', 'AllCare General Hospital');
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalAddress', 'Atbara, River Nile State, Sudan');
      db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)').run('hospitalPhone', '+249 123 456 789');
      
      const ins = [['Blue Nile Insurance', 'تأمين النيل الأزرق'], ['Shiekan Insurance', 'تأمين شيكان']];
      const insStmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      ins.forEach(i => insStmt.run(i[0], i[1]));

      console.log('- [Seed] Financial configurations initialized.');
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