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
*   **Patient Actions:** A unified "Manage" menu to quickly initiate actions for a patient, such as booking an appointment, requesting a lab test, or admitting them.
*   **Patient 360° View:** A modal-based detailed view showing a patient's complete profile, timeline of medical events (appointments), and financial history (bills).

### 1.3 Appointment Management
*   **Queue View:** A real-time, kanban-style board showing the daily appointment queue for each active doctor and nurse, organized by status (Waiting, In Progress, Completed).
*   **Workflow:** Supports a full clinical workflow: `Pending (Unpaid)` -> `Confirmed (Paid)` -> `In Progress` -> `Completed`.
*   **Walk-in Scheduling:** Ability for receptionists to create new walk-in appointments.
*   **Billing Integration:** Creating an appointment automatically generates a corresponding bill with the appropriate fee based on the staff member and appointment type.

### 1.4 Inpatient & Admissions
*   **Ward View:** A visual dashboard of all hospital beds, color-coded by status (Available, Occupied, Reserved, Maintenance).
*   **Admission Workflow:**
    1.  **Reservation:** Reserve an available bed for a patient, generating a pending deposit invoice.
    2.  **Confirmation:** Once the deposit is paid (in the Billing module), the reservation is confirmed, the patient becomes an "inpatient", and the bed status changes to "Occupied".
*   **Inpatient Care:** A dedicated modal for managing admitted patients, including viewing stay details, adding clinical notes with vitals, and processing discharge.
*   **Discharge Process:** A formal discharge workflow that calculates the final bill, updates patient and bed status, and records discharge notes.

### 1.5 Medical Services (Lab & Operations)
*   **Laboratory:** A workflow to manage lab test requests from creation to completion. Statuses include `Pending Payment`, `Confirmed (Ready for testing)`, and `Completed`. Technicians can enter results.
*   **Operations:** A workflow for surgical requests, including cost estimation, team assignment, scheduling, and status tracking (`Requested`, `Pending Payment`, `Confirmed`, `Completed`).

### 1.6 Billing & Finance
*   **Invoice Management:** A central module to view, create, and manage all patient invoices.
*   **Payment Processing:** Ability to record full or partial payments against invoices.
*   **Automated Billing:** Invoices are automatically generated for key actions like appointments, lab requests, and operation estimations.
*   **Status Syncing:** Paying an invoice automatically updates the status of the linked service (e.g., an appointment moves from `Pending` to `Confirmed`).

### 1.7 Human Resources (HR)
*   **Staff Directory:** A visual directory of all staff members with details on their role, department, and schedule.
*   **HR Modules:** Dedicated tabs for managing `Attendance`, `Leave Requests`, `Payroll`, and `Financial Adjustments` (bonuses/fines).
*   **Payroll Generation:** Automated payroll calculation based on base salary and financial adjustments for a given month.

### 1.8 System Configuration & Administration
*   **Modular Configuration:** A centralized admin panel to manage:
    *   **General Settings:** Hospital name, address.
    *   **Users & Roles:** Create users, assign roles, and manage granular permissions for each role.
    *   **Financial:** Configure tax rates and accepted payment methods.
    *   **Wards:** Add/edit hospital rooms and beds.
    *   **Medical Catalogs:** Manage lists of lab tests, nurse services, operations, departments, and specializations.
    *   **Data Management:** Perform database backups, restores, and factory resets.
*   **System Health:** A diagnostics tool to check server and database connectivity and performance.

## 2. Non-Functional & UI/UX Requirements

### 2.1 UI/UX
*   **Theming & Customization:**
    *   **Dark/Light/System Mode:** Full support for different color schemes.
    *   **Accent Colors:** Users can choose from multiple accent colors to personalize the UI.
    *   **Density & Font Size:** Options for comfortable/compact layouts and adjustable font sizes to improve accessibility.
*   **Internationalization (i18n):** Full support for English and Arabic, including right-to-left (RTL) layout adjustments.
*   **Responsiveness:** The application is designed to be fully responsive and functional on devices of all sizes.
*   **Feedback:** Consistent use of loading indicators, success/error messages, and confirmation dialogs to provide clear user feedback.

### 2.2 Performance & Reliability
*   **Efficient Data Handling:** Frontend data filtering, sorting, and pagination are handled client-side with `useMemo` for performance.
*   **API Design:** A RESTful API backend with optimized queries.
*   **Security:** Backend API routes are protected by JWT authentication and RBAC middleware. Frontend permissions dynamically render UI elements to prevent unauthorized actions.
*   **Error Handling:** Graceful error handling on both frontend and backend.
