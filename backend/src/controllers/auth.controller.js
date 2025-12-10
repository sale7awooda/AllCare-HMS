
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    // Async compare prevents blocking the event loop
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Error during login process:', err);
    res.status(500).json({ error: 'Internal server error during login', message: err.message });
  }
};

exports.me = (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.sendStatus(404);
    
    // Explicit mapping with safe fallbacks
    const safeUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name || user.username || 'User', // Fallback
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      is_active: !!user.is_active
    };
    
    res.json(safeUser);
  } catch (err) {
    console.error('Error in auth.me:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

exports.updateProfile = (req, res) => {
  const { id } = req.user;
  const { fullName, email, phone } = req.body;
  try {
    db.prepare('UPDATE users SET full_name = ?, email = ?, phone = ? WHERE id = ?').run(fullName, email, phone, id);
    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  const { id } = req.user;
  const { currentPassword, newPassword } = req.body;
  
  try {
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(id);
    // Async compare
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }
    
    // Async hash
    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
