# AllCare HMS - System Requirements

## 1. Functional Requirements

### 1.1 Authentication & Security
*   **Login Screen:** Username/password authentication.
*   **Security:**
    *   JWT token storage (httpOnly cookies + localStorage fallback).
    *   Password hashing with bcrypt (salt rounds: 10).
    *   Role-based access control (RBAC) with specific UI rendering based on permissions.
    *   API route protection via middleware.
    *   Session expiration and refresh token logic.

### 1.2 Dashboard (Home)
*   **Statistics Cards:** Total Patients, Today's Appointments, Pending Payments, Revenue (Today/Month).
*   **Visualizations:**
    *   Appointments by status (Pie chart).
    *   Revenue trends (Line chart).
    *   Patient type distribution (Bar chart).
*   **Activity Feed:** Recent patients, appointments, and payments.
*   **Role-Based Visibility:** Widgets displayed based on user role (Admin, Doctor, Receptionist).

### 1.3 Patient Management
*   **Patient List:** Searchable/filterable data table (ID, Name, Age, Gender, Phone, Type, Date).
*   **Registration:**
    *   Auto-generate unique IDs (`PAT-YYYYMMDD-XXXX`).
    *   Demographics: Name, Address, Age (0-150), Gender, Phone.
    *   Type: Inpatient, Outpatient, Emergency.
    *   Medical info: History, Symptoms, Allergies.
    *   Insurance details and Emergency contacts (JSON storage).
*   **Patient Details:** Unified view of info, history, billing, and timeline.

### 1.4 Appointment Management
*   **Scheduling:**
    *   Check doctor/staff availability.
    *   Prevent double-booking.
    *   Date & Time picker with validation.
    *   Service fee calculation based on staff rates.
*   **Views:** List view (filterable) and Calendar view (Monthly/Weekly).
*   **Workflow:** Pending → Scheduled → Completed → Cancelled.
*   **Billing Integration:** Auto-link appointments to billing records.

### 1.5 Billing & Payments
*   **Invoicing:**
    *   Auto-generate Bill IDs (`BILL-YYYYMMDD-XXXX`).
    *   Multiple line items (Service type, name, qty, price).
    *   Discount and Tax calculations.
    *   PDF Invoice generation.
*   **Payments:**
    *   Support partial payments.
    *   Multiple methods: Cash, Card, Insurance, Mobile Banking.
    *   Track balances (Total - Paid).
    *   Status tracking: Pending, Partial, Paid, Overdue.

### 1.6 Medical Staff Management
*   **Profiles:** Doctors, Nurses, Technicians.
*   **Availability:**
    *   Set working days and time ranges.
    *   Configure shift types (Morning/Evening/Night).
    *   Set consultation fees.
*   **Staff List:** Filter by specialization, department, availability.

### 1.7 Reports & Analytics
*   **Financial:** Revenue by date, payment method breakdown, outstanding balances.
*   **Operational:** Patient demographics, appointment stats (cancellations, volume by doctor).
*   **Exports:** Support for PDF and Excel (xlsx) export.

## 2. Non-Functional Requirements
*   **Performance:** Optimized data grids (TanStack Table), efficient SQL queries.
*   **Reliability:** Offline capability awareness, error boundaries in React.
*   **Validation:**
    *   Frontend: Zod schemas before submission.
    *   Backend: Request validation middleware.
*   **Logging:** Winston logger with file rotation.
*   **Deployment:** Docker-ready, PM2 for process management.

## 3. UI/UX Guidelines
*   **Design System:** Clean, professional healthcare aesthetic.
*   **Colors:**
    *   Primary: Blue/Teal (Medical trust).
    *   Success: Green.
    *   Warning: Yellow.
    *   Danger: Red.
*   **Components:** Shadcn/ui styled components (Modals, Toasts, Cards).
*   **Responsiveness:** Desktop-first, mobile-friendly for basic tasks.
