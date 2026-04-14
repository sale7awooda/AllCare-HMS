const { ROLE_PERMISSIONS, Permissions } = require('./rbac_backend_mirror');
const { getDb } = require('../config/database');

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
    console.error('[RBAC] FATAL: permission matrix is inconsistent.');
    if (process.env.NODE_ENV === 'production') process.exit(1);
    return;
  }

  // Synchronize with Database
  try {
    const db = getDb();
    if (db) {
      const insertOrUpdate = db.prepare('INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)');
      const syncTx = db.transaction(() => {
        for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
          insertOrUpdate.run(role, JSON.stringify(perms));
        }
      });
      syncTx();
      console.log('[RBAC] Database permissions synchronized with shared matrix.');
    }
  } catch (err) {
    console.error('[RBAC] Warning: Failed to sync permissions to DB:', err.message);
  }
};

module.exports = { validateRbac };
