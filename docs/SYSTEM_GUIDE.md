# AllCare HMS - Detailed System Guide

## 1. Introduction
**AllCare HMS** is a comprehensive, production-ready Hospital Management System designed to streamline clinical, administrative, and financial operations. It provides a unified platform for managing patients, appointments, medical records, billing, human resources, and system configurations.

The system is built with a focus on high performance, data integrity, and a modern user experience, supporting both English and Arabic (RTL) languages.

---

## 2. System Architecture

### 2.1 Technology Stack
- **Frontend**: React 18 (Hooks, Context API), Vite, React Router v6, Tailwind CSS, Recharts, Lucide React.
- **Backend**: Node.js, Express.js.
- **Database**: SQLite (via `better-sqlite3` for synchronous, high-performance operations).
- **Security**: JWT (JSON Web Tokens) for authentication, BcryptJS for password hashing.
- **Data Visualization**: Recharts for interactive dashboards and reports.

### 2.2 Core Design Patterns
- **Synchronous Database Layer**: Uses `better-sqlite3` to perform database operations synchronously, simplifying backend logic and ensuring predictable performance.
- **Atomic Transactions**: Complex workflows (e.g., patient discharge, payroll generation) are wrapped in database transactions to ensure data consistency.
- **Mirrored RBAC**: Permissions are defined in a central matrix and enforced on both the frontend (UI visibility/routing) and backend (API endpoint protection).
- **Dynamic Header State**: A `HeaderContext` allows individual pages to control the global layout's header content (title, actions).
- **i18n & RTL Synchronization**: Real-time switching between English (LTR) and Arabic (RTL) with layout adjustments.

---

## 3. Functional Modules

### 3.1 Authentication & Security (RBAC)
- **Role-Based Access Control**: Supports multiple roles: Admin, Doctor, Nurse, Laboratory, Finance, and HR.
- **Granular Permissions**: Each role has specific permissions (e.g., `VIEW_PATIENTS`, `MANAGE_BILLING`, `MANAGE_CONFIGURATION`).
- **Session Management**: JWT-based sessions with automatic expiry detection and redirection to login.

### 3.2 Patient Management
- **Centralized Registry**: A searchable database of all patients with demographic and contact information.
- **360° Patient View**: A comprehensive profile showing:
    - Clinical history and visit timeline.
    - Laboratory results.
    - Financial balance and billing history.
    - Insurance details.
- **Quick Actions**: Initiate clinical processes (Book Appointment, Admit, Request Lab) directly from the patient profile.

### 3.3 Clinical Operations
- **Appointments**:
    - Kanban-style queue management (Waiting, In-Progress, Completed).
    - Automated daily token system for sequential clinic visits.
- **Ward & Bed Management**:
    - Visual dashboard for bed occupancy.
    - Status tracking: Available, Occupied, Reserved, Cleaning.
- **Inpatient Care (Admissions)**:
    - Admission workflow with bed assignment and doctor allocation.
    - Clinical notes with vitals tracking (BP, Pulse, SpO2, etc.).
    - Automated discharge logic verifying financial clearance.

### 3.4 Medical Services
- **Laboratory Information System (LIS)**:
    - Catalog-based test requests.
    - Result entry with normal reference range tracking.
    - Multi-stage status: Pending, Processing, Completed, Confirmed.
- **Surgical Operations**:
    - Workflow: Request -> Estimation -> Payment -> Schedule -> Completion.
    - Detailed cost estimator including surgeon fees, theater costs, and consumables.
- **Nurse Services**:
    - Task queue for procedures like injections, dressings, and IV drips.

### 3.5 Financial Management
- **Automated Billing**: Invoices are automatically generated for appointments, lab tests, and ward stays.
- **Treasury & Ledger**:
    - Full audit trail of income and expenses.
    - Support for multiple payment methods (Cash, Bank, Insurance).
    - Net liquidity tracking.
- **Settlement**: Consolidate multiple bills into a single final settlement for discharged patients.

### 3.6 Human Resources & Payroll
- **Staff Directory**: Management of medical and administrative staff with specialization tracking.
- **Attendance**: Check-in/out logging with late detection.
- **Leave Management**: Request and approval workflow for vacations and sick leaves.
- **Smart Payroll**: Automated calculation based on base salary, bonuses, fines, and surgical participation fees.

---

