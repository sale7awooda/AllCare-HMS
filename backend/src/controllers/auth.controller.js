
const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

const crypto = require('crypto');

exports.login = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    // Async compare prevents blocking the event loop
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ALLOWED_LOGIN_ROLES = ['admin', 'manager', 'receptionist', 'technician', 'accountant', 'coordinator'];
    if (!ALLOWED_LOGIN_ROLES.includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access Denied', 
        message: `Your role (${user.role}) is not authorized to access the system via this interface.` 
      });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is inactive. Contact admin.' });
    }

    // 15 minute access token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '15m' }
    );

    // 7 day refresh token
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(refreshToken, user.id, expiresAt);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

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

exports.refresh = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }

  try {
    const db = getDb();
    // Validate refresh token exists and is not expired
    const record = db.prepare('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP').get(refreshToken);
    
    if (!record) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Account is inactive or disabled' });
    }

    // Issue new short-lived access token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: '15m' }
    );

    res.json({ token });
  } catch (err) {
    console.error('Error during token refresh:', err);
    res.status(500).json({ error: 'Internal server error during token refresh' });
  }
};

exports.logout = (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    try {
      const db = getDb();
      db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
    } catch (err) {
      console.error('Error during logout:', err);
    }
  }
  
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

exports.me = (req, res) => {
  try {
    const db = getDb();
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
    const db = getDb();
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
    const db = getDb();
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
