# AllCare HMS - System Documentation

## Overview
AllCare HMS (Hospital Management System) is a comprehensive, full-stack web application designed to manage hospital operations, including patient records, appointments, medical staff, admissions, billing, HR, and inventory. 

The system is built with a modern tech stack:
- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Recharts, Lucide React.
- **Backend:** Node.js, Express.js.
- **Database:** SQLite (using `sqlite` and `sqlite3` packages for asynchronous operations).
- **Authentication:** JWT (JSON Web Tokens) with role-based access control (RBAC).

---

## Architecture & Modules

The application follows a client-server architecture. The frontend is a Single Page Application (SPA) that communicates with the backend via RESTful APIs.

### 1. Authentication & Authorization (`/backend/src/controllers/auth.controller.js`)
- **Login:** Users authenticate using their email and password. The backend verifies credentials using `bcryptjs` and issues a JWT.
- **RBAC (Role-Based Access Control):** The system defines roles (e.g., `admin`, `manager`, `doctor`, `nurse`, `receptionist`, `accountant`, `hr`, `pharmacist`). Each role has specific permissions defined in `rbac_backend_mirror.js`.
- **Middleware:** `authenticateToken` verifies the JWT, and `authorizeRoles` ensures the user has the required permissions for specific endpoints.

### 2. Patient Management (`/backend/src/controllers/patient.controller.js`)
- **CRUD Operations:** Register new patients, update their details, and view patient history.
- **Data Stored:** Demographics, medical history, allergies, blood group, emergency contacts, and insurance details.
- **Patient ID Generation:** Automatically generates unique patient IDs (e.g., `P240401`).

### 3. Appointment Management (`/backend/src/controllers/appointment.controller.js`)
- **Scheduling:** Book appointments for patients with specific doctors.
- **Status Tracking:** Track appointment status (`scheduled`, `completed`, `cancelled`).
- **Integration:** Appointments are linked to both patients and medical staff.

### 4. Medical & Clinical Operations (`/backend/src/controllers/medical.controller.js`)
- **Admissions:** Manage inpatient admissions, assign beds, and track stay duration.
- **Operations/Surgeries:** Schedule and process operation requests, including cost estimation and staff participation.
- **Inpatient Notes:** Doctors can add clinical notes and vitals for admitted patients.
- **Discharge:** Process patient discharge and generate settlement bills.

### 5. Billing & Finance (`/backend/src/controllers/billing.controller.js`)
- **Invoicing:** Generate bills for consultations, admissions, operations, and pharmacy purchases.
- **Payments:** Process full or partial payments.
- **Treasury:** Track overall hospital revenue and expenses (transactions).
- **Settlement:** Consolidate unpaid bills into a final settlement bill upon patient discharge.

### 6. HR & Staff Management (`/backend/src/controllers/staff.controller.js`)
- **Staff Directory:** Manage doctors, nurses, and other staff members.
- **Attendance:** Track daily check-ins and check-outs.
- **Leaves:** Process leave requests.
- **Payroll:** Automatically calculate monthly salaries based on base salary, attendance (fines for unexcused absences/lateness), bonuses, and extra operation fees.

### 7. Inventory & Pharmacy (Integrated in Billing/Medical)
- **Stock Management:** Track medical supplies and medicines.
- **Dispensing:** Deduct stock when items are billed to patients.

### 8. Notifications (`/backend/src/controllers/notification.controller.js`)
- **System Alerts:** Send internal notifications to users (e.g., low stock alerts, new appointments).
- **Read Status:** Users can mark notifications as read.

---

## UI/UX Design

The frontend is designed with a focus on usability, clarity, and efficiency for healthcare professionals.

### Layout & Navigation
- **Sidebar:** A collapsible sidebar provides quick access to all major modules (Dashboard, Patients, Appointments, Admissions, Billing, HR, etc.). The visibility of menu items is dynamically controlled based on the user's role and permissions.
- **Header:** Displays the current user's profile, a notification bell with unread count, and a theme toggle (Light/Dark mode).
- **Theme:** The application supports both Light and Dark modes, utilizing Tailwind CSS for consistent styling across all components.

