const rbacConfig = require('./shared/permissions.json');
const ROLE_PERMISSIONS = rbacConfig.ROLE_PERMISSIONS;
const Permissions = rbacConfig.Permissions;

const hasPermission = (user, permission) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'manager') {
    if (String(permission).startsWith('DELETE_')) {
      return false;
    }
    return true; 
  }
  
  const roleKey = user.role;
  const userPermissions = ROLE_PERMISSIONS[roleKey] || [];
  const result = userPermissions.includes(String(permission));
  console.log(`Checking ${user.role} for ${permission}: ${result}`);
  return result;
};

const user = { role: 'receptionist' };
hasPermission(user, Permissions.MANAGE_PATIENTS);
hasPermission(user, 'MANAGE_PATIENTS');
console.log('Keys in ROLE_PERMISSIONS:', Object.keys(ROLE_PERMISSIONS));
