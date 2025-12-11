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

  // Departments
  if (db.prepare('SELECT COUNT(*) FROM departments').get()['COUNT(*)'] === 0) {
    const departments = [
      { name_en: 'Administration', name_ar: 'الإدارة' },
      { name_en: 'Anesthesiology', name_ar: 'التخدير' },
      { name_en: 'Cardiology', name_ar: 'أمراض القلب' },
      { name_en: 'Dermatology', name_ar: 'الأمراض الجلدية' },
      { name_en: 'Emergency', name_ar: 'الطوارئ' },
      { name_en: 'Finance', name_ar: 'المالية' },
      { name_en: 'General Surgery', name_ar: 'الجراحة العامة' },
      { name_en: 'Internal Medicine', name_ar: 'الطب الباطني' },
      { name_en: 'IT Support', name_ar: 'دعم تقنية المعلومات' },
      { name_en: 'Laboratory', name_ar: 'المختبر' },
      { name_en: 'Maintenance', name_ar: 'الصيانة' },
      { name_en: 'Neurology', name_ar: 'طب الأعصاب' },
      { name_en: 'Obstetrics and Gynecology', name_ar: 'أمراض النساء والتوليد' },
      { name_en: 'Oncology', name_ar: 'علم الأورام' },
      { name_en: 'Orthopedics', name_ar: 'طب العظام' },
      { name_en: 'Pediatrics', name_ar: 'طب الأطفال' },
      { name_en: 'Pharmacy', name_ar: 'الصيدلية' },
      { name_en: 'Radiology', name_ar: 'الأشعة' },
      { name_en: 'Security', name_ar: 'الأمن' },
      { name_en: 'Support Services', name_ar: 'خدمات الدعم' }
    ];
    const insertDept = db.prepare('INSERT OR IGNORE INTO departments (name_en, name_ar) VALUES (?, ?)');
    departments.forEach(d => insertDept.run(d.name_en, d.name_ar));
    console.log('✅ Departments seeded.');
  }

  // Specializations
  if (db.prepare('SELECT COUNT(*) FROM specializations').get()['COUNT(*)'] === 0) {
    const specializations = [
      { name_en: 'Anesthesiologist', name_ar: 'طبيب تخدير' },
      { name_en: 'Cardiologist', name_ar: 'أخصائي أمراض القلب' },
      { name_en: 'Dermatologist', name_ar: 'طبيب جلدية' },
      { name_en: 'Emergency Physician', name_ar: 'طبيب طوارئ' },
      { name_en: 'ENT Specialist', name_ar: 'أخصائي أنف وأذن وحنجرة' },
      { name_en: 'Gastroenterologist', name_ar: 'أخصائي أمراض الجهاز الهضمي' },
      { name_en: 'General Surgeon', name_ar: 'جراح عام' },
      { name_en: 'Gynecologist', name_ar: 'طبيب نساء' },
      { name_en: 'Internist', name_ar: 'طبيب باطني' },
      { name_en: 'Neurologist', name_ar: 'أخصائي طب الأعصاب' },
      { name_en: 'Oncologist', name_ar: 'طبيب أورام' },
      { name_en: 'Orthopedic Surgeon', name_ar: 'جراح عظام' },
      { name_en: 'Pediatrician', name_ar: 'طبيب أطفال' },
      { name_en: 'Psychiatrist', name_ar: 'طبيب نفسي' },
      { name_en: 'Radiologist', name_ar: 'أخصائي أشعة' },
      { name_en: 'Urologist', name_ar: 'أخصائي مسالك بولية' }
    ];
    const insertSpec = db.prepare('INSERT OR IGNORE INTO specializations (name_en, name_ar) VALUES (?, ?)');
    specializations.forEach(s => insertSpec.run(s.name_en, s.name_ar));
    console.log('✅ Specializations seeded.');
  }

  // Lab Tests (Extended)
  if (db.prepare('SELECT COUNT(*) FROM lab_tests').get()['COUNT(*)'] === 0) {
    const tests = [
      { name_en: 'CBC (Complete Blood Count)', name_ar: 'تعداد الدم الكامل', category_en: 'Hematology', category_ar: 'أمراض الدم', cost: 15 },
      { name_en: 'BMP (Basic Metabolic Panel)', name_ar: 'لوحة الأيض الأساسية', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 25 },
      { name_en: 'Lipid Panel', name_ar: 'لوحة الدهون', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 30 },
      { name_en: 'Liver Function Tests (LFT)', name_ar: 'اختبارات وظائف الكبد', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 40 },
      { name_en: 'Urinalysis', name_ar: 'تحليل البول', category_en: 'Microbiology', category_ar: 'علم الأحياء الدقيقة', cost: 10 },
      { name_en: 'Glucose Test (Fasting)', name_ar: 'اختبار الجلوكوز (صائم)', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 8 },
      { name_en: 'Thyroid Stimulating Hormone (TSH)', name_ar: 'هرمون الغدة الدرقية', category_en: 'Endocrinology', category_ar: 'الغدد الصماء', cost: 50 },
      { name_en: 'Hemoglobin A1c (HbA1c)', name_ar: 'الهيموجلوبين السكري', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 35 },
      { name_en: 'Prothrombin Time (PT/INR)', name_ar: 'زمن البروثرومبين', category_en: 'Hematology', category_ar: 'أمراض الدم', cost: 22 },
      { name_en: 'Creatinine Kinase (CK)', name_ar: 'كيناز الكرياتينين', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 18 },
      { name_en: 'C-Reactive Protein (CRP)', name_ar: 'بروتين سي التفاعلي', category_en: 'Immunology', category_ar: 'علم المناعة', cost: 20 },
      { name_en: 'Erythrocyte Sedimentation Rate (ESR)', name_ar: 'سرعة تثفل الكريات الحمر', category_en: 'Hematology', category_ar: 'أمراض الدم', cost: 12 },
      { name_en: 'Blood Urea Nitrogen (BUN)', name_ar: 'نيتروجين اليوريا في الدم', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 15 },
      { name_en: 'Uric Acid', name_ar: 'حمض اليوريك', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 14 },
      { name_en: 'Calcium, Total', name_ar: 'الكالسيوم, الكلي', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 10 },
      { name_en: 'Vitamin D, 25-Hydroxy', name_ar: 'فيتامين د, 25-هيدروكسي', category_en: 'Endocrinology', category_ar: 'الغدد الصماء', cost: 60 },
      { name_en: 'Iron, Total', name_ar: 'الحديد, الكلي', category_en: 'Chemistry', category_ar: 'الكيمياء', cost: 25 },
      { name_en: 'Ferritin', name_ar: 'الفيريتين', category_en: 'Immunology', category_ar: 'علم المناعة', cost: 30 },
      { name_en: 'Hepatitis B Surface Antigen', name_ar: 'المستضد السطحي لالتهاب الكبد ب', category_en: 'Serology', category_ar: 'علم الأمصال', cost: 45 },
      { name_en: 'HIV Antibody Test', name_ar: 'اختبار الأجسام المضادة لفيروس نقص المناعة', category_en: 'Serology', category_ar: 'علم الأمصال', cost: 55 }
    ];
    const insertTest = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost) VALUES (?, ?, ?, ?, ?)');
    tests.forEach(t => insertTest.run(t.name_en, t.name_ar, t.category_en, t.category_ar, t.cost));
    console.log('✅ Lab tests seeded.');
  }

  // Nurse Services
  if (db.prepare('SELECT COUNT(*) FROM nurse_services').get()['COUNT(*)'] === 0) {
    const services = [
      { name_en: 'IV Drip Administration', name_ar: 'إعطاء محاليل وريدية', description_en: 'Administering intravenous fluids.', description_ar: 'إعطاء السوائل عن طريق الوريد.', cost: 20 },
      { name_en: 'Wound Dressing', name_ar: 'تضميد الجروح', description_en: 'Cleaning and dressing wounds.', description_ar: 'تنظيف وتضميد الجروح.', cost: 15 },
      { name_en: 'Vital Signs Monitoring', name_ar: 'مراقبة العلامات الحيوية', description_en: 'Regular check of vital signs.', description_ar: 'فحص دوري للعلامات الحيوية.', cost: 5 },
      { name_en: 'Medication Administration (IM/SC)', name_ar: 'إعطاء الأدوية (حقن)', description_en: 'Administering prescribed medication via injection.', description_ar: 'إعطاء الدواء الموصوف عن طريق الحقن.', cost: 10 },
      { name_en: 'Catheter Care', name_ar: 'العناية بالقسطرة', description_en: 'Maintenance and cleaning of urinary catheters.', description_ar: 'صيانة وتنظيف القسطرة البولية.', cost: 25 },
      { name_en: 'Nebulizer Treatment', name_ar: 'جلسة استنشاق', description_en: 'Administering medication via a nebulizer.', description_ar: 'إعطاء الدواء عن طريق جهاز الاستنشاق.', cost: 12 }
    ];
    const insertSvc = db.prepare('INSERT INTO nurse_services (name_en, name_ar, description_en, description_ar, cost) VALUES (?, ?, ?, ?, ?)');
    services.forEach(s => insertSvc.run(s.name_en, s.name_ar, s.description_en, s.description_ar, s.cost));
    console.log('✅ Nurse services seeded.');
  }

  // Operations Catalog
  if (db.prepare('SELECT COUNT(*) FROM operations_catalog').get()['COUNT(*)'] === 0) {
    const operations = [
      { name_en: 'Appendectomy', name_ar: 'استئصال الزائدة الدودية', base_cost: 1500 },
      { name_en: 'Hernia Repair', name_ar: 'إصلاح الفتق', base_cost: 2000 },
      { name_en: 'Knee Arthroscopy', name_ar: 'تنظير الركبة', base_cost: 3000 },
      { name_en: 'Gallbladder Removal (Cholecystectomy)', name_ar: 'استئصال المرارة', base_cost: 2500 },
      { name_en: 'Cesarean Section', name_ar: 'الولادة القيصرية', base_cost: 2200 },
      { name_en: 'Tonsillectomy', name_ar: 'استئصال اللوزتين', base_cost: 800 },
      { name_en: 'Coronary Artery Bypass Graft (CABG)', name_ar: 'مجازة الشريان التاجي', base_cost: 25000 },
      { name_en: 'Hip Replacement', name_ar: 'استبدال مفصل الورك', base_cost: 15000 },
      { name_en: 'Cataract Surgery', name_ar: 'جراحة إعتام عدسة العين', base_cost: 1800 },
      { name_en: 'Mastectomy', name_ar: 'استئصال الثدي', base_cost: 6000 },
      { name_en: 'Prostatectomy', name_ar: 'استئصال البروستاتا', base_cost: 8000 },
      { name_en: 'Spinal Fusion', name_ar: 'دمج الفقرات', base_cost: 18000 },
      { name_en: 'Angioplasty', name_ar: 'رأب الوعاء', base_cost: 12000 }
    ];
    const insertOp = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)');
    operations.forEach(o => insertOp.run(o.name_en, o.name_ar, o.base_cost));
    console.log('✅ Operations catalog seeded.');
  }

  // Beds
  if (db.prepare('SELECT COUNT(*) FROM beds').get()['COUNT(*)'] === 0) {
    const beds = [
      { room_number: 'G-101', type: 'General', cost_per_day: 50 }, { room_number: 'G-102', type: 'General', cost_per_day: 50 },
      { room_number: 'G-103', type: 'General', cost_per_day: 50 }, { room_number: 'G-104', type: 'General', cost_per_day: 50 },
      { room_number: 'P-201', type: 'Private', cost_per_day: 150 }, { room_number: 'P-202', type: 'Private', cost_per_day: 150 },
      { room_number: 'P-203', type: 'Private', cost_per_day: 150 },
      { room_number: 'M-301', type: 'Private', cost_per_day: 160 }, { room_number: 'M-302', type: 'General', cost_per_day: 60 },
      { room_number: 'ICU-01', type: 'ICU', cost_per_day: 300 }, { room_number: 'ICU-02', type: 'ICU', cost_per_day: 300 }
    ];
    const insertBed = db.prepare('INSERT INTO beds (room_number, type, cost_per_day) VALUES (?, ?, ?)');
    beds.forEach(b => insertBed.run(b.room_number, b.type, b.cost_per_day));
    console.log('✅ Beds seeded.');
  }
  
  // Payment Methods
  if (db.prepare('SELECT COUNT(*) FROM payment_methods').get()['COUNT(*)'] === 0) {
    const methods = [
      { name_en: 'Cash', name_ar: 'نقداً' },
      { name_en: 'Bankak (Bank of Khartoum)', name_ar: 'بنكك (بنك الخرطوم)' },
      { name_en: 'SyberPay', name_ar: 'سايبر باي' },
      { name_en: 'Credit Card', name_ar: 'بطاقة ائتمان' },
      { name_en: 'Insurance', name_ar: 'تأمين' },
      { name_en: 'Bank Transfer', name_ar: 'تحويل بنكي' }
    ];
    const insertMethod = db.prepare('INSERT OR IGNORE INTO payment_methods (name_en, name_ar) VALUES (?, ?)');
    methods.forEach(m => insertMethod.run(m.name_en, m.name_ar));
    console.log('✅ Payment Methods seeded.');
  }

  // Tax Rates
  if (db.prepare('SELECT COUNT(*) FROM tax_rates').get()['COUNT(*)'] === 0) {
    const taxes = [ { name_en: 'VAT', name_ar: 'ضريبة القيمة المضافة', rate: 15 } ];
    const insertTax = db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate) VALUES (?, ?, ?)');
    taxes.forEach(t => insertTax.run(t.name_en, t.name_ar, t.rate));
    console.log('✅ Tax Rates seeded.');
  }

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
    const insertProvider = db.prepare('INSERT OR IGNORE INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
    providers.forEach(p => {
        try {
            insertProvider.run(p.name_en, p.name_ar);
        } catch (e) {
            // Ignore unique constraint errors on re-runs
        }
    });
    console.log('✅ Insurance providers seeded.');
  }
};

module.exports = { db, initDB };