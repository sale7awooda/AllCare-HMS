import axios from 'axios';

const API_BASE_URL = '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export const api = {
  // Auth
  login: (username: string, password: string) => client.post('/auth/login', { username, password }),
  me: () => client.get('/auth/me'),
  updateProfile: (data: any) => client.put('/auth/profile', data),
  changePassword: (data: any) => client.put('/auth/change-password', data),

  // Patients
  getPatients: () => client.get('/patients'),
  getPatient: (id: number | string) => client.get(`/patients/${id}`),
  addPatient: (data: any) => client.post('/patients', data),
  updatePatient: (id: number | string, data: any) => client.put(`/patients/${id}`, data),

  // Staff (HR)
  getStaff: () => client.get('/hr'),
  addStaff: (data: any) => client.post('/hr', data),
  updateStaff: (id: number | string, data: any) => client.put(`/hr/${id}`, data),

  // Appointments
  getAppointments: () => client.get('/appointments'),
  createAppointment: (data: any) => client.post('/appointments', data),
  updateAppointmentStatus: (id: number, status: string) => client.patch(`/appointments/${id}/status`, { status }),

  // Billing
  getBills: () => client.get('/billing'),
  createBill: (data: any) => client.post('/billing', data),
  recordPayment: (id: number, amount: number) => client.post(`/billing/${id}/pay`, { amount }),

  // Beds & Admissions
  getBeds: () => client.get('/config/beds'),
  getActiveAdmissions: () => client.get('/admissions/active'),
  createAdmission: (data: any) => client.post('/admissions', data),
  getInpatientDetails: (id: number) => client.get(`/admissions/${id}`),
  confirmAdmissionDeposit: (id: number) => client.post(`/admissions/${id}/confirm`),
  addInpatientNote: (id: number, data: any) => client.post(`/admissions/${id}/notes`, data),
  dischargePatient: (id: number, data: any) => client.post(`/admissions/${id}/discharge`, data),

  // Laboratory
  getLabTests: () => client.get('/config/lab-tests'),
  getPendingLabRequests: () => client.get('/lab/requests'),
  createLabRequest: (data: any) => client.post('/lab/requests', data),

  // Nurse
  getNurseServices: () => client.get('/config/nurse-services'),
  createNurseRequest: (data: any) => client.post('/nurse/requests', data),

  // Operations
  getOperations: () => client.get('/config/operations'),
  getScheduledOperations: () => client.get('/medical/requests/operations'),
  createOperation: (data: any) => client.post('/medical/requests/operations', data),
  processOperationRequest: (id: number, payload: any) => client.post(`/medical/requests/operations/${id}/process`, payload),
  confirmOperation: (id: number) => client.post(`/medical/requests/operations/${id}/confirm`),
  completeOperation: (id: number) => client.post(`/medical/requests/operations/${id}/complete`),

  // Configuration - General
  getSystemSettings: () => client.get('/config/settings'),
  getPublicSettings: () => client.get('/config/settings/public'),
  updateSystemSettings: (data: any) => client.put('/config/settings', data),
  
  // Configuration - Departments
  getDepartments: () => client.get('/config/departments'),
  addDepartment: (name: string, description: string) => client.post('/config/departments', { name, description }),
  updateDepartment: (id: number, name: string, description: string) => client.put(`/config/departments/${id}`, { name, description }),
  deleteDepartment: (id: number) => client.delete(`/config/departments/${id}`),

  // Configuration - Users
  getSystemUsers: () => client.get('/config/users'),
  addSystemUser: (data: any) => client.post('/config/users', data),
  updateSystemUser: (id: number, data: any) => client.put(`/config/users/${id}`, data),
  deleteSystemUser: (id: number) => client.delete(`/config/users/${id}`),

  // Configuration - Financial
  getTaxRates: () => client.get('/config/tax-rates'),
  addTaxRate: (data: any) => client.post('/config/tax-rates', data),
  updateTaxRate: (id: number, data: any) => client.put(`/config/tax-rates/${id}`, data),
  deleteTaxRate: (id: number) => client.delete(`/config/tax-rates/${id}`),
  
  getPaymentMethods: () => client.get('/config/payment-methods'),
  addPaymentMethod: (data: any) => client.post('/config/payment-methods', data),
  updatePaymentMethod: (id: number, data: any) => client.put(`/config/payment-methods/${id}`, data),
  deletePaymentMethod: (id: number) => client.delete(`/config/payment-methods/${id}`),

  // Configuration - Beds
  getConfigBeds: () => client.get('/config/beds'),
  addBed: (data: any) => client.post('/config/beds', data),
  updateBed: (id: number, data: any) => client.put(`/config/beds/${id}`, data),
  deleteBed: (id: number) => client.delete(`/config/beds/${id}`),

  // Configuration - Catalogs
  addLabTest: (data: any) => client.post('/config/lab-tests', data),
  updateLabTest: (id: number, data: any) => client.put(`/config/lab-tests/${id}`, data),
  deleteLabTest: (id: number) => client.delete(`/config/lab-tests/${id}`),

  addNurseService: (data: any) => client.post('/config/nurse-services', data),
  updateNurseService: (id: number, data: any) => client.put(`/config/nurse-services/${id}`, data),
  deleteNurseService: (id: number) => client.delete(`/config/nurse-services/${id}`),

  addOperationCatalog: (data: any) => client.post('/config/operations', data),
  updateOperationCatalog: (id: number, data: any) => client.put(`/config/operations/${id}`, data),
  deleteOperationCatalog: (id: number) => client.delete(`/config/operations/${id}`),

  // Data Management
  downloadBackup: () => {
    window.location.href = `${API_BASE_URL}/config/backup/download?token=${localStorage.getItem('token')}`;
  },
  restoreDatabase: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post('/config/backup/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  defaults: { baseURL: API_BASE_URL }
};
