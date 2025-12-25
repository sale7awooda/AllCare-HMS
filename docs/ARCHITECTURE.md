# System Architecture

## 1. Technology Stack

### Frontend
*   **Framework:** React 18+ (Functional Components, Hooks)
*   **Build Tool:** Vite (Fast HMR, optimized production build)
*   **Routing:** React Router v6 (`MemoryRouter` for embedded/demo stability)
*   **State Management:** React Context API
    *   `AuthContext`: User session and token management.
    *   `ThemeContext`: Appearance (Dark mode, Accent colors, Density).
    *   `TranslationContext`: i18n (English/Arabic).
    *   `HeaderContext`: Dynamic layout header control.
*   **Styling:** Tailwind CSS with CSS variables for dynamic theming.
*   **HTTP Client:** Axios with interceptors for Auth injection, 401 handling, and retry logic.
*   **Charts:** Recharts for data visualization.
*   **Icons:** Lucide React.

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** SQLite via `better-sqlite3` (High-performance, synchronous driver).
*   **Security:**
    *   `helmet`: Content Security Policy headers.
    *   `cors`: Cross-Origin Resource Sharing.
    *   `bcryptjs`: Password hashing.
    *   `express-rate-limit`: API request throttling.
*   **Validation:** `zod` for request body schema validation.
*   **File Handling:** `multer` for database restoration uploads.

## 2. Project Structure

```text
/
├── backend/
│   ├── public/              # Static frontend assets (post-build)
│   ├── src/
│   │   ├── config/          # Database initialization & connection
│   │   ├── controllers/     # Business logic (Patient, Staff, Billing, etc.)
│   │   ├── middleware/      # Auth, RBAC, Validation, Logging
│   │   ├── routes/          # API route definitions
│   │   └── utils/           # Shared constants (RBAC mirror)
│   ├── server.js            # Express entry point
│   └── allcare.db           # SQLite database file
│
├── src/
│   ├── components/          # Reusable UI (Card, Button, Modal, Inputs)
│   ├── context/             # Global Context Providers
│   ├── locales/             # i18n JSON files (en.json, ar.json)
│   ├── pages/               # Feature-specific page views
│   ├── services/            # Axios API wrapper definition
│   ├── utils/               # Helper functions (RBAC frontend logic)
│   ├── App.tsx              # Main application wrapper
│   └── types.ts             # TypeScript interfaces
├── docs/                    # Documentation
└── vite.config.js           # Vite configuration (Proxy setup)
```

## 3. Key Architectural Patterns

### 3.1 Dynamic Header Management
Pages use a custom `useHeader` hook to inject titles, subtitles, and action buttons (e.g., "Add Patient") directly into the main `Layout` component's header. This keeps the layout cleaner and allows pages to control the global navigation context without prop drilling.

### 3.2 Dual-Sided RBAC
Permissions are defined in `src/utils/rbac.ts` (Frontend) and mirrored in `backend/src/utils/rbac_backend_mirror.js` (Backend).
*   **Frontend:** Hides UI elements (buttons, tabs) and guards routes based on user role.
*   **Backend:** Middleware `authorizeRoles(...)` enforces permissions at the API endpoint level, ensuring security even if the frontend is bypassed.

### 3.3 Synchronous Database Operations
The backend utilizes `better-sqlite3`'s synchronous nature. This simplifies the codebase by removing the need for `await` on every DB call and provides excellent performance for the expected scale of this HMS, avoiding the "colored function" problem of async/await in tight loops.

### 3.4 Atomic Transactions
Complex operations involving multiple tables are wrapped in `db.transaction`. Examples include:
*   **Admission:** Updates Bed status + Creates Admission record + Creates Billing Invoice + Creates Bill Items.
*   **Payment:** Updates Bill status + Creates Transaction log + Updates Service status (e.g., confirming an appointment).
*   **Payroll:** Calculates deltas for base salary, bonuses, and fines to create or update draft payroll records idempotently.

### 3.5 Database Portability
The entire system state resides in `allcare.db`. The `Configuration` module leverages this to provide:
*   **Backup:** Streams the `.db` file to the client as a download.
*   **Restore:** Uploads a file to overwrite the current `.db` file, effectively restoring the system state.
