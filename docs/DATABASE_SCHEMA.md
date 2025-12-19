# Database Schema (SQLite)

The system uses `better-sqlite3`. Foreign keys are enabled (`PRAGMA foreign_keys = ON`).

## 1. Identity & Access
**`users`**
*   `id`: INTEGER PRIMARY KEY
*   `username`: TEXT UNIQUE
*   `password`: TEXT (Hashed)
*   `full_name`: TEXT
*   `role`: TEXT (admin, doctor, nurse, etc.)
*   `email`: TEXT
*   `phone`: TEXT
*   `is_active`: BOOLEAN
*   `created_at`: DATETIME

**`role_permissions`**
*   `role`: TEXT PRIMARY KEY
*   `permissions`: TEXT (JSON Array of permission strings)
*   `updated_at`: DATETIME

## 2. Human Resources (HR)
**`medical_staff`**
*   `id`: INTEGER PRIMARY KEY
*   `employee_id`: TEXT UNIQUE
*   `full_name`: TEXT
*   `type`: TEXT (doctor, nurse, technician, etc.)
*   `department`: TEXT
*   `specialization`: TEXT
*   `consultation_fee`: REAL
*   `consultation_fee_followup`: REAL
*   `consultation_fee_emergency`: REAL
*   `status`: TEXT (active, inactive, onleave)
*   `base_salary`: REAL
*   `bank_details`: TEXT (JSON: bankName, bankAccount)
*   `available_days`: TEXT (JSON Array)
*   `available_time_start`: TEXT
*   `available_time_end`: TEXT
*   `created_at`: DATETIME

**`hr_attendance`**
*   `id`: PK
*   `staff_id`: FK -> medical_staff(id)
*   `date`: DATE
*   `status`: TEXT (present, late, absent)
*   `check_in`: TIME
*   `check_out`: TIME

**`hr_leaves`**
*   `id`: PK
*   `staff_id`: FK -> medical_staff(id)
*   `type`: TEXT
*   `start_date`: DATE
*   `end_date`: DATE
*   `reason`: TEXT
*   `status`: TEXT (pending, approved, rejected)

**`hr_payroll`**
*   `id`: PK
*   `staff_id`: FK
*   `month`: TEXT (YYYY-MM)
*   `base_salary`: REAL
*   `total_bonuses`: REAL
*   `total_fines`: REAL
*   `net_salary`: REAL
*   `status`: TEXT (draft, paid)
*   `payment_method`: TEXT
*   `transaction_ref`: TEXT
*   `payment_date`: DATETIME

**`hr_financials`**
*   `id`: PK
*   `staff_id`: FK
*   `type`: TEXT (bonus, fine, loan)
*   `amount`: REAL
*   `reason`: TEXT
*   `date`: DATE

## 3. Patients & Clinical
**`patients`**
*   `id`: PK
*   `patient_id`: TEXT UNIQUE
*   `full_name`: TEXT
*   `phone`: TEXT
*   `age`: INTEGER
*   `gender`: TEXT
*   `type`: TEXT (outpatient, inpatient, emergency)
*   `blood_group`: TEXT
*   `allergies`: TEXT
*   `medical_history`: TEXT
*   `emergency_contacts`: TEXT (JSON)
*   `has_insurance`: BOOLEAN
*   `insurance_details`: TEXT (JSON)

**`appointments`**
*   `id`: PK
*   `appointment_number`: TEXT
*   `patient_id`: FK -> patients(id)
*   `medical_staff_id`: FK -> medical_staff(id)
*   `appointment_datetime`: DATETIME
*   `type`: TEXT (Consultation, Follow-up, etc.)
*   `status`: TEXT (pending, confirmed, in_progress, completed, cancelled)
*   `billing_status`: TEXT
*   `reason`: TEXT
*   `bill_id`: FK -> billing(id)
*   `daily_token`: INTEGER

**`admissions`**
*   `id`: PK
*   `patient_id`: FK
*   `bed_id`: FK -> beds(id)
*   `doctor_id`: FK
*   `entry_date`: DATETIME
*   `discharge_date`: DATETIME (Expected)
*   `actual_discharge_date`: DATETIME
*   `status`: TEXT (active, reserved, discharged, cancelled)
*   `notes`: TEXT
*   `projected_cost`: REAL
*   `bill_id`: INTEGER (Deposit Bill)

**`inpatient_notes`**
*   `id`: PK
*   `admission_id`: FK
*   `doctor_id`: FK
*   `note`: TEXT
*   `vitals`: TEXT (JSON: bp, temp, pulse, spo2, insulin)
*   `created_at`: DATETIME

## 4. Medical Services
**`lab_tests`** (Catalog)
*   `id`: PK, `name_en`, `name_ar`, `category_en`, `cost`, `normal_range`

**`lab_requests`**
*   `id`: PK
*   `patient_id`: FK
*   `test_ids`: TEXT (JSON Array of lab_test_ids)
*   `status`: TEXT (pending, confirmed, completed)
*   `results`: TEXT (Markdown Table)
*   `bill_id`: FK

**`nurse_services`** (Catalog)
*   `id`: PK, `name_en`, `name_ar`, `cost`

**`operations_catalog`**
*   `id`: PK, `name_en`, `name_ar`, `base_cost`

**`operations`**
*   `id`: PK
*   `patient_id`: FK
*   `operation_name`: TEXT
*   `doctor_id`: FK (Lead Surgeon)
*   `status`: TEXT (requested, pending_payment, confirmed, completed)
*   `projected_cost`: REAL
*   `bill_id`: FK
*   `cost_details`: TEXT (JSON: breakdown of fees, staff, consumables)

**`beds`**
*   `id`: PK
*   `room_number`: TEXT
*   `type`: TEXT
*   `status`: TEXT (available, occupied, reserved, cleaning, maintenance)
*   `cost_per_day`: REAL

## 5. Billing & Finance
**`billing`**
*   `id`: PK
*   `bill_number`: TEXT UNIQUE
*   `patient_id`: FK
*   `total_amount`: REAL
*   `paid_amount`: REAL
*   `status`: TEXT (pending, paid, partial, refunded, cancelled)
*   `bill_date`: DATETIME
*   `is_settlement_bill`: BOOLEAN

**`billing_items`**
*   `id`: PK
*   `billing_id`: FK
*   `description`: TEXT
*   `amount`: REAL

**`transactions`**
*   `id`: PK
*   `type`: TEXT (income, expense)
*   `category`: TEXT
*   `amount`: REAL
*   `method`: TEXT (Cash, Insurance, Bankak, etc.)
*   `reference_id`: INTEGER (Linked Bill ID or Payroll ID)
*   `details`: TEXT (JSON)
*   `date`: DATETIME

## 6. System Configuration
*   **`departments`**, **`specializations`**: Catalogs for dropdowns.
*   **`tax_rates`**: Configurable tax percentages.
*   **`payment_methods`**: Enabled/Disabled payment types.
*   **`insurance_providers`**: List of accepted insurance companies.
*   **`banks`**: List of banks for staff payroll.
*   **`system_settings`**: Key-Value store for hospital info.
