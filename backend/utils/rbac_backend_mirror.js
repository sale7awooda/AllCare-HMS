
// This file is a mirror of the frontend's src/utils/rbac.ts for backend (Node.js) consumption.
// It defines roles and granular permissions to ensure consistent access control logic.

// Define granular permissions for all modules and actions, including DELETE
// Must match frontend src/utils/rbac.ts Permission type
const Permissions = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  
  VIEW_PATIENTS: 'VIEW_PATIENTS',
  MANAGE_PATIENTS: 'MANAGE_PATIENTS', // Create/Update patient details
  DELETE_PATIENTS: 'DELETE_PATIENTS', // Delete patient records
  
  VIEW_APPOINTMENTS: 'VIEW_APPOINTMENTS',
  MANAGE_APPOINTMENTS: 'MANAGE_APPOINTMENTS', // Schedule/update appointments
  DELETE_APPOINTMENTS: 'DELETE_APPOINTMENTS', // Delete appointments
  
  VIEW_BILLING: 'VIEW_BILLING',
  MANAGE_BILLING: 'MANAGE_BILLING', // Create/update/process payments
  DELETE_BILLING: 'DELETE_BILLING', // Delete billing records
  
  VIEW_HR: 'VIEW_HR', // View Human Resources (Staff) list
  MANAGE_HR: 'MANAGE_HR', // Add/Update staff, manage availability
  DELETE_HR: 'DELETE_HR', // Delete staff records
  
  VIEW_ADMISSIONS: 'VIEW_ADMISSIONS', // View patient admissions/beds
  MANAGE_ADMISSIONS: 'MANAGE_ADMISSIONS', // Admit/Discharge patients, assign beds
  DELETE_ADMISSIONS: 'DELETE_ADMISSIONS', // Delete admission records
  
  VIEW_LABORATORY: 'VIEW_LABORATORY', // View lab tests & requests
  MANAGE_LABORATORY: 'MANAGE_LABORATORY', // Order new tests, update results (future)
  DELETE_LABORATORY: 'DELETE_LABORATORY', // Delete lab requests/records
  
  VIEW_OPERATIONS: 'VIEW_OPERATIONS', // View operation schedule
  MANAGE_OPERATIONS: 'MANAGE_OPERATIONS', // Schedule operations, assign doctors, update details
  DELETE_OPERATIONS: 'DELETE_OPERATIONS', // Delete operation records
  
  VIEW_REPORTS: 'VIEW_REPORTS', // Access various system reports
  MANAGE_REPORTS: 'MANAGE_REPORTS', // Generate/export reports
  
  VIEW_SETTINGS: 'VIEW_SETTINGS', // View general application settings
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', // Update general settings
  
  MANAGE_CONFIGURATION: 'MANAGE_CONFIGURATION', // Admin-level permission to manage user roles, permissions, departments etc.
};

// The Matrix: What each role can do (must match frontend src/utils/rbac.ts ROLE_PERMISSIONS)
const ROLE_PERMISSIONS = {
  admin: [
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, Permissions.DELETE_PATIENTS,
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, Permissions.DELETE_APPOINTMENTS, 
    Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, Permissions.DELETE_BILLING, 
    Permissions.VIEW_HR, Permissions.MANAGE_HR, Permissions.DELETE_HR,
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, Permissions.DELETE_ADMISSIONS,
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, Permissions.DELETE_LABORATORY,
    Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS, Permissions.DELETE_OPERATIONS,
    Permissions.VIEW_REPORTS, Permissions.MANAGE_REPORTS,
    Permissions.VIEW_SETTINGS, Permissions.MANAGE_SETTINGS,
    Permissions.MANAGE_CONFIGURATION
  ],
  manager: [ // Broad view and management, but no configuration management or direct DELETE
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, 
    Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, 
    Permissions.VIEW_HR, Permissions.MANAGE_HR,
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, 
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, // Managers can oversee lab/ops
    Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS, 
    Permissions.VIEW_REPORTS, Permissions.MANAGE_REPORTS,
    Permissions.VIEW_SETTINGS, Permissions.MANAGE_SETTINGS,
    // No DELETE permissions or MANAGE_CONFIGURATION
  ],
  receptionist: [
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, 
    Permissions.VIEW_BILLING, 
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, 
    Permissions.VIEW_HR,
    // Expanded permissions for Receptionist to handle requests
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY,
    Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS
  ],
  accountant: [
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, 
    Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, 
    Permissions.VIEW_REPORTS, Permissions.MANAGE_REPORTS
  ],
  technician: [ 
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, 
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, 
    Permissions.VIEW_OPERATIONS 
  ],
  doctor: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_PATIENTS,
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS,
    Permissions.VIEW_LABORATORY,
    Permissions.VIEW_OPERATIONS,
    Permissions.VIEW_ADMISSIONS,
    Permissions.VIEW_SETTINGS,
  ],
  nurse: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_PATIENTS,
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS,
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS,
    Permissions.VIEW_LABORATORY,
    Permissions.VIEW_OPERATIONS, // Added view operations for reference
    Permissions.VIEW_SETTINGS,
  ],
  pharmacist: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_PATIENTS,
    Permissions.VIEW_BILLING,
    Permissions.VIEW_LABORATORY,
    Permissions.VIEW_SETTINGS,
  ],
  hr: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_HR, Permissions.MANAGE_HR,
    Permissions.VIEW_REPORTS,
    Permissions.VIEW_SETTINGS,
  ],
};

module.exports = { ROLE_PERMISSIONS, Permissions };
