
const API_URL = '/api';

// Helper function to get headers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (response: Response) => {
  if (response.status === 401) {
    localStorage.removeItem('token');
    // Optional: Redirect to login or dispatch event
    // window.location.href = '/login'; 
    throw new Error('Session expired. Please login again.');
  }
  
  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
      return null;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'API Error');
    }
    return data;
  } else {
    // Handle non-JSON responses if needed, or error out
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'API Error');
    }
    return response.text(); 
  }
};

const request = async (method: string, endpoint: string, body?: any) => {
  const config: RequestInit = {
    method,
    headers: getHeaders(),
  };
  if (body) {
    config.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${endpoint}`, config);
  return handleResponse(response);
};

const get = (endpoint: string) => request('GET', endpoint);
const post = (endpoint: string, body?: any) => request('POST', endpoint, body);
const put = (endpoint: string, body?: any) => request('PUT', endpoint, body);
const del = (endpoint: string) => request('DELETE', endpoint);

const upload = async (endpoint: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(response);
};

const download = async (endpoint: string) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'GET',
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });
    
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Attempt to extract filename from content-disposition header if available
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (contentDisposition) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches != null && matches[1]) { 
            filename = matches[1]; 
        }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

export const api = {
  // Auth
  login: (username: string, password: string) => post('/auth/login', { username, password }),
  me: () => get('/auth/me'),
  updateProfile: (data: any) => put('/auth/profile', data),
  changePassword: (data: any) => put('/auth/change-password', data),

  // Patients
  getPatients: () => get('/patients'),
  getPatient: (id: number | string) => get(`/patients/${id}`),
  addPatient: (data: any) => post('/patients', data),
  updatePatient: (id: number | string, data: any) => put(`/patients/${id}`, data),

  // Staff
  getStaff: () => get('/staff'),
  addStaff: (data: any) => post('/staff', data),
  updateStaff: (id: number | string, data: any) => put(`/staff/${id}`, data),
  getAttendance: (date: string) => get(`/staff/attendance?date=${date}`),
  markAttendance: (data: any) => post('/staff/attendance', data),
  getLeaves: () => get('/staff/leaves'),
  requestLeave: (data: any) => post('/staff/leaves', data),
  updateLeaveStatus: (id: number, status: string) => put(`/staff/leaves/${id}/status`, { status }),
  getPayroll: (month: string) => get(`/staff/payroll?month=${month}`),
  generatePayroll: (data: any) => post('/staff/payroll/generate', data),
  updatePayrollStatus: (id: number, data: any) => put(`/staff/payroll/${id}/status`, data),
  getFinancials: (type: string) => get(`/staff/financials?type=${type}`),
  addAdjustment: (data: any) => post('/staff/financials', data),

  // Appointments
  getAppointments: () => get('/appointments'),
  createAppointment: (data: any) => post('/appointments', data),
  updateAppointment: (id: number | string, data: any) => put(`/appointments/${id}`, data),
  updateAppointmentStatus: (id: number, status: string) => put(`/appointments/${id}/status`, { status }),
  cancelAppointment: (id: number) => put(`/appointments/${id}/cancel`),

  // Billing
  getBills: () => get('/billing'),
  createBill: (data: any) => post('/billing', data),
  recordPayment: (id: number, data: any) => post(`/billing/${id}/pay`, data),
  processRefund: (id: number, data: any) => post(`/billing/${id}/refund`, data),
  cancelService: (id: number) => put(`/billing/${id}/cancel-service`),
  getTransactions: () => get('/billing/transactions'),
  addExpense: (data: any) => post('/billing/expenses', data),
  updateExpense: (id: number, data: any) => put(`/billing/expenses/${id}`, data),

  // Medical
  getLabTests: () => get('/config/lab-tests'),
  getPendingLabRequests: () => get('/medical/lab/requests'),
  createLabRequest: (data: any) => post('/medical/lab/requests', data),
  completeLabRequest: (id: number, data: any) => post(`/medical/lab/requests/${id}/complete`, data),
  
  getNurseServices: () => get('/config/nurse-services'),
  
  getScheduledOperations: () => get('/medical/operations'),
  createOperation: (data: any) => post('/medical/operations', data),
  processOperationRequest: (id: number | string, data: any) => post(`/medical/operations/${id}/process`, data),
  completeOperation: (id: number) => post(`/medical/operations/${id}/complete`),
  payOperationShare: (id: number | string, data: any) => post(`/medical/operations/${id}/pay-share`, data),

  // Admissions
  getActiveAdmissions: () => get('/medical/admissions'),
  createAdmission: (data: any) => post('/medical/admissions', data),
  getInpatientDetails: (id: number | string) => get(`/medical/admissions/${id}`),
  addInpatientNote: (id: number | string, data: any) => post(`/medical/admissions/${id}/notes`, data),
  dischargePatient: (id: number | string, data: any) => post(`/medical/admissions/${id}/discharge`, data),
  cancelAdmission: (id: number | string) => put(`/medical/admissions/${id}/cancel`),
  confirmAdmissionDeposit: (id: number | string) => post(`/medical/admissions/${id}/confirm`),
  markBedClean: (id: number | string) => put(`/config/beds/${id}/clean`),
  getAdmissionHistory: () => get('/medical/admissions/history'),

  // Pharmacy
  getPharmacyInventory: () => get('/pharmacy/inventory'),
  addPharmacyInventory: (data: any) => post('/pharmacy/inventory', data),
  updatePharmacyInventory: (id: number, data: any) => put(`/pharmacy/inventory/${id}`, data),
  deletePharmacyInventory: (id: number) => del(`/pharmacy/inventory/${id}`),
  dispenseDrugs: (data: any) => post('/pharmacy/dispense', data),

  // Config
  getPublicSettings: () => get('/config/public-settings'),
  getSystemSettings: () => get('/config/settings'),
  updateSettings: (data: any) => put('/config/settings', data),
  
  getSystemUsers: () => get('/config/users'),
  addSystemUser: (data: any) => post('/config/users', data),
  updateSystemUser: (id: number, data: any) => put(`/config/users/${id}`, data),
  deleteSystemUser: (id: number) => del(`/config/users/${id}`),
  
  getRolePermissions: () => get('/config/permissions'),
  updateRolePermissions: (role: string, permissions: string[]) => put(`/config/permissions/${role}`, { permissions }),
  
  getDepartments: () => get('/config/departments'),
  addDepartment: (data: any) => post('/config/departments', data),
  updateDepartment: (id: number, data: any) => put(`/config/departments/${id}`, data),
  deleteDepartment: (id: number) => del(`/config/departments/${id}`),

  getSpecializations: () => get('/config/specializations'),
  addSpecialization: (data: any) => post('/config/specializations', data),
  updateSpecialization: (id: number, data: any) => put(`/config/specializations/${id}`, data),
  deleteSpecialization: (id: number) => del(`/config/specializations/${id}`),

  addLabTest: (data: any) => post('/config/lab-tests', data),
  updateLabTest: (id: number, data: any) => put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id: number) => del(`/config/lab-tests/${id}`),

  addNurseService: (data: any) => post('/config/nurse-services', data),
  updateNurseService: (id: number, data: any) => put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id: number) => del(`/config/nurse-services/${id}`),

  getOperations: () => get('/config/operations'), // Catalog
  addOperationCatalog: (data: any) => post('/config/operations', data),
  updateOperationCatalog: (id: number, data: any) => put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id: number) => del(`/config/operations/${id}`),

  getInsuranceProviders: () => get('/config/insurance'),
  addInsuranceProvider: (data: any) => post('/config/insurance', data),
  updateInsuranceProvider: (id: number, data: any) => put(`/config/insurance/${id}`, data),
  deleteInsuranceProvider: (id: number) => del(`/config/insurance/${id}`),

  getBanks: () => get('/config/banks'),
  addBank: (data: any) => post('/config/banks', data),
  updateBank: (id: number, data: any) => put(`/config/banks/${id}`, data),
  deleteBank: (id: number) => del(`/config/banks/${id}`),

  getTaxRates: () => get('/config/tax-rates'),
  addTaxRate: (data: any) => post('/config/tax-rates', data),
  updateTaxRate: (id: number, data: any) => put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id: number) => del(`/config/tax-rates/${id}`),

  getPaymentMethods: () => get('/config/payment-methods'),
  addPaymentMethod: (data: any) => post('/config/payment-methods', data),
  updatePaymentMethod: (id: number, data: any) => put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id: number) => del(`/config/payment-methods/${id}`),

  getBeds: () => get('/config/beds'),
  addBed: (data: any) => post('/config/beds', data),
  updateBed: (id: number, data: any) => put(`/config/beds/${id}`, data),
  deleteBed: (id: number) => del(`/config/beds/${id}`),

  // Diagnostics
  checkSystemHealth: () => get('/config/health'),
  downloadBackup: () => download('/config/backup/download'),
  restoreDatabase: (file: File) => upload('/config/backup/restore', file),
  resetDatabase: () => post('/config/reset'),
};
