# System Architecture

## 1. Technology Stack

### Frontend
*   **React 18:** Modern functional components with Hooks API.
*   **Vite:** Build tool optimized for speed and production asset bundling.
*   **React Router v6:** SPA navigation using `BrowserRouter`.
*   **Tailwind CSS:** Utility-first styling with custom CSS variables for live-theming.
*   **Recharts:** High-performance SVG charts for data visualization.
*   **Lucide React:** Consistent iconography across the system.

### Backend (Node.js)
*   **Express.js:** Lightweight and robust web framework.
*   **Better-SQLite3:** Synchronous, high-performance SQLite driver.
*   **JWT & BcryptJS:** Industry-standard security for auth and password hashing.
*   **Multer:** Controlled file handling for database restoration.

## 2. Key Architectural Patterns

### 2.1 Synchronous Database Layer
Unlike standard async drivers, `better-sqlite3` operations are synchronous. This significantly simplifies the backend business logic by removing "callback hell" and `await` overhead, allowing for extremely fast execution of complex queries within Express routes.

### 2.2 Atomic Business Transactions
Complex hospital workflows are wrapped in SQLite `db.transaction()` blocks. For example, discharging a patient involves:
1.  Verifying zero balance.
2.  Updating Admission status to 'discharged'.
3.  Setting Bed status to 'cleaning'.
4.  Converting Patient type back to 'outpatient'.
These steps fail or succeed as a single unit to prevent data corruption.

### 2.3 Synced RBAC (Role-Based Access Control)
The system uses a mirrored permission matrix:
*   **Frontend (`utils/rbac.ts`):** Controls UI visibility, button disabled states, and client-side route guarding.
*   **Backend (`middleware/auth.js`):** Enforces permissions at the API level, ensuring that even direct HTTP requests from tools like Postman are validated against the user's role.

### 2.4 Dynamic Header State
Implemented via `HeaderContext`, allowing child pages (like Patients or Billing) to update the global layout's title, subtitle, and primary action buttons (e.g., "Add Invoice") without complex prop drilling.

### 2.5 i18n & RTL Synchronization
The `TranslationProvider` manages English/Arabic switching. It dynamically updates the HTML `dir` attribute (LTR/RTL) and `lang` tag, triggering CSS layout shifts for a native localized experience.

## 3. Deployment Strategy
The system is designed as a "Monolithic Hybrid":
*   The backend serves the built React frontend from a `public/` directory.
*   Environment variables manage API keys and database paths.
*   A single `allcare.db` file holds the entire system state, facilitating easy cloud backups and migrations.
