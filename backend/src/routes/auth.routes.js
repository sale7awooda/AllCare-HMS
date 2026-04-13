const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');

// Public
router.post('/login', validate(schemas.login), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

// Protected
router.use(authenticateToken);
router.get('/me', authController.me);
router.put('/profile', authController.updateProfile);
router.put('/password', validate(schemas.changePassword), authController.changePassword);

module.exports = router;