## 4. System Configuration & Data Management

### 4.1 Global Settings
- Hospital identity (Name, Logo, Contact).
- Currency and localization preferences.
- UI density (Comfortable vs. Compact).

### 4.2 Catalogs
- **Departments & Specializations**: Organizational structure.
- **Medical Catalogs**: Lab tests, Nurse services, Surgical procedures.
- **Infrastructure**: Room and Bed definitions.
- **Financial**: Tax rates, Payment methods, Insurance providers.

### 4.3 Data Resilience
- **Backup**: One-click download of the entire SQLite database file.
- **Restore**: Upload a backup file to restore the system state.
- **Reset**: Option to wipe the database for a fresh start (Admin only).

---

## 5. User Interface & Experience (UI/UX)

### 5.1 Design System & Typography
The system follows a modern, clean aesthetic designed for high-density professional environments.
- **Typography**:
    - **English**: *Plus Jakarta Sans* – A modern geometric sans-serif for clarity and professional feel.
    - **Arabic**: *Tajawal* – A low-contrast sans-serif designed for readability in both LTR and RTL contexts.
- **Iconography**: *Lucide React* – Provides a consistent, lightweight, and stroke-based icon set used for navigation and actions.
- **Styling**: *Tailwind CSS* – Used for utility-first styling, ensuring a responsive and maintainable CSS architecture.

### 5.2 Layout Architecture
The interface is divided into three primary functional areas:
1.  **Sidebar (Navigation)**:
    *   **Collapsible**: Can be collapsed to an icon-only view to maximize workspace.
    *   **Role-Aware**: Navigation items are filtered based on the user's permissions (RBAC).
    *   **Mobile Responsive**: Transforms into a slide-over drawer on smaller screens.
2.  **Header (Contextual Control)**:
    *   **Sticky & Blurred**: Remains at the top with a glassmorphism effect for persistent navigation.
    *   **Dynamic Content**: Updates title and subtitle based on the active page.
    *   **Action Bar**: Hosts context-specific buttons (e.g., "Add Patient", "Print Invoice") provided by the active module.
3.  **Main Content Area**:
    *   **Max-Width Container**: Content is centered in a `max-w-7xl` container to prevent eye strain on ultra-wide monitors.
    *   **Smooth Scrolling**: Implements custom scrollbars and smooth scroll behavior.

### 5.3 Theming & Personalization
Users and administrators can customize the interface to suit their preferences:
- **Dark Mode**: Native support for Light, Dark, and System-synced themes with smooth transitions.
- **Accent Colors**: 20+ dynamic color palettes (e.g., Emerald, Indigo, Rose). Changing the accent color updates CSS variables (`--primary-500`, etc.) globally.
- **Density Control**:
    *   **Comfortable**: Standard spacing for ease of use.
    *   **Compact**: Reduced padding and margins for data-heavy screens (e.g., Laboratory results, Billing tables).
- **Font Scaling**: Adjustable base font size (Small, Medium, Large) to improve accessibility for different users.

### 5.4 Interaction Design
- **Modals & Overlays**: Uses backdrop blurs and animated transitions (fade-in, zoom-in) to maintain focus during data entry.
- **Feedback Loops**:
    *   **Loading States**: Skeleton screens and animated spinners indicate background processing.
    *   **Confirmations**: Destructive actions (e.g., deleting a record) require explicit confirmation via specialized dialogs.
    *   **Tooltips**: Provide contextual help, especially useful when the sidebar is collapsed.
- **Form Design**: Consistent input styling with clear validation states (error borders, helper text).

### 5.5 Localization (i18n)
- **RTL Support**: The system automatically flips the entire layout (sidebar, header, margins, icons) when Arabic is selected.
- **Dynamic Translation**: All text is managed via JSON locale files, allowing for easy updates and additional language support in the future.

### 5.6 Professional Print Engine
The system includes specialized CSS media queries for printing:
- **Clean Layouts**: Removes navigation, sidebars, and background colors to save ink and provide a professional look.
- **Document Formatting**: Optimized for A4 printing of Invoices, Medical Reports, and Lab Results.

---

## 6. Module Deep Analysis

