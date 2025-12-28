# Database Schema (SQLite)

This schema is managed using `better-sqlite3` in `backend/src/config/database.js`.

## 1. Access Control
*   **users:** `id, username, password (hashed), full_name, role, email, phone, is_active, created_at`
*   **role_permissions:** `role (PK), permissions (JSON Array), updated_at`
*   **notifications:** `id, user_id, title, message, type, is_read, created_at`

## 2. Clinical Records
*   **patients:** `id, patient_id (UID), full_name, phone, address, age, gender, type, symptoms, medical_history, allergies, blood_group, emergency_contacts (JSON), has_insurance, insurance_details (JSON), created_at`
*   **appointments:** `id, appointment_number (UID), patient_id, medical_staff_id, appointment_datetime, type, status, billing_status, reason, bill_id, daily_token, created_at`

## 3. Human Resources
*   **medical_staff:** `id, employee_id (UID), full_name, type, department, specialization, consultation_fee, consultation_fee_followup, consultation_fee_emergency, status, is_available, available_days (JSON), available_time_start, available_time_end, email, phone, address, base_salary, join_date, created_at`
*   **hr_attendance:** `id, staff_id, date, status, check_in, check_out`
*   **hr_leaves:** `id, staff_id, type, start_date, end_date, reason, status`
*   **hr_payroll:** `id, staff_id, month (YYYY-MM), base_salary, total_bonuses, total_fines, net_salary, status, generated_at, payment_method, transaction_ref, payment_notes, payment_date`
*   **hr_financials:** `id, staff_id, type (bonus/fine/loan/extra), amount, reason, date, status, reference_id`

## 4. Billing & Treasury
*   **billing:** `id, bill_number (UID), patient_id, total_amount, paid_amount, status, bill_date, is_settlement_bill, settlement_for_patient_id`
*   **billing_items:** `id, billing_id, description, amount`
*   **transactions:** `id, type (income/expense), category, amount, method, reference_id, details (JSON), date, description`

## 5. Medical Services
*   **lab_tests:** `id (PK), name_en, name_ar, category_en, cost, normal_range (Structured String)`
*   **lab_requests:** `id (PK), patient_id, test_ids (JSON), status, projected_cost, bill_id, results_json (JSON Data), created_at`
*   **nurse_services:** `id (PK), name_en, name_ar, description_en, description_ar, cost`
*   **nurse_requests:** `id (PK), patient_id, staff_id, service_name, cost, notes, status, created_at`
*   **operations_catalog:** `id (PK), name_en, name_ar, base_cost`
*   **operations:** `id (PK), patient_id, operation_name, doctor_id, notes, status, projected_cost, bill_id, cost_details (JSON), created_at`
*   **beds:** `id (PK), room_number, type, status, cost_per_day`
*   **admissions:** `id (PK), patient_id, bed_id, doctor_id, entry_date, discharge_date, actual_discharge_date, status, notes, discharge_notes, discharge_status, projected_cost, bill_id`
*   **inpatient_notes:** `id (PK), admission_id, doctor_id, note, vitals (JSON), created_at`

## 6. Catalogs & System Config
*   **departments:** `id, name_en, name_ar, description_en, description_ar`
*   **specializations:** `id, name_en, name_ar, description_en, description_ar, related_role`
*   **system_settings:** `key (PK), value`
*   **tax_rates:** `id, name_en, name_ar, rate, is_active`
*   **payment_methods:** `id, name_en, name_ar, is_active`
*   **insurance_providers:** `id, name_en, name_ar, is_active`
