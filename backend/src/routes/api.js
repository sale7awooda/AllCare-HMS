
const express = require('express');
const router = express.Router();
const multer = require('multer');
// Security: Limit upload size to 50MB to prevent disk exhaustion
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

// --- PUBLIC ROUTES ---
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/config/settings/public', configurationController.getPublicSettings);

// --- PROTECTED ROUTES (Global Middleware) ---
router.use(authenticateToken);

// Auth & Profile
router.get('/auth/me', authController.me);
router.put('/auth/profile', authController.updateProfile);
router.put('/auth/password', authController.changePassword);

// System Health Check
router.get('/config/health', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getSystemHealth);

// Patients
router.get('/patients', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.get('/patients/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.post('/patients', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), patientController.create);
router.put('/patients/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), patientController.update);

// Staff (HR)
router.get('/hr', authorizeRoles(Permissions.VIEW_HR), staffController.getAll);
router.post('/hr', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.createStaff), staffController.create);
router.put('/hr/:id', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.updateStaff), staffController.update);

// HR Extended Features
router.get('/hr/attendance', authorizeRoles(Permissions.VIEW_HR), staffController.getAttendance);
router.post('/hr/attendance', authorizeRoles(Permissions.MANAGE_HR), staffController.markAttendance);

router.get('/hr/leaves', authorizeRoles(Permissions.VIEW_HR), staffController.getLeaves);
router.post('/hr/leaves', authorizeRoles(Permissions.VIEW_HR), staffController.requestLeave); // Allow viewing permission to request own leave
router.put('/hr/leaves/:id', authorizeRoles(Permissions.MANAGE_HR), staffController.updateLeaveStatus);

router.get('/hr/payroll', authorizeRoles(Permissions.MANAGE_HR), staffController.getPayroll);
router.post('/hr/payroll/generate', authorizeRoles(Permissions.MANAGE_HR), staffController.generatePayroll);

router.get('/hr/financials', authorizeRoles(Permissions.MANAGE_HR), staffController.getFinancials);
router.post('/hr/financials', authorizeRoles(Permissions.MANAGE_HR), staffController.addAdjustment);

// Appointments
router.get('/appointments', authorizeRoles(Permissions.VIEW_APPOINTMENTS), appointmentController.getAll);
router.post('/appointments', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.create);
router.put('/appointments/:id/status', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.updateStatus);
router.put('/appointments/:id/cancel', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.cancel);

// Billing
router.get('/billing', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/billing', authorizeRoles(Permissions.MANAGE_BILLING), billingController.create);
router.post('/billing/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), billingController.recordPayment);
router.post('/billing/:id/refund', authorizeRoles(Permissions.MANAGE_BILLING), billingController.processRefund);

// Treasury
router.get('/treasury/transactions', authorizeRoles(Permissions.VIEW_BILLING), billingController.getTransactions);
router.post('/treasury/expenses', authorizeRoles(Permissions.MANAGE_BILLING), billingController.addExpense);

// Medical: Laboratory
router.get('/lab/requests', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests);
router.post('/lab/requests', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/lab/requests/:id/complete', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.completeLabRequest);
router.post('/lab/requests/:id/confirm', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.confirmLabRequest);

// Medical: Nurse
router.get('/nurse/requests', authorizeRoles(Permissions.VIEW_DASHBOARD), medicalController.getNurseRequests);
router.post('/nurse/requests', authorizeRoles(Permissions.VIEW_DASHBOARD), medicalController.createNurseRequest);

// Medical: Operations
router.get('/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), medicalController.getScheduledOperations);
router.post('/operations', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.createOperation);
router.post('/operations/:id/process', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.processOperationRequest);
router.post('/operations/:id/complete', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.completeOperation);
router.post('/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.confirmOperation);

// Medical: Admissions
router.get('/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getActiveAdmissions);
router.get('/admissions/:id', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getInpatientDetails);
router.post('/admissions', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.createAdmission);
router.post('/admissions/:id/confirm', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.confirmAdmission);
router.put('/admissions/:id/cancel', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.cancelAdmission);
router.post('/admissions/:id/notes', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.addInpatientNote);
router.post('/admissions/:id/discharge', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.dischargePatient);
router.put('/admissions/beds/:id/clean', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.markBedClean);

// Configuration: General
router.get('/config/settings', authorizeRoles(Permissions.VIEW_SETTINGS), configurationController.getSettings);
router.put('/config/settings', authorizeRoles(Permissions.MANAGE_SETTINGS), configurationController.updateSettings);

// Configuration: Departments
router.get('/config/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getDepartments);
router.post('/config/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addDepartment);
router.put('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateDepartment);
router.delete('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteDepartment);

// Configuration: Specializations
router.get('/config/specializations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getSpecializations);
router.post('/config/specializations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addSpecialization);
router.put('/config/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateSpecialization);
router.delete('/config/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteSpecialization);

// Configuration: Beds
router.get('/config/beds', authorizeRoles(Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_CONFIGURATION), configurationController.getBeds);
router.post('/config/beds', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addBed);
router.put('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateBed);
router.delete('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteBed);

// Configuration: Catalogs (Lab, Nurse, Ops)
router.get('/config/lab-tests', authorizeRoles(Permissions.VIEW_LABORATORY, Permissions.MANAGE_CONFIGURATION), configurationController.getLabTests);
router.post('/config/lab-tests', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addLabTest);
router.put('/config/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateLabTest);
router.delete('/config/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteLabTest);

router.get('/config/nurse-services', authorizeRoles(Permissions.VIEW_DASHBOARD, Permissions.MANAGE_CONFIGURATION), configurationController.getNurseServices);
router.post('/config/nurse-services', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addNurseService);
router.put('/config/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateNurseService);
router.delete('/config/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteNurseService);

router.get('/config/operations', authorizeRoles(Permissions.VIEW_OPERATIONS, Permissions.MANAGE_CONFIGURATION), configurationController.getOperations);
router.post('/config/operations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addOperation);
router.put('/config/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateOperation);
router.delete('/config/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteOperation);

// Configuration: Catalogs (Insurance)
router.get('/config/insurance-providers', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.MANAGE_PATIENTS), configurationController.getInsuranceProviders);
router.post('/config/insurance-providers', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addInsuranceProvider);
router.put('/config/insurance-providers/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateInsuranceProvider);
router.delete('/config/insurance-providers/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteInsuranceProvider);

// Configuration: Catalogs (Banks)
router.get('/config/banks', authorizeRoles(Permissions.MANAGE_CONFIGURATION, Permissions.MANAGE_HR), configurationController.getBanks);
router.post('/config/banks', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addBank);
router.put('/config/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateBank);
router.delete('/config/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteBank);

// Configuration: Users & Roles
router.get('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getUsers);
router.post('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addUser);
router.put('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateUser);
router.delete('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteUser);

// Configuration: Permissions
router.get('/config/permissions', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getRolePermissions);
router.put('/config/permissions/:role', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateRolePermissions);

// Configuration: Financial
router.get('/config/tax-rates', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getTaxRates);
router.post('/config/tax-rates', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addTaxRate);
router.put('/config/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updateTaxRate);
router.delete('/config/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deleteTaxRate);

router.get('/config/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.getPaymentMethods);
router.post('/config/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.addPaymentMethod);
router.put('/config/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.updatePaymentMethod);
router.delete('/config/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.deletePaymentMethod);

// Configuration: Data
router.get('/config/backup', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.downloadBackup);
router.post('/config/restore', authorizeRoles(Permissions.MANAGE_CONFIGURATION), upload.single('backup'), configurationController.restoreBackup);
router.post('/config/reset', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configurationController.resetDatabase);

module.exports = router;
