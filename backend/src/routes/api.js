
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const { Permissions } = require('../utils/rbac_backend_mirror');
const multer = require('multer');

const authController = require('../controllers/auth.controller');
const patientController = require('../controllers/patient.controller');
const staffController = require('../controllers/staff.controller');
const appointmentController = require('../controllers/appointment.controller');
const billingController = require('../controllers/billing.controller');
const medicalController = require('../controllers/medical.controller');
const configController = require('../controllers/configuration.controller');
const pharmacyController = require('../controllers/pharmacy.controller');

// --- Auth ---
router.post('/auth/login', validate(schemas.login), authController.login);
router.get('/auth/me', authenticateToken, authController.me);
router.put('/auth/profile', authenticateToken, authController.updateProfile);
router.put('/auth/change-password', authenticateToken, authController.changePassword);

// Middleware for protected routes
router.use(authenticateToken);

// --- Patients ---
router.get('/patients', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getAll);
router.post('/patients', authorizeRoles(Permissions.MANAGE_PATIENTS), validate(schemas.createPatient), patientController.create);
router.get('/patients/:id', authorizeRoles(Permissions.VIEW_PATIENTS), patientController.getOne);
router.put('/patients/:id', authorizeRoles(Permissions.MANAGE_PATIENTS), patientController.update);

// --- Appointments ---
router.get('/appointments', authorizeRoles(Permissions.VIEW_APPOINTMENTS), appointmentController.getAll);
router.post('/appointments', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.create);
router.put('/appointments/:id', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.update);
router.put('/appointments/:id/status', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.updateStatus);
router.put('/appointments/:id/cancel', authorizeRoles(Permissions.MANAGE_APPOINTMENTS), appointmentController.cancel);

// --- Billing ---
router.get('/billing', authorizeRoles(Permissions.VIEW_BILLING), billingController.getAll);
router.post('/billing', authorizeRoles(Permissions.MANAGE_BILLING), billingController.create);
router.post('/billing/:id/pay', authorizeRoles(Permissions.MANAGE_BILLING), billingController.recordPayment);
router.post('/billing/:id/refund', authorizeRoles(Permissions.MANAGE_BILLING), billingController.processRefund);
router.put('/billing/:id/cancel-service', authorizeRoles(Permissions.MANAGE_BILLING), billingController.cancelService);
router.get('/billing/transactions', authorizeRoles(Permissions.VIEW_BILLING), billingController.getTransactions);
router.post('/billing/expenses', authorizeRoles(Permissions.MANAGE_BILLING), billingController.addExpense);
router.put('/billing/expenses/:id', authorizeRoles(Permissions.MANAGE_BILLING), billingController.updateExpense);

// --- Staff & HR ---
router.get('/staff', authorizeRoles(Permissions.VIEW_HR), staffController.getAll);
router.post('/staff', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.createStaff), staffController.create);
router.put('/staff/:id', authorizeRoles(Permissions.MANAGE_HR), validate(schemas.updateStaff), staffController.update);
router.get('/staff/attendance', authorizeRoles(Permissions.VIEW_HR), staffController.getAttendance);
router.post('/staff/attendance', authorizeRoles(Permissions.MANAGE_HR), staffController.markAttendance);
router.get('/staff/leaves', authorizeRoles(Permissions.VIEW_HR), staffController.getLeaves);
router.post('/staff/leaves', staffController.requestLeave); // Self-service
router.put('/staff/leaves/:id/status', authorizeRoles(Permissions.MANAGE_HR), staffController.updateLeaveStatus);
router.get('/staff/payroll', authorizeRoles(Permissions.MANAGE_HR), staffController.getPayroll);
router.post('/staff/payroll/generate', authorizeRoles(Permissions.MANAGE_HR), staffController.generatePayroll);
router.put('/staff/payroll/:id/status', authorizeRoles(Permissions.MANAGE_HR), staffController.updatePayrollStatus);
router.get('/staff/financials', authorizeRoles(Permissions.MANAGE_HR), staffController.getFinancials);
router.post('/staff/financials', authorizeRoles(Permissions.MANAGE_HR), staffController.addAdjustment);

// --- Medical (Labs, Ops, Admissions) ---
// Medical: Labs
router.get('/medical/lab/requests', authorizeRoles(Permissions.VIEW_LABORATORY), medicalController.getLabRequests);
router.post('/medical/lab/requests', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.createLabRequest);
router.post('/medical/lab/requests/:id/complete', authorizeRoles(Permissions.MANAGE_LABORATORY), medicalController.completeLabRequest);

// Medical: Operations
router.get('/medical/operations', authorizeRoles(Permissions.VIEW_OPERATIONS), (req, res) => {
    // Keep this one simple inline or move if it grows complexity
    try {
        const { db } = require('../config/database');
        const rows = db.prepare(`
            SELECT o.*, p.full_name as patientName, m.full_name as doctorName 
            FROM operations o 
            JOIN patients p ON o.patient_id = p.id
            LEFT JOIN medical_staff m ON o.doctor_id = m.id
            ORDER BY o.created_at DESC
        `).all();
        res.json(rows);
    } catch(e) { res.status(500).json({error: e.message}); }
});
router.post('/operations', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.createOperation);
router.post('/operations/:id/process', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.processOperationRequest);
router.post('/operations/:id/complete', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.completeOperation);
router.post('/operations/:id/confirm', authorizeRoles(Permissions.MANAGE_OPERATIONS), medicalController.confirmOperation);
router.post('/operations/:id/pay-share', authorizeRoles(Permissions.MANAGE_BILLING), medicalController.payOperationShare);

