# AllCare HMS - Development Roadmap

## Phase 1: Core Setup & Authentication
*   **Goal:** Establish project structure and user access control.
*   **Tasks:**
    *   Initialize React (Vite) and Node.js (Express) repositories.
    *   Setup SQLite database with `better-sqlite3` and migration scripts.
    *   Implement User table and Seed default Admin user.
    *   Build Login API (JWT generation) and Login Page.
    *   Implement Protected Route wrappers in frontend.

## Phase 2: Master Data Management
*   **Goal:** Manage hospital resources (Staff, Departments).
*   **Tasks:**
    *   Create Medical Staff CRUD API.
    *   Build Staff Management UI (List, Add/Edit Forms).
    *   Implement Availability/Schedule logic.
    *   Manage Departments (if applicable).

## Phase 3: Patient Management
*   **Goal:** Enable patient registration and record keeping.
*   **Tasks:**
    *   Create Patient table and CRUD API.
    *   Implement ID generation logic (`PAT-YYYY...`).
    *   Build Patient List with search and filtering.
    *   Create detailed Registration Form (Demographics, Medical History).
    *   Build Patient Details profile view.

## Phase 4: Appointment System
*   **Goal:** Enable scheduling.
*   **Tasks:**
    *   Create Appointment table with foreign keys to Patient and Staff.
    *   Build Appointment Booking Modal.
    *   Implement Conflict Detection (check staff availability).
    *   Create Appointment List and/or Calendar View.
    *   Add Status workflow (Confirm, Cancel, Complete).

## Phase 5: Billing & Finance
*   **Goal:** Revenue generation and tracking.
*   **Tasks:**
    *   Create Billing tables (Header and Items).
    *   Implement "Create Bill from Appointment" logic.
    *   Build Invoice Generation Form.
    *   Implement Payment Recording (Partial/Full updates).
    *   Generate PDF Invoices using `jsPDF`.

## Phase 6: Dashboard & Analytics
*   **Goal:** Business intelligence.
*   **Tasks:**
    *   Build Aggregation Queries (Total Revenue, Patient Counts).
    *   Implement Dashboard Widgets using `Recharts`.
    *   Create Excel Export functionality for reports.

## Phase 7: Polish & Production
*   **Goal:** Production readiness.
*   **Tasks:**
    *   Comprehensive Error Handling & Logging (Winston).
    *   Finalize Permissions/RBAC.
    *   Performance Testing.
    *   Docker containerization & PM2 setup.
