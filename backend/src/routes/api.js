
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller'); 
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { Permissions } = require('../../utils/rbac_backend_mirror'); 

// --- PUBLIC ROUTES ---
router.post('/login', authController.login);

// --- PROTECTED ROUTES (Requires authentication) ---
router.use(authenticateToken);

// User Profile
router.get('/me', authController.me);

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

// Medical Requests (Creation - The "Request" Step)
router.post('/medical/lab-request', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/medical/nurse-request', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), medicalController.createNurseService); 
router.post('/medical/admission', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.createAdmission);
router.post('/medical/operation', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.createOperation);

// Medical Actions (The "Confirm & Bill" Step)
router.get('/medical/requests/lab', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests);
router.post('/medical/requests/lab/:id/confirm', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.confirmLabRequest);

router.get('/medical/requests/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getAdmissions);
router.post('/medical/requests/admissions/:id/confirm', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.confirmAdmission);

router.get('/medical/requests/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), medicalController.getScheduledOperations);
router.post('/medical/requests/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.confirmOperation);


// --- Placeholder Routes for others ---
router.get('/reports', authorizeRoles(Permissions.VIEW_REPORTS), (req, res) => res.json({ message: 'Reports data (placeholder)' }));
router.get('/settings', authorizeRoles(Permissions.VIEW_SETTINGS), (req, res) => res.json({ message: 'Settings data (placeholder)' }));
router.get('/configuration', authorizeRoles(Permissions.MANAGE_CONFIGURATION), (req, res) => res.json({ message: 'Configuration data (placeholder)' }));

module.exports = router;
