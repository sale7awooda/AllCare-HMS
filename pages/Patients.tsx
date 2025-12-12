import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Shield, AlertTriangle, Edit, Calendar, Lock, 
  FlaskConical, Bed, Activity, Settings, Thermometer, Trash2, CheckCircle,
  Phone, User as UserIcon, History, Loader2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, MapPin, XCircle, FileText, Stethoscope
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, User, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog, Bill, InsuranceProvider } from '@/types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const { t, language } = useTranslation();
  
  // Catalogs
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Advanced Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewTab, setViewTab] = useState<'info' | 'timeline' | 'billing'>('info');
  const [isEditing, setIsEditing] = useState(false);

  // Action Logic
  const [currentAction, setCurrentAction] = useState<'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | null>(null);
  
  // Appointment specific
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  const [actionFormData, setActionFormData] = useState({
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    notes: '',
    subtype: '',
    dischargeDate: '',
    totalCost: 0,
    deposit: 0 
  });

  // Specific States for Complex Forms
  const [selectedTests, setSelectedTests] = useState<LabTestCatalog[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedService, setSelectedService] = useState<NurseServiceCatalog | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedType | null>(null);
  
  const initialFormState = {
    fullName: '', age: 0, phone: '',
    gender: 'male' as Patient['gender'],
    type: 'outpatient' as Patient['type'],
    address: '',
    // Medical Details
    symptoms: '', medicalHistory: '', allergies: '', bloodGroup: '',
    // Emergency Contact
    emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    // Insurance
    hasInsurance: false,
    insProvider: '', insPolicy: '', insExpiry: '', insNotes: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  const APPOINTMENT_TYPES = [
    { id: 'Consultation', label: t('patients_modal_action_consultation'), icon: UserIcon },
    { id: 'Follow-up', label: t('patients_modal_action_followUp'), icon: History },
    { id: 'Emergency', label: t('patients_modal_action_emergency'), icon: AlertTriangle },
  ];

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    
    try {
      const [pts, apts, b, stf, adms] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(),
        api.getBills(),
        api.getStaff(),
        api.getActiveAdmissions()
      ]);
      setPatients(Array.isArray(pts) ? pts : []);
      setAppointments(Array.isArray(apts) ? apts : []);
      setBills(Array.isArray(b) ? b : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setActiveAdmissions(Array.isArray(adms) ? adms : []);
    } catch (error) {
      console.error("Failed to load core data:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const loadCatalogs = async () => {
    try {
      const [l, n, b, o, ip] = await Promise.all([
        api.getLabTests(), 
        api.getNurseServices(), 
        api.getBeds(), 
        api.getOperations(),
        api.getInsuranceProviders()
      ]);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setBeds(Array.isArray(b) ? b : []);
      setOperations(Array.isArray(o) ? o : []);
      setInsuranceProviders(Array.isArray(ip) ? ip : []);
    } catch (e) {
      console.error("Failed to load catalogs:", e);
      setLabTests([]); setNurseServices([]); setBeds([]); setOperations([]); setInsuranceProviders([]);
    }
  };

  useEffect(() => {
    loadData();
    loadCatalogs();
  }, []);

  const openCreateModal = () => {
    setFormData(initialFormState);
    setIsEditing(false);
    setIsFormModalOpen(true);
  };

  const openEditModal = async (patient: Patient) => {
    setProcessStatus('processing');
    setProcessMessage(t('patients_process_loading'));
    try {
      const fullDetails = await api.getPatient(patient.id);
      setFormData({
        fullName: fullDetails.fullName,
        age: fullDetails.age,
        phone: fullDetails.phone,
        gender: fullDetails.gender,
        type: fullDetails.type,
        address: fullDetails.address,
        symptoms: fullDetails.symptoms || '',
        medicalHistory: fullDetails.medicalHistory || '',
        allergies: fullDetails.allergies || '',
        bloodGroup: fullDetails.bloodGroup || '',
        hasInsurance: fullDetails.hasInsurance,
        emergencyName: fullDetails.emergencyContact?.name || '',
        emergencyPhone: fullDetails.emergencyContact?.phone || '',
        emergencyRelation: fullDetails.emergencyContact?.relation || '',
        insProvider: fullDetails.insuranceDetails?.provider || '',
        insPolicy: fullDetails.insuranceDetails?.policyNumber || '',
        insExpiry: fullDetails.insuranceDetails?.expiryDate || '',
        insNotes: fullDetails.insuranceDetails?.notes || ''
      });
      setSelectedPatient(fullDetails);
      setIsEditing(true);
      setProcessStatus('idle');
      setIsFormModalOpen(true);
    } catch (err) {
      console.error("Failed to load patient details", err);
      setProcessStatus('error');
      setProcessMessage(t('patients_process_error_load'));
      setTimeout(() => setProcessStatus('idle'), 1500);
    }
  };

  const openActionMenu = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsActionMenuOpen(true);
  };

  const getLocalToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const openViewModal = async (patient: Patient) => {
    setProcessStatus('processing');
    setProcessMessage(t('patients_process_loading_file'));
    try {
      const fullDetails = await api.getPatient(patient.id);
      setSelectedPatient(fullDetails);
      setViewTab('info');
      setIsActionMenuOpen(false);
      setIsViewModalOpen(true);
    } catch (e) { 
      console.error(e); 
    } finally {
      setTimeout(() => setProcessStatus('idle'), 300);
    }
  };

  const handleActionSelect = (action: 'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | 'history') => {
    if (action === 'history') {
      openViewModal(selectedPatient!);
      return;
    }
    
    setIsActionMenuOpen(false);
    
    setSelectedTests([]);
    setTestSearch('');
    setSelectedService(null);
    setSelectedBed(null);
    setSelectedSpecialty('');
    
    setProcessStatus('idle');
    setProcessMessage('');
    
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: getLocalToday(),
      time: '09:00', 
      notes: '',
      subtype: '', 
      dischargeDate: '',
      totalCost: 0,
      deposit: 0
    });
    setIsActionModalOpen(true);
  };

  const handleBackToActionMenu = () => {
    setIsActionModalOpen(false);
    setIsActionMenuOpen(true);
  };

  const handleOperationSelect = (opName: string) => {
    const op = operations.find(o => o.name_en === opName);
    setActionFormData({
      ...actionFormData,
      subtype: opName,
    });
  };

  useEffect(() => {
    if (currentAction === 'admission' && selectedBed) {
      const entryDate = new Date(actionFormData.date);
      let days = 1;

      if (actionFormData.dischargeDate) {
        const dischargeDate = new Date(actionFormData.dischargeDate);
        const timeDiff = dischargeDate.getTime() - entryDate.getTime();
        const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        days = dayDiff > 0 ? dayDiff : 1;
      }

      const calculatedDeposit = selectedBed.costPerDay * days;
      setActionFormData(prev => ({ ...prev, deposit: calculatedDeposit }));
    }
  }, [selectedBed, actionFormData.date, actionFormData.dischargeDate, currentAction]);


  const checkAvailability = (doc: MedicalStaff) => {
    if (doc.status !== 'active') return false;
    if (!doc.availableDays || doc.availableDays.length === 0) return true; 
    try {
      const scheduleDays = doc.availableDays.map((d: string) => d.toLowerCase()); 
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(); 
      return scheduleDays.includes(today);
    } catch (e) {
      return true; 
    }
  };

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    setProcessStatus('processing');
    setProcessMessage(t('patients_process_submitting'));
    
    try {
      let staffAssignedId: number | undefined = actionFormData.staffId ? parseInt(actionFormData.staffId) : undefined;
      let successMessage = 'Request submitted successfully.';

      await new Promise(resolve => setTimeout(resolve, 800));

      if (currentAction === 'lab') {
        if (selectedTests.length === 0) throw new Error(t('patients_process_error_select_test'));
        await api.createLabRequest({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          testIds: selectedTests.map(t => t.id),
          totalCost: selectedTests.reduce((a,b)=>a+b.cost, 0)
        });
        successMessage = t('patients_process_success_lab');

      } else if (currentAction === 'nurse') {
        if (!selectedService) throw new Error(t('patients_process_error_select_service'));
        if (!staffAssignedId) throw new Error(t('patients_process_error_select_nurse'));
        
        const nurse = staff.find(s => s.id === staffAssignedId);
        
        // Re-routing Nurse Requests to Appointments System for unified queuing
        await api.createAppointment({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          staffId: staffAssignedId,
          staffName: nurse?.fullName,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: 'Procedure',
          reason: `${selectedService.name_en}: ${actionFormData.notes}`,
          customFee: selectedService.cost, //