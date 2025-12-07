import React from 'react';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'admin' | 'receptionist' | 'manager' | 'accountant';
  email: string;
}

export interface Patient {
  id: number;
  patientId: string;
  fullName: string;
  phone: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  type: 'inpatient' | 'outpatient' | 'emergency';
  address: string;
  medicalHistory?: string;
  createdAt: string;
}

export interface MedicalStaff {
  id: number;
  employeeId: string;
  fullName: string;
  type: 'doctor' | 'nurse' | 'technician' | 'specialist';
  department: string;
  specialization: string;
  consultationFee: number;
  isAvailable: boolean;
  email?: string;
  phone?: string;
  schedule?: string; // JSON string or simple text description
}

export interface Appointment {
  id: number;
  appointmentNumber: string;
  patientId: number;
  patientName: string; // Joined for display
  staffId: number;
  staffName: string; // Joined for display
  datetime: string;
  type: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  billingStatus: 'unbilled' | 'billed' | 'paid';
  reason?: string;
}

export interface Bill {
  id: number;
  billNumber: string;
  patientId: number;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  date: string;
  items: BillItem[];
}

export interface BillItem {
  id?: number;
  description: string;
  amount: number;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}