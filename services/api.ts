import axios from 'axios';
import { Patient, Appointment, MedicalStaff, Bill, User, LabTestCatalog, NurseServiceCatalog, Bed, OperationCatalog } from '../types';

// Use relative path '/api'. 
// This relies on the browser's own origin.
// In Dev: Vite Proxy forwards to Railway.
// In Prod: Backend serves Frontend, so origin is same.
const API_URL = '/api';

console.log('🔗 Connecting to API:', API_URL);

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
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
  async me(): Promise<User> {
    const { data } = await client.get('/me');
    return data;
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

  // Staff
  async getStaff(): Promise<MedicalStaff[]> {
    const { data } = await client.get('/staff');
    return data;
  },
  async addStaff(staff: Partial<MedicalStaff>): Promise<MedicalStaff> {
    const { data } = await client.post('/staff', staff);
    return data;
  },
  async updateStaff(id: number, updates: Partial<MedicalStaff>): Promise<void> {
    await client.patch(`/staff/${id}`, updates);
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
    const { data } = await client.get('/medical/operations');
    return data;
  },

  // Requests
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
  }
};