### 6.1 Authentication & Security
- **JWT Strategy**: Uses `jsonwebtoken` for stateless authentication. Tokens are stored in `localStorage` and sent via the `Authorization: Bearer` header.
- **RBAC Enforcement**:
    - **Backend**: Middleware `authorizeRoles` checks the user's role against a central `Permissions` matrix before allowing access to specific Express routes.
    - **Frontend**: The `canAccessRoute` utility (in `utils/rbac.ts`) is used by the `Layout` component to hide navigation items and by the `Router` to protect client-side routes.
- **Password Security**: Uses `bcryptjs` with a salt factor of 10 for secure hashing.

### 6.2 Patient Management
- **UID Generation**: Patients are assigned a unique, human-readable ID (e.g., `PAT-1234`).
- **Data Structure**: Stores complex data like `emergency_contacts` and `insurance_details` as JSON strings within the SQLite database, parsed on-the-fly by the application.
- **Patient Categorization**: Patients are dynamically categorized as `outpatient` or `inpatient` based on their active admission status.

### 6.3 Clinical Operations
#### 6.3.1 Appointment Logic
- **Daily Token System**: Automatically calculates a sequential token number (e.g., Token #5) for each doctor's daily queue.
- **Restricted Visit Rule**: To prevent double-billing and data duplication, the system enforces a "one clinical visit per day" rule for types like *Consultation*, *Emergency*, and *Follow-up* with the same doctor.
- **Automated Invoicing**: Creating an appointment automatically generates a pending bill in the Treasury module.

#### 6.3.2 Admission & Ward Management
- **Bed Lifecycle**: Beds transition through `available` -> `reserved` (on admission request) -> `occupied` (on deposit payment) -> `cleaning` (on discharge).
- **Inpatient Monitoring**: Doctors record clinical notes and vitals (BP, Pulse, SpO2, etc.) which are stored as a time-series history for the admission.
- **Discharge Guard**: The system prevents final discharge if the patient has any outstanding balance (`total_amount - paid_amount > 0`).

### 6.4 Medical Services
#### 6.4.1 Laboratory Information System (LIS)
- **Catalog Integration**: Test requests are built using a pre-configured catalog of tests with defined normal ranges.
- **Workflow**: `pending` (awaiting payment) -> `confirmed` (paid, ready for sample) -> `completed` (results entered).
- **Result Validation**: Lab technicians enter results which are compared against the catalog's reference ranges for clinical accuracy.

#### 6.4.2 Surgical Operations
- **Cost Estimation**: A multi-stage process where a surgery request is first "Estimated" (Surgeon fees, Theater costs, Consumables).
- **Participation Fees**: The system automatically generates "Extra Fee" adjustments for all participating staff (Assistant surgeons, Anesthesiologists, Nurses) upon surgery completion.

### 6.5 Financial Management
#### 6.5.1 Billing & Treasury
- **Atomic Payments**: Recording a payment updates the bill status and simultaneously creates an `income` transaction in the Treasury ledger.
- **Settlement Workflow**: For complex cases (like long inpatient stays), the system can consolidate dozens of individual pending bills into a single "Final Settlement Invoice," simplifying the payment process for the patient.
- **Refund Management**: Supports partial and full refunds, with automatic ledger adjustments and status tracking.

### 6.6 Human Resources & Payroll
- **Attendance Engine**:
    - **Late Detection**: Automatically flags check-ins that occur after the shift start time.
    - **Absence Logic**: Unexcused absences are automatically calculated and factored into the payroll as fines.
- **Delta-Based Payroll**:
    - The payroll engine calculates the "Net Salary" by summing `Base Salary + Bonuses + Surgical Fees - Attendance Fines - Loans`.
    - It uses a "Delta" approach: if a payroll record already exists for a month, it only generates a new entry if there is a difference (e.g., a late-added bonus), ensuring no double-payments.
- **Treasury Sync**: Marking a payroll record as `paid` automatically creates an `expense` transaction in the Treasury module.

---

## 7. Data Flow & Integration
1.  **Patient Visit**: Patient arrives -> Appointment booked -> Token assigned.
2.  **Clinical Encounter**: Doctor sees patient -> Requests Lab/Nurse service -> Adds clinical notes.
3.  **Service Fulfillment**: Lab tech performs test -> Enters results -> Confirms request.
4.  **Billing**: System detects completed service -> Generates bill item -> Finance collects payment.
5.  **Discharge (Inpatient)**: Doctor initiates discharge -> Finance verifies zero balance -> Bed marked for cleaning -> Patient discharged.
