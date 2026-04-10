
const { getDb } = require('../config/database');

exports.getAll = async (req, res) => {
  const userId = req.user.id;
  try {
    const db = getDb();
    const notifications = await db.all(`
      SELECT id, title, message, type, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const db = getDb();
    const result = await db.run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.changes === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  const userId = req.user.id;
  try {
    const db = getDb();
    await db.run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Helper for other controllers to create notifications
exports.createInternal = async (userId, title, message, type = 'info') => {
  try {
    const db = getDb();
    await db.run(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [userId, title, message, type]);
  } catch (err) {
    console.error('Failed to create internal notification:', err);
  }
};

// Helper to notify all users of a certain role
exports.notifyRole = async (role, title, message, type = 'info') => {
    try {
        const db = getDb();
        const users = await db.all('SELECT id FROM users WHERE role = ?', [role]);
        for (const user of users) {
            await db.run('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)', [user.id, title, message, type]);
        }
    } catch (err) {
        console.error('Failed to notify role:', err);
    }
};
