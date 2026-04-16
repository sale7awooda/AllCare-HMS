
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
const { getDb } = require('../config/database');

// Cache for role permissions to avoid excessive DB load
let permissionsCache = null;
let lastPermissionsFetch = 0;
const CACHE_TTL = 10000; // 10 seconds

const getRolePermissionsFromDB = (role) => {
  const now = Date.now();
  if (permissionsCache && (now - lastPermissionsFetch < CACHE_TTL)) {
    return permissionsCache[role] || null;
  }

  try {
    const db = getDb();
    if (!db) return null;

    // Load all permissions from the database
    const rows = db.prepare('SELECT role, permissions FROM role_permissions').all();
    const newCache = {};
    rows.forEach(row => {
      try {
        newCache[row.role] = JSON.parse(row.permissions);
      } catch (e) {
        newCache[row.role] = [];
      }
    });

    permissionsCache = newCache;
    lastPermissionsFetch = now;
    return permissionsCache[role] || null;
  } catch (e) {
    // Silently fallback to static permissions on DB error
    return null;
  }
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn(`[Auth] 401: Token missing for ${req.method} ${req.path}`);
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      const reason = err.name === 'TokenExpiredError' ? 'expired' : 'invalid';
      console.warn(`[Auth] 401: Token ${reason} for ${req.method} ${req.path}`);
      return res.status(401).json({ error: `Token ${reason}` });
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

    // For other roles, attempt to get permissions from DB first, then fallback to mirror
    const dbPermissions = getRolePermissionsFromDB(userRole);
    const userPermissions = dbPermissions || ROLE_PERMISSIONS[userRole] || [];
    const hasAnyRequiredPermission = requiredPermissions.some(perm => userPermissions.includes(perm));

    if (!hasAnyRequiredPermission) {
      return res.status(403).json({ error: 'Access denied: Insufficient permissions.' });
    }

    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, SECRET };
