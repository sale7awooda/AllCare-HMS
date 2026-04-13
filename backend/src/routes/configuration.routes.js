const express = require('express');
const router = express.Router();
const multer = require('multer');
// Security: Limit upload size to 50MB to prevent disk exhaustion
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
});

const configurationController = require('../controllers/configuration.controller');
const auditController = require('../controllers/audit.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { validate, schemas } = require('../middleware/validation');

// --- PUBLIC ROUTES (mounted in api.js) ---
// /config/settings/public is mounted directly in api.js or here. Let's put it here.
router.get('/settings/public', configurationController.getPublicSettings);

// --- PROTECTED ROUTES ---
router.use(authenticateToken);

// Audit Log (Admin-only, immutable compliance trail)
router.get('/audit-log', authorizeRoles(Permissions.MANAGE_CONFIGURATION), auditController.getAuditLog);

// System Health Check
router.get('/health', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getSystemHealth);

// Configuration: General
router.get('/settings', authorizeRoles(Permissions.VIEW_SETTINGS), configurationController.getSettings);
router.put('/settings', authorizeRoles(Permissions.MANAGE_SETTINGS), configurationController.updateSettings);

// Configuration: Departments
router.get('/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getDepartments);
router.post('/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addDepartment);
router.put('/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateDepartment);
router.delete('/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteDepartment);

// Configuration: Specializations
router.get('/specializations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getSpecializations);
router.post('/specializations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addSpecialization);
router.put('/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateSpecialization);
router.delete('/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteSpecialization);

// Configuration: Beds
router.get('/beds', authorizeRoles(Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_CONFIGURATION), configurationController.getBeds);
router.post('/beds', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addBed);
router.put('/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateBed);
router.delete('/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteBed);

// Configuration: Catalogs (Lab, Nurse, Ops)
// Allow Billing roles to view Lab Tests for invoicing catalog
router.get('/lab-tests', authorizeRoles(Permissions.VIEW_LABORATORY, Permissions.MANAGE_CONFIGURATION, Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING), configurationController.getLabTests);
router.post('/lab-tests', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addLabTest);
router.put('/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateLabTest);
router.delete('/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteLabTest);

router.get('/nurse-services', authorizeRoles(Permissions.VIEW_DASHBOARD, Permissions.MANAGE_CONFIGURATION), configurationController.getNurseServices);
router.post('/nurse-services', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addNurseService);
router.put('/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateNurseService);
router.delete('/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteNurseService);

router.get('/operations', authorizeRoles(Permissions.VIEW_OPERATIONS, Permissions.MANAGE_CONFIGURATION), configurationController.getOperations);
router.post('/operations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addOperation);
router.put('/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateOperation);
router.delete('/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteOperation);

// Configuration: Catalogs (Insurance)
// Allow Billing roles to view Insurance Providers for payments
router.get('/insurance-providers', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.MANAGE_PATIENTS, Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING), configurationController.getInsuranceProviders);
router.post('/insurance-providers', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addInsuranceProvider);
router.put('/insurance-providers/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateInsuranceProvider);
router.delete('/insurance-providers/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteInsuranceProvider);

// Configuration: Users & Roles
router.get('/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getUsers);
router.post('/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), validate(schemas.createUser), configurationController.addUser);
router.put('/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateUser);
router.delete('/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteUser);

// Configuration: Permissions
router.get('/permissions', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getRolePermissions);
router.put('/permissions/:role', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateRolePermissions);

// Configuration: Financial
// Allow Billing roles to view Taxes and Payment Methods
router.get('/tax-rates', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING), configurationController.getTaxRates);
router.post('/tax-rates', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addTaxRate);
router.put('/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateTaxRate);
router.delete('/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteTaxRate);

router.get('/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING), configurationController.getPaymentMethods);
router.post('/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addPaymentMethod);
router.put('/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updatePaymentMethod);
router.delete('/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deletePaymentMethod);

// Configuration: Banks
router.get('/banks', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING), configurationController.getBanks);
router.post('/banks', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addBank);
router.put('/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateBank);
router.delete('/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteBank);

// Configuration: Data
router.get('/backup', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.downloadBackup);
router.post('/restore', authorizeRoles(Permissions.MANAGE_CONFIGURATION), upload.single('backup'), configurationController.restoreBackup);
router.post('/reset', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.resetDatabase);

module.exports = router;
