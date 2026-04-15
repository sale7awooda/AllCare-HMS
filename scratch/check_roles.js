
const sqlite3 = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/allcare.db');
const db = new sqlite3(dbPath);

const roles = db.prepare('SELECT DISTINCT role FROM users').all();
console.log('Roles in DB:', JSON.stringify(roles, null, 2));

const receptionistData = db.prepare('SELECT * FROM users WHERE role = "receptionist"').get();
console.log('Receptionist specimen:', JSON.stringify(receptionistData, null, 2));

const labData = db.prepare('SELECT * FROM users WHERE role LIKE "%lab%"').all();
console.log('Lab users:', JSON.stringify(labData, null, 2));
