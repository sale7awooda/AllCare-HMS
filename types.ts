import React from 'react';

// Define the 5 comprehensive roles as per requirements
export type Role = 
  'admin' | 'receptionist' | 'manager' | 'accountant' | 
  'technician'; // Technician is the 'labtech' user

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role; 
  email: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface InsuranceDetails {
  provider: string;
  policyNumber: string;
  expiryDate: string;
  notes?: string;
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
  
  // Medical Details
  medicalHistory?: string;
  symptoms?: string;
  allergies?: string;
  bloodGroup?: string;

  // Emergency
  emergencyContact?: EmergencyContact; 

  // Insurance
  hasInsurance: boolean;
  insuranceDetails?: InsuranceDetails; 

  createdAt: string;
}

export interface MedicalStaff {
  id: number;
  employeeId: string;
  fullName: string;
  // Staff types managed, aligning with requirements (doctor, nurse, technician, anesthesiologist, medical_assistant)
  type: 'doctor' | 'nurse' | 'anesthesiologist' | 'technician' | 'medical_assistant'; 
  department: string;
  specialization: string;
  consultationFee: number;
  isAvailable: boolean;
  email?: string;
  phone?: string;
  schedule?: string; 
}

export interface Appointment {
  id: number;
  appointmentNumber: string;
  patientId: number;
  patientName: string; 
  staffId: number;
  staffName: string; 
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

// Keep these types as the patient action menu still creates data for them
export interface LabTestCatalog {
  id: number;
  name: string;
  category: string;
  cost: number;
}

export interface NurseServiceCatalog {
  id: number;
  name: string;
  description: string;
  cost: number;
}

export interface Bed {
  id: number;
  roomNumber: string;
  type: 'General' | 'Private' | 'ICU';
  status: 'available' | 'occupied' | 'maintenance';
  costPerDay: number;
}

export interface OperationCatalog {
  id: number;
  name: string;
  baseCost: number;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color: string;
}