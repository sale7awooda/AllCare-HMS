
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { ROLE_PERMISSIONS } = require('../utils/rbac_backend_mirror');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

db.pragma('journal_mode = DELETE');
db.pragma('synchronous = NORMAL'); 
db.pragma('foreign_keys = ON');

const initDB = (forceReset = false) => {
  if (forceReset) {
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
  db.prepare(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, results TEXT, notes TEXT)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`).run();
  db.prepare(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`).run();

  // --- Pharmacy Tables ---
  db.prepare(`
    CREATE TABLE IF NOT EXISTS pharmacy_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      stock INTEGER DEFAULT 0,
      min_stock INTEGER DEFAULT 10,
      unit_price REAL DEFAULT 0,
      expiry_date DATE,
      manufacturer TEXT,
      sku TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS pharmacy_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      medicine_id INTEGER,
      quantity INTEGER,
      total_price REAL,
      dispensed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      pharmacist_id INTEGER,
      bill_id INTEGER,
      FOREIGN KEY(patient_id) REFERENCES patients(id),
      FOREIGN KEY(medicine_id) REFERENCES pharmacy_stock(id),
      FOREIGN KEY(pharmacist_id) REFERENCES users(id)
    )
  `).run();

  // --- Configuration Tables ---
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

  // --- 1. Default System Accounts ---
  const defaultUsers = [
    { u: 'admin', p: 'admin123', n: 'System Administrator', r: 'admin' },
    { u: 'labtech', p: 'labtech123', n: 'Ahmed Lab Technician', r: 'technician' },
    { u: 'pharmacist', p: 'pharmacist123', n: 'Musa Pharmacist', r: 'pharmacist' },
    { u: 'manager', p: 'manager123', n: 'Sarah Manager', r: 'manager' },
    { u: 'receptionist', p: 'receptionist123', n: 'Pam Receptionist', r: 'receptionist' },
    { u: 'accountant', p: 'accountant123', n: 'Angela Accountant', r: 'accountant' },
  ];

  const userStmt = db.prepare("INSERT OR REPLACE INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)");
  defaultUsers.forEach(d => {
      const h = bcrypt.hashSync(d.p, 10);
      userStmt.run(d.u, h, d.n, d.r);
  });

  // --- 2. Pharmacy Initial Inventory (200+ Known Medicines) ---
  const medCount = db.prepare('SELECT count(*) as count FROM pharmacy_stock').get().count;
  if (medCount === 0) {
      const meds = [
        // Antibiotics
        ['Amoxicillin 500mg', 'Capsule', 1000, 100, 0.45, '2026-05-01', 'GSK', 'AMX-500'],
        ['Azithromycin 500mg', 'Tablet', 500, 50, 2.50, '2025-11-20', 'Pfizer', 'AZI-500'],
        ['Ciprofloxacin 500mg', 'Tablet', 800, 100, 0.85, '2026-02-15', 'Bayer', 'CIP-500'],
        ['Cephalexin 500mg', 'Capsule', 600, 50, 0.95, '2025-08-30', 'Lupin', 'CEP-500'],
        ['Metronidazole 500mg', 'Tablet', 700, 100, 0.30, '2026-01-10', 'Sanofi', 'MET-500'],
        ['Augmentin 625mg', 'Tablet', 450, 50, 3.20, '2025-12-05', 'GSK', 'AUG-625'],
        ['Doxycycline 100mg', 'Capsule', 900, 100, 0.55, '2026-04-20', 'Mylan', 'DOX-100'],
        // Pain Management
        ['Paracetamol 500mg', 'Tablet', 5000, 500, 0.05, '2027-01-01', 'Panadol', 'PARA-500'],
        ['Ibuprofen 400mg', 'Tablet', 2000, 200, 0.15, '2026-09-12', 'Advil', 'IBU-400'],
        ['Diclofenac 50mg', 'Tablet', 1500, 150, 0.25, '2026-03-25', 'Voltaren', 'DIC-50'],
        ['Tramadol 50mg', 'Capsule', 300, 50, 1.10, '2025-07-14', 'Grunenthal', 'TRA-50'],
        ['Celecoxib 200mg', 'Capsule', 400, 50, 2.80, '2026-06-05', 'Pfizer', 'CEL-200'],
        ['Aspirin 81mg', 'Tablet', 3000, 300, 0.08, '2027-02-28', 'Bayer', 'ASP-81'],
        // Diabetic
        ['Metformin 500mg', 'Tablet', 4000, 400, 0.12, '2026-11-15', 'Merck', 'METF-500'],
        ['Gliclazide 80mg', 'Tablet', 1200, 150, 0.35, '2026-05-10', 'Servier', 'GLI-80'],
        ['Sitagliptin 100mg', 'Tablet', 600, 60, 4.50, '2025-10-30', 'MSD', 'SIT-100'],
        ['Insulin Glargine', 'Injection', 150, 20, 28.00, '2025-04-20', 'Lantus', 'INS-GL'],
        ['Insulin Aspart', 'Injection', 120, 15, 22.50, '2025-03-15', 'NovoLog', 'INS-AS'],
        // Cardiovascular
        ['Amlodipine 5mg', 'Tablet', 2500, 250, 0.20, '2026-08-20', 'Pfizer', 'AML-5'],
        ['Atorvastatin 20mg', 'Tablet', 1800, 200, 0.65, '2026-07-15', 'Lipitor', 'ATO-20'],
        ['Lisinopril 10mg', 'Tablet', 2200, 250, 0.18, '2026-12-01', 'Zestril', 'LIS-10'],
        ['Losartan 50mg', 'Tablet', 1500, 150, 0.45, '2026-05-30', 'Cozaar', 'LOS-50'],
        ['Clopidogrel 75mg', 'Tablet', 900, 100, 1.25, '2026-02-10', 'Plavix', 'CLO-75'],
        ['Bisoprolol 5mg', 'Tablet', 1000, 100, 0.55, '2026-01-20', 'Concor', 'BIS-5'],
        ['Warfarin 5mg', 'Tablet', 500, 50, 0.40, '2025-09-15', 'Coumadin', 'WAR-5'],
        // Gastrointestinal
        ['Omeprazole 20mg', 'Capsule', 2500, 300, 0.35, '2026-10-01', 'Prilosec', 'OME-20'],
        ['Esomeprazole 40mg', 'Tablet', 1200, 150, 1.80, '2026-04-12', 'Nexium', 'ESO-40'],
        ['Pantoprazole 40mg', 'Tablet', 1500, 150, 0.75, '2026-03-20', 'Protonix', 'PAN-40'],
        ['Domperidone 10mg', 'Tablet', 2000, 200, 0.22, '2026-08-15', 'Motilium', 'DOM-10'],
        ['Loperamide 2mg', 'Capsule', 1000, 100, 0.15, '2026-02-28', 'Imodium', 'LOP-2'],
        // Respiratory
        ['Salbutamol Inhaler', 'Inhaler', 300, 50, 8.50, '2025-11-30', 'Ventolin', 'SAL-INH'],
        ['Fluticasone Spray', 'Nasal Spray', 250, 30, 14.00, '2025-06-20', 'Flonase', 'FLU-SPR'],
        ['Montelukast 10mg', 'Tablet', 800, 100, 1.20, '2026-04-15', 'Singulair', 'MON-10'],
        ['Cough Syrup (Guaifenesin)', 'Syrup', 400, 50, 4.50, '2025-10-10', 'Benylin', 'COU-SYR'],
        // Vitamins & Supplements
        ['Vitamin D3 1000IU', 'Tablet', 3000, 300, 0.12, '2027-05-20', 'NatureMade', 'VIT-D3'],
        ['Vitamin C 500mg', 'Tablet', 4000, 400, 0.10, '2027-03-15', 'Cebion', 'VIT-C'],
        ['Multivitamin', 'Tablet', 2000, 200, 0.25, '2027-02-10', 'Centrum', 'VIT-MUL'],
        ['Folic Acid 5mg', 'Tablet', 5000, 500, 0.04, '2027-06-30', 'HealthAid', 'FOL-5'],
        ['Iron Supplement', 'Tablet', 1500, 150, 0.30, '2026-11-20', 'Ferrous', 'IRO-TAB']
      ];

      // Procedurally generate more entries to hit ~200
      const categories = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Supplies'];
      const suffixes = ['Extra', 'Forte', 'Junior', 'XR', 'Plus'];
      for (let i = 0; i < 160; i++) {
          const name = `Medicine SKU-${100 + i}`;
          const cat = categories[i % categories.length];
          const sku = `SKU-${5000 + i}`;
          meds.push([name, cat, 200 + i, 20, 1.5 + (i * 0.1), '2026-12-31', 'Global Pharma', sku]);
      }

      const mStmt = db.prepare('INSERT INTO pharmacy_stock (name, category, stock, min_stock, unit_price, expiry_date, manufacturer, sku) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      meds.forEach(m => mStmt.run(...m));
  }

  // --- 3. Financial Configuration (Sudanese Standards) ---
  const pmCount = db.prepare('SELECT count(*) as count FROM payment_methods').get().count;
  if (pmCount === 0) {
      const pms = [
          ['Cash', 'نقدي', 1],
          ['Bankak (BOK)', 'بنكك (بنك الخرطوم)', 1],
          ['Insurance', 'تأمين طبي', 1],
          ['Fawry', 'فوري', 1],
          ['Ocash', 'أو كاش', 1],
          ['Credit Card', 'بطاقة مصرفية', 1]
      ];
      const pmStmt = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, ?)');
      pms.forEach(p => pmStmt.run(...p));
  }

  const taxCount = db.prepare('SELECT count(*) as count FROM tax_rates').get().count;
  if (taxCount === 0) {
      const taxes = [
          ['Standard', 'قياسي', 0, 1],
          ['VAT', 'ضريبة القيمة المضافة', 15, 0]
      ];
      const taxStmt = db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)');
      taxes.forEach(t => taxStmt.run(...t));
  }

  const insCount = db.prepare('SELECT count(*) as count FROM insurance_providers').get().count;
  if (insCount === 0) {
      const ins = [
          ['Shiekan Insurance', 'شركة شيكان للتأمين'],
          ['Blue Nile Insurance', 'شركة النيل الأزرق للتأمين'],
          ['United Insurance', 'الشركة المتحدة للتأمين'],
          ['El Nilin Insurance', 'شركة النيلين للتأمين'],
          ['Islamic Insurance', 'شركة التأمين الإسلامية'],
          ['Al Baraka Insurance', 'شركة البركة للتأمين'],
          ['Savanna Insurance', 'شركة سافنا للتأمين'],
          ['General Insurance', 'شركة التأمين العامة'],
          ['Juba Insurance', 'شركة جوبا للتأمين'],
          ['Arabia Insurance', 'شركة التأمين العربية']
      ];
      const insStmt = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      ins.forEach(i => insStmt.run(...i));
  }

  const bankCount = db.prepare('SELECT count(*) as count FROM banks').get().count;
  if (bankCount === 0) {
      const banks = [
          ['Bank of Khartoum (BOK)', 'بنك الخرطوم'],
          ['Faisal Islamic Bank', 'بنك فيصل الإسلامي'],
          ['Omdurman National Bank', 'بنك أمدرمان الوطني'],
          ['Sudanese Islamic Bank', 'البنك الإسلامي السوداني'],
          ['Al Baraka Bank', 'بنك البركة'],
          ['Al Salam Bank', 'بنك السلام'],
          ['United Capital Bank', 'بنك المال المتحد'],
          ['Blue Nile Mashreq Bank', 'بنك النيل الأزرق المشرق'],
          ['Saudi Sudanese Bank', 'البنك السعودي السوداني'],
          ['Workers National Bank', 'بنك العمال الوطني']
      ];
      const bStmt = db.prepare('INSERT INTO banks (name_en, name_ar, is_active) VALUES (?, ?, 1)');
      banks.forEach(b => bStmt.run(...b));
  }

  // --- 4. Clinical Catalogs (Departments, Specializations, Lab Tests, Nurse Services) ---
  const deptCount = db.prepare('SELECT count(*) as count FROM departments').get().count;
  if (deptCount === 0) {
      const depts = [
          ['General Medicine', 'الطب العام', 'Primary care and internal diagnostics', 'الرعاية الأولية والتشخيص الباطني'],
          ['General Surgery', 'الجراحة العامة', 'Surgical procedures and critical care', 'الإجراءات الجراحية والعناية المركزة'],
          ['Pediatrics', 'الأطفال', 'Healthcare for infants and children', 'رعاية الرضع والأطفال'],
          ['Emergency', 'الطوارئ', '24/7 urgent medical response', 'استجابة طبية عاجلة على مدار الساعة'],
          ['Radiology', 'الأشعة', 'X-Ray, CT, Ultrasound services', 'خدمات الأشعة المقطعية والموجات الصوتية'],
          ['Laboratory', 'المختبر', 'Diagnostic pathology and bloodwork', 'التشخيص المرضي وفحوصات الدم'],
          ['Cardiology', 'القلب', 'Heart and vascular medicine', 'طب القلب والأوعية الدموية'],
          ['Orthopedics', 'العظام', 'Musculoskeletal and bone health', 'صحة العظام والجهاز العضلي الهيكلي'],
          ['OB/GYN', 'النساء والتوليد', 'Maternity and womens health', 'صحة الأمومة والنساء'],
          ['Neurology', 'الأعصاب', 'Brain and nervous system care', 'رعاية الدماغ والجهاز العصبي'],
          ['Dermatology', 'الجلدية', 'Skin and hair diagnostics', 'تشخيص أمراض الجلد والشعر'],
          ['Ophthalmology', 'العيون', 'Vision and eye surgeries', 'جراحات العيون والرؤية'],
          ['ENT', 'الأنف والأذن والحنجرة', 'Ear, nose, and throat specialized care', 'رعاية تخصصية للأنف والأذن والحنجرة'],
          ['Urology', 'المسالك البولية', 'Urinary tract and kidney health', 'صحة المسالك البولية والكلى'],
          ['Oncology', 'الأورام', 'Cancer screening and treatment', 'فحص وعلاج السرطان'],
          ['Physiotherapy', 'العلاج الطبيعي', 'Physical rehabilitation services', 'خدمات التأهيل البدني']
      ];
      const dStmt = db.prepare('INSERT INTO departments (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)');
      depts.forEach(d => dStmt.run(...d));
  }

  const specCount = db.prepare('SELECT count(*) as count FROM specializations').get().count;
  if (specCount === 0) {
      const specs = [
          ['Internal Medicine', 'طب باطني', 'doctor'],
          ['General Surgery', 'جراحة عامة', 'doctor'],
          ['Pediatrics', 'طب الأطفال', 'doctor'],
          ['Cardiology', 'طب القلب', 'doctor'],
          ['Orthopedic Surgeon', 'جراحة عظام', 'doctor'],
          ['Radiologist', 'طبيب أشعة', 'doctor'],
          ['Anesthesiologist', 'طبيب تخدير', 'doctor'],
          ['Pathologist', 'طبيب مختبر', 'doctor'],
          ['Clinical Nurse', 'ممرض سريري', 'nurse'],
          ['Lab Technician', 'فني مختبر', 'technician'],
          ['Pharmacist', 'صيدلي', 'pharmacist']
      ];
      const sStmt = db.prepare('INSERT INTO specializations (name_en, name_ar, related_role) VALUES (?, ?, ?)');
      specs.forEach(s => sStmt.run(...s));
  }

  const labCount = db.prepare('SELECT count(*) as count FROM lab_tests').get().count;
  if (labCount === 0) {
      const labs = [
          ['CBC (Complete Blood Count)', 'صورة دم كاملة', 'Hematology', 'علم الدم', 15, 'Hb: 12-16, WBC: 4-11'],
          ['Fast Blood Glucose', 'سكر صائم', 'Biochemistry', 'الكيمياء الحيوية', 10, '70 - 100 mg/dL'],
          ['Random Blood Glucose', 'سكر عشوائي', 'Biochemistry', 'الكيمياء الحيوية', 8, '80 - 140 mg/dL'],
          ['Malaria (RDT)', 'ملاريا (فحص سريع)', 'Parasitology', 'الطفيليات', 12, 'Negative'],
          ['Malaria (Blood Film)', 'ملاريا (شريحة)', 'Parasitology', 'الطفيليات', 15, 'No parasite seen'],
          ['Lipid Profile', 'دهون كاملة', 'Biochemistry', 'الكيمياء الحيوية', 35, 'Cholesterol < 200'],
          ['Renal Function Test (RFT)', 'وظائف كلى', 'Biochemistry', 'الكيمياء الحيوية', 30, 'Urea: 15-45, Creatinine: 0.6-1.2'],
          ['Liver Function Test (LFT)', 'وظائف كبد', 'Biochemistry', 'الكيمياء الحيوية', 40, 'ALT < 41, AST < 40'],
          ['TSH (Thyroid Stimulating Hormone)', 'هرمون الغدة الدرقية', 'Endocrinology', 'الهرمونات', 25, '0.45 - 4.5 uIU/mL'],
          ['Urine Analysis', 'فحص بول', 'Clinical', 'سريري', 10, 'Normal'],
          ['Stool Analysis', 'فحص براز', 'Clinical', 'سريري', 10, 'Normal'],
          ['Blood Grouping & RH', 'فصيلة الدم', 'Hematology', 'علم الدم', 8, 'A/B/O/AB'],
          ['Widal Test', 'تيفويد (ويدال)', 'Serology', 'الأمصال', 15, 'Negative'],
          ['HbA1c', 'السكر التراكمي', 'Biochemistry', 'الكيمياء الحيوية', 45, '4.0 - 5.6%'],
          ['Electrolytes (Na, K, Cl)', 'الأملاح والمعادن', 'Biochemistry', 'الكيمياء الحيوية', 30, 'Normal Range']
      ];
      const lStmt = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost, normal_range) VALUES (?, ?, ?, ?, ?, ?)');
      labs.forEach(l => lStmt.run(...l));
  }

  const nurseCount = db.prepare('SELECT count(*) as count FROM nurse_services').get().count;
  if (nurseCount === 0) {
      const nurseS = [
          ['Injection (IM)', 'حقنة عضلية', 'Intramuscular injection administration', 'إعطاء حقنة في العضل', 5],
          ['Injection (IV)', 'حقنة وريدية', 'Intravenous injection administration', 'إعطاء حقنة في الوريد', 8],
          ['Wound Dressing (Small)', 'غيار جروح صغير', 'Cleaning and dressing minor wounds', 'تنظيف وتغطية الجروح الصغيرة', 15],
          ['Wound Dressing (Large)', 'غيار جروح كبير', 'Cleaning and dressing major surgical wounds', 'تنظيف وتغطية الجروح الجراحية الكبيرة', 30],
          ['Nebulization', 'جلسة بخار', 'Aerosol medication delivery', 'توصيل الدواء عبر الرذاذ', 10],
          ['Catheterization', 'تركيب قسطرة بولية', 'Urinary catheter placement', 'تركيب القسطرة البولية', 25],
          ['Cannulation', 'تركيب كانيولا', 'IV cannula placement', 'تركيب الكانيولا الوريدية', 10],
          ['Suture Removal', 'فك غرز', 'Removing surgical sutures', 'إزالة الغرز الجراحية', 15],
          ['Vitals Check', 'قياس العلامات الحيوية', 'Full vital signs monitoring', 'مراقبة العلامات الحيوية كاملة', 5]
      ];
      const nStmt = db.prepare('INSERT INTO nurse_services (name_en, name_ar, description_en, description_ar, cost) VALUES (?, ?, ?, ?, ?)');
      nurseS.forEach(n => nStmt.run(...n));
  }

  const bedCount = db.prepare('SELECT count(*) as count FROM beds').get().count;
  if (bedCount === 0) {
      const bedsData = [
          ['101', 'General', 50, 'available'],
          ['102', 'General', 50, 'available'],
          ['103', 'General', 50, 'available'],
          ['104', 'General', 50, 'available'],
          ['105', 'General', 50, 'available'],
          ['201', 'Private', 150, 'available'],
          ['202', 'Private', 150, 'available'],
          ['203', 'Private', 150, 'available'],
          ['204', 'Private', 150, 'available'],
          ['205', 'Private', 150, 'available'],
          ['301', 'ICU', 450, 'available'],
          ['302', 'ICU', 450, 'available'],
          ['303', 'ICU', 450, 'available'],
          ['304', 'ICU', 450, 'available'],
          ['305', 'ICU', 450, 'available']
      ];
      const bStmt = db.prepare('INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, ?)');
      bedsData.forEach(b => bStmt.run(...b));
  }

  // --- 5. System Settings ---
  const settingsCount = db.prepare('SELECT count(*) as count FROM system_settings').get().count;
  if (settingsCount === 0) {
      const settings = [
          ['hospitalName', 'AllCare Hospital'],
          ['hospitalAddress', 'Atbara, The Big Market'],
          ['hospitalPhone', '0987654321']
      ];
      const sStmt = db.prepare('INSERT INTO system_settings (key, value) VALUES (?, ?)');
      settings.forEach(s => sStmt.run(...s));
  }
};

module.exports = { db, initDB };
