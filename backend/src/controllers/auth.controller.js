const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { SECRET } = require('../middleware/auth');

exports.login = (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    
    if (!user || !user.password || !bcrypt.compareSync(password, user.password)) {
      // If user not found, or password field is missing/invalid, or password comparison fails
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
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error during login process:', err);
    res.status(500).json({ error: 'Internal server error during login', message: err.message });
  }
};

exports.me = (req, res) => {
  const user = db.prepare('SELECT id, username, full_name as fullName, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.sendStatus(404);
  res.json(user);
};