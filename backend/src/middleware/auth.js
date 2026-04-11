
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Security: Require JWT_SECRET in production. Generate a random one-time secret for dev only.
const SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET environment variable is required in production. Exiting.');
    process.exit(1);
  }
  const devSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[Security] JWT_SECRET not set. Using random dev secret (sessions will not persist across restarts).');
  return devSecret;
})();

// Importing roles and permissions for backend enforcement logic
const { ROLE_PERMISSIONS, Permissions } = require('../utils/rbac_backend_mirror'); 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Token invalid or expired' });
    }
    req.user = user;
    next();
  });
};

// RBAC Permissions - Backend Enforcement
const authorizeRoles = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const userRole = req.user.role;

    // Admin always has all permissions
    if (userRole === 'admin') {
      return next();
    }

    // Manager has all permissions except 'MANAGE_CONFIGURATION' and DELETE actions
    if (userRole === 'manager') {
      const hasConfigManagementPerm = requiredPermissions.includes(Permissions.MANAGE_CONFIGURATION);
      const hasDeletePerm = requiredPermissions.some(p => p.startsWith('DELETE_'));

      if (!hasConfigManagementPerm && !hasDeletePerm) {
        return next();
      } else {
        return res.status(403).json({ error: 'Access denied: Insufficient permissions.' });
      }
    }

    // For other roles, check if the user has *any* of the required permissions for the route
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    const hasAnyRequiredPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasAnyRequiredPermission) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions.' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, SECRET };
