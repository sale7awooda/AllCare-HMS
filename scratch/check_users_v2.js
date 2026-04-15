const Database = require('../backend/node_modules/better-sqlite3');
const db = new Database('./backend/allcare.db');

console.log('--- USERS ---');
const users = db.prepare('SELECT id, username, role FROM users').all();
console.log(users);

db.close();
