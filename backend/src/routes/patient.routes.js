const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { validate, schemas } = require('../middleware/validation');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');

router.use(authenticateToken);

router.get('/', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.get('/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.post('/', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), auditLog('CREATE', 'patient'), patientController.create);
router.put('/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), auditLog('UPDATE', 'patient'), patientController.update);

module.exports = router;
