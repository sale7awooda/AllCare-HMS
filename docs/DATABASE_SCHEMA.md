# Database Schema (SQLite)

The system uses `better-sqlite3`. Below is the schema definition.

## Users & Roles

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL, -- Bcrypt hash
  full_name TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'receptionist', 'manager', 'accountant')) NOT NULL,
  phone TEXT,
  email TEXT UNIQUE,
  department_id INTEGER,
  is_active BOOLEAN DEFAULT 1,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT CHECK(role IN ('admin', 'receptionist', 'manager', 'accountant')) NOT NULL UNIQUE,
  permissions TEXT NOT NULL, -- JSON string
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Patients

```sql
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id TEXT UNIQUE NOT NULL, -- Format: PAT-YYYYMMDD-XXXX
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  age INTEGER NOT NULL CHECK(age >= 0 AND age <= 150),
  gender TEXT CHECK(gender IN ('male', 'female', 'other')) NOT NULL,
  type TEXT CHECK(type IN ('inpatient', 'outpatient', 'emergency')) NOT NULL DEFAULT 'outpatient',
  symptoms TEXT,
  medical_history TEXT,
  allergies TEXT,
  blood_group TEXT,
  has_insurance BOOLEAN DEFAULT 0,
  insurance_details TEXT, -- JSON string
  emergency_contacts TEXT, -- JSON string
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Medical Staff

```sql
CREATE TABLE IF NOT EXISTS medical_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  staff_type TEXT CHECK(staff_type IN ('doctor', 'nurse', 'anesthesiologist', 'technician', 'medical_assistant')) NOT NULL,
  license_number TEXT UNIQUE,
  employee_id TEXT UNIQUE NOT NULL,
  specialization TEXT,
  department TEXT,
  consultation_fee REAL DEFAULT 0 CHECK(consultation_fee >= 0),
  is_available BOOLEAN DEFAULT 1,
  available_days TEXT DEFAULT '["monday","tuesday","wednesday","thursday","friday"]', -- JSON array
  available_time_start TEXT DEFAULT '09:00',
  available_time_end TEXT DEFAULT '17:00',
  shift TEXT CHECK(shift IN ('morning', 'evening', 'night', 'flexible')) DEFAULT 'morning',
  deleted_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Appointments

```sql
CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_number TEXT UNIQUE NOT NULL, -- APT-20251207-0001
  patient_id INTEGER NOT NULL,
  medical_staff_id INTEGER NOT NULL,
  appointment_datetime DATETIME NOT NULL,
  type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  billing_status TEXT NOT NULL DEFAULT 'unbilled' CHECK(billing_status IN ('unbilled', 'billed', 'paid')),
  service_fee REAL DEFAULT 0,
  bill_id INTEGER DEFAULT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (medical_staff_id) REFERENCES medical_staff(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES billing(id) ON DELETE SET NULL
);
```

## Billing

```sql
CREATE TABLE IF NOT EXISTS billing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_number TEXT UNIQUE NOT NULL, -- BILL-20251207-0001
  patient_id INTEGER NOT NULL,
  bill_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  total_amount REAL NOT NULL CHECK(total_amount >= 0),
  discount_amount REAL DEFAULT 0,
  final_amount REAL NOT NULL,
  paid_amount REAL DEFAULT 0,
  payment_status TEXT CHECK(payment_status IN ('pending', 'partial', 'paid', 'overdue', 'refunded', 'cancelled')) DEFAULT 'pending',
  payment_method TEXT,
  transaction_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE IF NOT EXISTS billing_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  billing_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (billing_id) REFERENCES billing(id) ON DELETE CASCADE
);
```
