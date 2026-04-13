const { getDb } = require('../config/database');

/**
 * GET /api/config/audit-log
 * Admin-only. Paginated, filterable audit trail.
 */
exports.getAuditLog = (req, res) => {
  try {
    const db = getDb();

    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(100, parseInt(req.query.limit) || 25);
    const offset  = (page - 1) * limit;

    // Build optional filters
    const conditions = [];
    const params     = [];

    if (req.query.user_id) {
      conditions.push('user_id = ?');
      params.push(parseInt(req.query.user_id));
    }
    if (req.query.username) {
      conditions.push('username LIKE ?');
      params.push(`%${req.query.username}%`);
    }
    if (req.query.resource) {
      conditions.push('resource = ?');
      params.push(req.query.resource);
    }
    if (req.query.action) {
      conditions.push('action = ?');
      params.push(req.query.action.toUpperCase());
    }
    if (req.query.from) {
      conditions.push('created_at >= ?');
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push('created_at <= ?');
      params.push(req.query.to);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM audit_log ${where}`).get(...params).count;
    const rows  = db.prepare(
      `SELECT id, user_id, username, action, resource, resource_id, payload, ip_address, created_at
       FROM audit_log ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    res.json({
      data:  rows,
      meta:  { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('[AuditController] Error fetching audit log:', err);
    res.status(500).json({ error: 'Failed to retrieve audit log.' });
  }
};
