const { ROLE_PERMISSIONS } = require('../utils/rbac_backend_mirror');

exports.up = (db) => {
  console.log('[Migration 003] Synchronizing permissions and standardizing roles...');

  const migrationTx = db.transaction(() => {
    // 1. Standardize Role Names in Users table
    // Move all 'technician' users to 'lab_technician'
    db.prepare("UPDATE users SET role = 'lab_technician' WHERE role = 'technician'").run();
    
    // 2. Standardize Role Names in medical_staff table
    db.prepare("UPDATE medical_staff SET type = 'lab_technician' WHERE type = 'technician'").run();
    
    // 3. Refresh role_permissions table with the latest from permissions.json
    db.prepare('DELETE FROM role_permissions').run();
    const insertPerm = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      insertPerm.run(role, JSON.stringify(perms));
    }
  });

  migrationTx();
  console.log('[Migration 003] Finished successfully.');
};
