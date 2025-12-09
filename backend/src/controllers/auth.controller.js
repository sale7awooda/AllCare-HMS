
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

exports.login = (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
    
    // Manual mapping to handle potential missing columns safely
    const safeUser = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || ''
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

exports.changePassword = (req, res) => {
  const { id } = req.user;
  const { currentPassword, newPassword } = req.body;
  
  try {
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(id);
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }
    
    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, id);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