### Dashboard
- **Key Metrics:** Displays high-level statistics (e.g., Total Patients, Active Admissions, Today's Revenue).
- **Charts:** Uses `recharts` to visualize data trends, such as revenue over time or patient demographics.
- **Recent Activity:** A feed of recent actions or upcoming appointments.

### Forms & Data Entry
- **Modals:** Forms for creating or editing records (e.g., New Patient, Book Appointment) are presented in modal dialogs to keep the user in context without navigating away.
- **Validation:** Client-side validation ensures required fields are filled before submission.

### Tables & Data Grids
- **Search & Filter:** Most data tables include search bars and status filters to quickly find specific records.
- **Actions:** Each row typically has an "Actions" column with icons (e.g., Edit, View, Delete, Process Payment) for quick operations.

---

## How to Run the System

### Prerequisites
- Node.js (v18 or higher)
- npm (Node Package Manager)

### Development Mode
1. **Install Dependencies:**
   Navigate to the root directory and run:
   ```bash
   npm install
   cd backend && npm install
   cd ..
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory (or use the provided `.env.example` as a template). Ensure `JWT_SECRET` is set.

3. **Start the Development Server:**
   From the root directory, run:
   ```bash
   npm run dev
   ```
   This command concurrently starts the backend server on port 3001 and the Vite frontend server on port 3000. The frontend proxies API requests to the backend.

### Production Build
1. **Build the Application:**
   From the root directory, run:
   ```bash
   npm run build
   ```
   This compiles the React frontend into static files and places them in the `backend/public` directory.

2. **Start the Production Server:**
   ```bash
   npm start
   ```
   The Express backend will serve both the API endpoints and the static frontend files on the port specified by the `PORT` environment variable (defaults to 3001 if not set).

---

## Deep Analysis of Asynchronous Database Refactoring

Recently, the backend was refactored to use the `sqlite` package instead of `better-sqlite3`. This transition moves the application from synchronous database operations to asynchronous ones.

### Why the Change?
- **Non-blocking I/O:** Node.js is single-threaded. Synchronous database calls block the event loop, meaning the server cannot process other requests while waiting for a database query to finish. Asynchronous calls (`async/await`) free up the event loop, significantly improving the application's concurrency and scalability.
- **Compatibility:** Native compilation issues with `better-sqlite3` in certain environments (like Docker containers or specific cloud providers) are avoided by using the standard `sqlite3` driver wrapped with `sqlite` for Promise support.

### How it Works Now
1. **Database Initialization (`/backend/src/config/database.js`):**
   The `getDb()` function returns a Promise that resolves to the database instance.
   ```javascript
   const { open } = require('sqlite');
   const sqlite3 = require('sqlite3');
   
   let dbInstance = null;
   async function initDB() {
       dbInstance = await open({ filename: './database.sqlite', driver: sqlite3.Database });
       // ... migrations ...
   }
   function getDb() { return dbInstance; }
   ```

2. **Controllers:**
   All controller functions are now `async`. They await the database instance and then await the query execution.
   ```javascript
   exports.getAll = async (req, res) => {
     try {
       const db = getDb();
       const patients = await db.all('SELECT * FROM patients');
       res.json(patients);
     } catch (err) {
       res.status(500).json({ error: err.message });
     }
   };
   ```

3. **Transactions:**
   Transactions are handled using explicit SQL commands rather than a callback wrapper.
   ```javascript
   const db = getDb();
   try {
       await db.exec('BEGIN TRANSACTION');
       // ... multiple await db.run() calls ...
       await db.exec('COMMIT');
   } catch (err) {
       await db.exec('ROLLBACK');
       throw err;
   }
   ```
This architecture ensures robust data integrity while maintaining high performance under load.
