# System Architecture

## 1. Tech Stack

### Frontend
*   **Framework:** React 18+ (using hooks and functional components)
*   **Build Tool:** Vite
*   **Routing:** React Router v6
*   **State Management:** React Context API (`useContext`, `useState`, `useEffect`)
*   **Styling:** Tailwind CSS with dynamic theming via CSS variables
*   **HTTP Client:** Axios with interceptors for auth
*   **Charts & Visualization:** Recharts
*   **Icons:** Lucide React
*   **Internationalization (i18n):** Custom solution via React Context
*   **Theming:** Custom solution via React Context

### Backend
*   **Runtime:** Node.js
*   **Framework:** Express.js
*   **Database:** `better-sqlite3` for synchronous, high-performance SQLite access
*   **Authentication:** JWT (JSON Web Tokens) with role-based access control (RBAC)
*   **Middleware:** `cors`, `helmet` for security, `morgan` for logging, `multer` for file uploads
*   **Validation:** Zod for schema-based request validation

## 2. Project Structure

```text
/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection, initial schema
│   │   ├── controllers/     # Route logic for each module
│   │   ├── middleware/      # Auth (JWT), RBAC, validation (Zod)
│   │   ├── routes/          # API endpoint definitions
│   │   └── utils/           # RBAC permissions mirror, helpers
│   ├── server.js            # Main Express server entry point
│   └── allcare.db           # SQLite database file
│
├── docs/                    # System documentation
│
├── locales/                 # i18n JSON translation files (en.json, ar.json)
│
├── src/  (Conceptual Frontend Root)
│   ├── components/          # Reusable UI components (UI.tsx, Layout.tsx)
│   ├── context/             # Global state (ThemeContext, TranslationContext)
│   ├── pages/               # Top-level route components (Dashboard, Patients, etc.)
│   ├── services/            # API service layer (api.ts)
│   ├── utils/               # Utility functions, RBAC logic (rbac.ts)
│   ├── types.ts             # TypeScript type definitions
│   └── App.tsx              # Main application component with routing
│
├── index.html               # Main HTML entry point
├── index.tsx                # React application bootstrap
└── vite.config.js           # Vite configuration with proxy for backend
```

## 3. Data & Control Flow

1.  **Client Initialization:** `index.tsx` renders the `App` component, wrapping it in `TranslationProvider` and `ThemeProvider` to provide global context for language and UI appearance.
2.  **Authentication:**
    *   `App.tsx` checks for a JWT token in `localStorage`. If not found or invalid, it renders the `Login` page.
    *   User enters credentials on the `Login` page.
    *   `api.login()` sends a request to the backend's `/api/auth/login` endpoint.
    *   The backend's `auth.controller` validates credentials, generates a JWT, and returns it with user data.
    *   The token is stored in `localStorage`, and the user state is updated, triggering a re-render to the main `Layout`.
3.  **Authenticated Request:**
    *   A component (e.g., `Patients.tsx`) calls a function from `services/api.ts` (e.g., `api.getPatients()`).
    *   Axios interceptor automatically attaches the `Authorization: Bearer <token>` header.
    *   Request hits the Express backend API.
4.  **Backend Processing:**
    *   `auth` middleware (`authenticateToken`) verifies the JWT.
    *   `authorizeRoles` middleware checks if the user's role has the required permissions for the route (e.g., `VIEW_PATIENTS`).
    *   `validation` middleware (if applicable) uses Zod to validate the request body.
    *   The relevant controller (e.g., `patient.controller.js`) processes the request, interacts with the database via `better-sqlite3`, and returns a JSON response.
5.  **UI Rendering:**
    *   The React component receives data from the API call.
    *   It updates its state, causing a re-render with the new data.
    *   Components from `UI.tsx` are used to display data in a structured way (Cards, Tables, etc.).
    *   `useTranslation` hook provides localized strings based on the current language context.
    *   `useTheme` hook provides theme/accent information for styling.
