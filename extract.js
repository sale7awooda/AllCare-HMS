const fs = require('fs');
const path = require('path');

const dbContent = fs.readFileSync(path.join(__dirname, 'backend', 'src', 'config', 'database.js'), 'utf-8');

// The DB schema is between '// --- Core Tables ---' and '// 1. RBAC Permissions'
const schemaStart = dbContent.indexOf('// --- Core Tables ---');
const schemaEnd = dbContent.indexOf('const seedData = () => {');

const schemaLines = dbContent.substring(schemaStart, schemaEnd).replace('console.log(\'[Database] Verifying schema...\');', '').trim();

let schemaOutput = `exports.up = (db) => {\n${schemaLines}\n};\n`;
// Remove last `seedData();};` which is part of schema lines end
schemaOutput = schemaOutput.replace(/seedData\(\);\s*\};\s*$/, '');

const seedStart = dbContent.indexOf('const seedData = () => {') + 'const seedData = () => {'.length;
const seedEnd = dbContent.indexOf('console.log(\'[Seed] Database initialization complete.\');');

const seedLines = dbContent.substring(seedStart, seedEnd).trim();
const seedOutput = `const { ROLE_PERMISSIONS } = require('../../utils/rbac_backend_mirror');\n\nexports.up = (db) => {\n${seedLines}\n};\n`;

fs.writeFileSync(path.join(__dirname, 'backend', 'src', 'migrations', '001_initial_schema.js'), schemaOutput);
fs.writeFileSync(path.join(__dirname, 'backend', 'src', 'migrations', '002_seed_initial_data.js'), seedOutput);
console.log('Done extracting scripts');
