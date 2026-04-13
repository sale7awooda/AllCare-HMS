/**
 * RBAC Startup Validator
 * Runs once on server start to catch any corruption or drift in permissions.json
 * before that bug affects a real user request.
 */

const { ROLE_PERMISSIONS, Permissions } = require('./rbac_backend_mirror');

const validateRbac = () => {
  const permissionValues = new Set(Object.values(Permissions));

  if (!ROLE_PERMISSIONS || typeof ROLE_PERMISSIONS !== 'object') {
    console.error('[RBAC] FATAL: ROLE_PERMISSIONS is missing or not an object.');
    process.exit(1);
  }

  let valid = true;

  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (!Array.isArray(perms)) {
      console.error(`[RBAC] Role "${role}" has a non-array permission list.`);
      valid = false;
      continue;
    }
    for (const perm of perms) {
      if (!permissionValues.has(perm)) {
        console.error(`[RBAC] Role "${role}" references unknown permission: "${perm}"`);
        valid = false;
      }
    }
  }

  if (!valid) {
    console.error('[RBAC] FATAL: permissions.json is inconsistent. Fix before running in production.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
  } else {
    console.log('[RBAC] Permissions validated OK.');
  }
};

module.exports = { validateRbac };
