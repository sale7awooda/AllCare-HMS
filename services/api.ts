
import axios from 'axios';

// Helper to determine the correct base URL based on the current environment
const getBaseUrl = () => {
  const { hostname } = window.location;
  
  // 1. Local Development (uses Vite proxy in vite.config.js)
  // 2. Production Deployment (served by Express on same domain)
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('railway.app')) {
    return '/api';
  }

  // 3. External Environments (e.g. Google AI Studio, StackBlitz, Local Network)
  // Connect directly to the deployed Railway backend
  return 'https://allcare.up.railway.app/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/'; 
    }
    if (!error.response && error.code !== 'ERR_CANCELED') {
      console.error('Network Error: Backend unreachable.');
    }
    return Promise.reject(error);
  }
);

export const api = {
  login: (username, password) => client.post('/auth/login', { username, password }),
  me: () => client.get('/auth/me'),
  updateProfile: (data) => client.put('/auth/profile', data),
  changePassword: (data) => client.put('/auth/password', data),
  checkSystemHealth: () => client.get('/config/health'),

  getPatients: () => client.get('/patients'),
  getPatient: (id) => client.get(`/patients/${id}`),
  addPatient: (data) => client.post('/patients', data),
  updatePatient: (id, data) => client.put(`/patients/${id}`, data),

  getStaff: () => client.get('/hr'),
  addStaff: (data) => client.post('/hr', data),
  updateStaff: (id, data) => client.put(`/hr/${id}`, data),
  getAttendance: (date) => client.get(`/hr/attendance?date=${date}`),
  markAttendance: (data) => client.post('/hr/attendance', data),
  getLeaves: () => client.get('/hr/leaves'),
  requestLeave: (data) => client.post('/hr/leaves', data),
  updateLeaveStatus: (id, status) => client.put(`/hr/leaves/${id}`, { status }),
  getPayroll: (month) => client.get(`/hr/payroll?month=${month}`),
  generatePayroll: (data) => client.post('/hr/payroll/generate', data),
  updatePayrollStatus: (id, status) => client.put(`/hr/payroll/${id}/status`, { status }),
  getFinancials: (type) => client.get(`/hr/financials?type=${type}`), 
  addAdjustment: (data) => client.post('/hr/financials', data), 

  getAppointments: () => client.get('/appointments'),
  createAppointment: (data) => client.post('/appointments', data),
  updateAppointmentStatus: (id, status) => client.put(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id) => client.put(`/appointments/${id}/cancel`),

  getBills: () => client.get('/billing'),
  createBill: (data) => client.post('/billing', data),
  recordPayment: (id, data) => client.post(`/billing/${id}/pay`, data), 
  processRefund: (id, data) => client.post(`/billing/${id}/refund`, data), 
  getTransactions: () => client.get('/treasury/transactions'),
  addExpense: (data) => client.post('/treasury/expenses', data),

  getActiveAdmissions: () => client.get('/admissions'),
  getInpatientDetails: (id) => client.get(`/admissions/${id}`),
  createAdmission: (data) => client.post('/admissions', data),
  confirmAdmissionDeposit: (id) => client.post(`/admissions/${id}/confirm`),
  cancelAdmission: (id) => client.put(`/admissions/${id}/cancel`),
  addInpatientNote: (id, data) => client.post(`/admissions/${id}/notes`, data),
  dischargePatient: (id, data) => client.post(`/admissions/${id}/discharge`, data),
  markBedClean: (id) => client.put(`/admissions/beds/${id}/clean`),

  getLabTests: () => client.get('/config/lab-tests'),
  getPendingLabRequests: () => client.get('/lab/requests'),
  createLabRequest: (data) => client.post('/lab/requests', data),
  completeLabRequest: (id, data) => client.post(`/lab/requests/${id}/complete`, data),

  getNurseServices: () => client.get('/config/nurse-services'),
  createNurseRequest: (data) => client.post('/nurse/requests', data),
  getNurseRequests: () => client.get('/nurse/requests'),

  getScheduledOperations: () => client.get('/operations'),
  getOperations: () => client.get('/config/operations'),
  createOperation: (data) => client.post('/operations', data),
  processOperationRequest: (id, data) => client.post(`/operations/${id}/process`, data),
  completeOperation: (id) => client.post(`/operations/${id}/complete`),

  getSystemSettings: () => client.get('/config/settings'),
  getPublicSettings: () => client.get('/config/settings/public'),
  updateSystemSettings: (data) => client.put('/config/settings', data),
  getSystemUsers: () => client.get('/config/users'),
  addSystemUser: (data) => client.post('/config/users', data),
  updateSystemUser: (id, data) => client.put(`/config/users/${id}`, data),
  deleteSystemUser: (id) => client.delete(`/config/users/${id}`),
  getRolePermissions: () => client.get('/config/permissions'),
  updateRolePermissions: (role, permissions) => client.put(`/config/permissions/${role}`, { permissions }),

  getDepartments: () => client.get('/config/departments'),
  addDepartment: (data) => client.post('/config/departments', data),
  updateDepartment: (id, data) => client.put(`/config/departments/${id}`, data),
  deleteDepartment: (id) => client.delete(`/config/departments/${id}`),
  getSpecializations: () => client.get('/config/specializations'),
  addSpecialization: (data) => client.post('/config/specializations', data),
  updateSpecialization: (id, data) => client.put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id) => client.delete(`/config/specializations/${id}`),
  getBeds: () => client.get('/config/beds'), 
  getConfigBeds: () => client.get('/config/beds'), 
  addBed: (data) => client.post('/config/beds', data),
  updateBed: (id, data) => client.put(`/config/beds/${id}`, data),
  deleteBed: (id) => client.delete(`/config/beds/${id}`),
  addLabTest: (data) => client.post('/config/lab-tests', data),
  updateLabTest: (id, data) => client.put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id) => client.delete(`/config/lab-tests/${id}`),
  addNurseService: (data) => client.post('/config/nurse-services', data),
  updateNurseService: (id, data) => client.put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id) => client.delete(`/config/nurse-services/${id}`),
  addOperationCatalog: (data) => client.post('/config/operations', data),
  updateOperationCatalog: (id, data) => client.put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id) => client.delete(`/config/operations/${id}`),
  
  getInsuranceProviders: () => client.get('/config/insurance-providers'),
  addInsuranceProvider: (data) => client.post('/config/insurance-providers', data),
  updateInsuranceProvider: (id, data) => client.put(`/config/insurance-providers/${id}`, data),
  deleteInsuranceProvider: (id) => client.delete(`/config/insurance-providers/${id}`),
  getBanks: () => client.get('/config/banks'),
  addBank: (data) => client.post('/config/banks', data),
  updateBank: (id, data) => client.put(`/config/banks/${id}`, data),
  deleteBank: (id) => client.delete(`/config/banks/${id}`),
  getTaxRates: () => client.get('/config/tax-rates'),
  addTaxRate: (data) => client.post('/config/tax-rates', data),
  updateTaxRate: (id, data) => client.put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id) => client.delete(`/config/tax-rates/${id}`),
  getPaymentMethods: () => client.get('/config/payment-methods'),
  addPaymentMethod: (data) => client.post('/config/payment-methods', data),
  updatePaymentMethod: (id, data) => client.put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id) => client.delete(`/config/payment-methods/${id}`),

  downloadBackup: () => window.open(`${client.defaults.baseURL}/config/backup`, '_blank'),
  restoreDatabase: (file) => {
    const formData = new FormData();
    formData.append('backup', file);
    return client.post('/config/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  resetDatabase: () => client.post('/config/reset'),
};
