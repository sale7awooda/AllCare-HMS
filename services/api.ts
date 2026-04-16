
import axios from 'axios';
import { 
  User, Notification, Patient, MedicalStaff, Attendance, LeaveRequest, 
  FinancialAdjustment, PayrollRecord, Appointment, Bill, Transaction,
  LabTestCatalog, NurseServiceCatalog, Bed, OperationCatalog, InsuranceProvider,
  TaxRate, PaymentMethod, Bank
} from '../types';

// Helper to determine the correct base URL based on the current environment
const getBaseUrl = () => {
  // If running in Google AI Studio environment, point to the locally hosted Windows backend
  if (window.location.hostname.includes('run.app') || window.location.hostname.includes('google')) {
    return 'http://localhost:3001/api';
  }
  // Otherwise (local network access via static IP), use relative path
  return '/api';
};

const client = axios.create({
  baseURL: getBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Robust header setting for current Axios versions
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (response) => {
    const data = response.data;
    // Automatically unwrap paginated responses to maintain compatibility with existing components
    if (data && typeof data === 'object' && Array.isArray(data.data) && data.meta) {
      return data.data;
    }
    return data;
  },
  async (error: any) => {
    const config = error.config;
    const response = error.response;
    
    // Auto-retry once on 429
    if (response?.status === 429 && !(config as any)._retry) {
      (config as any)._retry = true;
      console.warn('Rate limit hit, retrying in 1s...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      return client(config);
    }

    // Identify polling requests to exclude from aggressive retries
    const isPolling = config?.url?.includes('/config/settings/public') || 
                      config?.url?.includes('/config/health') || 
                      config?.url?.includes('/notifications');

    // Authentication failure (No token or invalid token)
    if (response?.status === 401) {
      // If the refresh token itself failed, or if we are logging in, abort
      if (config.url === '/auth/refresh' || config.url === '/auth/login') {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:expired'));
        return Promise.reject(error);
      }

      const originalRequest = config;
      if (!(originalRequest as any)._retry) {
        (originalRequest as any)._retry = true;

        if (isRefreshing) {
          return new Promise(function(resolve, reject) {
            failedQueue.push({ resolve, reject });
          }).then(token => {
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
            }
            return client(originalRequest);
          }).catch(err => {
            return Promise.reject(err);
          });
        }

        isRefreshing = true;

        try {
          const res = await axios.post(`${getBaseUrl()}/auth/refresh`, {}, { withCredentials: true });
          const newToken = res.data.token;
          
          if (!newToken) throw new Error('Refresh failed - No token returned');

          localStorage.setItem('token', newToken);
          client.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          
          if (originalRequest.headers) {
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
          
          processQueue(null, newToken);
          return client(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('token');
          window.dispatchEvent(new Event('auth:expired'));
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    } 

    // Authorization failure (Authenticated but no permission)
    if (response?.status === 403) {
      console.error('[API 403] Access forbidden:', config?.url);
    }

    // Aggressive Auto-retry on Network Error
    if ((error.code === 'ERR_NETWORK' || error.message === 'Network Error') && !(config as any)._retryNetwork && !isPolling) {
        (config as any)._retryNetworkCount = ((config as any)._retryNetworkCount || 0) + 1;
        const MAX_RETRIES = 5; 
        if ((config as any)._retryNetworkCount <= MAX_RETRIES) {
            const delay = 2000;
            console.log(`Backend unreachable. Retrying in ${delay}ms... (${(config as any)._retryNetworkCount}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            (config as any)._retryNetwork = true;
            return client(config);
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
  login: (username: string, password: string): Promise<{ token: string; user: User }> => post('/auth/login', { username, password }),
  me: (): Promise<User> => get('/auth/me'),
  updateProfile: (data: Partial<User>): Promise<User> => put('/auth/profile', data),
  changePassword: (data: any): Promise<{ success: boolean }> => put('/auth/password', data),
  checkSystemHealth: (): Promise<any> => get('/config/health'),

  // Notifications
  getNotifications: (): Promise<Notification[]> => get('/notifications'),
  markNotificationRead: (id: number): Promise<void> => put(`/notifications/${id}/read`),
  markAllNotificationsRead: (): Promise<void> => put('/notifications/read-all'),

  // Patients
  getPatients: (): Promise<Patient[]> => get('/patients'),
  getPatient: (id: number): Promise<Patient> => get(`/patients/${id}`),
  addPatient: (data: Partial<Patient>): Promise<Patient> => post('/patients', data),
  updatePatient: (id: number, data: Partial<Patient>): Promise<Patient> => put(`/patients/${id}`, data),

  // HR & Staff
  getStaff: (): Promise<MedicalStaff[]> => get('/hr'),
  addStaff: (data: Partial<MedicalStaff>): Promise<MedicalStaff> => post('/hr', data),
  updateStaff: (id: number, data: Partial<MedicalStaff>): Promise<MedicalStaff> => put(`/hr/${id}`, data),
  getAttendance: (date: string): Promise<Attendance[]> => get(`/hr/attendance?date=${date}`),
  markAttendance: (data: any): Promise<void> => post('/hr/attendance', data),
  getLeaves: (): Promise<LeaveRequest[]> => get('/hr/leaves'),
  requestLeave: (data: any): Promise<LeaveRequest> => post('/hr/leaves', data),
  updateLeaveStatus: (id: number, status: string): Promise<void> => put(`/hr/leaves/${id}`, { status }),
  getPayroll: (month: string): Promise<PayrollRecord[]> => get(`/hr/payroll?month=${month}`),
  generatePayroll: (data: any): Promise<void> => post('/hr/payroll/generate', data),
  updatePayrollStatus: (id: number, data: any): Promise<void> => put(`/hr/payroll/${id}/status`, data),
  getFinancials: (type: string): Promise<FinancialAdjustment[]> => get(`/hr/financials?type=${type}`), 
  addAdjustment: (data: any): Promise<FinancialAdjustment> => post('/hr/financials', data), 
  updateFinancialStatus: (id: number, status: string): Promise<void> => put(`/hr/financials/${id}/status`, { status }),

  // Appointments
  getAppointments: (): Promise<Appointment[]> => get('/appointments'),
  createAppointment: (data: any): Promise<Appointment> => post('/appointments', data),
  updateAppointment: (id: number, data: any): Promise<Appointment> => put(`/appointments/${id}`, data),
  updateAppointmentStatus: (id: number, status: string): Promise<void> => put(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id: number): Promise<void> => put(`/appointments/${id}/cancel`),

  // Billing
  getBills: (): Promise<Bill[]> => get('/billing'),
  createBill: (data: any): Promise<Bill> => post('/billing', data),
  recordPayment: (id: number, data: any): Promise<void> => post(`/billing/${id}/pay`, data), 
  processRefund: (id: number, data: any): Promise<void> => post(`/billing/${id}/refund`, data),
  cancelService: (id: number): Promise<void> => post(`/billing/${id}/cancel-service`), 
  getTransactions: (): Promise<Transaction[]> => get('/treasury/transactions'),
  addExpense: (data: any): Promise<Transaction> => post('/treasury/expenses', data),
  updateExpense: (id: number, data: any): Promise<Transaction> => put(`/treasury/expenses/${id}`, data),

  // Admissions
  getActiveAdmissions: (): Promise<any[]> => get('/admissions'),
  getAdmissionsHistory: (): Promise<any[]> => get('/admissions/history'),
  getInpatientDetails: (id: number): Promise<any> => get(`/admissions/${id}`),
  createAdmission: (data: any): Promise<any> => post('/admissions', data),
  confirmAdmissionDeposit: (id: number): Promise<void> => post(`/admissions/${id}/confirm`),
  cancelAdmission: (id: number): Promise<void> => put(`/admissions/${id}/cancel`),
  addInpatientNote: (id: number, data: any): Promise<void> => post(`/admissions/${id}/notes`, data),
  dischargePatient: (id: number, data: any): Promise<void> => post(`/admissions/${id}/discharge`, data),
  settleAndDischarge: (id: number, data: any): Promise<void> => post(`/admissions/${id}/settle_and_discharge`, data),
  generateSettlementBill: (id: number): Promise<Bill> => post(`/admissions/${id}/generate-settlement`),
  markBedClean: (id: number): Promise<void> => put(`/admissions/beds/${id}/clean`),

  // Lab
  getLabTests: (): Promise<LabTestCatalog[]> => get('/config/lab-tests'),
  getPendingLabRequests: (): Promise<any[]> => get('/lab/requests'),
  createLabRequest: (data: any): Promise<any> => post('/lab/requests', data),
  completeLabRequest: (id: number, data: any): Promise<void> => post(`/lab/requests/${id}/complete`, data),
  confirmLabRequest: (id: number): Promise<void> => post(`/lab/requests/${id}/confirm`),
  reopenLabRequest: (id: number): Promise<void> => post(`/lab/requests/${id}/reopen`),

  // Nurse
  getNurseServices: (): Promise<NurseServiceCatalog[]> => get('/config/nurse-services'),
  createNurseRequest: (data: any): Promise<any> => post('/nurse/requests', data),
  getNurseRequests: (): Promise<any[]> => get('/nurse/requests'),

  // Operations
  getScheduledOperations: (): Promise<any[]> => get('/operations'),
  getOperations: (): Promise<OperationCatalog[]> => get('/config/operations'),
  createOperation: (data: any): Promise<any> => post('/operations', data),
  processOperationRequest: (id: number, data: any): Promise<void> => post(`/operations/${id}/process`, data),
  completeOperation: (id: number): Promise<void> => post(`/operations/${id}/complete`),
  confirmOperation: (id: number): Promise<void> => post(`/operations/${id}/confirm`),

  // Config & Administration
  getSystemSettings: (): Promise<any> => get('/config/settings'),
  getPublicSettings: (): Promise<any> => get('/config/settings/public'),
  updateSystemSettings: (data: any): Promise<void> => put('/config/settings', data),
  getSystemUsers: (): Promise<User[]> => get('/config/users'),
  addSystemUser: (data: Partial<User>): Promise<User> => post('/config/users', data),
  updateSystemUser: (id: number, data: Partial<User>): Promise<User> => put(`/config/users/${id}`, data),
  deleteSystemUser: (id: number): Promise<void> => del(`/config/users/${id}`),
  getRolePermissions: (): Promise<any> => get('/config/permissions'),
  updateRolePermissions: (role: string, permissions: string[]): Promise<void> => put(`/config/permissions/${role}`, { permissions }),

  getDepartments: (): Promise<any[]> => get('/config/departments'),
  addDepartment: (data: any): Promise<any> => post('/config/departments', data),
  updateDepartment: (id: number, data: any): Promise<any> => put(`/config/departments/${id}`, data),
  deleteDepartment: (id: number): Promise<void> => del(`/config/departments/${id}`),
  getSpecializations: (): Promise<any[]> => get('/config/specializations'),
  addSpecialization: (data: any): Promise<any> => post('/config/specializations', data),
  updateSpecialization: (id: number, data: any): Promise<any> => put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id: number): Promise<void> => del(`/config/specializations/${id}`),
  getBeds: (): Promise<Bed[]> => get('/config/beds'), 
  addBed: (data: Partial<Bed>): Promise<Bed> => post('/config/beds', data),
  updateBed: (id: number, data: Partial<Bed>): Promise<Bed> => put(`/config/beds/${id}`, data),
  deleteBed: (id: number): Promise<void> => del(`/config/beds/${id}`),
  addLabTest: (data: Partial<LabTestCatalog>): Promise<LabTestCatalog> => post('/config/lab-tests', data),
  updateLabTest: (id: number, data: Partial<LabTestCatalog>): Promise<LabTestCatalog> => put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id: number): Promise<void> => del(`/config/lab-tests/${id}`),
  addNurseService: (data: Partial<NurseServiceCatalog>): Promise<NurseServiceCatalog> => post('/config/nurse-services', data),
  updateNurseService: (id: number, data: Partial<NurseServiceCatalog>): Promise<NurseServiceCatalog> => put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id: number): Promise<void> => del(`/config/nurse-services/${id}`),
  addOperationCatalog: (data: Partial<OperationCatalog>): Promise<OperationCatalog> => post('/config/operations', data),
  updateOperationCatalog: (id: number, data: Partial<OperationCatalog>): Promise<OperationCatalog> => put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id: number): Promise<void> => del(`/config/operations/${id}`),
  
  getInsuranceProviders: (): Promise<InsuranceProvider[]> => get('/config/insurance-providers'),
  addInsuranceProvider: (data: Partial<InsuranceProvider>): Promise<InsuranceProvider> => post('/config/insurance-providers', data),
  updateInsuranceProvider: (id: number, data: Partial<InsuranceProvider>): Promise<InsuranceProvider> => put(`/config/insurance-providers/${id}`, data),
  deleteInsuranceProvider: (id: number): Promise<void> => del(`/config/insurance-providers/${id}`),
  getBanks: (): Promise<Bank[]> => get('/config/banks'),
  addBank: (data: Partial<Bank>): Promise<Bank> => post('/config/banks', data),
  updateBank: (id: number, data: Partial<Bank>): Promise<Bank> => put(`/config/banks/${id}`, data),
  deleteBank: (id: number): Promise<void> => del(`/config/banks/${id}`),
  getTaxRates: (): Promise<TaxRate[]> => get('/config/tax-rates'),
  addTaxRate: (data: Partial<TaxRate>): Promise<TaxRate> => post('/config/tax-rates', data),
  updateTaxRate: (id: number, data: Partial<TaxRate>): Promise<TaxRate> => put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id: number): Promise<void> => del(`/config/tax-rates/${id}`),
  getPaymentMethods: (): Promise<PaymentMethod[]> => get('/config/payment-methods'),
  addPaymentMethod: (data: Partial<PaymentMethod>): Promise<PaymentMethod> => post('/config/payment-methods', data),
  updatePaymentMethod: (id: number, data: Partial<PaymentMethod>): Promise<PaymentMethod> => put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id: number): Promise<void> => del(`/config/payment-methods/${id}`),

  downloadBackup: async (): Promise<void> => {
    try {
        const response = await client.get('/config/backup', { responseType: 'blob' });
        // Response is unwrapped by interceptor to be data (the blob)
        const blob = new Blob([response as any], { type: 'application/x-sqlite3' });
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
  restoreDatabase: (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('backup', file);
    return post('/config/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  resetDatabase: (): Promise<any> => post('/config/reset'),
};
