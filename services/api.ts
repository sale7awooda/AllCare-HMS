import axios from 'axios';
import { Patient, Appointment, MedicalStaff, Bill, User, LabTestCatalog, NurseServiceCatalog, Bed, OperationCatalog } from '../types';

// NETWORK CONFIGURATION
// 1. Localhost: Use relative path '/api' (uses Vite Proxy to avoid CORS locally)
// 2. Cloud IDE / Production: Use direct URL to Railway (Bypasses flaky internal proxies or same-origin in prod)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isRailwayProduction = window.location.hostname.includes('railway.app'); // Check if the frontend itself is on Railway

const RAILWAY_BACKEND_URL = 'https://railway-hms-production.up.railway.app/api';

// If running on localhost, use Vite proxy.
// If frontend is deployed on Railway, use relative path (same origin).
// Otherwise (e.g., Google AI Studio preview), use direct Railway backend URL.
const API_BASE_URL = isLocal 
  ? '/api' 
  : (isRailwayProduction ? '/api' : RAILWAY_BACKEND_URL);

console.log(`🔗 Network Mode: ${isLocal ? 'Local Dev Proxy' : (isRailwayProduction ? 'Railway Production (Same Origin)' : 'Cloud IDE Direct Connection')}`);
console.log(`🔗 Connecting to: ${API_BASE_URL}`);

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // IMPORTANT: Send cookies/JWT with requests
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

  // Staff (now HR)
  async getStaff(): Promise<MedicalStaff[]> {
    const { data } = await client.get('/hr'); // Changed to /hr
    return data;
  },
  async addStaff(staff: Partial<MedicalStaff>): Promise<MedicalStaff> {
    const { data } = await client.post('/hr', staff); // Changed to /hr
    return data;
  },
  async updateStaff(id: number, updates: Partial<MedicalStaff>): Promise<void> {
    await client.patch(`/hr/${id}`, updates); // Changed to /hr
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
    const { data } = await client.get('/medical/operations_catalog'); // Renamed route
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