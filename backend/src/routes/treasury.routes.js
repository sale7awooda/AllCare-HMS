const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');

router.use(authenticateToken);

router.get('/transactions', authorizeRoles(Permissions.VIEW_BILLING), billingController.getTransactions);
router.post('/expenses', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('CREATE', 'expense'), billingController.addExpense);
router.put('/expenses/:id', authorizeRoles(Permissions.MANAGE_BILLING), auditLog('UPDATE', 'expense'), billingController.updateExpense);

module.exports = router;
