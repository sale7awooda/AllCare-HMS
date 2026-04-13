// This file is a mirror of the frontend's src/utils/rbac.ts for backend (Node.js) consumption.

const rbacConfig = require('../../../shared/permissions.json');

const Permissions = rbacConfig.Permissions;
const ROLE_PERMISSIONS = rbacConfig.ROLE_PERMISSIONS;

module.exports = { ROLE_PERMISSIONS, Permissions };
