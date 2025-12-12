
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
const db = new Database(dbPath); // verbose: console.log for debugging

// PERFORMANCE OPTIMIZATION: Enable Write-Ahead Logging (WAL)
// This allows simultaneous readers and writers, preventing "database is locked" errors in production.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL'); // Faster writes with reasonable safety

const initDB = (forceReset = false) => {
  if (forceReset) {
    console.log('Resetting database...');
    const dbFile = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
    if (fs.existsSync(dbFile)) {
        fs.unlinkSync(dbFile);
    }
    // Re-instantiate after delete
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

  // --- 2. Patient & Clinical Records ---
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
      emergency_contacts TEXT, -- JSON object
      has_insurance BOOLEAN DEFAULT 0,
      insurance_details TEXT, -- JSON object
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

  // --- 3. Human Resources (HR) ---
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

  // MIGRATION: Ensure 'address' column exists in medical_staff for existing databases
  try {
    // Attempt to select the column. If it fails, the catch block runs.
    db.prepare('SELECT address FROM medical_staff LIMIT 1').get();
  } catch (error) {
    if (error.message.includes('no such column')) {
        console.log('Migrating database: Adding missing address column to medical_staff table...');
        try {
          db.prepare('ALTER TABLE medical_staff ADD COLUMN address TEXT').run();
          console.log('Migration successful.');
        } catch (e) {
          console.error('Migration failed:', e);
        }
    }
  }

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hr_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status TEXT CHECK(status IN ('present', 'absent', 'late', 'half_day')) DEFAULT 'present',
      check_in TIME,
      check_out TIME,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hr_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('sick', 'vacation', 'casual', 'unpaid')) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hr_payroll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      base_salary REAL NOT NULL,
      total_bonuses REAL DEFAULT 0,
      total_fines REAL DEFAULT 0,
      net_salary REAL NOT NULL,
      status TEXT DEFAULT 'draft',
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS hr_financials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('bonus', 'fine', 'loan')) NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      date DATE NOT NULL,
      status TEXT DEFAULT 'active',
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `).run();

  // --- 4. Billing & Financials ---
  db.prepare(`
    CREATE TABLE IF NOT EXISTS billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(patient_id) REFERENCES patients(id)
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS billing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billing_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY(billing_id) REFERENCES billing(id)
    )
  `).run();

  // --- TREASURY (New) ---
  db.prepare(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
      category TEXT,
      amount REAL NOT NULL,
      method TEXT,
      reference_id INTEGER, -- bill_id for income
      details TEXT, -- JSON for insurance/trans details
      date DATETIME DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `).run();

  // --- 5. Medical Services & Wards ---
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`).run();

  // --- 6. System Configuration ---
  db.prepare(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT)`).run();
  
  db.prepare(`CREATE TABLE IF NOT EXISTS specializations (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT)`).run();
  
  // Add related_role column to specializations if it doesn't exist
  try {
    db.prepare('SELECT related_role FROM specializations LIMIT 1').get();
  } catch (e) {
    db.prepare('ALTER TABLE specializations ADD COLUMN related_role TEXT').run();
  }

  db.prepare(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS tax_rates (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, rate REAL, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY AUTOINCREMENT, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`).run();

  // --- Seeding ---
  seedData();
};

const seedData = () => {
  // Seed Banks
  const banksCount = db.prepare('SELECT count(*) as count FROM banks').get().count;
  if (banksCount === 0) {
    const banks = [
      { en: 'Bank of Khartoum', ar: 'بنك الخرطوم' },
      { en: 'Omdurman National Bank', ar: 'بنك أمدرمان الوطني' },
      { en: 'Faisal Islamic Bank', ar: 'بنك فيصل الإسلامي' },
      { en: 'Blue Nile Mashreg Bank', ar: 'بنك النيل الأزرق المشرق' },
      { en: 'Al Salam Bank', ar: 'بنك السلام' },
      { en: 'United Capital Bank', ar: 'بنك المال المتحد' },
      { en: 'Ivory Bank', ar: 'بنك إيفوري' },
      { en: 'Farmer\'s Commercial Bank', ar: 'البنك المزارع التجاري' },
      { en: 'Saudi Sudanese Bank', ar: 'البنك السعودي السوداني' },
      { en: 'Nile Bank', ar: 'بنك النيل' },
      { en: 'Animal Resources Bank', ar: 'بنك الثروة الحيوانية' },
      { en: 'Saving and Social Development Bank', ar: 'بنك الادخار والتنمية الاجتماعية' }
    ];
    const insert = db.prepare('INSERT INTO banks (name_en, name_ar) VALUES (?, ?)');
    banks.forEach(b => insert.run(b.en, b.ar));
    console.log('Seeded banks.');
  }

  // Seed Specializations with Role mappings
  const specCount = db.prepare('SELECT count(*) as count FROM specializations').get().count;
  // If specializations are missing or minimal, re-seed to include all roles
  if (specCount < 20) { 
    db.prepare('DELETE FROM specializations').run(); 

    const specs = [
      // Doctors
      { en: 'Cardiology', ar: 'أمراض القلب', role: 'doctor' },
      { en: 'Neurology', ar: 'الأعصاب', role: 'doctor' },
      { en: 'Orthopedics', ar: 'العظام', role: 'doctor' },
      { en: 'Pediatrics', ar: 'طب الأطفال', role: 'doctor' },
      { en: 'General Surgery', ar: 'الجراحة العامة', role: 'doctor' },
      { en: 'Internal Medicine', ar: 'الباطنية', role: 'doctor' },
      { en: 'Dermatology', ar: 'الجلدية', role: 'doctor' },
      { en: 'Anesthesiology', ar: 'التخدير', role: 'doctor' },
      { en: 'Oncology', ar: 'الأورام', role: 'doctor' },
      { en: 'Obstetrics and Gynecology', ar: 'النساء والولادة', role: 'doctor' },
      { en: 'Radiology', ar: 'الأشعة', role: 'doctor' },
      { en: 'Ophthalmology', ar: 'العيون', role: 'doctor' },
      { en: 'ENT', ar: 'أنف وأذن وحنجرة', role: 'doctor' },
      { en: 'Psychiatry', ar: 'الطب النفسي', role: 'doctor' },
      { en: 'Urology', ar: 'المسالك البولية', role: 'doctor' },

      // Nurses
      { en: 'Critical Care Nursing', ar: 'تمريض العناية المركزة', role: 'nurse' },
      { en: 'Pediatric Nursing', ar: 'تمريض الأطفال', role: 'nurse' },
      { en: 'Surgical Nursing', ar: 'تمريض الجراحة', role: 'nurse' },
      { en: 'Emergency Nursing', ar: 'تمريض الطوارئ', role: 'nurse' },
      { en: 'General Nursing', ar: 'تمريض عام', role: 'nurse' },
      { en: 'Oncology Nursing', ar: 'تمريض الأورام', role: 'nurse' },
      { en: 'Maternity Nursing', ar: 'تمريض الأمومة', role: 'nurse' },

      // Technicians
      { en: 'Laboratory Technician', ar: 'فني مختبر', role: 'technician' },
      { en: 'Radiology Technician', ar: 'فني أشعة', role: 'technician' },
      { en: 'Phlebotomist', ar: 'سحب دم', role: 'technician' },
      { en: 'Anesthesia Technician', ar: 'فني تخدير', role: 'technician' },
      { en: 'Dialysis Technician', ar: 'فني غسيل كلى', role: 'technician' },

      // Pharmacists
      { en: 'Clinical Pharmacy', ar: 'صيدلة سريرية', role: 'pharmacist' },
      { en: 'Hospital Pharmacy', ar: 'صيدلة المستشفيات', role: 'pharmacist' },
      { en: 'Dispensing Pharmacy', ar: 'صيدلة الصرف', role: 'pharmacist' },

      // Anesthesiologists
      { en: 'General Anesthesiology', ar: 'تخدير عام', role: 'anesthesiologist' },
      { en: 'Pediatric Anesthesiology', ar: 'تخدير أطفال', role: 'anesthesiologist' },
      { en: 'Cardiac Anesthesiology', ar: 'تخدير قلب', role: 'anesthesiologist' },

      // HR/Staff (Mapped to hr_manager)
      { en: 'Human Resources', ar: 'الموارد البشرية', role: 'hr_manager' },
      { en: 'Recruitment', ar: 'التوظيف', role: 'hr_manager' },
      { en: 'Personnel Administration', ar: 'شؤون الموظفين', role: 'hr_manager' },

      // General Staff
      { en: 'Administration', ar: 'الإدارة', role: 'staff' },
      { en: 'Maintenance', ar: 'الصيانة', role: 'staff' },
      { en: 'Security', ar: 'الأمن', role: 'staff' },
      { en: 'Housekeeping', ar: 'النظافة', role: 'staff' },
      { en: 'IT Support', ar: 'الدعم الفني', role: 'staff' },
      { en: 'Transport', ar: 'النقل', role: 'staff' },

      // Medical Assistant
      { en: 'Clinical Assistance', ar: 'مساعدة سريرية', role: 'medical_assistant' },
      { en: 'Administrative Assistance', ar: 'مساعدة إدارية', role: 'medical_assistant' },

      // Receptionist
      { en: 'Front Desk', ar: 'الاستقبال', role: 'receptionist' },
      { en: 'Patient Registration', ar: 'تسجيل المرضى', role: 'receptionist' },
      { en: 'Call Center', ar: 'مركز الاتصال', role: 'receptionist' },

      // Accountant
      { en: 'General Accounting', ar: 'محاسبة عامة', role: 'accountant' },
      { en: 'Billing & Claims', ar: 'الفواتير والمطالبات', role: 'accountant' },
      { en: 'Financial Auditing', ar: 'تدقيق مالي', role: 'accountant' },

      // Manager
      { en: 'Hospital Management', ar: 'إدارة المستشفيات', role: 'manager' },
      { en: 'Operations Management', ar: 'إدارة العمليات', role: 'manager' },
      { en: 'Department Head', ar: 'رئيس قسم', role: 'manager' }
    ];

    const insert = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
    specs.forEach(s => insert.run(s.en, s.ar, s.role));
    console.log('Seeded specializations.');
  }
  
  // Seed Users (Admin) if not exists
  const userCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (userCount === 0) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare("INSERT INTO users (username, password, full_name, role) VALUES ('admin', ?, 'System Administrator', 'admin')").run(hash);
    console.log('Seeded admin user.');
  }
};

module.exports = { db, initDB };
