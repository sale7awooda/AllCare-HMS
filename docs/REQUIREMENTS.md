# AllCare HMS - System Requirements

## 1. Functional Requirements

### 1.1 Authentication & Security
*   **Login:** Secure login screen with username and password. Demo-friendly "Quick Profile" selection for easy access.
*   **Authentication:** JWT-based token authentication for securing API endpoints.
*   **Authorization:** Granular Role-Based Access Control (RBAC) to restrict access to modules and actions (View, Manage, Delete) based on user role (Admin, Manager, Receptionist, Doctor, etc.).
*   **Password Security:** Passwords are hashed on the backend using `bcryptjs`.

### 1.2 Patient Management
*   **Patient Registry:** A comprehensive, searchable, and paginated list of all patients.
*   **Registration Form:** Detailed form to capture demographics, medical history, allergies, emergency contacts, and insurance details.
*   **Patient Actions:** A unified "Manage" menu to quickly initiate actions for a patient, such as booking an appointment, requesting a lab test, admitting them, or requesting nurse services.
*   **Patient 360° View:** A modal-based detailed view showing a patient's complete profile, timeline of medical events (appointments), and financial history (bills).

### 1.3 Appointment Management
*   **Queue View:** A real-time, kanban-style board showing the daily appointment queue for each active doctor and nurse, organized by status (Waiting, In Progress, Completed).
*   **Workflow:** Supports a full clinical workflow: `Pending (Unpaid)` -> `Confirmed (Paid)` -> `In Progress` -> `Completed`.
*   **Walk-in Scheduling:** Ability for receptionists to create new walk-in appointments.
*   **Billing Integration:** Creating an appointment automatically generates a corresponding bill with the appropriate fee based on the staff member and appointment type.

### 1.4 Inpatient & Admissions
*   **Ward View:** A visual dashboard of all hospital beds, color-coded by status (Available, Occupied, Reserved, Maintenance, Cleaning).
*   **Admission Workflow:**
    1.  **Reservation:** Reserve an available bed for a patient, generating a pending deposit invoice.
    2.  **Confirmation:** Once the deposit is paid, the reservation is confirmed, and the bed status changes to "Occupied".
*   **Inpatient Care:** A dedicated modal for managing admitted patients, viewing stay details, and adding clinical notes with vitals (BP, Temp, Pulse, Resp).
*   **Discharge Process:** A formal discharge workflow that calculates the final bill based on days stayed + bed cost, updates patient status, and marks the bed for "Cleaning".

### 1.5 Medical Services (Lab, Nurse, Operations)
*   **Laboratory:** A workflow to manage lab test requests. Supports catalog-based ordering, cost calculation, and status tracking (`Pending Payment` -> `Confirmed` -> `Completed`). Results entry supported.
*   **Nurse Services:** A dedicated module for requesting nursing procedures (e.g., Injections, Dressing). Requests are routed to the nursing queue.
*   **Operations (Theater):** A comprehensive workflow for surgical requests:
    *   **Request:** Initial request by a doctor.
    *   **Estimation:** A detailed cost estimation builder allowing the addition of Surgeon Fees, Theater Fees, Team (Anesthesiologist, Assistants), Consumables, and Equipment.
    *   **Billing:** Generates a detailed invoice based on the estimation.
    *   **Execution:** Tracks status through `Scheduled` to `Completed`.

### 1.6 Billing & Finance
*   **Invoice Management:** A central module to view, create, and manage all patient invoices.
*   **Payment Processing:** Ability to record full or partial payments against invoices using configurable payment methods.
*   **Automated Billing:** Invoices are automatically generated for key actions like appointments, lab requests, and operation estimations.
*   **Status Syncing:** Paying an invoice automatically updates the status of the linked service.

### 1.7 Human Resources (HR)
*   **Staff Directory:** A visual directory of all staff members with details on their role, department, and schedule.
*   **Attendance:** Track daily check-in/check-out and status (Present, Absent, Late).
*   **Leaves:** Manage leave requests (Sick, Vacation, etc.) with approval/rejection workflow.
*   **Financial Adjustments:** Manage monetary adjustments including Bonuses, Fines, and Loans.
*   **Payroll Generation:** Automated payroll calculation module that aggregates Base Salary + Bonuses - Fines/Loans for a specific month.

### 1.8 System Configuration & Administration
*   **Modular Configuration:** A centralized admin panel to manage:
    *   **General Settings:** Hospital details.
    *   **Users & Roles:** User management and matrix-based permission configuration.
    *   **Financial:** Configure tax rates and accepted payment methods.
    *   **Wards:** Add/edit hospital rooms, bed types, and costs.
    *   **Catalogs:** Manage dynamic lists for Lab Tests, Nurse Services, Operations, Departments, Specializations, and Insurance Providers.
    *   **Data Management:** Database backup (download), restore (upload), and factory reset capabilities.
*   **System Health:** A diagnostics tool to check server uptime, database latency, and memory usage.

## 2. Non-Functional & UI/UX Requirements

### 2.1 UI/UX
*   **Theming & Customization:**
    *   **Dark/Light/System Mode:** Full support.
    *   **Accent Colors:** 10+ selectable accent colors.
    *   **Density & Font Size:** User-configurable interface density and text size.
*   **Internationalization (i18n):** Complete English and Arabic support with automatic RTL layout switching.
*   **Responsiveness:** Fully responsive design adapting to Mobile, Tablet, and Desktop.
*   **Feedback:** Toast notifications for success/error states, loading skeletons, and modal confirmations for critical actions.

### 2.2 Performance & Reliability
*   **Architecture:** Decoupled Frontend (Vite/React) and Backend (Express/SQLite) architecture.
*   **Validation:** Robust backend validation using `zod`.
*   **Security:** Helmet for headers, CORS configuration, and bcrypt for password hashing.
*   **API:** RESTful design with rate limiting.
