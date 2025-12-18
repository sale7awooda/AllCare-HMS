
import axios from 'axios';

const getBaseUrl = () => {
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('railway.app')) {
    return '/api';
  }
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
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/'; 
    }
    return Promise.reject(error);
  }
);

const get = (url: string) => client.get(url) as Promise<any>;
const post = (url: string, data?: any, config?: any) => client.post(url, data, config) as Promise<any>;
const put = (url: string, data?: any) => client.put(url, data) as Promise<any>;
const del = (url: string) => client.delete(url) as Promise<any>;

export const api = {
  login: (username, password) => post('/auth/login', { username, password }),
  me: () => get('/auth/me'),
  getPublicSettings: () => get('/config/settings/public'),

  // --- Patients ---
  getPatients: () => get('/patients'),
  getPatient: (id) => get(`/patients/${id}`),
  addPatient: (data) => post('/patients', data),
  // FIX: Added updatePatient method
  updatePatient: (id, data) => put(`/patients/${id}`, data),

  // --- HR & Staff ---
  getStaff: () => get('/hr'),
  addStaff: (data) => post('/hr', data),
  // FIX: Added updateStaff and other HR related methods
  updateStaff: (id, data) => put(`/hr/${id}`, data),
  getAttendance: (date) => get(`/hr/attendance?date=${date}`),
  markAttendance: (data) => post('/hr/attendance', data),
  getLeaves: () => get('/hr/leaves'),
  requestLeave: (data) => post('/hr/leaves', data),
  updateLeaveStatus: (id, status) => put(`/hr/leaves/${id}/status`, { status }),
  getPayroll: (month) => get(`/hr/payroll?month=${month}`),
  generatePayroll: (data) => post('/hr/payroll/generate', data),
  updatePayrollStatus: (id, data) => put(`/hr/payroll/${id}/status`, data),
  getFinancials: (type) => get(`/hr/financials?type=${type}`),
  addAdjustment: (data) => post('/hr/financials', data),

  // --- Appointments ---
  getAppointments: () => get('/appointments'),
  createAppointment: (data) => post('/appointments', data),
  // FIX: Added updateAppointment and cancelAppointment methods
  updateAppointment: (id, data) => put(`/appointments/${id}`, data),
  updateAppointmentStatus: (id, status) => put(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id) => del(`/appointments/${id}`),

  // --- Billing & Treasury ---
  getBills: () => get('/billing'),
  createBill: (data) => post('/billing', data),
  recordPayment: (id, data) => post(`/billing/${id}/pay`, data),
  getTransactions: () => get('/treasury/transactions'),
  // FIX: Added addExpense and updateExpense methods
  addExpense: (data) => post('/treasury/expenses', data),
  updateExpense: (id, data) => put(`/treasury/expenses/${id}`, data),

  // --- Pharmacy ---
  getPharmacyInventory: () => get('/pharmacy/inventory'),
  addMedicine: (data) => post('/pharmacy/inventory', data),
  updateMedicine: (id, data) => put(`/pharmacy/inventory/${id}`, data),
  dispenseMedicine: (data) => post('/pharmacy/dispense', data),
  getPharmacyTransactions: () => get('/pharmacy/transactions'),

  // --- Admissions ---
  getActiveAdmissions: () => get('/admissions'),
  // FIX: Added admission management methods
  createAdmission: (data) => post('/admissions', data),
  confirmAdmissionDeposit: (id) => post(`/admissions/${id}/confirm`),
  cancelAdmission: (id) => del(`/admissions/${id}`),
  getInpatientDetails: (id) => get(`/admissions/${id}`),
  addInpatientNote: (id, data) => post(`/admissions/${id}/notes`, data),
  dischargePatient: (id, data) => post(`/admissions/${id}/discharge`, data),

  // --- Laboratory ---
  getLabTests: () => get('/config/lab-tests'),
  getPendingLabRequests: () => get('/lab/requests'),
  // FIX: Added lab request management methods
  createLabRequest: (data) => post('/lab/requests', data),
  completeLabRequest: (id, data) => post(`/lab/requests/${id}/complete`, data),

  // --- Nurse Services ---
  getNurseServices: () => get('/config/nurse-services'),

  // --- Operations ---
  getScheduledOperations: () => get('/operations'),
  getOperations: () => get('/config/operations'),
  // FIX: Added operation management methods
  createOperation: (data) => post('/operations', data),
  processOperationRequest: (id, data) => post(`/operations/${id}/process`, data),
  completeOperation: (id) => post(`/operations/${id}/complete`),

  // --- Configuration Catalogs ---
  getBeds: () => get('/config/beds'),
  // FIX: Added catalog CRUD methods for beds, insurance, etc.
  addBed: (data) => post('/config/beds', data),
  updateBed: (id, data) => put(`/config/beds/${id}`, data),
  deleteBed: (id) => del(`/config/beds/${id}`),
  markBedClean: (id) => put(`/config/beds/${id}/clean`),

  getInsuranceProviders: () => get('/config/insurance-providers'),
  addInsuranceProvider: (data) => post('/config/insurance-providers', data),
  updateInsuranceProvider: (id, data) => put(`/config/insurance-providers/${id}`, data),
  deleteInsuranceProvider: (id) => del(`/config/insurance-providers/${id}`),

  getPaymentMethods: () => get('/config/payment-methods'),
  addPaymentMethod: (data) => post('/config/payment-methods', data),
  updatePaymentMethod: (id, data) => put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id) => del(`/config/payment-methods/${id}`),

  getTaxRates: () => get('/config/tax-rates'),
  addTaxRate: (data) => post('/config/tax-rates', data),
  updateTaxRate: (id, data) => put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id) => del(`/config/tax-rates/${id}`),

  getDepartments: () => get('/config/departments'),
  addDepartment: (data) => post('/config/departments', data),
  updateDepartment: (id, data) => put(`/config/departments/${id}`, data),
  deleteDepartment: (id) => del(`/config/departments/${id}`),

  getSpecializations: () => get('/config/specializations'),
  addSpecialization: (data) => post('/config/specializations', data),
  updateSpecialization: (id, data) => put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id) => del(`/config/specializations/${id}`),

  getBanks: () => get('/config/banks'),
  addBank: (data) => post('/config/banks', data),
  updateBank: (id, data) => put(`/config/banks/${id}`, data),
  deleteBank: (id) => del(`/config/banks/${id}`),

  addOperationCatalog: (data) => post('/config/operations', data),
  updateOperationCatalog: (id, data) => put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id) => del(`/config/operations/${id}`),

  // --- System Management ---
  getSystemUsers: () => get('/config/users'),
  addSystemUser: (data) => post('/config/users', data),
  updateSystemUser: (id, data) => put(`/config/users/${id}`, data),
  deleteSystemUser: (id) => del(`/config/users/${id}`),

  getRolePermissions: () => get('/config/permissions'),
  updateRolePermissions: (role, permissions) => put(`/config/permissions/${role}`, { permissions }),

  checkSystemHealth: () => get('/config/health'),
  
  // --- Profile & Auth ---
  // FIX: Added profile update methods
  updateProfile: (data) => put('/auth/profile', data),
  changePassword: (data) => put('/auth/password', data),

  // --- Data Tools ---
  // FIX: Added backup and restore methods
  downloadBackup: () => client.get('/config/backup', { responseType: 'blob' }).then(data => {
    const url = window.URL.createObjectURL(new Blob([data as any]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `allcare-backup-${new Date().toISOString().split('T')[0]}.db`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }),
  restoreDatabase: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return post('/config/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  resetDatabase: () => post('/config/reset'),
};
