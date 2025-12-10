
import React from 'react';

// Define a comprehensive set of roles as per requirements
export type Role = 
  'admin' | 'receptionist' | 'manager' | 'technician' | 'accountant' | 'doctor' | 'nurse' | 'pharmacist' | 'hr'; 

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role; 
  email: string;
  phone?: string; // Added phone
  is_active?: boolean;
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
  // Expanded staff types to include all potential roles/types
  type: 'doctor' | 'nurse' | 'anesthesiologist' | 'technician' | 'medical_assistant' | 'pharmacist' | 'admin_staff' | 'hr_manager'; 
  department: string;
  specialization: string;
  consultationFee: number;
  consultationFeeFollowup?: number; // Added
  consultationFeeEmergency?: number; // Added
  isAvailable: boolean;
  email?: string;
  phone?: string;
  schedule?: string; 
  
  // HR Specific
  baseSalary?: number;
  joinDate?: string;
  bankDetails?: string;
}

// HR & Payroll Types
export interface Attendance {
  id: number;
  staffId: number;
  staffName: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  checkIn?: string;
  checkOut?: string;
}

export interface LeaveRequest {
  id: number;
  staffId: number;
  staffName: string;
  type: 'sick' | 'vacation' | 'casual' | 'unpaid';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface PayrollRecord {
  id: number;
  staffId: number;
  staffName: string;
  month: string; // YYYY-MM
  baseSalary: number;
  totalBonuses: number;
  totalFines: number;
  netSalary: number;
  status: 'draft' | 'paid';
  generatedAt: string;
}

export interface FinancialAdjustment {
  id: number;
  staffId: number;
  staffName: string;
  type: 'bonus' | 'fine' | 'loan';
  amount: number;
  reason: string;
  date: string;
  status?: 'active' | 'repaid' | 'deducted'; // For loans
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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'checked_in' | 'in_progress' | 'waiting';
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
  normalRange?: string; // Added normal range
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

// Financial Config Types
export interface TaxRate {
  id: number;
  name: string;
  rate: number; // percentage
  isActive: boolean;
}

export interface PaymentMethod {
  id: number;
  name: string;
  isActive: boolean;
}
