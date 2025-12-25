# AllCare HMS - System Requirements

## 1. Functional Requirements

### 1.1 Authentication & Security
*   **Login:** Secure login screen with username/password authentication.
*   **Quick Profiles:** Demo-friendly "Quick Profile" selection for rapid testing of different roles (Admin, Doctor, Nurse, etc.).
*   **Authentication:** JWT-based token authentication with automatic expiration handling.
*   **Authorization:** Granular Role-Based Access Control (RBAC) mirrored between frontend and backend.
*   **Password Security:** Backend hashing using `bcryptjs`.
*   **Session Management:** Secure logout and session expiry detection.

### 1.2 Patient Management
*   **Patient Registry:** Paginated, searchable list of all patients with filtering by type (Inpatient, Outpatient, Emergency).
*   **Registration:** Comprehensive form capturing demographics, medical history, allergies, emergency contacts, and insurance details.
*   **360° View:** detailed modal view showing:
    *   **Overview:** Personal & contact info, medical profile.
    *   **Timeline:** Chronological history of appointments and visits.
    *   **Labs:** History of laboratory requests and results.
    *   **Financials:** List of invoices and payment status.
*   **Quick Actions:** Unified menu to trigger Appointments, Lab Requests, Nurse Services, Admissions, or Operations directly from the patient list.

### 1.3 Appointment Management
*   **Queue View:** Kanban-style columns per doctor showing daily queues (Waiting, In Progress, Done).
*   **List View:** Tabular view for searching and filtering historical appointments.
*   **Scheduling:** Conflict detection preventing duplicate clinical visits (Consultation/Follow-up) for the same doctor on the same day.
*   **Status Workflow:** `Pending` -> `Confirmed` -> `In Progress` -> `Completed` / `Cancelled`.
*   **Billing Integration:** Automatic generation of pending invoices based on staff consultation fees.

### 1.4 Inpatient & Admissions
*   **Ward Dashboard:** Visual grid of beds with status indicators (Available, Occupied, Reserved, Maintenance, Cleaning).
*   **Admission Workflow:**
    *   **Reservation:** Select bed, assign doctor, and generate deposit bill.
    *   **Confirmation:** Activate admission upon deposit payment.
    *   **Care:** Track duration, manage clinical notes, and record vitals (BP, Temp, Pulse, Resp).
*   **Discharge Process:** Logic to block discharge if outstanding bills exist. Finalizes stay and marks bed for cleaning.
*   **History:** Searchable archive of past admissions.

### 1.5 Medical Services
*   **Laboratory:**
    *   Catalog of tests with pricing categories.
    *   "Shopping Cart" style request builder.
    *   Result entry form with findings and technician notes.
*   **Nurse Services:**
    *   Service catalog (Injections, Dressings, etc.).
    *   Assignment of tasks to specific nursing staff.
*   **Operations (Surgery):**
    *   Request workflow: Surgeon request -> Cost Estimation -> Financial Approval -> Scheduling -> Completion.
    *   Detailed cost builder: Surgeon fee, Theater fee, Team (Anesthesiologist, Nurses), Consumables, and Equipment.

### 1.6 Billing & Finance
*   **Invoices:** Create, view, and print detailed invoices. Support for tax calculation.
*   **Payments:** Record payments via multiple methods (Cash, Insurance, Bank Transfer, etc.).
*   **Refunds:** Process refunds for cancelled services with strict validation logic.
*   **Treasury:**
    *   **Dashboard:** Income vs. Expenses, Net Cash Flow.
    *   **Transactions:** Ledger of all financial movements.
    *   **Expenses:** Record operational costs (Rent, Salaries, Supplies).

### 1.7 Human Resources (HR)
*   **Staff Directory:** Manage employee profiles, roles, departments, and financial terms (Salary, Fees).
*   **Attendance:** Daily check-in/check-out tracking with "Late" status detection.
*   **Leaves:** Request and approval workflow for sick, vacation, and unpaid leaves.
*   **Payroll:**
    *   **Generation:** Automated calculation of Net Salary = Base + Bonuses - Fines (Attendance/Manual).
    *   **Disbursement:** Record payment of salaries with method and reference tracking.
    *   **Adjustments:** Manual entry of bonuses, fines, or loans.

### 1.8 Analytics & Reporting
*   **Financial Reports:** Revenue trends, Income by Method, Top Services.
*   **Operational Reports:** Appointment volume, Doctor workload, Department utilization.
*   **Demographics:** Patient age distribution, gender split, growth trends.
*   **Activity Log:** System-wide audit trail (Records) tracking creation and updates of key entities.

### 1.9 System Configuration
*   **General:** Hospital profile settings (Name, Address, Phone).
*   **Access Control:** User account management and dynamic Role-Permission matrix.
*   **Catalogs:** Management of Departments, Specializations, Lab Tests, Nurse Services, Operation Types, Insurance Providers, Banks.
*   **Financial Config:** Tax rates and Payment methods.
*   **Infrastructure:** Ward and Bed management.
*   **Data Management:** Database Backup (.db download), Restoration, and Factory Reset.
*   **Diagnostics:** Real-time backend health check (API status, DB latency, Uptime).

## 2. Non-Functional Requirements

### 2.1 UI/UX
*   **Theming:** Robust theme engine with Light/Dark/System modes and 20+ accent colors.
*   **Density:** Toggle between "Comfortable" and "Compact" layout densities.
*   **Internationalization:** Full support for English (LTR) and Arabic (RTL) with dynamic switching.
*   **Responsive:** Mobile-first design adapting to tablets and desktops.

### 2.2 Architecture & Performance
*   **Frontend:** React 18, Vite, Tailwind CSS.
*   **Backend:** Node.js, Express, `better-sqlite3` (Synchronous I/O for speed).
*   **Database:** Self-contained SQLite file for portability and ease of backup.
*   **Resilience:** Auto-retry mechanisms for network flakiness and 429 rate limits.
