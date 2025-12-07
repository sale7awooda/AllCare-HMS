# System Architecture

## 1. Tech Stack

### Frontend
*   **Framework:** React 18+ SPA
*   **Routing:** React Router v6
*   **State Management:** React Context API + useReducer
*   **Styling:** Tailwind CSS + shadcn/ui components
*   **HTTP Client:** Axios (with interceptors)
*   **Data Grid:** TanStack Table (React Table v8)
*   **Charts:** Recharts
*   **Utilities:** Zod (validation), date-fns, jsPDF, xlsx

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** SQLite3 (via `better-sqlite3` for synchronous performance)
*   **Authentication:** JWT (JSON Web Tokens)
*   **Logging:** Winston
*   **Process Manager:** PM2

## 2. Project Structure

```text
hospital-management-system/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, JWT, Logger config
│   │   ├── controllers/     # Route logic
│   │   ├── middleware/      # Auth, Validation, RBAC
│   │   ├── routes/          # API definitions
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helpers (ID gen, validators)
│   │   └── migrations/      # DB Schema management
│   ├── server.js            # Entry point
│   └── ecosystem.config.js  # PM2 config
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI & Layouts
│   │   ├── pages/           # Route views
│   │   ├── context/         # Global state
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API integration
│   │   ├── utils/           # Formatters & Constants
│   │   └── styles/          # Tailwind setup
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── shared/
    └── validators/          # Shared Zod schemas
```

## 3. Data Flow

1.  **Client:** User interacts with React UI. Zod validates forms.
2.  **Request:** Axios sends HTTP request with JWT token to Express API.
3.  **Middleware:** API validates token, permissions, and request body.
4.  **Controller:** Calls Service layer.
5.  **Service:** Executes business logic, calls Database layer.
6.  **Database:** `better-sqlite3` executes synchronous SQL query against SQLite file.
7.  **Response:** JSON data returned to Client.
