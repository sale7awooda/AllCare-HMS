# AllCare HMS - System Requirements

## 1. Functional Requirements

### 1.1 Authentication & Security
*   **Login:** Secure login screen with username and password. Demo-friendly "Quick Profile" selection for easy access.
*   **Authentication:** JWT-based token authentication for securing API endpoints.
*   **Authorization:** Granular Role-Based Access Control (RBAC) to restrict access to modules and actions (View, Manage, Delete) based on user role.
*   **Password Security:** Passwords hashed using `bcryptjs` on the backend.

### 1.2 Patient Management
*   **Patient Registry:** Comprehensive, searchable, and paginated list of patients.
*   **Registration Form:** Detailed capture of demographics, medical history, allergies, emergency contacts, and insurance details.
*   **Patient Actions:** Unified "Manage" menu for quick actions: appointments, lab tests, admissions, or nurse services.
*   **Patient 360° View:** Modal-based detailed view showing complete profile, medical timeline (visits, labs), and financial history.

### 1.3 Appointment Management
*   **Queue View:** Real-time, kanban-style board showing daily queues per doctor/nurse, organized by status (Waiting, In Progress, Completed).
*   **Token System:** Sequential daily token assignment for efficient patient flow management.
*   **Workflow:** `Pending (Unpaid)` -> `Confirmed (Paid)` -> `In Progress` -> `Completed`.
*   **Billing Integration:** Automatic generation of pending invoices based on staff consultation fees.

### 1.4 Inpatient & Admissions
*   **Ward Dashboard:** Visual grid of hospital beds color-coded by status (Available, Occupied, Reserved, Maintenance, Cleaning).
*   **Admission Workflow:** Bed reservation, deposit billing, arrival confirmation, and clinical care tracking.
*   **Clinical Vitals:** Track BP, Temperature, Pulse, and Respiration within daily clinical notes.
*   **Discharge & Settlement:** Formal discharge process requiring full balance settlement. Supports consolidation of all pending bills into a single settlement invoice.

### 1.5 Medical Services (Lab, Nurse, Operations)
*   **Laboratory:** Catalog-based ordering, status tracking, and technician result entry with findings and internal notes.
*   **Nurse Services:** Routing of procedure requests (injections, dressings) to assigned nursing staff.
*   **Operations (Theater):** Multi-stage workflow: Request -> Detailed Cost Estimation (Surgeon, Team, Theater, Consumables) -> Billing -> Execution.

### 1.6 Billing, Finance & Treasury
*   **Invoice Management:** Centralized hub for patient billing, partial payments, and refunds.
*   **Treasury (Cash Management):** Track hospital income and outgoing expenses. Monitor "Method Holdings" (balances in Cash, Bankak/BOK, etc.).
*   **Insurance Processing:** Support for insurance-based payments with provider and policy tracking.

### 1.7 Human Resources (HR)
*   **Staff Directory:** Visual directory with specialized roles and departments.
*   **Attendance Tracking:** Daily check-in/out logs with "Late" status detection based on shift start times.
*   **Leave Management:** Approval workflow for sick, vacation, and unpaid leaves.
*   **Payroll & Adjustments:** Automated monthly payroll generation calculating Base Salary + Bonuses - Fines/Loans/Absences.

### 1.8 Analytics & Audit
*   **Reports:** Financial trends, operational volume (departmental workload), and patient demographics.
*   **System Records:** A unified audit log of every significant event in the system (registrations, appointments, bills) with deep-dive analysis capability.

## 2. Non-Functional & UI/UX Requirements

### 2.1 UI/UX
*   **Theming:** Full Dark/Light/System mode support with 20+ selectable accent colors.
*   **Internationalization (i18n):** Complete English and Arabic support with automatic RTL (Right-to-Left) layout switching.
*   **Responsiveness:** Mobile-first responsive design for all modules.
*   **Density Control:** Toggle between "Comfortable" and "Compact" UI density.

### 2.2 Performance & Reliability
*   **Backend:** High-performance synchronous SQLite operations via `better-sqlite3`.
*   **Architecture:** Decoupled RESTful API with Zod validation and rate limiting.
*   **Data Safety:** Built-in tools for database backup (.db snapshot), restoration, and factory reset.