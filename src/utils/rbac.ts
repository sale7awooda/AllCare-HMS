import { User } from '../types';

export type Role = 'admin' | 'manager' | 'receptionist' | 'accountant' | 'technician';

// Define granular permissions
export type Permission = 
  | 'VIEW_DASHBOARD'
  | 'VIEW_PATIENTS'
  | 'MANAGE_PATIENTS' // Create/Edit/Delete
  | 'VIEW_APPOINTMENTS'
  | 'MANAGE_APPOINTMENTS'
  | 'VIEW_BILLING'
  | 'MANAGE_BILLING'
  | 'VIEW_STAFF'
  | 'MANAGE_STAFF';

// The Matrix: What each role can do
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'VIEW_DASHBOARD', 'VIEW_PATIENTS', 'MANAGE_PATIENTS', 
    'VIEW_APPOINTMENTS', 'MANAGE_APPOINTMENTS', 
    'VIEW_BILLING', 'MANAGE_BILLING', 
    'VIEW_STAFF', 'MANAGE_STAFF'
  ],
  manager: [
    'VIEW_DASHBOARD', 'VIEW_PATIENTS', 'MANAGE_PATIENTS', 
    'VIEW_APPOINTMENTS', 'MANAGE_APPOINTMENTS', 
    'VIEW_BILLING', 'MANAGE_BILLING', 
    'VIEW_STAFF', 'MANAGE_STAFF'
  ],
  receptionist: [
    'VIEW_DASHBOARD', 'VIEW_PATIENTS', 'MANAGE_PATIENTS', 
    'VIEW_APPOINTMENTS', 'MANAGE_APPOINTMENTS', 
    'VIEW_BILLING' 
    // Cannot Manage Billing, Cannot View/Manage Staff
  ],
  accountant: [
    'VIEW_DASHBOARD', 'VIEW_PATIENTS', 'VIEW_APPOINTMENTS', 
    'VIEW_BILLING', 'MANAGE_BILLING'
    // Cannot Manage Patients/Appointments, Cannot View/Manage Staff
  ],
  technician: [
    'VIEW_DASHBOARD', 'VIEW_PATIENTS', 'VIEW_APPOINTMENTS' 
    // Read only mostly
  ]
};

/**
 * Checks if a user has a specific permission.
 */
export const hasPermission = (user: User | null, permission: Permission): boolean => {
  if (!user) return false;
  const userPermissions = ROLE_PERMISSIONS[user.role as Role] || [];
  return userPermissions.includes(permission);
};

/**
 * Checks if a user has access to a specific route/module.
 * Used primarily for Sidebar logic.
 */
export const canAccessRoute = (user: User | null, path: string): boolean => {
  if (!user) return false;
  
  // Admin and Manager can access everything
  if (user.role === 'admin' || user.role === 'manager') return true;

  switch (path) {
    case '/': return true; // Everyone sees dashboard
    case '/patients': return hasPermission(user, 'VIEW_PATIENTS');
    case '/appointments': return hasPermission(user, 'VIEW_APPOINTMENTS');
    case '/billing': return hasPermission(user, 'VIEW_BILLING');
    case '/staff': return hasPermission(user, 'VIEW_STAFF');
    default: return true;
  }
};