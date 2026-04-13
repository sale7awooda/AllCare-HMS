const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');

router.use(authenticateToken);

router.get('/', authorizeRoles(Permissions.VIEW_HR), staffController.getAll);
router.post('/', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.createStaff), auditLog('CREATE', 'staff'), staffController.create);
router.put('/:id', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.updateStaff), auditLog('UPDATE', 'staff'), staffController.update);

// HR Extended Features
router.get('/attendance', authorizeRoles(Permissions.VIEW_HR), staffController.getAttendance);
router.post('/attendance', authorizeRoles(Permissions.MANAGE_HR), auditLog('CREATE', 'attendance'), staffController.markAttendance);

router.get('/leaves', authorizeRoles(Permissions.VIEW_HR), staffController.getLeaves);
router.post('/leaves', authorizeRoles(Permissions.VIEW_HR), auditLog('CREATE', 'leave'), staffController.requestLeave); 
router.put('/leaves/:id', authorizeRoles(Permissions.MANAGE_HR), auditLog('UPDATE', 'leave'), staffController.updateLeaveStatus);

router.get('/payroll', authorizeRoles(Permissions.VIEW_HR), staffController.getPayroll);
router.post('/payroll/generate', authorizeRoles(Permissions.MANAGE_HR), auditLog('CREATE', 'payroll'), staffController.generatePayroll);
router.put('/payroll/:id/status', authorizeRoles(Permissions.MANAGE_HR), auditLog('UPDATE', 'payroll'), staffController.updatePayrollStatus);

router.get('/financials', authorizeRoles(Permissions.VIEW_HR), staffController.getFinancials);
router.post('/financials', authorizeRoles(Permissions.MANAGE_HR), auditLog('CREATE', 'staff_financial'), staffController.addAdjustment);
router.put('/financials/:id/status', authorizeRoles(Permissions.MANAGE_HR), auditLog('UPDATE', 'staff_financial'), staffController.updateFinancialStatus);

module.exports = router;
