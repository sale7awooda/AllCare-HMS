const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const { authenticateToken } = require('../middleware/auth');

// Auth
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.me);

// Protected Routes
router.use(authenticateToken);

// Patients
router.get('/patients', patientController.getAll);
router.post('/patients', patientController.create);
router.get('/patients/:id', patientController.getOne);

// Staff
router.get('/staff', staffController.getAll);
router.post('/staff', staffController.create);
router.patch('/staff/:id', staffController.update);

// Appointments
router.get('/appointments', appointmentController.getAll);
router.post('/appointments', appointmentController.create);
router.patch('/appointments/:id/status', appointmentController.updateStatus);

// Billing
router.get('/billing', billingController.getAll);
router.post('/billing', billingController.create);
router.post('/billing/:id/pay', billingController.recordPayment);

module.exports = router;