
import { User, Role } from './../types';

// Define granular permissions for all modules and actions, including DELETE
export const Permissions = {
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
  MANAGE_LABORATORY: 'MANAGE_LABORATORY', // Order new tests, update results
  DELETE_LABORATORY: 'DELETE_LABORATORY', // Delete lab requests/records
  
  VIEW_OPERATIONS: 'VIEW_OPERATIONS', // View operation schedule
  MANAGE_OPERATIONS: 'MANAGE_OPERATIONS', // Schedule operations, assign doctors, update details
  DELETE_OPERATIONS: 'DELETE_OPERATIONS', // Delete operation records
  
  VIEW_REPORTS: 'VIEW_REPORTS', // Access various system reports
  MANAGE_REPORTS: 'MANAGE_REPORTS', // Generate/export reports
  
  VIEW_SETTINGS: 'VIEW_SETTINGS', // View general application settings
  MANAGE_SETTINGS: 'MANAGE_SETTINGS', // Update general settings
  
  MANAGE_CONFIGURATION: 'MANAGE_CONFIGURATION', // Admin-level permission to manage user roles, permissions, departments etc.
} as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

// The Matrix: What each role can do
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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
    Permissions.MANAGE_CONFIGURATION // Full control
  ],
  manager: [ // Broad view and management
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
  technician: [ 
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS,
    Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, 
    Permissions.VIEW_OPERATIONS 
  ],
  accountant: [
    Permissions.VIEW_DASHBOARD, 
    Permissions.VIEW_PATIENTS, 
    Permissions.VIEW_APPOINTMENTS, 
    Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, 
    Permissions.VIEW_REPORTS, Permissions.MANAGE_REPORTS,
    Permissions.VIEW_SETTINGS
  ],
};

export const hasPermission = (user: User | null, permission: Permission): boolean => {
  if (!user || !user.role) return false;
  
  if (user.role === 'admin') return true; 

  if (user.role === 'manager') {
    if (permission === Permissions.MANAGE_CONFIGURATION || permission.startsWith('DELETE_')) { 
      return false;
    }
    return true; 
  }

  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
};

export const canAccessRoute = (user: User | null, path: string): boolean => {
  if (!user || !user.role) return false;
  
  if (user.role === 'admin') return true;

  if (user.role === 'manager' && path !== '/configuration') return true;

  switch (path) {
    case '/': return true; 
    case '/patients': return hasPermission(user, Permissions.VIEW_PATIENTS);
    case '/appointments': return hasPermission(user, Permissions.VIEW_APPOINTMENTS);
    case '/billing': return hasPermission(user, Permissions.VIEW_BILLING);
    case '/hr': return hasPermission(user, Permissions.VIEW_HR); 
    case '/admissions': return hasPermission(user, Permissions.VIEW_ADMISSIONS);
    case '/laboratory': return hasPermission(user, Permissions.VIEW_LABORATORY);
    case '/operations': return hasPermission(user, Permissions.VIEW_OPERATIONS);
    case '/reports': return hasPermission(user, Permissions.VIEW_REPORTS);
    case '/settings': return hasPermission(user, Permissions.VIEW_SETTINGS);
    case '/configuration': return hasPermission(user, Permissions.MANAGE_CONFIGURATION);
    default: return false; 
  }
};
