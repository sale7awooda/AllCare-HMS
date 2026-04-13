const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const patientRoutes = require('./patient.routes');
const staffRoutes = require('./staff.routes');
const appointmentRoutes = require('./appointment.routes');
const billingRoutes = require('./billing.routes');
const treasuryRoutes = require('./treasury.routes');
const medicalRoutes = require('./medical.routes');
const notificationRoutes = require('./notification.routes');
const configurationRoutes = require('./configuration.routes');

// Mount domain routers
router.use('/auth', authRoutes);
router.use('/patients', patientRoutes);
router.use('/hr', staffRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/billing', billingRoutes);
router.use('/treasury', treasuryRoutes);
router.use('/', medicalRoutes); // handles /lab, /nurse, /operations, /admissions
router.use('/notifications', notificationRoutes);
router.use('/config', configurationRoutes);

module.exports = router;
