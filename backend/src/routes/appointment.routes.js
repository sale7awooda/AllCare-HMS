const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');

router.use(authenticateToken);

router.get('/', authorizeRoles(Permissions.VIEW_APPOINTMENTS), appointmentController.getAll);
router.post('/', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), auditLog('CREATE', 'appointment'), appointmentController.create);
router.put('/:id', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), auditLog('UPDATE', 'appointment'), appointmentController.update);
router.put('/:id/status', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), auditLog('UPDATE', 'appointment'), appointmentController.updateStatus);
router.put('/:id/cancel', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), auditLog('DELETE', 'appointment'), appointmentController.cancel);

module.exports = router;
