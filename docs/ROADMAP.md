# AllCare HMS - Development Roadmap

## Phase 1: Core Foundation & Patient Management (Completed)
*   **Goal:** Establish the project structure, user access, and core patient registry.
*   **Status:** ✅ **Done**
*   **Key Features Implemented:**
    *   **Project Setup:** Vite (React) and Express (Node.js) boilerplate.
    *   **Database:** SQLite setup with `better-sqlite3`.
    *   **Authentication:** JWT-based login system with a secure backend.
    *   **RBAC:** Implemented a granular permission system for roles.
    *   **Patient Module:** Full CRUD functionality for patient records.
    *   **Basic Layout:** Created the main sidebar, header, and content layout.

## Phase 2: Clinical Workflow Implementation (Completed)
*   **Goal:** Build out the primary clinical modules for day-to-day operations.
*   **Status:** ✅ **Done**
*   **Key Features Implemented:**
    *   **Appointment Module:** Developed the real-time queue view and list view for managing appointments.
    *   **Billing Module:** Implemented invoice creation, payment processing, and automatic status updates.
    *   **Admissions Module:** Created the visual ward dashboard for managing inpatient admissions from reservation to discharge.
    *   **Medical Services:** Built workflows for Laboratory and Operations requests.

## Phase 3: Administrative & Management Modules (Completed)
*   **Goal:** Add modules for hospital administration and staff management.
*   **Status:** ✅ **Done**
*   **Key Features Implemented:**
    *   **HR Module:** Full suite including staff directory, attendance, leaves, payroll, and financial adjustments.
    *   **Configuration Panel:** A comprehensive admin section to manage all system parameters, from users and roles to medical catalogs and data backups.
    *   **Settings Page:** User-specific settings for profile management and UI customization.

## Phase 4: Analytics, UI Polish & Internationalization (Completed)
*   **Goal:** Enhance user experience, provide data insights, and make the application globally accessible.
*   **Status:** ✅ **Done**
*   **Key Features Implemented:**
    *   **Dashboard:** Built a dynamic dashboard with key performance indicators and charts.
    *   **Reports Module:** Created a dedicated analytics page with financial, operational, and demographic reports.
    *   **Records Module:** Developed a unified, searchable log of all system activities.
    *   **Theming:** Implemented dark/light mode, accent colors, density, and font size controls.
    *   **Internationalization (i18n):** Added full support for English and Arabic, including RTL layouts.
    *   **UI Enhancements:** Refined component styling, added smooth animations, and improved user feedback mechanisms (modals, toasts, loaders).

## Phase 5: Advanced Features & Future Enhancements (Planned)
*   **Goal:** Integrate advanced technologies and expand module capabilities.
*   **Status:** 📝 **In Planning**
*   **Potential Features:**
    *   **AI Assistant:** Integrate a conversational AI (powered by Gemini) to help users with tasks like summarizing patient data, finding information, or generating quick reports.
    *   **Pharmacy & Inventory Module:** A new module to manage medication stock, prescriptions, and dispensary sales.
    *   **Real-time Notifications:** Implement a WebSocket or SSE solution for real-time push notifications for events like new appointments or critical lab results.
    *   **Third-Party Integrations:** API integrations with external accounting software, insurance portals, or lab equipment.
    *   **Patient Portal:** A separate, secure web application for patients to view their records, book appointments, and pay bills.
    *   **Enhanced Reporting:** More complex, customizable report generation with advanced filtering and visualization options.
    *   **Telemedicine Module:** Integration of video conferencing tools for remote consultations.
