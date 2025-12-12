
export type Role = 'admin' | 'receptionist' | 'manager' | 'technician' | 'accountant' | 'doctor' | 'nurse' | 'pharmacist' | 'hr'; 

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role; 
  email: string;
  phone?: string;
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
  medicalHistory?: string;
  symptoms?: string;
  allergies?: string;
  bloodGroup?: string;
  emergencyContact?: EmergencyContact; 
  hasInsurance: boolean;
  insuranceDetails?: InsuranceDetails; 
  createdAt: string;
}

export interface MedicalStaff {
  id: number;
  employeeId: string;
  fullName: string;
  type: string; 
  department: string;
  specialization: string;
  consultationFee: number;
  consultationFeeFollowup?: number;
  consultationFeeEmergency?: number;
  status: 'active' | 'inactive' | 'dismissed';
  email?: string;
  phone?: string;
  address?: string;
  availableDays?: string[];
  availableTimeStart?: string;
  availableTimeEnd?: string;
  baseSalary?: number;
  joinDate?: string;
  bankDetails?: any;
}

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
  month: string;
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
  status?: string;
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
  billId?: number;
  totalAmount?: number;
  paidAmount?: number;
  dailyToken?: number;
}

export interface Bill {
  id: number;
  billNumber: string;
  patientId: number;
  patientName: string;
  totalAmount: number;
  paidAmount: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded';
  date: string;
  items: BillItem[];
  serviceStatus?: string;
}

export interface BillItem {
  description: string;
  amount: number;
}

export interface Transaction {
  id: number;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  method: string;
  reference_id?: number;
  details?: any;
  date: string;
  description?: string;
}

export interface LabTestCatalog {
  id: number;
  name_en: string;
  name_ar: string;
  category_en: string;
  category_ar: string;
  cost: number;
  normal_range?: string;
}

export interface NurseServiceCatalog {
  id: number;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  cost: number;
}

export interface Bed {
  id: number;
  roomNumber: string;
  type: 'General' | 'Private' | 'ICU';
  status: 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved';
  costPerDay: number;
}

export interface OperationCatalog {
  id: number;
  name_en: string;
  name_ar: string;
  baseCost: number;
}

export interface InsuranceProvider {
    id: number;
    name_en: string;
    name_ar: string;
    isActive: boolean;
}

export interface TaxRate {
  id: number;
  name_en: string;
  name_ar: string;
  rate: number;
  isActive: boolean;
}

export interface PaymentMethod {
  id: number;
  name_en: string;
  name_ar: string;
  isActive: boolean;
}
