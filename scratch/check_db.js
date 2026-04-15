const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '../backend/allcare.db');
const db = new Database(dbPath);

console.log('--- User Roles ---');
const roles = db.prepare('SELECT role, count(*) as count FROM users GROUP BY role').all();
console.log(roles);

console.log('\n--- Role Permissions Count ---');
const perms = db.prepare('SELECT role, length(permissions) as len FROM role_permissions').all();
console.log(perms);

console.log('\n--- Medical Staff Types ---');
const staff = db.prepare('SELECT type, count(*) as count FROM medical_staff GROUP BY type').all();
console.log(staff);

db.close();
