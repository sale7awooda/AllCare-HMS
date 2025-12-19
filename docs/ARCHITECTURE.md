# System Architecture

## 1. Technology Stack

### Frontend (SPA)
*   **Core:** React 18 (Hooks-based functional components).
*   **Build System:** Vite (Fast HMR and bundling).
*   **State Management:** React Context API.
    *   `AuthContext`: User session and token management.
    *   `ThemeContext`: Appearance, density, and accent color injection.
    *   `TranslationContext`: Client-side i18n (EN/AR).
    *   `HeaderContext`: dynamic layout header control.
*   **Routing:** React Router DOM v6.
*   **Styling:** Tailwind CSS + CSS Variables for dynamic theming.
*   **HTTP Client:** Axios (Interceptors for Bearer token injection).
*   **Visualization:** Recharts (Responsive charts).
*   **Icons:** Lucide React.

### Backend (API)
*   **Runtime:** Node.js.
*   **Framework:** Express.js (REST API).
*   **Database:** `better-sqlite3`.
    *   *Reasoning:* Synchronous I/O offers simplicity and extreme speed for single-file databases, eliminating the need for complex async/await patterns in standard CRUD within a single-threaded Node environment.
*   **Validation:** `zod` middleware for request body schema validation.
*   **Security:**
    *   `helmet`: Content Security Policy (CSP).
    *   `cors`: Cross-Origin Resource Sharing.
    *   `bcryptjs`: Password hashing.
    *   `express-rate-limit`: API throttling.
    *   `jsonwebtoken`: Stateless authentication.
*   **File Handling:** `multer` (Used for database restoration uploads).

## 2. Project Structure

```text
/
├── backend/
│   ├── public/              # Served frontend static files (production)
│   ├── src/
│   │   ├── config/          # database.js (SQLite connection & Schema Seeding)
│   │   ├── controllers/     # Business logic (Patient, Staff, Billing, Medical, Config)
│   │   ├── middleware/      # auth.js (JWT, RBAC), validation.js (Zod)
│   │   ├── routes/          # api.js (Centralized route definitions)
│   │   └── utils/           # rbac_backend_mirror.js (Permissions constants)
│   ├── server.js            # Entry point & Error handling
│   └── allcare.db           # SQLite Database file
│
├── src/
│   ├── components/          # Reusable UI (Card, Button, Modal, Inputs)
│   ├── context/             # React Context Providers
│   ├── pages/               # Route Views (Dashboard, Patients, Billing, etc.)
│   ├── services/            # api.ts (Axios wrapper endpoints)
│   ├── utils/               # rbac.ts (Frontend permission logic)
│   ├── locales/             # JSON translation files
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
│
└── dist/                    # Built frontend artifacts
```

## 3. Data Flow & Security Pattern

1.  **Request:** Frontend makes Axios call -> Includes `Authorization: Bearer <token>`.
2.  **Gateway:** Express `rateLimit` checks frequency -> `helmet` sets headers -> `cors` validates origin.
3.  **Authentication:** `authenticateToken` middleware verifies JWT signature -> Attaches `req.user`.
4.  **Authorization:** `authorizeRoles(Permission)` middleware checks if `req.user.role` has the specific required permission (e.g., `MANAGE_BILLING`).
5.  **Validation:** `validate(schema)` middleware uses Zod to ensure request body integrity.
6.  **Controller:** Executes business logic -> Calls `better-sqlite3` synchronous methods -> Returns JSON response.
7.  **Database:** Transactions (`db.transaction`) are used for multi-step writes (e.g., Creating an Appointment + Creating a Bill).

## 4. Key Design Decisions

*   **RBAC Mirroring:** Permissions are defined in `src/utils/rbac.ts` (Frontend) and mirrored in `backend/src/utils/rbac_backend_mirror.js` (Backend). This allows the frontend to hide UI elements securely while the backend enforces the actual access control.
*   **Synchronous SQLite:** Using `better-sqlite3` allows for cleaner controller code without "callback hell" or excessive `await` statements, leveraging SQLite's speed.
*   **Context-Driven UI:** The `HeaderContext` allows individual pages to control the global layout header (Titles, Action Buttons), keeping the sidebar/layout persistent while the content changes.
