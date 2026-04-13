import { User, Role } from '../types';
import rbacConfig from '../shared/permissions.json';

// Define granular permissions for all modules and actions, including DELETE
export const Permissions = rbacConfig.Permissions as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

// The Matrix: What each role can do
const ROLE_PERMISSIONS: Record<Role, Permission[]> = rbacConfig.ROLE_PERMISSIONS as Record<Role, Permission[]>;

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
    case '/records': return hasPermission(user, Permissions.VIEW_RECORDS);
    case '/customizations': return hasPermission(user, Permissions.VIEW_SETTINGS);
    case '/configuration': return hasPermission(user, Permissions.MANAGE_CONFIGURATION);
    default: return false; 
  }
};
