
import axios from 'axios';
import { Patient, Appointment, MedicalStaff, Bill, User, LabTestCatalog, NurseServiceCatalog, Bed, OperationCatalog, TaxRate, PaymentMethod } from '../types';

// NETWORK CONFIGURATION
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isRailwayProduction = window.location.hostname.includes('railway.app'); 

const RAILWAY_BACKEND_URL = 'https://allcare.up.railway.app/api';

const API_BASE_URL = isLocal 
  ? '/api' 
  : (isRailwayProduction ? '/api' : RAILWAY_BACKEND_URL);

console.log(`🔗 Network Mode: ${isLocal ? 'Local Dev Proxy' : (isRailwayProduction ? 'Railway Production (Same Origin)' : 'Cloud IDE Direct Connection')}`);
console.log(`🔗 Connecting to: ${API_BASE_URL}`);

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, 
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API call failed:", error);
    if (error.response?.status === 401 && window.location.hash !== '#/') {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const api = {
  // Auth
  async login(username: string, password?: string): Promise<User> {
    const pwd = password || 'admin123'; 
    const { data } = await client.post('/login', { username, password: pwd }); 
    localStorage.setItem('token', data.token);
    return data.user;
  },
  async getPublicSettings(): Promise<any> {
    const { data } = await client.get('/public/settings');
    return data;
  },
  async me(): Promise<User> {
    const { data } = await client.get('/me');
    return data;
  },
  async updateProfile(data: any): Promise<void> {
    await client.patch('/me/profile', data);
  },
  async changePassword(data: any): Promise<void> {
    await client.patch('/me/password', data);
  },

  // Patients
  async getPatients(): Promise<Patient[]> {
    const { data } = await client.get('/patients');
    return data;
  },
  async getPatient(id: number): Promise<Patient> {
    const { data } = await client.get(`/patients/${id}`);
    return data;
  },
  async addPatient(patient: Partial<Patient>): Promise<Patient> {
    const { data } = await client.post('/patients', patient);
    return data;
  },
  async updatePatient(id: number, patient: Partial<Patient>): Promise<void> {
    await client.patch(`/patients/${id}`, patient);
  },

  // Staff (HR)
  async getStaff(): Promise<MedicalStaff[]> {
    const { data } = await client.get('/hr'); 
    return data;
  },
  async addStaff(staff: Partial<MedicalStaff>): Promise<MedicalStaff> {
    const { data } = await client.post('/hr', staff); 
    return data;
  },
  async updateStaff(id: number, updates: Partial<MedicalStaff>): Promise<void> {
    await client.patch(`/hr/${id}`, updates); 
  },

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    const { data } = await client.get('/appointments');
    return data;
  },
  async createAppointment(apt: Partial<Appointment>): Promise<Appointment> {
    const { data } = await client.post('/appointments', apt);
    return data;
  },
  async updateAppointmentStatus(id: number, status: string): Promise<void> {
    await client.patch(`/appointments/${id}/status`, { status });
  },

  // Billing
  async getBills(): Promise<Bill[]> {
    const { data } = await client.get('/billing');
    return data;
  },
  async createBill(bill: Partial<Bill>): Promise<Bill> {
    const { data } = await client.post('/billing', bill);
    return data;
  },
  async recordPayment(billId: number, amount: number): Promise<void> {
    await client.post(`/billing/${billId}/pay`, { amount });
  },

  // --- MEDICAL MODULES ---
  async getLabTests(): Promise<LabTestCatalog[]> {
    const { data } = await client.get('/medical/tests');
    return data;
  },
  async getNurseServices(): Promise<NurseServiceCatalog[]> {
    const { data } = await client.get('/medical/services');
    return data;
  },
  async getBeds(): Promise<Bed[]> {
    const { data } = await client.get('/medical/beds');
    return data;
  },
  async getOperations(): Promise<OperationCatalog[]> {
    const { data } = await client.get('/medical/operations_catalog'); 
    return data;
  },

  // Requests (Step 1)
  async createLabRequest(payload: any): Promise<void> {
    await client.post('/medical/lab-request', payload);
  },
  async createNurseRequest(payload: any): Promise<void> {
    await client.post('/medical/nurse-request', payload);
  },
  async createAdmission(payload: any): Promise<void> {
    await client.post('/medical/admission', payload);
  },
  async createOperation(payload: any): Promise<void> {
    await client.post('/medical/operation', payload);
  },

  // Confirmations & Management (Step 2)
  async getPendingLabRequests(): Promise<any[]> {
    const { data } = await client.get('/medical/requests/lab');
    return data;
  },
  async confirmLabRequest(id: number): Promise<void> {
    await client.post(`/medical/requests/lab/${id}/confirm`);
  },

  async getActiveAdmissions(): Promise<any[]> {
    const { data } = await client.get('/medical/requests/admissions');
    return data;
  },
  async confirmAdmissionDeposit(id: number): Promise<void> {
    await client.post(`/medical/requests/admissions/${id}/confirm`);
  },
  // Inpatient Management (New)
  async getInpatientDetails(admissionId: number): Promise<any> {
    const { data } = await client.get(`/medical/admissions/${admissionId}`);
    return data;
  },
  async addInpatientNote(admissionId: number, payload: any): Promise<void> {
    await client.post(`/medical/admissions/${admissionId}/note`, payload);
  },
  async dischargePatient(admissionId: number, payload: any): Promise<void> {
    await client.post(`/medical/admissions/${admissionId}/discharge`, payload);
  },

  async getScheduledOperations(): Promise<any[]> {
    const { data } = await client.get('/medical/requests/operations');
    return data;
  },
  async confirmOperation(id: number): Promise<void> {
    await client.post(`/medical/requests/operations/${id}/confirm`);
  },

  // --- CONFIGURATION ---
  defaults: { baseURL: API_BASE_URL },

  async getSystemSettings(): Promise<any> {
    const { data } = await client.get('/config/settings');
    return data;
  },
  async updateSystemSettings(settings: any): Promise<void> {
    await client.post('/config/settings', settings);
  },
  
  // User Management
  async getSystemUsers(): Promise<User[]> {
    const { data } = await client.get('/config/users');
    return data;
  },
  async addSystemUser(user: Partial<User>): Promise<void> {
    await client.post('/config/users', user);
  },
  async updateSystemUser(id: number, user: Partial<User>): Promise<void> {
    await client.put(`/config/users/${id}`, user);
  },
  async deleteSystemUser(id: number): Promise<void> {
    await client.delete(`/config/users/${id}`);
  },

  async getDepartments(): Promise<any[]> {
    const { data } = await client.get('/config/departments');
    return data;
  },
  async addDepartment(name: string, description?: string): Promise<void> {
    await client.post('/config/departments', { name, description });
  },
  async updateDepartment(id: number, name: string, description?: string): Promise<void> {
    await client.put(`/config/departments/${id}`, { name, description });
  },
  async deleteDepartment(id: number): Promise<void> {
    await client.delete(`/config/departments/${id}`);
  },

  // Bed Configuration
  async getConfigBeds(): Promise<Bed[]> {
    const { data } = await client.get('/config/beds');
    return data;
  },
  async addBed(bed: Partial<Bed>): Promise<void> {
    await client.post('/config/beds', bed);
  },
  async updateBed(id: number, bed: Partial<Bed>): Promise<void> {
    await client.put(`/config/beds/${id}`, bed);
  },
  async deleteBed(id: number): Promise<void> {
    await client.delete(`/config/beds/${id}`);
  },

  // Catalog Management
  async addLabTest(test: Partial<LabTestCatalog>): Promise<void> {
    await client.post('/config/catalogs/lab-tests', test);
  },
  async updateLabTest(id: number, test: Partial<LabTestCatalog>): Promise<void> {
    await client.put(`/config/catalogs/lab-tests/${id}`, test);
  },
  async deleteLabTest(id: number): Promise<void> {
    await client.delete(`/config/catalogs/lab-tests/${id}`);
  },

  async addNurseService(service: Partial<NurseServiceCatalog>): Promise<void> {
    await client.post('/config/catalogs/nurse-services', service);
  },
  async updateNurseService(id: number, service: Partial<NurseServiceCatalog>): Promise<void> {
    await client.put(`/config/catalogs/nurse-services/${id}`, service);
  },
  async deleteNurseService(id: number): Promise<void> {
    await client.delete(`/config/catalogs/nurse-services/${id}`);
  },

  async addOperationCatalog(op: Partial<OperationCatalog>): Promise<void> {
    await client.post('/config/catalogs/operations', op);
  },
  async updateOperationCatalog(id: number, op: Partial<OperationCatalog>): Promise<void> {
    await client.put(`/config/catalogs/operations/${id}`, op);
  },
  async deleteOperationCatalog(id: number): Promise<void> {
    await client.delete(`/config/catalogs/operations/${id}`);
  },

  // Financial Config
  async getTaxRates(): Promise<TaxRate[]> {
    const { data } = await client.get('/config/finance/taxes');
    return data;
  },
  async addTaxRate(rate: Partial<TaxRate>): Promise<void> {
    await client.post('/config/finance/taxes', rate);
  },
  async updateTaxRate(id: number, rate: Partial<TaxRate>): Promise<void> {
    await client.put(`/config/finance/taxes/${id}`, rate);
  },
  async deleteTaxRate(id: number): Promise<void> {
    await client.delete(`/config/finance/taxes/${id}`);
  },

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    const { data } = await client.get('/config/finance/payment-methods');
    return data;
  },
  async addPaymentMethod(method: Partial<PaymentMethod>): Promise<void> {
    await client.post('/config/finance/payment-methods', method);
  },
  async updatePaymentMethod(id: number, method: Partial<PaymentMethod>): Promise<void> {
    await client.put(`/config/finance/payment-methods/${id}`, method);
  },
  async deletePaymentMethod(id: number): Promise<void> {
    await client.delete(`/config/finance/payment-methods/${id}`);
  },

  // Data Management
  async downloadBackup(): Promise<void> {
    window.open(`${API_BASE_URL}/config/backup`, '_blank');
  },
  async restoreDatabase(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('backup', file);
    await client.post('/config/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
};
