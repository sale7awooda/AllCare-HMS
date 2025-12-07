import axios from 'axios';
import { Patient, Appointment, MedicalStaff, Bill, User } from '../types';

// Configuration Logic
const hostname = window.location.hostname;
const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
const isProduction = hostname.includes('railway.app');

// URL Strategy:
// 1. If VITE_API_URL is set (manual override), use it.
// 2. If running Locally or on the Production Domain itself, use relative path '/api'.
// 3. If running in a Cloud IDE (Google AI Studio, etc), use the full Railway URL.
const RAILWAY_URL = 'https://railway-hms-production.up.railway.app/api';
const API_URL = (import.meta as any).env?.VITE_API_URL || ((isLocal || isProduction) ? '/api' : RAILWAY_URL);

console.log(`🔌 API Client initialized.`);
console.log(`   Mode: ${isLocal ? 'Local' : isProduction ? 'Production' : 'Cloud IDE'}`);
console.log(`   Target: ${API_URL}`);

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor to handle auth errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect if 401 and not already on login page
    if (error.response?.status === 401 && window.location.hash !== '#/') {
      localStorage.removeItem('token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// API Service
export const api = {
  // Auth
  async login(username: string, password?: string): Promise<User> {
    // Default password for demo if not provided, though form should provide it
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
  }
};