exports.up = (db) => {
// --- Core Tables ---
  db.exec(`
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
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT PRIMARY KEY,
      permissions TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
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
  `);

  db.exec(`
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
  `);

  db.exec(`
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
  `);

  db.exec(`
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
  `);

  db.exec(`CREATE TABLE IF NOT EXISTS hr_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, date DATE NOT NULL, status TEXT, check_in TIME, check_out TIME, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS hr_leaves (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id INTEGER NOT NULL, type TEXT, start_date DATE, end_date DATE, reason TEXT, status TEXT, FOREIGN KEY(staff_id) REFERENCES medical_staff(id))`);
  db.exec(`
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
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS hr_financials (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      staff_id INTEGER NOT NULL, 
      type TEXT, 
      amount REAL, 
      reason TEXT, 
      date DATE, 
      status TEXT DEFAULT 'pending', 
      reference_id INTEGER,
      FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
    )
  `);

  db.exec(`
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
  `);
  
  db.exec(`CREATE TABLE IF NOT EXISTS billing_items (id INTEGER PRIMARY KEY AUTOINCREMENT, billing_id INTEGER, description TEXT, amount REAL, FOREIGN KEY(billing_id) REFERENCES billing(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, category TEXT, amount REAL, method TEXT, reference_id INTEGER, details TEXT, date DATETIME DEFAULT CURRENT_TIMESTAMP, description TEXT)`);

  db.exec(`CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, results_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.exec(`CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL)`);
  db.exec(`CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER)`);
  db.exec(`CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(admission_id) REFERENCES admissions(id))`);
  db.exec(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS specializations (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, related_role TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.exec(`CREATE TABLE IF NOT EXISTS tax_rates (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, rate REAL, is_active BOOLEAN)`);
  db.exec(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN DEFAULT 1)`);
  db.exec(`CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN)`);
  db.exec(`CREATE TABLE IF NOT EXISTS banks (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, account_number TEXT, initial_balance REAL DEFAULT 0, current_balance REAL DEFAULT 0, is_active BOOLEAN DEFAULT 1)`);

  // --- Performance: Database Indexes ---
  console.log('[Database] Creating indexes...');
  
  // Patients
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patients_patient_id ON patients(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patients_type ON patients(type)`);
  
  // Appointments
  db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_staff_id ON appointments(medical_staff_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_datetime ON appointments(appointment_datetime)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_billing_status ON appointments(billing_status)`);
  
  // Billing
  db.exec(`CREATE INDEX IF NOT EXISTS idx_billing_patient_id ON billing(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_billing_date ON billing(bill_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_billing_items_billing_id ON billing_items(billing_id)`);
  
  // Transactions
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category)`);
  
  // Medical Staff
  db.exec(`CREATE INDEX IF NOT EXISTS idx_medical_staff_type ON medical_staff(type)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_medical_staff_status ON medical_staff(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_medical_staff_department ON medical_staff(department)`);
  
  // HR
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_attendance_staff_id ON hr_attendance(staff_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_leaves_staff_id ON hr_leaves(staff_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_payroll_staff_id ON hr_payroll(staff_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_payroll_month ON hr_payroll(month)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_hr_financials_staff_id ON hr_financials(staff_id)`);
  
  // Lab & Medical
  db.exec(`CREATE INDEX IF NOT EXISTS idx_lab_requests_patient_id ON lab_requests(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_lab_requests_status ON lab_requests(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_nurse_requests_patient_id ON nurse_requests(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_operations_patient_id ON operations(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status)`);
  
  // Admissions
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admissions_patient_id ON admissions(patient_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_admissions_bed_id ON admissions(bed_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_inpatient_notes_admission_id ON inpatient_notes(admission_id)`);
  
  // Notifications
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
};
