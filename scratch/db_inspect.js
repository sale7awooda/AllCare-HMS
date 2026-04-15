const Database = require('better-sqlite3');
const db = new Database('./backend/hms.db');

console.log('--- USERS ---');
const users = db.prepare('SELECT id, username, role FROM users').all();
console.log(users);

console.log('\n--- BILLING RECORDS COUNT ---');
const bills = db.prepare('SELECT COUNT(*) as count FROM bills').get();
console.log(bills);

console.log('\n--- APPOINTMENTS RECORDS COUNT ---');
const appointments = db.prepare('SELECT COUNT(*) as count FROM appointments').get();
console.log(appointments);

console.log('\n--- ROLE_PERMISSIONS TABLE HEAD ---');
try {
  const rolePerms = db.prepare('SELECT role, permission FROM role_permissions LIMIT 10').all();
  console.log(rolePerms);
} catch (e) {
  console.log('role_permissions table does not exist or error:', e.message);
}

db.close();
