import axios from 'axios';

// Helper to determine the correct base URL based on the current environment
const getBaseUrl = () => {
  // Use relative path '/api' to ensure same-origin requests work across all environments.
  // This is critical for Railway and other proxy-based deployments.
  return '/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: { 
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  // Increased timeout to 60s to handle backend cold starts on Railway/Render/etc.
  timeout: 60000, 
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const { config, response } = error;
    
    // 1. Handle Rate Limiting (429)
    if (response?.status === 429 && !config._retry) {
      config._retry = true;
      console.warn('[API] Rate limit hit, retrying in 2s...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      return client(config);
    }

    // 2. Handle Network Errors / Backend Unreachable
    // This specifically targets ERR_NETWORK, timeout, and cases where response is undefined
    const isNetworkError = error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !error.response;
    
    if (isNetworkError && !config._retryNetwork) {
        config._retryNetworkCount = (config._retryNetworkCount || 0) + 1;
        const MAX_RETRIES = 5; 
        
        if (config._retryNetworkCount <= MAX_RETRIES) {
            const delay = 2500; // Slightly longer delay for retries
            const targetUrl = config.url ? (config.baseURL ? config.baseURL + config.url : config.url) : 'unknown';
            
            console.log(`[API] Backend unreachable at ${targetUrl}. Attempt ${config._retryNetworkCount}/${MAX_RETRIES}. Retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return client(config);
        }
    }

    // 3. Handle Session Expiry (401)
    if (error.response?.status === 401) {
      const isLoginRequest = config.url?.includes('/auth/login');
      const isPublicRequest = config.url?.includes('/config/settings/public');
      
      if (!isLoginRequest && !isPublicRequest) {
        console.warn('[API] Session expired. Clearing token.');
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:expired'));
      }
    } 
    
    // 4. Enhance Error Message for User
    if (isNetworkError) {
        const isBackgroundPolling = config.url?.includes('/notifications') || config.url?.includes('/config/health');
        if (!isBackgroundPolling) {
            const enhancedError = new Error('Network Error: The hospital backend is currently unreachable. This may be due to a server restart or network connection issues.');
            (enhancedError as any).code = 'ERR_NETWORK';
            (enhancedError as any).isNetworkError = true;
            return Promise.reject(enhancedError);
        }
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
  updateProfile: (data) => put('/auth/profile', data),
  changePassword: (data) => put('/auth/password', data),
  checkSystemHealth: () => get('/config/health'),

  // Notifications
  getNotifications: () => get('/notifications'),
  markNotificationRead: (id) => put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => put('/notifications/read-all'),

  getPatients: () => get('/patients'),
  getPatient: (id) => get(`/patients/${id}`),
  addPatient: (data) => post('/patients', data),
  updatePatient: (id, data) => put(`/patients/${id}`, data),

  getStaff: () => get('/hr'),
  addStaff: (data) => post('/hr', data),
  updateStaff: (id, data) => put(`/hr/${id}`, data),
  getAttendance: (date) => get(`/hr/attendance?date=${date}`),
  markAttendance: (data) => post('/hr/attendance', data),
  getLeaves: () => get('/hr/leaves'),
  requestLeave: (data) => post('/hr/leaves', data),
  updateLeaveStatus: (id, status) => put(`/hr/leaves/${id}`, { status }),
  getPayroll: (month) => get(`/hr/payroll?month=${month}`),
  generatePayroll: (data) => post('/hr/payroll/generate', data),
  updatePayrollStatus: (id, data) => put(`/hr/payroll/${id}/status`, data),
  getFinancials: (type) => get(`/hr/financials?type=${type}`), 
  addAdjustment: (data) => post('/hr/financials', data), 

  getAppointments: () => get('/appointments'),
  createAppointment: (data) => post('/appointments', data),
  updateAppointment: (id, data) => put(`/appointments/${id}`, data),
  updateAppointmentStatus: (id, status) => put(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id) => put(`/appointments/${id}/cancel`),

  getBills: () => get('/billing'),
  createBill: (data) => post('/billing', data),
  recordPayment: (id, data) => post(`/billing/${id}/pay`, data), 
  processRefund: (id, data) => post(`/billing/${id}/refund`, data),
  cancelService: (id) => post(`/billing/${id}/cancel-service`), 
  getTransactions: () => get('/treasury/transactions'),
  addExpense: (data) => post('/treasury/expenses', data),
  updateExpense: (id, data) => put(`/treasury/expenses/${id}`, data),

  getActiveAdmissions: () => get('/admissions'),
  getAdmissionsHistory: () => get('/admissions/history'),
  getInpatientDetails: (id) => get(`/admissions/${id}`),
  createAdmission: (data) => post('/admissions', data),
  confirmAdmissionDeposit: (id) => post(`/admissions/${id}/confirm`),
  cancelAdmission: (id) => put(`/admissions/${id}/cancel`),
  addInpatientNote: (id, data) => post(`/admissions/${id}/notes`, data),
  dischargePatient: (id, data) => post(`/admissions/${id}/discharge`, data),
  settleAndDischarge: (id, data) => post(`/admissions/${id}/settle_and_discharge`, data),
  generateSettlementBill: (id) => post(`/admissions/${id}/generate-settlement`),
  markBedClean: (id) => put(`/admissions/beds/${id}/clean`),

  getLabTests: () => get('/config/lab-tests'),
  getPendingLabRequests: () => get('/lab/requests'),
  createLabRequest: (data) => post('/lab/requests', data),
  completeLabRequest: (id, data) => post(`/lab/requests/${id}/complete`),
  confirmLabRequest: (id) => post(`/lab/requests/${id}/confirm`),

  getNurseServices: () => get('/config/nurse-services'),
  createNurseRequest: (data) => post('/nurse/requests', data),
  getNurseRequests: () => get('/nurse/requests'),

  getScheduledOperations: () => get('/operations'),
  getOperations: () => get('/config/operations'),
  createOperation: (data) => post('/operations', data),
  processOperationRequest: (id, data) => post(`/operations/${id}/process`, data),
  completeOperation: (id) => post(`/operations/${id}/complete`),
  confirmOperation: (id) => post(`/operations/${id}/confirm`),

  getSystemSettings: () => get('/config/settings'),
  getPublicSettings: () => get('/config/settings/public'),
  updateSystemSettings: (data) => put('/config/settings', data),
  getSystemUsers: () => get('/config/users'),
  addSystemUser: (data) => post('/config/users', data),
  updateSystemUser: (id, data) => put(`/config/users/${id}`, data),
  deleteSystemUser: (id) => del(`/config/users/${id}`),
  getRolePermissions: () => get('/config/permissions'),
  updateRolePermissions: (role, permissions) => put(`/config/permissions/${role}`, { permissions }),

  getDepartments: () => get('/config/departments'),
  addDepartment: (data) => post('/config/departments', data),
  updateDepartment: (id, data) => put(`/config/departments/${id}`, data),
  deleteDepartment: (id) => del(`/config/departments/${id}`),
  getSpecializations: () => get('/config/specializations'),
  addSpecialization: (data) => post('/config/specializations', data),
  updateSpecialization: (id, data) => put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id) => del(`/config/specializations/${id}`),
  getBeds: () => get('/config/beds'), 
  addBed: (data) => post('/config/beds', data),
  updateBed: (id, data) => put(`/config/beds/${id}`, data),
  deleteBed: (id) => del(`/config/beds/${id}`),
  addLabTest: (data) => post('/config/lab-tests', data),
  updateLabTest: (id, data) => put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id) => del(`/config/lab-tests/${id}`),
  addNurseService: (data) => post('/config/nurse-services', data),
  updateNurseService: (id, data) => put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id) => del(`/config/nurse-services/${id}`),
  addOperationCatalog: (data) => post('/config/operations', data),
  updateOperationCatalog: (id, data) => put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id) => del(`/config/operations/${id}`),
  
  getInsuranceProviders: () => get('/config/insurance-providers'),
  addInsuranceProvider: (data) => post('/config/insurance-providers', data),
  updateInsuranceProvider: (id, data) => put(`/config/insurance-providers/${id}`, data),
  deleteInsuranceProvider: (id) => del(`/config/insurance-providers/${id}`),
  getBanks: () => get('/config/banks'),
  addBank: (data) => post('/config/banks', data),
  updateBank: (id, data) => put(`/config/banks/${id}`, data),
  deleteBank: (id) => del(`/config/banks/${id}`),
  getTaxRates: () => get('/config/tax-rates'),
  addTaxRate: (data) => post('/config/tax-rates', data),
  updateTaxRate: (id, data) => put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id) => del(`/config/tax-rates/${id}`),
  getPaymentMethods: () => get('/config/payment-methods'),
  addPaymentMethod: (data) => post('/config/payment-methods', data),
  updatePaymentMethod: (id, data) => put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id) => del(`/config/payment-methods/${id}`),

  downloadBackup: async () => {
    try {
        const response = await client.get('/config/backup', { responseType: 'blob' });
        const blob = new Blob([response], { type: 'application/x-sqlite3' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `allcare-backup-${new Date().toISOString().split('T')[0]}.db`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Backup download error:", e);
        throw e;
    }
  },
  restoreDatabase: (file) => {
    const formData = new FormData();
    formData.append('backup', file);
    return post('/config/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  resetDatabase: () => post('/config/reset'),
};
