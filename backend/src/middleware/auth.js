const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev_secret_key_123';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Admin and Manager usually have access to most things
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Requires one of: ${allowedRoles.join(', ')}` });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles, SECRET };