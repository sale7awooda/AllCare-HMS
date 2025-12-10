
const jwt = require('jsonwebtoken');
// IMPORTANT: Set JWT_SECRET in production ENV
const SECRET = process.env.JWT_SECRET || 'dev_secret_key_123'; 

// Importing roles and permissions for backend enforcement logic
// Corrected to point to src/utils
const { ROLE_PERMISSIONS, Permissions } = require('../utils/rbac_backend_mirror'); 

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // Attach user payload to request
    next();
  });
};

// RBAC Permissions - Backend Enforcement
// This middleware now requires explicit Permission types.
// It relies on a mirrored ROLE_PERMISSIONS map on the backend.
const authorizeRoles = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied: User role not found.' });
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
        return next(); // Manager can do everything except config management and delete actions
      } else {
        return res.status(403).json({ error: `Access denied: Manager role cannot perform required permission(s): ${requiredPermissions.join(', ')}` });
      }
    }

    // For other roles, check if the user has *any* of the required permissions for the route
    const userPermissions = ROLE_PERMISSIONS[userRole] || [];
    const hasAnyRequiredPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasAnyRequiredPermission) {
      return res.status(403).json({ 
        error: `Access denied. Requires permission(s): ${requiredPermissions.join(', ')}.`,
        userRole: userRole, // For debugging
        userPermissions: userPermissions // For debugging
      });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, SECRET };
