
import axios from 'axios';
import { Patient, Appointment, MedicalStaff, Bill, User } from '../types';

// Configuration
// In production (served by backend), use relative path '/api'. 
// In development (Vite proxy), this also works as '/api'.
const API_URL = (import.meta as any).env?.VITE_API_URL || '/api';

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
    if (error.response?.status === 401) {
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
    const { data } = await client.post('/login', { username, password });
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

  async addPatient(patient: Partial<Patient>): Promise<Patient> {
    const { data } = await client.post('/patients', patient);
    return data;
  },

  async getOnePatient(id: number | string): Promise<Patient> {
    const { data } = await client.get(`/patients/${id}`);
    return data;
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