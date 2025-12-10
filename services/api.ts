
import axios from 'axios';

// Create axios instance with base URL
const client = axios.create({
  baseURL: 'https://allcare.up.railway.app/api',
});

// Add token interceptor
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for auth errors
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Optional: Redirect to login or handle session expiry
      // window.location.href = '/login'; 
    }
    return Promise.reject(error);
  }
);

export const api = {
  // --- Auth ---
  login: (username, password) => client.post('/auth/login', { username, password }),
  me: () => client.get('/auth/me'),
  updateProfile: (data) => client.put('/auth/profile', data),
  changePassword: (data) => client.put('/auth/password', data),

  // --- System Health ---
  checkSystemHealth: () => client.get('/config/health'),

  // --- Patients ---
  getPatients: () => client.get('/patients'),
  getPatient: (id) => client.get(`/patients/${id}`),
  addPatient: (data) => client.post('/patients', data),
  updatePatient: (id, data) => client.put(`/patients/${id}`, data),

  // --- Staff (HR) ---
  getStaff: () => client.get('/hr'),
  addStaff: (data) => client.post('/hr', data),
  updateStaff: (id, data) => client.put(`/hr/${id}`, data),
  
  // HR Extended
  getAttendance: (date) => client.get(`/hr/attendance?date=${date}`),
  markAttendance: (data) => client.post('/hr/attendance', data),
  
  getLeaves: () => client.get('/hr/leaves'),
  requestLeave: (data) => client.post('/hr/leaves', data),
  updateLeaveStatus: (id, status) => client.put(`/hr/leaves/${id}`, { status }),
  
  getPayroll: (month) => client.get(`/hr/payroll?month=${month}`),
  generatePayroll: (data) => client.post('/hr/payroll/generate', data),
  
  getFinancials: (type) => client.get(`/hr/financials?type=${type}`), // bonus, fine, loan
  addAdjustment: (data) => client.post('/hr/financials', data), // bonus, fine, loan

  // --- Appointments ---
  getAppointments: () => client.get('/appointments'),
  createAppointment: (data) => client.post('/appointments', data),
  updateAppointmentStatus: (id, status) => client.put(`/appointments/${id}/status`, { status }),

  // --- Billing ---
  getBills: () => client.get('/billing'),
  createBill: (data) => client.post('/billing', data),
  recordPayment: (id, amount) => client.post(`/billing/${id}/pay`, { amount }),

  // --- Admissions ---
  getActiveAdmissions: () => client.get('/admissions'),
  getInpatientDetails: (id) => client.get(`/admissions/${id}`),
  createAdmission: (data) => client.post('/admissions', data),
  confirmAdmissionDeposit: (id) => client.post(`/admissions/${id}/confirm`),
  addInpatientNote: (id, data) => client.post(`/admissions/${id}/notes`, data),
  dischargePatient: (id, data) => client.post(`/admissions/${id}/discharge`, data),

  // --- Laboratory ---
  getLabTests: () => client.get('/config/lab-tests'),
  getPendingLabRequests: () => client.get('/lab/requests'),
  createLabRequest: (data) => client.post('/lab/requests', data),
  completeLabRequest: (id, data) => client.post(`/lab/requests/${id}/complete`, data),

  // --- Nurse ---
  getNurseServices: () => client.get('/config/nurse-services'),
  createNurseRequest: (data) => client.post('/nurse/requests', data),
  getNurseRequests: () => client.get('/nurse/requests'),

  // --- Operations ---
  getScheduledOperations: () => client.get('/operations'),
  getOperations: () => client.get('/config/operations'), // Catalog
  createOperation: (data) => client.post('/operations', data),
  processOperationRequest: (id, data) => client.post(`/operations/${id}/process`, data),
  completeOperation: (id) => client.post(`/operations/${id}/complete`),

  // --- Configuration: General ---
  getSystemSettings: () => client.get('/config/settings'),
  getPublicSettings: () => client.get('/config/settings/public'),
  updateSystemSettings: (data) => client.put('/config/settings', data),

  // --- Configuration: Users ---
  getSystemUsers: () => client.get('/config/users'),
  addSystemUser: (data) => client.post('/config/users', data),
  updateSystemUser: (id, data) => client.put(`/config/users/${id}`, data),
  deleteSystemUser: (id) => client.delete(`/config/users/${id}`),

  // --- Configuration: Permissions ---
  getRolePermissions: () => client.get('/config/permissions'),
  updateRolePermissions: (role, permissions) => client.put(`/config/permissions/${role}`, { permissions }),

  // --- Configuration: Departments ---
  getDepartments: () => client.get('/config/departments'),
  addDepartment: (data) => client.post('/config/departments', data),
  updateDepartment: (id, data) => client.put(`/config/departments/${id}`, data),
  deleteDepartment: (id) => client.delete(`/config/departments/${id}`),

  // --- Configuration: Specializations ---
  getSpecializations: () => client.get('/config/specializations'),
  addSpecialization: (data) => client.post('/config/specializations', data),
  updateSpecialization: (id, data) => client.put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id) => client.delete(`/config/specializations/${id}`),

  // --- Configuration: Beds ---
  getBeds: () => client.get('/config/beds'), // Public/Dashboard usage (mapped to config endpoint for simplicty if same data structure)
  getConfigBeds: () => client.get('/config/beds'), // Admin usage
  addBed: (data) => client.post('/config/beds', data),
  updateBed: (id, data) => client.put(`/config/beds/${id}`, data),
  deleteBed: (id) => client.delete(`/config/beds/${id}`),

  // --- Configuration: Catalogs (Lab) ---
  addLabTest: (data) => client.post('/config/lab-tests', data),
  updateLabTest: (id, data) => client.put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id) => client.delete(`/config/lab-tests/${id}`),

  // --- Configuration: Catalogs (Nurse) ---
  addNurseService: (data) => client.post('/config/nurse-services', data),
  updateNurseService: (id, data) => client.put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id) => client.delete(`/config/nurse-services/${id}`),

  // --- Configuration: Catalogs (Operations) ---
  addOperationCatalog: (data) => client.post('/config/operations', data),
  updateOperationCatalog: (id, data) => client.put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id) => client.delete(`/config/operations/${id}`),
  
  // --- Configuration: Catalogs (Insurance) ---
  getInsuranceProviders: () => client.get('/config/insurance-providers'),
  addInsuranceProvider: (data) => client.post('/config/insurance-providers', data),
  updateInsuranceProvider: (id, data) => client.put(`/config/insurance-providers/${id}`, data),
  deleteInsuranceProvider: (id) => client.delete(`/config/insurance-providers/${id}`),

  // --- Configuration: Financial ---
  getTaxRates: () => client.get('/config/tax-rates'),
  addTaxRate: (data) => client.post('/config/tax-rates', data),
  updateTaxRate: (id, data) => client.put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id) => client.delete(`/config/tax-rates/${id}`),

  getPaymentMethods: () => client.get('/config/payment-methods'),
  addPaymentMethod: (data) => client.post('/config/payment-methods', data),
  updatePaymentMethod: (id, data) => client.put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id) => client.delete(`/config/payment-methods/${id}`),

  // --- Configuration: Data Management ---
  downloadBackup: () => {
    // Direct open to trigger download
    window.open('https://allcare.up.railway.app/api/config/backup', '_blank');
  },
  restoreDatabase: (file) => {
    const formData = new FormData();
    formData.append('backup', file);
    return client.post('/config/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  resetDatabase: () => client.post('/config/reset'),
};