// Medical: Admissions
router.get('/admissions', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getActiveAdmissions);
router.post('/medical/admissions', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.createAdmission);
router.get('/medical/admissions/history', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getAdmissionHistory);
router.get('/medical/admissions/:id', authorizeRoles(Permissions.VIEW_ADMISSIONS), medicalController.getInpatientDetails);
router.post('/medical/admissions/:id/notes', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.addInpatientNote);
router.post('/medical/admissions/:id/discharge', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.dischargePatient);
router.post('/medical/admissions/:id/confirm', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.confirmAdmissionDeposit);
router.put('/medical/admissions/:id/cancel', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.cancelAdmission);

// --- Pharmacy ---
router.get('/pharmacy/inventory', authorizeRoles(Permissions.VIEW_PHARMACY), pharmacyController.getInventory);
router.post('/pharmacy/inventory', authorizeRoles(Permissions.MANAGE_PHARMACY), pharmacyController.addInventory);
router.put('/pharmacy/inventory/:id', authorizeRoles(Permissions.MANAGE_PHARMACY), pharmacyController.updateInventory);
router.delete('/pharmacy/inventory/:id', authorizeRoles(Permissions.MANAGE_PHARMACY), pharmacyController.deleteInventory);
router.post('/pharmacy/dispense', authorizeRoles(Permissions.MANAGE_PHARMACY), pharmacyController.dispense);

// --- Configuration & System ---
router.get('/config/public-settings', configController.getPublicSettings); // Public
router.get('/config/settings', authorizeRoles(Permissions.MANAGE_SETTINGS), configController.getSettings);
router.put('/config/settings', authorizeRoles(Permissions.MANAGE_SETTINGS), configController.updateSettings);

router.get('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getUsers);
router.post('/config/users', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addUser);
router.put('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateUser);
router.delete('/config/users/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteUser);

router.get('/config/permissions', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.getRolePermissions);
router.put('/config/permissions/:role', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateRolePermissions);

// Catalogs
router.get('/config/departments', configController.getDepartments);
router.post('/config/departments', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addDepartment);
router.put('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateDepartment);
router.delete('/config/departments/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteDepartment);

router.get('/config/specializations', configController.getSpecializations);
router.post('/config/specializations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addSpecialization);
router.put('/config/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateSpecialization);
router.delete('/config/specializations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteSpecialization);

router.get('/config/lab-tests', configController.getLabTests);
router.post('/config/lab-tests', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addLabTest);
router.put('/config/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateLabTest);
router.delete('/config/lab-tests/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteLabTest);

router.get('/config/nurse-services', configController.getNurseServices);
router.post('/config/nurse-services', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addNurseService);
router.put('/config/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateNurseService);
router.delete('/config/nurse-services/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteNurseService);

router.get('/config/operations', configController.getOperations);
router.post('/config/operations', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addOperation);
router.put('/config/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateOperation);
router.delete('/config/operations/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteOperation);

router.get('/config/insurance', configController.getInsuranceProviders);
router.post('/config/insurance', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addInsuranceProvider);
router.put('/config/insurance/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateInsuranceProvider);
router.delete('/config/insurance/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteInsuranceProvider);

router.get('/config/banks', configController.getBanks);
router.post('/config/banks', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addBank);
router.put('/config/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateBank);
router.delete('/config/banks/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteBank);

router.get('/config/tax-rates', configController.getTaxRates);
router.post('/config/tax-rates', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addTaxRate);
router.put('/config/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateTaxRate);
router.delete('/config/tax-rates/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteTaxRate);

router.get('/config/payment-methods', configController.getPaymentMethods);
router.post('/config/payment-methods', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addPaymentMethod);
router.put('/config/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updatePaymentMethod);
router.delete('/config/payment-methods/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deletePaymentMethod);

router.get('/config/beds', configController.getBeds);
router.post('/config/beds', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.addBed);
router.put('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.updateBed);
router.delete('/config/beds/:id', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.deleteBed);

router.put('/config/beds/:id/clean', authorizeRoles(Permissions.MANAGE_ADMISSIONS), medicalController.markBedClean);

// Diagnostics
router.get('/config/health', authorizeRoles(Permissions.VIEW_SETTINGS), configController.getSystemHealth);
router.get('/config/backup/download', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.downloadBackup);
router.post('/config/backup/restore', authorizeRoles(Permissions.MANAGE_CONFIGURATION), multer({ dest: 'uploads/' }).single('file'), configController.restoreBackup);
router.post('/config/reset', authorizeRoles(Permissions.MANAGE_CONFIGURATION), configController.resetDatabase);

module.exports = router;
