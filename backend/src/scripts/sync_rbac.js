
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Path to the database
const dbPath = path.resolve(__dirname, '../../allcare.db');
// Path to permissions.json
const permissionsPath = path.resolve(__dirname, '../../../shared/permissions.json');

console.log('--- RBAC Sync Script ---');
console.log('Database:', dbPath);
console.log('Permissions:', permissionsPath);

if (!fs.existsSync(dbPath)) {
  console.error('Error: Database file not found.');
  process.exit(1);
}

if (!fs.existsSync(permissionsPath)) {
  console.error('Error: permissions.json not found.');
  process.exit(1);
}

const db = new Database(dbPath);
const rbacConfig = JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));

try {
  const syncTx = db.transaction(() => {
    // 1. Refresh role_permissions table
    console.log('Refreshing role_permissions table...');
    db.prepare('DELETE FROM role_permissions').run();
    const insertPerm = db.prepare('INSERT INTO role_permissions (role, permissions) VALUES (?, ?)');
    
    for (const [role, perms] of Object.entries(rbacConfig.ROLE_PERMISSIONS)) {
      console.log(`- Updating role: ${role} (${perms.length} permissions)`);
      insertPerm.run(role, JSON.stringify(perms));
    }

    // 2. Standardize 'technician' to 'lab_technician'
    console.log('Standardizing lab_technician roles in users and medical_staff...');
    const userUpdate = db.prepare("UPDATE users SET role = 'lab_technician' WHERE role = 'technician'").run();
    const staffUpdate = db.prepare("UPDATE medical_staff SET type = 'lab_technician' WHERE type = 'technician'").run();
    console.log(`- Updated ${userUpdate.changes} users.`);
    console.log(`- Updated ${staffUpdate.changes} staff members.`);

    // 3. Ensure accountant and coordinator have basic settings visibility
    // (This is already in the JSON, but we are enforcing it via the refresh above)
  });

  syncTx();
  console.log('--- Sync Completed Successfully ---');
} catch (error) {
  console.error('CRITICAL: Sync failed!', error);
} finally {
  db.close();
}
