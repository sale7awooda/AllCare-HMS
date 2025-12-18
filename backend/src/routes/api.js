
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 }
});

const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../utils/rbac_backend_mirror');
const { validate, schemas } = require('../middleware/validation');

const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller');
const configurationController = require('../controllers/configuration.controller');
const pharmacyController = require('../controllers/pharmacy.controller');

// --- PUBLIC ROUTES ---
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/config/settings/public', configurationController.getPublicSettings);

// --- PROTECTED ROUTES ---
router.use(authenticateToken);

// Auth & Profile
router.get('/auth/me', authController.me);
router.put('/auth/profile', authController.updateProfile);
router.put('/auth/password', authController.changePassword);

// Patients
router.get('/patients', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.get('/patients/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.post('/patients', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), patientController.create);
router.put('/patients/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), patientController.update);

// Pharmacy
router.get('/pharmacy/inventory', authorizeRoles(Permissions.VIEW_LABORATORY), pharmacyController.getInventory);
router.post('/pharmacy/inventory', authorizeRoles(Permissions.MANAGE_CONFIGURATION), pharmacyController.addMedicine);
router.put('/pharmacy/inventory/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), pharmacyController.updateMedicine);
router.post('/pharmacy/dispense', authorizeRoles(Permissions.VIEW_LABORATORY), pharmacyController.dispense);
router.get('/pharmacy/transactions', authorizeRoles(Permissions.VIEW_LABORATORY), pharmacyController.getTransactions);

// Appointments, Billing, HR... (Remaining routes from existing file)
router.get('/billing', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/billing', authorizeRoles(Permissions.MANAGE_BILLING), billingController.create);
router.post('/billing/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), billingController.recordPayment);

router.get('/hr', authorizeRoles(Permissions.VIEW_HR), staffController.getAll);
router.post('/hr', authorizeRoles(Permissions.MANAGE_HR), staffController.create);

module.exports = router;
