
# System Architecture

## 1. Tech Stack

### Frontend
*   **Framework:** React 18+
*   **Build Tool:** Vite
*   **Routing:** React Router v6
*   **State Management:** React Context API
*   **Styling:** Tailwind CSS + CSS Variables for dynamic theming
*   **HTTP Client:** Axios (with interceptors)
*   **Charts:** Recharts
*   **Icons:** Lucide React
*   **Internationalization:** Custom Context-based i18n (JSON)

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** `better-sqlite3` (Synchronous, high-performance SQLite driver)
*   **Authentication:** JWT (JSON Web Tokens)
*   **Security:** `helmet` (Headers), `cors`, `bcryptjs` (Password hashing), `express-rate-limit`
*   **Validation:** `zod` schema validation
*   **File Handling:** `multer` (for backup restoration)

## 2. Project Structure

```text
/
├── backend/
│   ├── public/              # Static frontend assets (post-build)
│   ├── src/
│   │   ├── config/          # DB connection (database.js)
│   │   ├── controllers/     # Business logic (auth, patient, staff, etc.)
│   │   ├── middleware/      # Auth, Validation, Rate Limiting
│   │   ├── routes/          # API route definitions
│   │   └── utils/           # RBAC permission mirror
│   ├── server.js            # Entry point
│   ├── package.json         # Backend dependencies
│   └── .env                 # Backend environment variables
│
├── docs/                    # Documentation
├── locales/                 # Translation files (en.json, ar.json)
│
├── components/              # UI Components (Card, Button, Modal, etc.)
├── context/                 # Global Contexts (Auth, Theme, Translation)
├── pages/                   # Route Pages (Dashboard, Patients, HR, etc.)
├── services/                # API Client (api.ts)
├── utils/                   # Helpers (rbac.ts)
├── types.ts                 # TypeScript Interfaces
├── App.tsx                  # Root Component
├── index.tsx                # Entry Point
│
├── index.html
├── vite.config.js           # Vite Configuration (Proxy setup)
├── tailwind.config.js
└── package.json             # Root/Frontend dependencies
```

## 3. Data & Control Flow

1.  **Frontend Request:**
    *   User interacts with UI (e.g., submits "Add Staff" form).
    *   `api.ts` method is called.
    *   Axios attaches `Authorization` header with JWT from localStorage.
    *   Request is proxied by Vite (dev) or served directly (prod) to `http://localhost:3000/api/...`.

2.  **Backend Processing:**
    *   `server.js` receives request, passes through security middleware (`helmet`, `cors`, `rateLimit`).
    *   `api.js` router directs to specific sub-route.
    *   `auth.js` middleware verifies JWT and attaches `req.user`.
    *   `auth.js` (RBAC) checks if `req.user.role` has required permission (e.g., `MANAGE_HR`).
    *   `validation.js` middleware validates request body against Zod schema.
    *   Controller (e.g., `staff.controller.js`) executes business logic.
    *   `better-sqlite3` executes synchronous SQL query against `allcare.db`.

3.  **Response:**
    *   Controller sends JSON response.
    *   Frontend component receives data, updates React state.
    *   UI re-renders to reflect changes (e.g., new staff member appears in list).
