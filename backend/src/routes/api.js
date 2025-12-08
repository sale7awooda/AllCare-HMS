const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller'); 
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../../utils/rbac_backend_mirror'); // Import Permissions for clear use

// --- PUBLIC ROUTES ---
router.post('/login', authController.login);

// --- PROTECTED ROUTES (Requires authentication) ---
router.use(authenticateToken);

// User Profile (everyone can view their own)
router.get('/me', authController.me);

// Patients
router.get('/patients', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.post('/patients', authorizeRoles(Permissions.MANAGE_PATIENTS), patientController.create);
router.get('/patients/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.patch('/patients/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), patientController.update); 
router.delete('/patients/:id', authorizeRoles(Permissions.DELETE_PATIENTS), (req, res) => res.json({ message: 'Delete patient (placeholder)' }));


// HR (Staff Management)
router.get('/hr', authorizeRoles(Permissions.VIEW_HR), staffController.getAll); 
router.post('/hr', authorizeRoles(Permissions.MANAGE_HR), staffController.create); 
router.patch('/hr/:id', authorizeRoles(Permissions.MANAGE_HR), staffController.update); 
router.delete('/hr/:id', authorizeRoles(Permissions.DELETE_HR), (req, res) => res.json({ message: 'Delete staff (placeholder)' }));

// Appointments
router.get('/appointments', authorizeRoles(Permissions.VIEW_APPOINTMENTS), appointmentController.getAll);
router.post('/appointments', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.create);
router.patch('/appointments/:id/status', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.updateStatus);
router.delete('/appointments/:id', authorizeRoles(Permissions.DELETE_APPOINTMENTS), (req, res) => res.json({ message: 'Delete appointment (placeholder)' }));


// Billing
router.get('/billing', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/billing', authorizeRoles(Permissions.MANAGE_BILLING), billingController.create);
router.post('/billing/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), billingController.recordPayment);
router.delete('/billing/:id', authorizeRoles(Permissions.DELETE_BILLING), (req, res) => res.json({ message: 'Delete bill (placeholder)' }));

// Medical Modules (Catalogs & Requests for Patient Actions)
router.get('/medical/tests', authorizeRoles(Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY), medicalController.getLabTests);
router.get('/medical/services', authorizeRoles(Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS), medicalController.getNurseServices); 
router.get('/medical/beds', authorizeRoles(Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS), medicalController.getBeds);
router.get('/medical/operations_catalog', authorizeRoles(Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS), medicalController.getOperations);

// Medical Requests (Creation by specific roles - used by patient actions, map to MANAGE permissions)
router.post('/medical/lab-request', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/medical/nurse-request', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), medicalController.createNurseService); 
router.post('/medical/admission', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.createAdmission);
router.post('/medical/operation', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.createOperation);


// --- NEW MODULES (Placeholder routes with full RBAC) ---
// Admissions
router.get('/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), (req, res) => res.json({ message: 'Admissions data (placeholder)' }));
router.post('/admissions', authorizeRoles(Permissions.MANAGE_ADMISSIONS), (req, res) => res.json({ message: 'Admit patient (placeholder)' }));
router.patch('/admissions/:id', authorizeRoles(Permissions.MANAGE_ADMISSIONS), (req, res) => res.json({ message: 'Update admission (placeholder)' }));
router.delete('/admissions/:id', authorizeRoles(Permissions.DELETE_ADMISSIONS), (req, res) => res.json({ message: 'Delete admission (placeholder)' }));


// Laboratory
router.get('/laboratory', authorizeRoles(Permissions.VIEW_LABORATORY), (req, res) => res.json({ message: 'Laboratory data (placeholder)' }));
router.post('/laboratory', authorizeRoles(Permissions.MANAGE_LABORATORY), (req, res) => res.json({ message: 'Process lab results (placeholder)' }));
router.patch('/laboratory/:id', authorizeRoles(Permissions.MANAGE_LABORATORY), (req, res) => res.json({ message: 'Update lab result (placeholder)' }));
router.delete('/laboratory/:id', authorizeRoles(Permissions.DELETE_LABORATORY), (req, res) => res.json({ message: 'Delete lab record (placeholder)' }));

// Operations
router.get('/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), (req, res) => res.json({ message: 'Operations schedule (placeholder)' }));
router.post('/operations', authorizeRoles(Permissions.MANAGE_OPERATIONS), (req, res) => res.json({ message: 'Update operation details (placeholder)' }));
router.patch('/operations/:id', authorizeRoles(Permissions.MANAGE_OPERATIONS), (req, res) => res.json({ message: 'Update operation (placeholder)' }));
router.delete('/operations/:id', authorizeRoles(Permissions.DELETE_OPERATIONS), (req, res) => res.json({ message: 'Delete operation (placeholder)' }));

// Reports
router.get('/reports', authorizeRoles(Permissions.VIEW_REPORTS), (req, res) => res.json({ message: 'Reports data (placeholder)' }));
router.post('/reports', authorizeRoles(Permissions.MANAGE_REPORTS), (req, res) => res.json({ message: 'Generate report (placeholder)' }));

// Settings
router.get('/settings', authorizeRoles(Permissions.VIEW_SETTINGS), (req, res) => res.json({ message: 'Settings data (placeholder)' }));
router.patch('/settings', authorizeRoles(Permissions.MANAGE_SETTINGS), (req, res) => res.json({ message: 'Update settings (placeholder)' }));

// Configuration (Admin Only)
router.get('/configuration', authorizeRoles(Permissions.MANAGE_CONFIGURATION), (req, res) => res.json({ message: 'Configuration data (placeholder)' }));
router.patch('/configuration', authorizeRoles(Permissions.MANAGE_CONFIGURATION), (req, res) => res.json({ message: 'Update configuration (placeholder)' }));


module.exports = router;