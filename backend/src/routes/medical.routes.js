const express = require('express');
const router = express.Router();
const medicalController = require('../controllers/medical.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { auditLog } = require('../middleware/audit');
const { validate, schemas } = require('../middleware/validation');

router.use(authenticateToken);

// Medical: Laboratory
router.get('/lab/requests', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests);
router.post('/lab/requests', authorizeRoles(Permissions.MANAGE_LABORATORY), validate(schemas.createLabRequest), auditLog('CREATE', 'lab_request'), medicalController.createLabRequest);
router.post('/lab/requests/:id/complete', authorizeRoles(Permissions.MANAGE_LABORATORY), validate(schemas.completeLabRequest), auditLog('UPDATE', 'lab_request'), medicalController.completeLabRequest);
router.post('/lab/requests/:id/confirm', authorizeRoles(Permissions.MANAGE_LABORATORY), auditLog('UPDATE', 'lab_request'), medicalController.confirmLabRequest);
router.post('/lab/requests/:id/reopen', authorizeRoles(Permissions.MANAGE_LABORATORY), auditLog('UPDATE', 'lab_request'), medicalController.reopenLabRequest);

// Medical: Nurse
router.get('/nurse/requests', authorizeRoles(Permissions.VIEW_DASHBOARD), medicalController.getNurseRequests);
router.post('/nurse/requests', authorizeRoles(Permissions.VIEW_DASHBOARD), validate(schemas.createNurseRequest), auditLog('CREATE', 'nurse_request'), medicalController.createNurseRequest);

// Medical: Operations
router.get('/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), medicalController.getScheduledOperations);
router.post('/operations', authorizeRoles(Permissions.MANAGE_OPERATIONS), validate(schemas.createOperation), auditLog('CREATE', 'operation'), medicalController.createOperation);
router.post('/operations/:id/process', authorizeRoles(Permissions.MANAGE_OPERATIONS), auditLog('UPDATE', 'operation'), medicalController.processOperationRequest);
router.post('/operations/:id/complete', authorizeRoles(Permissions.MANAGE_OPERATIONS), auditLog('UPDATE', 'operation'), medicalController.completeOperation);
router.post('/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), auditLog('UPDATE', 'operation'), medicalController.confirmOperation);

// Medical: Admissions
router.get('/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getActiveAdmissions);
router.get('/admissions/history', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getAdmissionsHistory);
router.get('/admissions/:id', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getInpatientDetails);
router.post('/admissions', authorizeRoles(Permissions.MANAGE_ADMISSIONS), validate(schemas.createAdmission), auditLog('CREATE', 'admission'), medicalController.createAdmission);
router.post('/admissions/:id/confirm', authorizeRoles(Permissions.MANAGE_ADMISSIONS), auditLog('UPDATE', 'admission'), medicalController.confirmAdmission);
router.put('/admissions/:id/cancel', authorizeRoles(Permissions.MANAGE_ADMISSIONS), auditLog('DELETE', 'admission'), medicalController.cancelAdmission);
router.post('/admissions/:id/notes', authorizeRoles(Permissions.MANAGE_ADMISSIONS), validate(schemas.addInpatientNote), auditLog('CREATE', 'admission_note'), medicalController.addInpatientNote);
router.post('/admissions/:id/discharge', authorizeRoles(Permissions.MANAGE_ADMISSIONS), auditLog('UPDATE', 'admission'), medicalController.dischargePatient);
router.post('/admissions/:id/generate-settlement', authorizeRoles(Permissions.MANAGE_ADMISSIONS), auditLog('CREATE', 'billing'), medicalController.generateSettlementBill);
router.put('/admissions/beds/:id/clean', authorizeRoles(Permissions.MANAGE_ADMISSIONS), auditLog('UPDATE', 'bed'), medicalController.markBedClean);

module.exports = router;
