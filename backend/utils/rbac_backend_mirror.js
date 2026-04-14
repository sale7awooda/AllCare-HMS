const path = require('path');
const fs = require('fs');

// Path to shared permissions
const sharedPermissionsPath = path.resolve(__dirname, '../../shared/permissions.json');

let permissionsData;
try {
  permissionsData = JSON.parse(fs.readFileSync(sharedPermissionsPath, 'utf8'));
} catch (error) {
  console.error('Error loading permissions:', error);
  // Fallback to empty if file missing (should not happen in production)
  permissionsData = { Permissions: {}, ROLE_PERMISSIONS: {} };
}

const { Permissions, ROLE_PERMISSIONS } = permissionsData;

module.exports = { ROLE_PERMISSIONS, Permissions };
