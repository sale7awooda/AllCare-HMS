import { User, Role } from '../types';
// @ts-ignore - Handle JSON import correctly in different build environments
import rbacConfigRaw from '../shared/permissions.json';

interface RbacConfig {
  Permissions: Record<string, string>;
  ROLE_PERMISSIONS: Record<string, string[]>;
}

const rbacConfig = rbacConfigRaw as unknown as RbacConfig;

// Define granular permissions for all modules and actions
export const Permissions = rbacConfig.Permissions;

export type Permission = string;

// The Matrix: What each role can do
const ROLE_PERMISSIONS = rbacConfig.ROLE_PERMISSIONS;

export const hasPermission = (user: { role: Role } | null, permission: Permission): boolean => {
  if (!user || !user.role) return false;
  
  const userRole = String(user.role).toLowerCase();

  if (userRole === 'admin') return true; 

  if (userRole === 'manager') {
    // Managers can't access configuration or perform deletes
    const permStr = String(permission);
    if (permStr === Permissions.MANAGE_CONFIGURATION || permStr.startsWith('DELETE_')) { 
      return false;
    }
    return true; 
  }

  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
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

