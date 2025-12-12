# Database Schema (SQLite)

This schema is defined and initialized in `backend/src/config/database.js` using `better-sqlite3`.

## 1. Core & Access Control

```sql
-- users: Manages login credentials and system roles.
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

-- role_permissions: Stores permissions for each role as a JSON array.
CREATE TABLE IF NOT EXISTS role_permissions (
  role TEXT PRIMARY KEY,
  permissions TEXT NOT NULL, -- JSON array of permission strings
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 2. Patient & Clinical Records

```sql
-- patients: Central repository for all patient information.
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
);

-- appointments: Tracks all scheduled patient visits and consultations.
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
```

## 3. Human Resources (HR)

```sql
-- medical_staff: Stores profiles for all hospital employees.
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
  available_days TEXT, -- JSON array
  available_time_start TEXT, -- HH:mm
  available_time_end TEXT, -- HH:mm
  email TEXT,
  phone TEXT,
  base_salary REAL DEFAULT 0,
  join_date DATE,
  bank_details TEXT, -- JSON object { bankName, bankAccount }
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- hr_attendance: Tracks daily staff attendance.
CREATE TABLE IF NOT EXISTS hr_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  date DATE NOT NULL,
  status TEXT CHECK(status IN ('present', 'absent', 'late', 'half_day')) DEFAULT 'present',
  check_in TIME,
  check_out TIME,
  FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
);

-- hr_leaves: Manages staff leave requests.
CREATE TABLE IF NOT EXISTS hr_leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('sick', 'vacation', 'casual', 'unpaid')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT CHECK(status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
);

-- hr_adjustments: Records bonuses, fines, or loans for payroll calculation.
CREATE TABLE IF NOT EXISTS hr_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('bonus', 'fine', 'loan')) NOT NULL,
  amount REAL NOT NULL,
  reason TEXT,
  date DATE NOT NULL,
  status TEXT DEFAULT 'active',
  FOREIGN KEY(staff_id) REFERENCES medical_staff(id)
);

-- hr_payroll: Stores generated monthly payroll records.
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
```

## 4. Billing & Financials

```sql
-- billing: Header table for each invoice.
CREATE TABLE IF NOT EXISTS billing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT UNIQUE NOT NULL,
  patient_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending', -- pending, partial, paid, overdue
  bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(patient_id) REFERENCES patients(id)
);

-- billing_items: Line items for each bill.
CREATE TABLE IF NOT EXISTS billing_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY(billing_id) REFERENCES billing(id)
);
```

## 5. Medical Services & Wards

```sql
-- lab_tests: Catalog of available laboratory tests.
CREATE TABLE IF NOT EXISTS lab_tests (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, category_en TEXT, category_ar TEXT, cost REAL, normal_range TEXT);

-- lab_requests: Tracks patient lab test requests.
CREATE TABLE IF NOT EXISTS lab_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, test_ids TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, created_at DATETIME);

-- nurse_services: Catalog of nursing services.
CREATE TABLE IF NOT EXISTS nurse_services (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT, cost REAL);

-- nurse_requests: Tracks nursing service requests for patients.
CREATE TABLE IF NOT EXISTS nurse_requests (id INTEGER PRIMARY KEY, patient_id INTEGER, staff_id INTEGER, service_name TEXT, cost REAL, notes TEXT, status TEXT, created_at DATETIME);

-- operations_catalog: Catalog of surgical procedures.
CREATE TABLE IF NOT EXISTS operations_catalog (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, base_cost REAL);

-- operations: Tracks patient surgical operation requests and status.
CREATE TABLE IF NOT EXISTS operations (id INTEGER PRIMARY KEY, patient_id INTEGER, operation_name TEXT, doctor_id INTEGER, notes TEXT, status TEXT, projected_cost REAL, bill_id INTEGER, cost_details TEXT);

-- beds: Manages hospital beds and their status.
CREATE TABLE IF NOT EXISTS beds (id INTEGER PRIMARY KEY, room_number TEXT, type TEXT, status TEXT, cost_per_day REAL);

-- admissions: Tracks inpatient admissions, linking patients to beds.
CREATE TABLE IF NOT EXISTS admissions (id INTEGER PRIMARY KEY, patient_id INTEGER, bed_id INTEGER, doctor_id INTEGER, entry_date DATETIME, discharge_date DATETIME, actual_discharge_date DATETIME, status TEXT, notes TEXT, discharge_notes TEXT, discharge_status TEXT, projected_cost REAL, bill_id INTEGER);

-- inpatient_notes: Clinical notes for admitted patients.
CREATE TABLE IF NOT EXISTS inpatient_notes (id INTEGER PRIMARY KEY, admission_id INTEGER, doctor_id INTEGER, note TEXT, vitals TEXT, created_at DATETIME, FOREIGN KEY(admission_id) REFERENCES admissions(id));
```

## 6. System Configuration

```sql
-- departments: List of hospital departments.
CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT);

-- specializations: List of medical specializations.
CREATE TABLE IF NOT EXISTS specializations (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, description_en TEXT, description_ar TEXT);

-- system_settings: Key-value store for global settings.
CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT);

-- tax_rates: Manages applicable tax rates for billing.
CREATE TABLE IF NOT EXISTS tax_rates (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, rate REAL, is_active BOOLEAN);

-- payment_methods: Manages accepted payment methods.
CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN);

-- insurance_providers: Catalog of supported insurance companies.
CREATE TABLE IF NOT EXISTS insurance_providers (id INTEGER PRIMARY KEY, name_en TEXT, name_ar TEXT, is_active BOOLEAN);
```
