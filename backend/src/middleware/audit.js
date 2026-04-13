const { getDb } = require('../config/database');

// Fields that must never be stored in the audit log
const SENSITIVE_FIELDS = new Set(['password', 'token', 'secret', 'refreshToken', 'confirmPassword']);

/**
 * Recursively sanitize an object, removing sensitive keys.
 */
const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [key, val] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    out[key] = typeof val === 'object' ? sanitize(val) : val;
  }
  return out;
};

/**
 * Middleware factory.
 * Usage:  router.post('/', authenticateToken, ..., auditLog('CREATE', 'patient'), controller.create)
 *
 * @param {string} action   - 'CREATE' | 'UPDATE' | 'DELETE'
 * @param {string} resource - Domain entity name, e.g. 'patient', 'billing'
 */
const auditLog = (action, resource) => (req, res, next) => {
  // Only log if user is authenticated (safety guard)
  if (!req.user) return next();

  try {
    const db = getDb();
    const payload = Object.keys(req.body || {}).length > 0
      ? JSON.stringify(sanitize(req.body))
      : null;

    db.prepare(`
      INSERT INTO audit_log (user_id, username, action, resource, resource_id, payload, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      req.user.username,
      action,
      resource,
      req.params.id ?? null,
      payload,
      req.ip ?? null
    );
  } catch (err) {
    // Audit failure must never break the request — log and continue
    console.error('[Audit] Failed to write audit log entry:', err.message);
  }

  next();
};

module.exports = { auditLog };
