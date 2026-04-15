import { User, Role } from '../types';
import rbacConfig from '../shared/permissions.json';

// Define granular permissions for all modules and actions, including DELETE
export const Permissions = rbacConfig.Permissions as const;

export type Permission = typeof Permissions[keyof typeof Permissions];

// The Matrix: What each role can do
const ROLE_PERMISSIONS = rbacConfig.ROLE_PERMISSIONS as Record<string, string[]>;

export const hasPermission = (user: { role: Role } | null, permission: Permission): boolean => {
  if (!user || !user.role) return false;
  
  if (user.role === 'admin') return true; 

  if (user.role === 'manager') {
    // Managers can't access configuration or perform deletes
    const permStr = String(permission);
    if (permStr === Permissions.MANAGE_CONFIGURATION || permStr.startsWith('DELETE_')) { 
      return false;
    }
    return true; 
  }

  const roleKey = user.role as string;
  const userPermissions = ROLE_PERMISSIONS[roleKey] || [];
  return userPermissions.includes(String(permission));
};

export const canAccessRoute = (user: User | null, path: string): boolean => {
  if (!user || !user.role) return false;
  
  // Admin maintains full system access as a failsafe
  if (user.role === 'admin') return true;

  switch (path) {
    case '/': return hasPermission(user, Permissions.VIEW_SCREEN_DASHBOARD); 
    case '/patients': return hasPermission(user, Permissions.VIEW_SCREEN_PATIENTS);
    case '/appointments': return hasPermission(user, Permissions.VIEW_SCREEN_APPOINTMENTS);
    case '/billing': return hasPermission(user, Permissions.VIEW_SCREEN_BILLING);
    case '/hr': return hasPermission(user, Permissions.VIEW_SCREEN_HR); 
    case '/admissions': return hasPermission(user, Permissions.VIEW_SCREEN_ADMISSIONS);
    case '/laboratory': return hasPermission(user, Permissions.VIEW_SCREEN_LABORATORY);
    case '/operations': return hasPermission(user, Permissions.VIEW_SCREEN_OPERATIONS);
    case '/reports': return hasPermission(user, Permissions.VIEW_SCREEN_REPORTS);
    case '/records': return hasPermission(user, Permissions.VIEW_SCREEN_RECORDS);
    case '/customizations': return hasPermission(user, Permissions.VIEW_SCREEN_SETTINGS);
    case '/configuration': return hasPermission(user, Permissions.VIEW_SCREEN_CONFIGURATION);
    default: return false;
  }
};

export const getDefaultRoute = (role: string | undefined): string => {
  if (!role) return '/';
  
  switch (role) {
    case 'admin':
    case 'manager':
      return '/';
    case 'receptionist':
      return '/patients';
    case 'lab_technician':
      return '/laboratory';
    case 'accountant':
      return '/billing';
    case 'coordinator':
      return '/appointments';
    default:
      return '/';
  }
};

