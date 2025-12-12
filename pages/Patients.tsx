
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
          customFee: selectedService.cost, 
        });
        successMessage = t('patients_process_success_nurse');

      } else if (currentAction === 'admission') {
        if (!selectedBed) throw new Error(t('patients_process_error_select_bed'));
        if (!staffAssignedId) throw new Error(t('patients_process_error_select_doctor'));

        await api.createAdmission({
          patientId: selectedPatient.id,
          bedId: selectedBed.id,
          doctorId: staffAssignedId,
          entryDate: actionFormData.date,
          deposit: actionFormData.deposit,
          notes: actionFormData.notes
        });
        successMessage = t('patients_process_success_admission');

      } else if (currentAction === 'operation') {
        if (!actionFormData.subtype) throw new Error(t('patients_process_error_select_op'));
        if (!staffAssignedId) throw new Error(t('patients_process_error_select_surgeon'));

        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffAssignedId,
          notes: actionFormData.notes
        });
        successMessage = t('patients_process_success_operation');

      } else if (currentAction === 'appointment') {
        if (!staffAssignedId) throw new Error(t('patients_process_error_no_doctor'));
        const doctor = staff.find(s => s.id === staffAssignedId);
        if (!doctor) throw new Error(t('patients_process_error_doctor_not_found'));

        await api.createAppointment({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          staffId: staffAssignedId,
          staffName: doctor.fullName,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: actionFormData.subtype || 'Consultation',
          reason: actionFormData.notes
        });
        successMessage = t('patients_process_success_appointment');
      }

      setProcessStatus('success');
      setProcessMessage(successMessage);
      
      // Refresh data
      await loadData(true);
      
      setTimeout(() => {
        setIsActionModalOpen(false);
        setProcessStatus('idle');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setProcessStatus('error');
      setProcessMessage(err.message || t('patients_process_title_failed'));
    }
  };

  const handlePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(isEditing ? t('patients_process_updating') : t('patients_process_registering'));

    const payload = {
      ...formData,
      emergencyContact: {
        name: formData.emergencyName,
        phone: formData.emergencyPhone,
        relation: formData.emergencyRelation
      },
      insuranceDetails: {
        provider: formData.insProvider,
        policyNumber: formData.insPolicy,
        expiryDate: formData.insExpiry,
        notes: formData.insNotes
      }
    };

    try {
      if (isEditing && selectedPatient) {
        await api.updatePatient(selectedPatient.id, payload);
        setProcessMessage(t('patients_process_update_success'));
      } else {
        await api.addPatient(payload);
        setProcessMessage(t('patients_process_register_success'));
      }
      
      setProcessStatus('success');
      await loadData(true);
      
      setTimeout(() => {
        setIsFormModalOpen(false);
        setProcessStatus('idle');
      }, 1000);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(t('patients_process_error_save'));
    }
  };

  // --- Filtering ---
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = 
        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm) ||
        p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'all' || p.type === filterType;
      const matchesGender = filterGender === 'all' || p.gender === filterGender;

      return matchesSearch && matchesType && matchesGender;
    });
  }, [patients, searchTerm, filterType, filterGender]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const paginatedPatients = filteredPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, '...', totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    }
    return pages;
  };

  const getFilteredDoctors = () => {
    if (currentAction === 'operation') {
      return staff.filter(s => s.type === 'doctor' && s.specialization === 'General Surgery'); // Simplified logic
    }
    if (selectedSpecialty) {
      return staff.filter(s => s.type === 'doctor' && s.specialization === selectedSpecialty);
    }
    return staff.filter(s => s.type === 'doctor');
  };

  const hasPermissionToCreate = hasPermission(currentUser, Permissions.MANAGE_PATIENTS);

  return (
    <div className="space-y-6">
      
      {/* LOADING OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95 border dark:border-slate-700">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t('patients_process_title_processing')}</h3>
                <p className="text-slate-500 dark:text-slate-400">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('patients_process_title_success')}</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('patients_process_title_failed')}</h3>
                <p className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('patients_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('patients_subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {hasPermissionToCreate ? (
            <Button onClick={openCreateModal} icon={Plus}>{t('patients_register_button')}</Button>
          ) : (
            <Button disabled variant="secondary" icon={Lock}>{t('patients_register_button_locked')}</Button>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder={t('patients_search_placeholder')} 
              className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="relative min-w-[140px]">
               <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
               <select 
                 className="pl-9 pr-8 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                 value={filterType}
                 onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
               >
                 <option value="all">{t('patients_filter_type_all')}</option>
                 <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                 <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                 <option value="emergency">{t('patients_filter_type_emergency')}</option>
               </select>
            </div>

            <div className="relative min-w-[140px]">
               <select 
                 className="pl-4 pr-8 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                 value={filterGender}
                 onChange={e => { setFilterGender(e.target.value); setCurrentPage(1); }}
               >
                 <option value="all">{t('patients_filter_gender_all')}</option>
                 <option value="male">{t('patients_filter_gender_male')}</option>
                 <option value="female">{t('patients_filter_gender_female')}</option>
               </select>
            </div>

            {(filterType !== 'all' || filterGender !== 'all' || searchTerm) && (
              <Button variant="ghost" size="sm" onClick={() => {setFilterType('all'); setFilterGender('all'); setSearchTerm('');}} className="text-slate-500">
                {t('patients_clear_filters_button')}
              </Button>
            )}
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_patient')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_contact')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_status')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_demographics')}</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-20 text-slate-500">{t('loading')}</td></tr>
              ) : paginatedPatients.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-20 text-slate-500">{t('patients_table_empty')}</td></tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold">
                            {patient.fullName.charAt(0)}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">{patient.fullName}</div>
                          <div className="text-xs text-slate-500 font-mono">{patient.patientId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-300">{patient.phone}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">{patient.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={patient.type === 'inpatient' ? 'red' : patient.type === 'emergency' ? 'orange' : 'green'}>
                        {patient.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {patient.age} yrs / {patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="sm" 
                          variant="primary" 
                          onClick={() => openActionMenu(patient)}
                          className="shadow-sm"
                        >
                          {t('patients_manage_button')}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          onClick={() => openEditModal(patient)}
                          icon={Edit}
                        >
                          {t('patients_edit_button')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        {!loading && filteredPatients.length > 0 && (
           <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-xl gap-4">
             <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span>
                  {t('patients_pagination_showing')} <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredPatients.length)}</span> {t('patients_pagination_of')} <span className="font-medium text-slate-900 dark:text-white">{filteredPatients.length}</span>
                </span>
                
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                  <span>{t('patients_pagination_rows')}</span>
                  <select 
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary-500"
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
             </div>

             <div className="flex gap-1.5">
               <button 
                 onClick={() => setCurrentPage(1)}
                 disabled={currentPage === 1}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronsLeft size={16} />
               </button>
               <button 
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage === 1}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronLeft size={16} />
               </button>
               
               {getPageNumbers().map((p, i) => (
                 <button
                   key={i}
                   onClick={() => typeof p === 'number' && setCurrentPage(p)}
                   disabled={typeof p !== 'number'}
                   className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                     p === currentPage 
                       ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' 
                       : typeof p === 'number' 
                         ? 'border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300' 
                         : 'text-slate-400 cursor-default'
                   }`}
                 >
                   {p}
                 </button>
               ))}

               <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronRight size={16} />
               </button>
               <button 
                 onClick={() => setCurrentPage(totalPages)}
                 disabled={currentPage === totalPages}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronsRight size={16} />
               </button>
             </div>
           </div>
        )}
      </Card>

      {/* --- MODAL 1: ADD/EDIT PATIENT --- */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? t('patients_modal_edit_title') : t('patients_modal_new_title')}>
        <form onSubmit={handlePatientSubmit} className="space-y-6">
          
          {/* Section 1: Personal Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">{t('patients_modal_form_personal_title')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('patients_modal_form_fullName')} required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              <Input label={t('patients_modal_form_phone')} required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('patients_modal_form_age')} type="number" required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})} />
                <Select label={t('patients_modal_form_gender')} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                  <option value="male">{t('patients_modal_form_gender_male')}</option>
                  <option value="female">{t('patients_modal_form_gender_female')}</option>
                </Select>
              </div>
              <Select label={t('patients_modal_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                <option value="emergency">{t('patients_filter_type_emergency')}</option>
              </Select>
            </div>
            <Input label={t('patients_modal_form_address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>

          {/* Section 2: Medical Profile */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">{t('patients_modal_form_medical_title')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('patients_modal_form_bloodGroup')} value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                <option value="">{t('patients_modal_form_bloodGroup_unknown')}</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </Select>
              <Input label={t('patients_modal_form_allergies')} placeholder={t('patients_modal_form_allergies_placeholder')} value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            </div>
            <Input label={t('patients_modal_form_symptoms')} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
            <Textarea label={t('patients_modal_form_medicalHistory')} placeholder={t('patients_modal_form_medicalHistory_placeholder')} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
          </div>

          {/* Section 3: Emergency Contact */}
          <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_emergency_title')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label={t('patients_modal_form_emergency_name')} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
              <Input label={t('patients_modal_form_emergency_phone')} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
              <Input label={t('patients_modal_form_emergency_relation')} placeholder={t('patients_modal_form_emergency_relation_placeholder')} value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
            </div>
          </div>

          {/* Section 4: Insurance */}
          <div className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">{t('patients_modal_form_insurance_title')}</h4>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.hasInsurance} onChange={e => setFormData({...formData, hasInsurance: e.target.checked})} className="rounded text-primary-600 focus:ring-primary-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('patients_modal_form_has_insurance')}</span>
              </label>
            </div>
            
            {formData.hasInsurance && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <Select label={t('patients_modal_form_insurance_provider')} value={formData.insProvider} onChange={e => setFormData({...formData, insProvider: e.target.value})}>
                  <option value="">{t('patients_modal_form_insurance_provider_select')}</option>
                  {insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
                </Select>
                <Input label={t('patients_modal_form_insurance_policy')} value={formData.insPolicy} onChange={e => setFormData({...formData, insPolicy: e.target.value})} />
                <Input label={t('patients_modal_form_insurance_expiry')} type="date" value={formData.insExpiry} onChange={e => setFormData({...formData, insExpiry: e.target.value})} />
                <Input label={t('patients_modal_form_insurance_notes')} value={formData.insNotes} onChange={e => setFormData({...formData, insNotes: e.target.value})} />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('patients_modal_save_button')}</Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 2: ACTION MENU --- */}
      <Modal isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} title={t('patients_modal_action_menu_title', {name: selectedPatient?.fullName})}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { id: 'appointment', label: t('patients_modal_action_appointment'), icon: Calendar, color: 'bg-violet-100 text-violet-700', allowed: hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS) },
            { id: 'lab', label: t('patients_modal_action_lab'), icon: FlaskConical, color: 'bg-orange-100 text-orange-700', allowed: hasPermission(currentUser, Permissions.MANAGE_LABORATORY) },
            { id: 'nurse', label: t('patients_modal_action_nurse'), icon: Stethoscope, color: 'bg-pink-100 text-pink-700', allowed: hasPermission(currentUser, Permissions.VIEW_DASHBOARD) }, // Nurse requests open to most
            { id: 'admission', label: t('patients_modal_action_admission'), icon: Bed, color: 'bg-blue-100 text-blue-700', allowed: hasPermission(currentUser, Permissions.MANAGE_ADMISSIONS), disabled: selectedPatient?.type === 'inpatient' },
            { id: 'operation', label: t('patients_modal_action_operation'), icon: Activity, color: 'bg-red-100 text-red-700', allowed: hasPermission(currentUser, Permissions.MANAGE_OPERATIONS) },
            { id: 'history', label: t('patients_modal_action_history'), icon: FileText, color: 'bg-slate-100 text-slate-700', allowed: hasPermission(currentUser, Permissions.VIEW_PATIENTS) },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => handleActionSelect(action.id as any)}
              disabled={!action.allowed || action.disabled}
              className={`flex flex-col items-center justify-center p-6 rounded-xl transition-all duration-200 border-2 border-transparent ${!action.allowed || action.disabled ? 'opacity-50 grayscale cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 hover:border-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-600 hover:-translate-y-1 hover:shadow-lg'}`}
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-3 ${action.color} dark:bg-opacity-20`}>
                <action.icon size={28} />
              </div>
              <span className="font-bold text-slate-700 dark:text-slate-300">{action.label}</span>
              {action.disabled && <span className="text-[10px] text-red-500 font-medium mt-1">{t('patients_modal_action_already_admitted')}</span>}
            </button>
          ))}
        </div>
      </Modal>

      {/* --- MODAL 3: ACTION FORMS (Unified) --- */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={
        currentAction === 'appointment' ? t('patients_modal_action_specific_title_appointment') :
        currentAction === 'lab' ? t('patients_modal_action_specific_title_lab') :
        currentAction === 'nurse' ? t('patients_modal_action_specific_title_nurse') :
        currentAction === 'admission' ? t('patients_modal_action_specific_title_admission') :
        currentAction === 'operation' ? t('patients_modal_action_specific_title_operation') : t('patients_modal_action_specific_title_default')
      }>
        <div className="mb-4 flex items-center gap-2">
          <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={handleBackToActionMenu}>{t('patients_modal_action_back_button')}</Button>
        </div>

        <form onSubmit={submitAction} className="space-y-5">
          
          {/* Common Date/Time for most actions */}
          {currentAction !== 'lab' && (
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">{t('patients_modal_action_booking_date_title')}</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input type="date" required value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                {currentAction !== 'admission' && <Input type="time" required value={actionFormData.time} onChange={e => setActionFormData({...actionFormData, time: e.target.value})} />}
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {[0, 1, 2].map(days => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  const str = d.toISOString().split('T')[0];
                  return (
                    <button 
                      key={days} 
                      type="button" 
                      onClick={() => setActionFormData({...actionFormData, date: str})}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${actionFormData.date === str ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                    >
                      {days === 0 ? t('patients_modal_action_today') : d.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {weekday: 'short', day: 'numeric'})}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- DYNAMIC FIELDS BASED ON ACTION --- */}

          {/* 1. Appointment */}
          {currentAction === 'appointment' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('patients_modal_action_appointment_type')} value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                  {APPOINTMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </Select>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('staff_select_specialization')}</label>
                  <select 
                    className="block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border"
                    value={selectedSpecialty}
                    onChange={e => setSelectedSpecialty(e.target.value)}
                  >
                    <option value="">{t('patients_modal_action_select_specialty')}</option>
                    {[...new Set(staff.filter(s => s.type === 'doctor').map(s => s.specialization))].map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('appointments_form_select_staff')}</label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                  {getFilteredDoctors().map(doc => {
                    const available = checkAvailability(doc);
                    return (
                      <div 
                        key={doc.id}
                        onClick={() => available && setActionFormData({...actionFormData, staffId: doc.id.toString()})}
                        className={`flex items-center p-3 rounded-lg cursor-pointer border transition-all ${actionFormData.staffId === doc.id.toString() ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800'} ${!available ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 dark:text-slate-400 mr-3">
                          {doc.fullName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-slate-800 dark:text-white">{doc.fullName}</p>
                          <p className="text-xs text-slate-500">{doc.specialization}</p>
                        </div>
                        <div className="text-right">
                          <Badge color={available ? 'green' : 'red'}>{available ? t('patients_modal_action_doctor_available') : t('patients_modal_action_doctor_unavailable')}</Badge>
                          <p className="text-xs font-bold text-slate-700 mt-1">${doc.consultationFee}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Textarea label={t('patients_modal_action_reason')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* 2. Lab Request */}
          {currentAction === 'lab' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('patients_modal_action_search_tests')}</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text" 
                    className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder={t('patients_modal_action_search_tests_placeholder')}
                    value={testSearch}
                    onChange={e => setTestSearch(e.target.value)}
                  />
                </div>
                {testSearch && (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm mb-4">
                    {labTests.filter(t => t.name_en.toLowerCase().includes(testSearch.toLowerCase())).map(test => (
                      <div 
                        key={test.id} 
                        onClick={() => {
                          if (!selectedTests.find(t => t.id === test.id)) setSelectedTests([...selectedTests, test]);
                          setTestSearch('');
                        }}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex justify-between border-b border-slate-100 last:border-0"
                      >
                        <span className="text-sm font-medium">{test.name_en}</span>
                        <span className="text-xs font-bold bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">${test.cost}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Selected Tests List */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 min-h-[100px]">
                  {selectedTests.length === 0 ? (
                    <p className="text-center text-slate-400 text-sm py-8">{t('patients_modal_action_no_tests_selected')}</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTests.map(test => (
                        <div key={test.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                          <span className="text-sm font-medium">{test.name_en}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">${test.cost}</span>
                            <button type="button" onClick={() => setSelectedTests(selectedTests.filter(t => t.id !== test.id))} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end mt-2">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('patients_modal_action_total')}: <span className="text-lg text-primary-600">${selectedTests.reduce((acc, t) => acc + t.cost, 0)}</span></p>
                </div>
              </div>
            </>
          )}

          {/* 3. Nurse Request */}
          {currentAction === 'nurse' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('patients_modal_action_assign_nurse')}</label>
                <div className="grid grid-cols-2 gap-4">
                  <Select value={selectedService ? selectedService.name_en : ''} onChange={e => setSelectedService(nurseServices.find(s => s.name_en === e.target.value) || null)}>
                    <option value="">Select Service...</option>
                    {nurseServices.map(s => <option key={s.id} value={s.name_en}>{s.name_en} (${s.cost})</option>)}
                  </Select>
                  <Select value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                    <option value="">{t('patients_modal_action_select_nurse')}</option>
                    {staff.filter(s => s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                  </Select>
                </div>
              </div>
              <Textarea label={t('patients_modal_action_notes')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* 4. Admission */}
          {currentAction === 'admission' && (
            <>
              <Select label={t('patients_modal_action_select_room')} value={selectedBed ? selectedBed.id : ''} onChange={e => setSelectedBed(beds.find(b => b.id === parseInt(e.target.value)) || null)}>
                <option value="">{t('patients_modal_action_choose_bed')}</option>
                {beds.filter(b => b.status === 'available').map(b => (
                  <option key={b.id} value={b.id}>{b.roomNumber} ({b.type}) - ${b.costPerDay}{t('patients_modal_action_bed_cost_per_day')}</option>
                ))}
              </Select>
              
              <Select label={t('patients_modal_action_treating_doctor')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                <option value="">{t('patients_modal_action_select_doctor')}</option>
                {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>

              <div className="grid grid-cols-2 gap-4">
                <Input label={t('patients_modal_action_admission_date')} type="date" value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                <Input label={t('patients_modal_action_discharge_date')} type="date" value={actionFormData.dischargeDate} onChange={e => setActionFormData({...actionFormData, dischargeDate: e.target.value})} />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex justify-between items-center">
                <div>
                  <span className="text-sm font-bold text-blue-800 dark:text-blue-300">{t('patients_modal_action_required_deposit')}</span>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{t('patients_modal_action_deposit_note')}</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">${actionFormData.deposit}</span>
                  <Badge color="red" className="ml-2">{t('patients_modal_action_unpaid')}</Badge>
                </div>
              </div>
            </>
          )}

          {/* 5. Operation */}
          {currentAction === 'operation' && (
            <>
              <div className="bg-yellow-50 border border-yellow-100 p-3 rounded-lg text-sm text-yellow-800 mb-2">
                {t('patients_modal_action_op_note')}
              </div>
              <Select label={t('patients_modal_action_op_type')} value={actionFormData.subtype} onChange={e => handleOperationSelect(e.target.value)}>
                <option value="">{t('patients_modal_action_select_procedure')}</option>
                {operations.map(o => <option key={o.id} value={o.name_en}>{o.name_en} ({t('patients_modal_action_base_cost')}: ${o.baseCost})</option>)}
              </Select>
              <Select label={t('patients_modal_action_request_surgeon')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                <option value="">{t('patients_modal_action_select_surgeon')}</option>
                {staff.filter(s => s.type === 'doctor' && (s.specialization?.toLowerCase().includes('surgery') || s.specialization?.toLowerCase().includes('surgeon'))).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Textarea label={t('patients_modal_action_pre_op_notes')} placeholder={t('patients_modal_action_pre_op_notes_placeholder')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={processStatus === 'processing'}>
              {processStatus === 'processing' ? t('patients_process_submitting') : t('patients_modal_action_submit_request')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 4: VIEW DETAILS (360) --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={t('patients_modal_view_title')}>
        {selectedPatient && (
          <div className="min-h-[400px]">
            {/* Header Profile */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-2xl font-bold text-slate-500 dark:text-slate-400">
                {selectedPatient.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedPatient.fullName}</h2>
                <p className="text-sm text-slate-500">{selectedPatient.patientId} • {selectedPatient.age} yrs • {selectedPatient.gender}</p>
                <div className="flex gap-2 mt-2">
                  <Badge color={selectedPatient.hasInsurance ? 'blue' : 'gray'}>{selectedPatient.hasInsurance ? 'Insured' : 'Self-pay'}</Badge>
                  <Badge color={selectedPatient.type === 'inpatient' ? 'red' : 'green'}>{selectedPatient.type}</Badge>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
              {[
                {id: 'info', label: t('patients_modal_view_overview_tab')}, 
                {id: 'timeline', label: t('patients_modal_view_timeline_tab')}, 
                {id: 'billing', label: t('patients_modal_view_financials_tab')}
              ].map((tab: any) => (
                <button 
                  key={tab.id}
                  onClick={() => setViewTab(tab.id)}
                  className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors ${viewTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="animate-in fade-in">
              {viewTab === 'info' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-400 uppercase">{t('patients_modal_view_contact_personal')}</h4>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_phone')}</span> <span className="font-medium">{selectedPatient.phone}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_address')}</span> <span className="font-medium text-right">{selectedPatient.address}</span></div>
                      <hr className="border-slate-200 dark:border-slate-700 my-2"/>
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_emergency_contact')}</span> <span className="font-medium">{selectedPatient.emergencyContact?.name || t('patients_modal_view_na')}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_emergency_phone')}</span> <span className="font-medium">{selectedPatient.emergencyContact?.phone || t('patients_modal_view_na')}</span></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-slate-400 uppercase">{t('patients_modal_view_medical_profile')}</h4>
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_blood_group')}</span> <span className="font-bold text-red-600">{selectedPatient.bloodGroup || 'Unknown'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('patients_modal_view_allergies')}</span> <span className="font-medium text-right text-red-500">{selectedPatient.allergies || t('patients_modal_view_none')}</span></div>
                      
                      <div className="mt-4">
                        <span className="text-slate-500 block mb-1">{t('patients_modal_view_medical_history')}</span>
                        <p className="p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          {selectedPatient.medicalHistory || t('patients_modal_view_no_history')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedPatient.hasInsurance && (
                    <div className="col-span-1 md:col-span-2 space-y-2">
                        <h4 className="font-bold text-sm text-slate-400 uppercase">{t('patients_modal_view_insurance_coverage')}</h4>
                        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="font-bold text-blue-900 dark:text-blue-200">{selectedPatient.insuranceDetails?.provider}</p>
                                <p className="text-xs text-blue-700 dark:text-blue-300">{t('patients_modal_view_policy_no')}: {selectedPatient.insuranceDetails?.policyNumber}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-blue-600 dark:text-blue-400">Exp: {selectedPatient.insuranceDetails?.expiryDate}</p>
                            </div>
                        </div>
                    </div>
                  )}
                </div>
              )}

              {viewTab === 'timeline' && (
                <div className="space-y-4">
                  {appointments.filter(a => a.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-center text-slate-400 py-8">{t('patients_modal_view_no_timeline')}</p>
                  ) : (
                    appointments.filter(a => a.patientId === selectedPatient.id).map(apt => (
                      <div key={apt.id} className="flex gap-4 items-start relative pb-6 border-l-2 border-slate-200 dark:border-slate-700 ml-4 pl-6 last:pb-0 last:border-0">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary-100 border-2 border-primary-500"></div>
                        <div className="flex-1 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm">
                          <div className="flex justify-between items-start">
                            <h5 className="font-bold text-slate-800 dark:text-white">{apt.type}</h5>
                            <span className="text-xs text-slate-500">{new Date(apt.datetime).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">Dr. {apt.staffName}</p>
                          <p className="text-xs text-slate-400 mt-2">{apt.status}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {viewTab === 'billing' && (
                <div className="space-y-2">
                   {bills.filter(b => b.patientId === selectedPatient.id).length === 0 ? (
                     <p className="text-center text-slate-400 py-8">{t('patients_modal_view_no_billing')}</p>
                   ) : (
                     <table className="w-full text-sm">
                       <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
                         <tr>
                           <th className="px-4 py-2 text-left">{t('patients_modal_view_billing_date')}</th>
                           <th className="px-4 py-2 text-left">{t('patients_modal_view_billing_items')}</th>
                           <th className="px-4 py-2 text-right">{t('patients_modal_view_billing_amount')}</th>
                           <th className="px-4 py-2 text-center">{t('patients_modal_view_billing_status')}</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         {bills.filter(b => b.patientId === selectedPatient.id).map(bill => (
                           <tr key={bill.id}>
                             <td className="px-4 py-2">{new Date(bill.date).toLocaleDateString()}</td>
                             <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                                {bill.items && bill.items.length > 0 ? (
                                    <span>
                                        {bill.items[0].description} 
                                        {bill.items.length > 1 && <span className="text-xs text-slate-400 ml-1">{t('patients_modal_view_billing_item_more', {count: bill.items.length - 1})}</span>}
                                    </span>
                                ) : '-'}
                             </td>
                             <td className="px-4 py-2 text-right font-bold">${bill.totalAmount}</td>
                             <td className="px-4 py-2 text-center"><Badge color={bill.status === 'paid' ? 'green' : 'red'}>{bill.status}</Badge></td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   )}
                </div>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-end pt-6 border-t dark:border-slate-700 mt-4">
          <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>{t('close')}</Button>
        </div>
      </Modal>

    </div>
  );
};
