const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');

router.use(authenticateToken);

// Billing
router.get('/', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('CREATE', 'billing'), billingController.create);
router.post('/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('UPDATE', 'billing'), billingController.recordPayment);
router.post('/:id/refund', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('UPDATE', 'billing'), billingController.processRefund);
router.post('/:id/cancel-service', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('UPDATE', 'billing'), billingController.cancelService);


module.exports = router;
