# System Architecture

## 1. Tech Stack

### Frontend
*   **Framework:** React 18+ (Functional components with Hooks)
*   **Build Tool:** Vite
*   **Routing:** React Router v6 (HashRouter)
*   **State Management:** React Context API (Auth, Theme, Translation, Header)
*   **Styling:** Tailwind CSS + Dynamic CSS Variable Injection for theming
*   **Data Fetching:** Axios with interceptors for JWT injection and 401 handling
*   **Visualizations:** Recharts for analytics and dashboard KPIs
*   **Internationalization:** Custom JSON-based i18n engine with RTL support

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** `better-sqlite3` (High-performance synchronous SQLite driver)
*   **Security:** `helmet` (CSP), `cors`, `bcryptjs` (Hashing), `express-rate-limit`
*   **Validation:** `zod` for robust request schema enforcement
*   **File Handling:** `multer` for secure database restoration

## 2. Project Structure

```text
/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection & init logic
│   │   ├── controllers/     # Business logic split by module
│   │   ├── middleware/      # Auth, RBAC, and Zod Validation
│   │   ├── routes/          # API route definitions
│   │   └── utils/           # Shared constants (RBAC mirror)
│   ├── server.js            # Express server entry point
│   └── allcare.db           # SQLite database file
│
├── context/                 # Global React Contexts
├── components/              # Shared UI & Layout components
├── pages/                   # Main module views
├── services/                # API Client (Axios wrapper)
├── locales/                 # i18n Translation dictionaries (EN/AR)
├── utils/                   # Frontend helpers (RBAC logic)
├── types.ts                 # Global TypeScript interfaces
├── App.tsx                  # Root component & Routing
└── index.tsx                # Client-side entry point
```

## 3. Core Architectural Patterns

1.  **Centralized Header Management:**
    Pages use a `useHeader` hook to dynamically update the layout's header title, subtitle, and action buttons, ensuring a consistent UI while keeping page components focused.

2.  **RBAC Mirroring:**
    Permissions are defined once and mirrored between frontend (`utils/rbac.ts`) and backend (`backend/utils/rbac_backend_mirror.js`). The frontend hides UI elements, while the backend middleware (`authorizeRoles`) enforces access at the API level.

3.  **Synchronous Database Access:**
    The system utilizes `better-sqlite3`'s synchronous nature to simplify backend logic and improve performance by avoiding the overhead of async/await for standard CRUD operations in a single-threaded SQLite context.

4.  **Transaction-Based Consistency:**
    Critical operations (like creating an appointment with an associated bill) are wrapped in SQLite transactions (`db.transaction`) to ensure atomic updates and data integrity.