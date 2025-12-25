
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const userId = req.user.id;
  try {
    const notifications = db.prepare(`
      SELECT id, title, message, type, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const result = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllAsRead = (req, res) => {
  const userId = req.user.id;
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper for other controllers to create notifications
exports.createInternal = (userId, title, message, type = 'info') => {
  try {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `).run(userId, title, message, type);
  } catch (err) {
    console.error('Failed to create internal notification:', err);
  }
};

// Helper to notify all users of a certain role
exports.notifyRole = (role, title, message, type = 'info') => {
    try {
        const users = db.prepare('SELECT id FROM users WHERE role = ?').all(role);
        const stmt = db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)');
        for (const user of users) {
            stmt.run(user.id, title, message, type);
        }
    } catch (err) {
        console.error('Failed to notify role:', err);
    }
};
