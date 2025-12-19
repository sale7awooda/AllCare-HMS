# AllCare HMS - System Requirements

## 1. Implemented Functional Modules

### 1.1 Authentication & Security (Implemented)
*   **Login:** Secure login with role-based profiles (Admin, Doctor, Receptionist, etc.).
*   **RBAC:** Granular permission system (View/Manage/Delete) enforced on both Frontend (UI hiding) and Backend (Middleware).
*   **Session Management:** JWT-based stateless authentication with automatic expiration.
*   **Security:** Password hashing (`bcryptjs`), Rate limiting, Helmet (CSP), and sanitized SQL queries.

### 1.2 Patient Management (Implemented)
*   **Registry:** Centralized patient database with search and filtering by status (Inpatient/Outpatient).
*   **360° Profile:** Modal view aggregating Demographics, Visit History, Lab Results, and Financials.
*   **Quick Actions:** One-click access to schedule appointments, admit patients, or order tests from the patient list.
*   **Insurance:** Dedicated tracking for provider, policy number, and coverage notes.

### 1.3 Appointments & Queue (Implemented)
*   **Kanban Queue:** Visual columns per doctor showing "Waiting", "In Progress", and "Completed" patients.
*   **Token System:** Automatic daily token generation for walk-ins.
*   **Scheduling:** Conflict detection preventing duplicate clinical visits (Consultation/Follow-up) on the same day.
*   **Status Workflow:** Unpaid -> Confirmed -> Checked In -> In Progress -> Completed.

### 1.4 Inpatient & Admissions (Implemented)
*   **Visual Ward:** Interactive grid showing real-time bed status (Available, Occupied, Reserved, Cleaning).
*   **Admission Logic:** Deposit billing triggers, reservation confirmation, and admission capability.
*   **Clinical Charting:** Digital nursing notes recording Vitals (BP, Temp, Pulse, SpO2, Insulin) and observations.
*   **Discharge Safety:** Logic preventing discharge if there are outstanding/unpaid medical bills.

### 1.5 specialized Medical Services (Implemented)
*   **Laboratory:**
    *   Catalog-based test ordering.
    *   Result entry with reference ranges and automatic flagging (High/Low/Normal).
    *   Composite tests support (e.g., CBC, Urine Analysis expanding into sub-parameters).
    *   Printable lab reports.
*   **Operations (Surgery):**
    *   **Cost Estimation Engine:** Detailed breakdown builder for Surgeon Fees, Theater Fees, Staff, Consumables, Equipment, and Misc charges.
    *   **Workflow:** Request -> Estimate/Invoice -> Payment -> Scheduling -> Completion -> Payout.
*   **Nursing:** Quick procedure requests (Injections, Dressings) with billing integration.

### 1.6 Billing & Finance (Implemented)
*   **Invoicing:** Automatic invoice generation from all modules. Support for Tax rates and multiple Payment Methods.
*   **Treasury:** Cash flow tracking (Income vs. Expenses).
*   **Operations Payouts:** Dedicated system to track and disburse shares to surgeons and participating staff after procedures.
*   **Expense Management:** Recording hospital operational expenses (Rent, Utilities, Supplies).

### 1.7 Human Resources (Implemented)
*   **Directory:** Comprehensive staff profile management with banking details and contract terms.
*   **Attendance:** Check-in/Check-out logging with "Late" status detection.
*   **Payroll Engine:** Automated monthly payroll generation calculating:
    *   Base Salary
    *   (+) Bonuses/Commissions
    *   (-) Fines/Deductions/Loans
    *   (=) Net Payout
*   **Financial Adjustments:** Manual entry for bonuses, loans, or fines.

### 1.8 System Intelligence (Implemented)
*   **Analytics:** Real-time dashboards for Revenue, Operational Volume, and Demographics.
*   **Audit Logs:** "Records" module tracking every significant creation or update event in the system.
*   **Health Diagnostics:** Server performance monitoring (CPU, RAM, Uptime, DB Latency).
*   **Data Management:** One-click Database Backup (.db download) and Restoration mechanisms.

## 2. Non-Functional Implementation

### 2.1 UI/UX
*   **Theming:** Dynamic engine supporting Light/Dark modes and 20+ accent color palettes.
*   **Localization:** Native English and Arabic (RTL) support.
*   **Responsive:** Adaptive layouts for Desktop, Tablet, and Mobile.
*   **Print Styles:** CSS optimized for printing Reports, Invoices, and Lab Results.

### 2.2 Tech Stack
*   **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons, Recharts.
*   **Backend:** Node.js, Express.js.
*   **Database:** `better-sqlite3` (Synchronous, file-based, high performance).
*   **Validation:** Zod schemas for robust input sanitization.
