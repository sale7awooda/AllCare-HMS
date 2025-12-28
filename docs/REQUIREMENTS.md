# AllCare HMS - System Requirements

## 1. Functional Requirements

### 1.1 Authentication & Security
*   **Secure Login:** Role-based access with JWT token authentication.
*   **Quick Profiles:** Demo-friendly selection for testing Admin, Doctor, Nurse, Lab, and Finance roles.
*   **RBAC (Role-Based Access Control):** Granular permission system enforced on both frontend UI and backend API endpoints.
*   **Session Management:** Automatic detection of token expiry with graceful redirection to login.

### 1.2 Patient Management
*   **Digital Registry:** Searchable database with demographic tracking and patient categorization.
*   **360° Patient File:** A centralized view for clinical history, timeline of visits, lab results, and financial balances.
*   **Quick Actions:** Initiate any clinical or administrative process (Admit, Book, Test, Operate) directly from the patient record.

### 1.3 Clinical Operations
*   **Appointment Queue:** Kanban-style visualization of daily patient flow (Waiting, In-Progress, Completed).
*   **Daily Token System:** Automated sequential numbering for daily clinic visits.
*   **Ward Management:** Visual dashboard for bed occupancy with color-coded statuses (Available, Occupied, Reserved, Cleaning).
*   **Inpatient Care:** Structured clinical notes with vitals tracking (BP, Temp, Pulse, SpO2, GCS, Sugar).
*   **Automated Discharge Logic:** Verification of financial clearance before final discharge and medical report generation.

### 1.4 Specialized Medical Services
*   **Laboratory Information System (LIS):** 
    *   Request builder with catalog-based pricing.
    *   Technical validation screen for entering results.
    *   Multi-parameter test support with normal reference range tracking.
*   **Surgical Operations:**
    *   Multi-stage workflow: Request -> Estimation -> Payment -> Schedule -> Completion.
    *   Detailed Cost Estimator: Includes Surgeon/Theater fees, clinical team participation, and consumables.
*   **Nurse Services:** Managed task queue for procedures like injections, dressings, and IV drips.

### 1.5 Financial & Treasury Management
*   **Automated Invoicing:** Bills generated automatically for appointments, labs, and ward stays.
*   **Payment Processing:** Support for Cash, Bank Transfer, and Insurance claims.
*   **Treasury Ledger:** Full audit trail of income and expenses with net liquidity tracking.
*   **Settlement Workflow:** Ability to consolidate multiple pending bills into a single final settlement invoice for discharged patients.

### 1.6 Human Resources & Payroll
*   **Attendance Tracking:** Check-in/out logging with automatic "Late" detection based on shift timing.
*   **Leave Management:** Request/Approval system for various leave types (Sick, Vacation, Unpaid).
*   **Smart Payroll:** Automated salary calculation (Net = Base + Bonuses + Extra Fees - Attendance Fines).
*   **Participation Fees:** Automatic crediting of surgical team members upon operation completion.

## 2. Non-Functional Requirements

### 2.1 UI/UX Design
*   **Modern Interface:** Built with Tailwind CSS and Plus Jakarta Sans typography.
*   **Dynamic Theming:** Light/Dark/System modes with 20+ customizable accent colors.
*   **Accessibility:** Full support for RTL (Arabic) and LTR (English) layouts.
*   **Responsiveness:** Fluid adaptation from mobile handsets to high-resolution desktop monitors.
*   **UI Density:** Toggle between "Comfortable" and "Compact" views for data-heavy screens.

### 2.2 Performance & Architecture
*   **Synchronous Speed:** Powered by `better-sqlite3` for high-performance data operations.
*   **Resilient API:** Built-in retry logic and circuit breakers for handling network instability.
*   **Atomic Transactions:** Ensures data integrity during complex multi-table operations (e.g., Admission + Billing).
