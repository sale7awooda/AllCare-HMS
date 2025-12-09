
// This file is a mirror of the frontend's src/utils/rbac.ts for backend (Node.js) consumption.

const Permissions = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD',
  
  VIEW_PATIENTS: 'VIEW_PATIENTS',
  MANAGE_PATIENTS: 'MANAGE_PATIENTS', 
  DELETE_PATIENTS: 'DELETE_PATIENTS', 
  
  VIEW_APPOINTMENTS: 'VIEW_APPOINTMENTS',
  MANAGE_APPOINTMENTS: 'MANAGE_APPOINTMENTS', 
  DELETE_APPOINTMENTS: 'DELETE_APPOINTMENTS', 
  
  VIEW_BILLING: 'VIEW_BILLING',
  MANAGE_BILLING: 'MANAGE_BILLING', 
  DELETE_BILLING: 'DELETE_BILLING', 
  
  VIEW_HR: 'VIEW_HR', 
  MANAGE_HR: 'MANAGE_HR', 
  DELETE_HR: 'DELETE_HR', 
  
  VIEW_ADMISSIONS: 'VIEW_ADMISSIONS', 
  MANAGE_ADMISSIONS: 'MANAGE_ADMISSIONS', 
  DELETE_ADMISSIONS: 'DELETE_ADMISSIONS', 
  
  VIEW_LABORATORY: 'VIEW_LABORATORY', 
  MANAGE_LABORATORY: 'MANAGE_LABORATORY', 
  DELETE_LABORATORY: 'DELETE_LABORATORY', 
  
  VIEW_OPERATIONS: 'VIEW_OPERATIONS', 
  MANAGE_OPERATIONS: 'MANAGE_OPERATIONS', 
  DELETE_OPERATIONS: 'DELETE_OPERATIONS', 
  
  VIEW_REPORTS: 'VIEW_REPORTS', 
  MANAGE_REPORTS: 'MANAGE_REPORTS', 
  
  VIEW_SETTINGS: 'VIEW_SETTINGS', 
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', 
  
  MANAGE_CONFIGURATION: 'MANAGE_CONFIGURATION', 
};

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
  manager: [ 
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, 
    Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, 
    Permissions.VIEW_HR, Permissions.MANAGE_HR,
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, 
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, 
    Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS, 
    Permissions.VIEW_REPORTS, Permissions.MANAGE_REPORTS,
    Permissions.VIEW_SETTINGS, Permissions.MANAGE_SETTINGS,
  ],
  receptionist: [
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, 
    Permissions.VIEW_BILLING, 
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, 
    Permissions.VIEW_HR,
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
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, 
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, 
    Permissions.VIEW_OPERATIONS 
  ],
  doctor: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS,
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS,
    Permissions.VIEW_LABORATORY,
    Permissions.VIEW_OPERATIONS,
    Permissions.VIEW_ADMISSIONS,
    Permissions.VIEW_SETTINGS,
  ],
  nurse: [
    Permissions.VIEW_DASHBOARD,
    Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS,
    Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS,
    Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS,
    Permissions.VIEW_LABORATORY,
    Permissions.VIEW_OPERATIONS, 
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
