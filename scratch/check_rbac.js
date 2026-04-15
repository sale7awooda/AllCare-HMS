const { ROLE_PERMISSIONS, Permissions } = require('../backend/src/utils/rbac_backend_mirror');

const user = { role: 'receptionist' };

const hasPermission = (user, permission) => {
  if (!user || !user.role) return false;
  
  if (user.role === 'admin') return true; 

  if (user.role === 'manager') {
    if (permission === Permissions.MANAGE_CONFIGURATION || (permission && permission.startsWith && permission.startsWith('DELETE_'))) { 
      return false;
    }
    return true; 
  }

  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
};

const canAccessRoute = (user, path) => {
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true;

  switch (path) {
    case '/': return hasPermission(user, Permissions.VIEW_SCREEN_DASHBOARD); 
    case '/patients': return hasPermission(user, Permissions.VIEW_SCREEN_PATIENTS);
    case '/appointments': return hasPermission(user, Permissions.VIEW_SCREEN_APPOINTMENTS);
    case '/admissions': return hasPermission(user, Permissions.VIEW_SCREEN_ADMISSIONS);
    case '/laboratory': return hasPermission(user, Permissions.VIEW_SCREEN_LABORATORY);
    case '/operations': return hasPermission(user, Permissions.VIEW_SCREEN_OPERATIONS);
    default: return false;
  }
};

console.log('Receptionist checks:');
console.log('/patients:', canAccessRoute(user, '/patients'));
console.log('/appointments:', canAccessRoute(user, '/appointments'));
console.log('/admissions:', canAccessRoute(user, '/admissions'));
console.log('/operations:', canAccessRoute(user, '/operations'));
console.log('Permissions keys:', Object.keys(Permissions).filter(k => k.startsWith('VIEW_SCREEN_')));
console.log('Receptionist perms:', ROLE_PERMISSIONS.receptionist);
