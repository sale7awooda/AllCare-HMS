
const express = require('express');
const router = express.Router();
const multer = require('multer');
const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller'); 
const configController = require('../controllers/configuration.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../../utils/rbac_backend_mirror'); 

// Multer Config for Backup Uploads
const upload = multer({ dest: 'uploads/' });

// --- PUBLIC ROUTES ---
router.post('/login', authController.login);

// --- PROTECTED ROUTES (Requires authentication) ---
router.use(authenticateToken);

// User Profile & Settings
router.get('/me', authController.me);
router.patch('/me/profile', authController.updateProfile);
router.patch('/me/password', authController.changePassword);

// Patients
router.get('/patients', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.post('/patients', authorizeRoles(Permissions.MANAGE_PATIENTS), patientController.create);
router.get('/patients/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.patch('/patients/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), patientController.update); 
router.delete('/patients/:id', authorizeRoles(Permissions.DELETE_PATIENTS), (req, res) => res.json({ message: 'Delete patient (placeholder)' }));

// HR
router.get('/hr', authorizeRoles(Permissions.VIEW_HR), staffController.getAll); 
router.post('/hr', authorizeRoles(Permissions.MANAGE_HR), staffController.create); 
router.patch('/hr/:id', authorizeRoles(Permissions.MANAGE_HR), staffController.update); 
router.delete('/hr/:id', authorizeRoles(Permissions.DELETE_HR), (req, res) => res.json({ message: 'Delete staff (placeholder)' }));

// Appointments
router.get('/appointments', authorizeRoles(Permissions.VIEW_APPOINTMENTS), appointmentController.getAll);
router.post('/appointments', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.create);
router.patch('/appointments/:id/status', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.updateStatus);

// Billing
router.get('/billing', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/billing', authorizeRoles(Permissions.MANAGE_BILLING), billingController.create);
router.post('/billing/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), billingController.recordPayment);
router.delete('/billing/:id', authorizeRoles(Permissions.DELETE_BILLING), (req, res) => res.json({ message: 'Delete bill (placeholder)' }));

// Medical Modules (Catalogs)
router.get('/medical/tests', authorizeRoles(Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY), medicalController.getLabTests);
router.get('/medical/services', authorizeRoles(Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS), medicalController.getNurseServices); 
router.get('/medical/beds', authorizeRoles(Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS), medicalController.getBeds);
router.get('/medical/operations_catalog', authorizeRoles(Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS), medicalController.getOperations);

// Medical Requests
router.post('/medical/lab-request', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/medical/nurse-request', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), medicalController.createNurseService); 
router.post('/medical/admission', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.createAdmission);
router.post('/medical/operation', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.createOperation);

// Medical Actions
router.get('/medical/requests/lab', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests);
router.post('/medical/requests/lab/:id/confirm', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.confirmLabRequest);

router.get('/medical/requests/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getAdmissions);
router.post('/medical/requests/admissions/:id/confirm', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.confirmAdmission);

// Inpatient Management Routes
router.get('/medical/admissions/:id', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getInpatientDetails);
router.post('/medical/admissions/:id/note', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.addInpatientNote);
router.post('/medical/admissions/:id/discharge', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.dischargePatient);

router.get('/medical/requests/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), medicalController.getScheduledOperations);
router.post('/medical/requests/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.confirmOperation);


// --- CONFIGURATION ROUTES (Admin Only) ---
router.get('/config/settings', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getSettings);
router.post('/config/settings', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateSettings);

router.get('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getUsers);
router.post('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addUser);
router.put('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateUser);
router.delete('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteUser);

router.get('/config/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getDepartments);
router.post('/config/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addDepartment);
router.put('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateDepartment);
router.delete('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteDepartment);

router.get('/config/beds', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getBeds);
router.post('/config/beds', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addBed);
router.put('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateBed);
router.delete('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteBed);

router.post('/config/catalogs/lab-tests', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addLabTest);
router.put('/config/catalogs/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateLabTest);
router.delete('/config/catalogs/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteLabTest);

router.post('/config/catalogs/nurse-services', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addNurseService);
router.put('/config/catalogs/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateNurseService);
router.delete('/config/catalogs/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteNurseService);

router.post('/config/catalogs/operations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addOperation);
router.put('/config/catalogs/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateOperation);
router.delete('/config/catalogs/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteOperation);

// Financial Configuration
router.get('/config/finance/taxes', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getTaxRates);
router.post('/config/finance/taxes', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addTaxRate);
router.put('/config/finance/taxes/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateTaxRate);
router.delete('/config/finance/taxes/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteTaxRate);

router.get('/config/finance/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getPaymentMethods);
router.post('/config/finance/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addPaymentMethod);
router.put('/config/finance/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updatePaymentMethod);
router.delete('/config/finance/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deletePaymentMethod);

// Data Management Routes
router.get('/config/backup', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.downloadBackup);
router.post('/config/restore', authorizeRoles(Permissions.MANAGE_CONFIGURATION), upload.single('backup'), configController.restoreBackup);


// --- Placeholder Routes for others ---
router.get('/reports', authorizeRoles(Permissions.VIEW_REPORTS), (req, res) => res.json({ message: 'Reports data (placeholder)' }));

module.exports = router;
