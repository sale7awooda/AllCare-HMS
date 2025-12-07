const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Auth
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.me);

// Protected Routes
router.use(authenticateToken);

// Patients
router.get('/patients', authorizeRoles('receptionist', 'doctor', 'nurse', 'technician'), patientController.getAll);
router.post('/patients', authorizeRoles('receptionist'), patientController.create);
router.get('/patients/:id', authorizeRoles('receptionist', 'doctor', 'nurse', 'technician'), patientController.getOne);
router.patch('/patients/:id', authorizeRoles('receptionist', 'doctor'), patientController.update);

// Staff (Admin/Manager Only)
router.get('/staff', authorizeRoles('admin', 'manager'), staffController.getAll);
router.post('/staff', authorizeRoles('admin', 'manager'), staffController.create);
router.patch('/staff/:id', authorizeRoles('admin', 'manager'), staffController.update);

// Appointments
router.get('/appointments', authorizeRoles('receptionist', 'doctor', 'nurse'), appointmentController.getAll);
router.post('/appointments', authorizeRoles('receptionist', 'doctor'), appointmentController.create);
router.patch('/appointments/:id/status', authorizeRoles('receptionist', 'doctor'), appointmentController.updateStatus);

// Billing
router.get('/billing', authorizeRoles('accountant', 'receptionist'), billingController.getAll);
router.post('/billing', authorizeRoles('accountant'), billingController.create);
router.post('/billing/:id/pay', authorizeRoles('accountant'), billingController.recordPayment);

// Medical Modules
router.get('/medical/tests', medicalController.getLabTests);
router.get('/medical/services', medicalController.getNurseServices);
router.get('/medical/beds', medicalController.getBeds);
router.get('/medical/operations', medicalController.getOperations);

// Requests
router.post('/medical/lab-request', authorizeRoles('doctor', 'technician'), medicalController.createLabRequest);
router.post('/medical/nurse-request', authorizeRoles('doctor', 'nurse'), medicalController.createNurseService);
router.post('/medical/admission', authorizeRoles('doctor', 'receptionist'), medicalController.createAdmission);
router.post('/medical/operation', authorizeRoles('doctor'), medicalController.createOperation);

module.exports = router;