
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Filter, Edit, Calendar, Lock, 
  FlaskConical, Bed, Activity, Trash2, CheckCircle,
  Phone, User, Loader2,
  ChevronLeft, ChevronRight, Stethoscope, FileText, XCircle, DollarSign
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog, Bill, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [allLabRequests, setAllLabRequests] = useState<any[]>([]); // New state for 360 view history
  const { user: currentUser } = useAuth();
  const { t, language } = useTranslation();
  
  // Catalogs for Actions
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false); // Add/Edit Patient
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false); // The Grid Menu
  const [isActionModalOpen, setIsActionModalOpen] = useState(false); // The Specific Form
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); // History/360 View
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewTab, setViewTab] = useState<'info' | 'visits' | 'labs' | 'financials'>('info');

  // --- ACTION FORM STATE ---
  const [currentAction, setCurrentAction] = useState<'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | null>(null);
  
  // Dynamic Form Data
  const [actionFormData, setActionFormData] = useState({
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    notes: '',
    subtype: '',
    deposit: 0 
  });

  // Specific Sub-states
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedTests, setSelectedTests] = useState<LabTestCatalog[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedService, setSelectedService] = useState<NurseServiceCatalog | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedType | null>(null);

  // Patient Form Data
  const initialFormState = {
    fullName: '', age: 0, phone: '',
    gender: 'male' as Patient['gender'],
    type: 'outpatient' as Patient['type'],
    address: '',
    symptoms: '', medicalHistory: '', allergies: '', bloodGroup: '',
    emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    hasInsurance: false,
    insProvider: '', insPolicy: '', insExpiry: '', insNotes: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // --- LOADING DATA ---
  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [pts, apts, b, stf, labs] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(),
        api.getBills(),
        api.getStaff(),
        api.getPendingLabRequests() // Fetches all lab requests actually
      ]);
      setPatients(Array.isArray(pts) ? pts : []);
      setAppointments(Array.isArray(apts) ? apts : []);
      setBills(Array.isArray(b) ? b : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setAllLabRequests(Array.isArray(labs) ? labs : []);
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
    }
  };

  useEffect(() => {
    loadData();
    loadCatalogs();
  }, []);

  // --- HANDLERS ---

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
      setProcessStatus('error');
      setProcessMessage(t('patients_process_error_load'));
      setTimeout(() => setProcessStatus('idle'), 1500);
    }
  };

  const openActionMenu = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsActionMenuOpen(true);
  };

  const handleActionSelect = (action: 'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | 'history') => {
    if (action === 'history') {
      openViewModal(selectedPatient!);
      return;
    }
    
    // Reset specific form states
    setIsActionMenuOpen(false);
    setSelectedTests([]);
    setTestSearch('');
    setSelectedService(null);
    setSelectedBed(null);
    setSelectedSpecialty('');
    
    // Reset base form state
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00', 
      notes: '',
      subtype: '', 
      deposit: 0
    });
    setIsActionModalOpen(true);
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

  const handleBackToActionMenu = () => {
    setIsActionModalOpen(false);
    setIsActionMenuOpen(true);
  };

  // --- SUBMIT LOGIC ---

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    setProcessStatus('processing');
    setProcessMessage(t('patients_process_submitting'));
    
    try {
      const staffAssignedId = actionFormData.staffId ? parseInt(actionFormData.staffId) : undefined;

      if (currentAction === 'lab') {
        if (selectedTests.length === 0) throw new Error(t('patients_process_error_select_test'));
        await api.createLabRequest({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          testIds: selectedTests.map(t => t.id),
          totalCost: selectedTests.reduce((a,b)=>a+b.cost, 0)
        });
        setProcessMessage(t('patients_process_success_lab'));

      } else if (currentAction === 'nurse') {
        if (!selectedService) throw new Error(t('patients_process_error_select_service'));
        if (!staffAssignedId) throw new Error(t('patients_process_error_select_nurse'));
        const nurse = staff.find(s => s.id === staffAssignedId);
        
        // Use Appointment system for Nurse Requests to allow queueing
        await api.createAppointment({
          patientId: selectedPatient.id,
          staffId: staffAssignedId,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: 'Procedure',
          reason: `${selectedService.name_en}: ${actionFormData.notes}`,
          customFee: selectedService.cost, 
        });
        setProcessMessage(t('patients_process_success_nurse'));

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
        setProcessMessage(t('patients_process_success_admission'));

      } else if (currentAction === 'operation') {
        if (!actionFormData.subtype) throw new Error(t('patients_process_error_select_op'));
        if (!staffAssignedId) throw new Error(t('patients_process_error_select_surgeon'));

        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffAssignedId,
          notes: actionFormData.notes
        });
        setProcessMessage(t('patients_process_success_operation'));

      } else if (currentAction === 'appointment') {
        if (!staffAssignedId) throw new Error(t('patients_process_error_no_doctor'));
        
        await api.createAppointment({
          patientId: selectedPatient.id,
          staffId: staffAssignedId,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: actionFormData.subtype || 'Consultation',
          reason: actionFormData.notes
        });
        setProcessMessage(t('patients_process_success_appointment'));
      }

      setProcessStatus('success');
      await loadData(true);
      
      setTimeout(() => {
        setIsActionModalOpen(false);
        setProcessStatus('idle');
      }, 1500);

    } catch (err: any) {
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
      } else {
        await api.addPatient(payload);
      }
      setProcessStatus('success');
      setProcessMessage(isEditing ? t('patients_process_update_success') : t('patients_process_register_success'));
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

  // --- FILTERS & HELPERS ---
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = 
        p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.phone.includes(searchTerm) ||
        p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [patients, searchTerm, filterType]);

  const paginatedPatients = filteredPatients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);

  const getFilteredDoctors = () => {
    if (selectedSpecialty) return staff.filter(s => s.type === 'doctor' && s.specialization === selectedSpecialty);
    return staff.filter(s => s.type === 'doctor');
  };

  const hasPermissionToCreate = hasPermission(currentUser, Permissions.MANAGE_PATIENTS);

  // 360 View Data Filtering
  const patientVisits = useMemo(() => selectedPatient ? appointments.filter(a => a.patientId === selectedPatient.id).sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()) : [], [selectedPatient, appointments]);
  const patientFinancials = useMemo(() => selectedPatient ? bills.filter(b => b.patientId === selectedPatient.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [], [selectedPatient, bills]);
  const patientLabs = useMemo(() => selectedPatient ? allLabRequests.filter(l => l.patient_id === selectedPatient.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [], [selectedPatient, allLabRequests]);

  return (
    <div className="space-y-6">
      
      {/* LOADING OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processStatus === 'processing' ? t('patients_process_title_processing') : processStatus === 'success' ? t('patients_process_title_success') : t('patients_process_title_failed')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('patients_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('patients_subtitle')}</p>
        </div>
        {hasPermissionToCreate ? (
          <Button onClick={openCreateModal} icon={Plus}>{t('patients_register_button')}</Button>
        ) : (
          <Button disabled variant="secondary" icon={Lock}>{t('patients_register_button_locked')}</Button>
        )}
      </div>

      {/* TABLE CARD */}
      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              name="patient_search_query"
              autoComplete="off"
              placeholder={t('patients_search_placeholder')} 
              className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex gap-2">
             <select 
               className="pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
               value={filterType}
               onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
             >
               <option value="all">{t('patients_filter_type_all')}</option>
               <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
               <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
               <option value="emergency">{t('patients_filter_type_emergency')}</option>
             </select>
          </div>
        </div>

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
                      <div className="flex items-center group/name cursor-pointer" onClick={() => openViewModal(patient)}>
                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 group-hover/name:bg-primary-100 group-hover/name:text-primary-600 transition-colors">
                          {patient.fullName.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-slate-900 dark:text-white group-hover/name:text-primary-600 transition-colors">{patient.fullName}</div>
                          <div className="text-xs text-slate-500 font-mono">{patient.patientId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                      <div>{patient.phone}</div>
                      <div className="text-xs text-slate-400">{patient.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={patient.type === 'inpatient' ? 'red' : patient.type === 'emergency' ? 'orange' : 'green'}>{patient.type}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {patient.age} yrs / {patient.gender}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => openActionMenu(patient)}>{t('patients_manage_button')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => openEditModal(patient)} icon={Edit}>{t('patients_edit_button')}</Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        {!loading && (
            <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>{t('patients_pagination_showing')} {paginatedPatients.length} {t('patients_pagination_of')} {filteredPatients.length}</span>
                    <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                        <span>{t('patients_pagination_rows')}</span>
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary-500"
                        >
                            <option value={10}>10</option>
                            <option value={15}>15</option>
                            <option value={20}>20</option>
                            <option value={25}>25</option>
                            <option value={30}>30</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>Prev</Button>
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={null}>Next</Button>
                </div>
            </div>
        )}
      </Card>

      {/* --- MODAL 1: ADD/EDIT PATIENT --- */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? t('patients_modal_edit_title') : t('patients_modal_new_title')}>
        <form onSubmit={handlePatientSubmit} className="space-y-6">
          
          {/* Personal Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">{t('patients_modal_form_personal_title')}</h4>
            <Input label={t('patients_modal_form_fullName')} required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('patients_modal_form_phone')} required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <Input label={t('patients_modal_form_age')} type="number" required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Select label={t('patients_modal_form_gender')} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                  <option value="male">{t('patients_modal_form_gender_male')}</option>
                  <option value="female">{t('patients_modal_form_gender_female')}</option>
                </Select>
                <Select label={t('patients_modal_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                  <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                  <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                  <option value="emergency">{t('patients_filter_type_emergency')}</option>
                </Select>
            </div>
            <Input label={t('patients_modal_form_address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
          </div>

          {/* Medical Profile */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">{t('patients_modal_form_medical_title')}</h4>
            <div className="grid grid-cols-2 gap-4">
               <Select label={t('patients_modal_form_bloodGroup')} value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                  <option value="">{t('patients_modal_form_bloodGroup_unknown')}</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
               </Select>
               <Input label={t('patients_modal_form_allergies')} placeholder={t('patients_modal_form_allergies_placeholder')} value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            </div>
            <Textarea label={t('patients_modal_form_symptoms')} rows={2} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
            <Textarea label={t('patients_modal_form_medicalHistory')} placeholder={t('patients_modal_form_medicalHistory_placeholder')} rows={2} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 pb-2">{t('patients_modal_form_emergency_title')}</h4>
            <Input label={t('patients_modal_form_emergency_name')} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
               <Input label={t('patients_modal_form_emergency_phone')} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
               <Input label={t('patients_modal_form_emergency_relation')} placeholder={t('patients_modal_form_emergency_relation_placeholder')} value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
            </div>
          </div>

          {/* Insurance Details */}
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_insurance_title')}</h4>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="hasInsurance" className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" checked={formData.hasInsurance} onChange={e => setFormData({...formData, hasInsurance: e.target.checked})} />
                    <label htmlFor="hasInsurance" className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('patients_modal_form_has_insurance')}</label>
                </div>
            </div>
            
            {formData.hasInsurance && (
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-4 border border-slate-100 dark:border-slate-700 animate-in slide-in-from-top-2 fade-in">
                    <Select label={t('patients_modal_form_insurance_provider')} value={formData.insProvider} onChange={e => setFormData({...formData, insProvider: e.target.value})}>
                        <option value="">{t('patients_modal_form_insurance_provider_select')}</option>
                        {insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
                    </Select>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label={t('patients_modal_form_insurance_policy')} value={formData.insPolicy} onChange={e => setFormData({...formData, insPolicy: e.target.value})} />
                        <Input label={t('patients_modal_form_insurance_expiry')} type="date" value={formData.insExpiry} onChange={e => setFormData({...formData, insExpiry: e.target.value})} />
                    </div>
                    <Textarea label={t('patients_modal_form_insurance_notes')} rows={2} value={formData.insNotes} onChange={e => setFormData({...formData, insNotes: e.target.value})} />
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
            { id: 'nurse', label: t('patients_modal_action_nurse'), icon: Stethoscope, color: 'bg-pink-100 text-pink-700', allowed: hasPermission(currentUser, Permissions.VIEW_DASHBOARD) }, 
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

      {/* --- MODAL 3: ACTION FORMS (Integrated) --- */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={t('patients_modal_action_specific_title_default')}>
        <div className="mb-4">
          <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={handleBackToActionMenu}>{t('patients_modal_action_back_button')}</Button>
        </div>

        <form onSubmit={submitAction} className="space-y-5">
          {/* Appointment Form */}
          {currentAction === 'appointment' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t('patients_modal_action_select_specialty')}</label>
                <select 
                  className="block w-full rounded-xl bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 p-2.5 border"
                  value={selectedSpecialty}
                  onChange={e => { setSelectedSpecialty(e.target.value); setActionFormData(prev => ({ ...prev, staffId: '', subtype: '' })); }}
                >
                  <option value="">{t('patients_modal_action_select_specialty')}</option>
                  {[...new Set(staff.filter(s => s.type === 'doctor').map(s => s.specialization))].map(spec => <option key={spec} value={spec}>{spec}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{t('patients_modal_action_select_doctor')}</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {getFilteredDoctors().map(doc => (
                    <div 
                      key={doc.id}
                      onClick={() => setActionFormData(prev => ({...prev, staffId: doc.id.toString(), subtype: ''}))}
                      className={`min-w-[140px] p-3 rounded-xl border cursor-pointer ${actionFormData.staffId === doc.id.toString() ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div className="font-bold text-sm truncate">{doc.fullName}</div>
                      <div className="text-xs text-slate-500 truncate">{doc.specialization}</div>
                    </div>
                  ))}
                </div>
              </div>

              {actionFormData.staffId && (
                <div className="animate-in fade-in">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">{t('patients_modal_action_appointment_type')}</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {(() => {
                      const doctor = staff.find(s => s.id.toString() === actionFormData.staffId);
                      return [
                        { id: 'Consultation', label: t('patients_modal_action_consultation'), fee: doctor?.consultationFee },
                        { id: 'Follow-up', label: t('patients_modal_action_followUp'), fee: doctor?.consultationFeeFollowup },
                        { id: 'Emergency', label: t('patients_modal_action_emergency'), fee: doctor?.consultationFeeEmergency },
                      ].map(type => (
                        <div 
                          key={type.id}
                          onClick={() => setActionFormData(prev => ({...prev, subtype: type.id}))}
                          className={`min-w-[120px] p-3 rounded-xl border cursor-pointer flex flex-col justify-between h-20 ${actionFormData.subtype === type.id ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 hover:bg-slate-50'}`}
                        >
                          <span className="text-sm font-medium">{type.label}</span>
                          <span className="font-bold text-lg text-primary-600">${type.fee}</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              <Textarea label={t('patients_modal_action_reason')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* Nurse Request Form */}
          {currentAction === 'nurse' && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('patients_process_error_select_service')}</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-40 overflow-y-auto custom-scrollbar">
                  {nurseServices.map(s => (
                    <div 
                      key={s.id}
                      onClick={() => setSelectedService(s)}
                      className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between h-20 ${selectedService?.id === s.id ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <span className="text-sm font-medium line-clamp-2">{s.name_en}</span>
                      <span className="font-bold text-sm text-primary-600">${s.cost}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('patients_modal_action_select_nurse')}</label>
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {staff.filter(s => s.type === 'nurse').map(nurse => (
                    <div 
                      key={nurse.id}
                      onClick={() => setActionFormData(prev => ({...prev, staffId: nurse.id.toString()}))}
                      className={`min-w-[140px] p-3 rounded-xl border cursor-pointer ${actionFormData.staffId === nurse.id.toString() ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div className="font-bold text-sm truncate">{nurse.fullName}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Textarea label={t('patients_modal_action_notes')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* Admission Form */}
          {currentAction === 'admission' && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">{t('patients_modal_action_choose_bed')}</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                  {beds.map(bed => {
                    const isAvailable = bed.status === 'available';
                    let bgClass = 'bg-slate-100 border-slate-200 text-slate-400';
                    if (isAvailable) bgClass = 'bg-white border-green-200 text-slate-700 hover:border-green-400 cursor-pointer';
                    if (bed.status === 'occupied') bgClass = 'bg-red-50 border-red-100 text-red-400 opacity-70';
                    if (bed.status === 'reserved') bgClass = 'bg-blue-50 border-blue-100 text-blue-400 opacity-70';
                    
                    if (selectedBed?.id === bed.id) bgClass = 'bg-green-50 border-green-500 ring-1 ring-green-500 text-green-800';

                    return (
                      <div 
                        key={bed.id}
                        onClick={() => isAvailable && setSelectedBed(bed)}
                        className={`p-2 rounded-lg border flex flex-col items-center text-center gap-1 transition-all ${bgClass}`}
                      >
                        <Bed size={20} />
                        <span className="text-xs font-bold">{bed.roomNumber}</span>
                        <span className="text-[10px] font-mono">${bed.costPerDay}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('patients_modal_action_treating_doctor')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                  <option value="">{t('patients_modal_action_select_doctor')}</option>
                  {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </Select>
                <Input label={t('patients_modal_action_admission_date')} type="date" value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
              </div>
              <Input label={t('patients_modal_action_required_deposit')} type="number" value={actionFormData.deposit} onChange={e => setActionFormData({...actionFormData, deposit: parseFloat(e.target.value)})} />
            </>
          )}

          {/* Operation Form */}
          {currentAction === 'operation' && (
            <>
              <Select label={t('patients_modal_action_op_type')} value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                <option value="">{t('patients_modal_action_select_procedure')}</option>
                {operations.map(o => <option key={o.id} value={o.name_en}>{o.name_en} (Base: ${o.baseCost})</option>)}
              </Select>
              <Select label={t('patients_modal_action_request_surgeon')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                <option value="">{t('patients_modal_action_select_surgeon')}</option>
                {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Textarea label={t('patients_modal_action_pre_op_notes')} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* Lab Form */}
          {currentAction === 'lab' && (
            <>
              <Input 
                label={t('patients_modal_action_search_tests')} 
                placeholder={t('patients_modal_action_search_tests_placeholder')}
                value={testSearch}
                onChange={e => setTestSearch(e.target.value)}
              />
              {testSearch && (
                <div className="max-h-40 overflow-y-auto border rounded-xl bg-white shadow-sm p-2">
                  {labTests.filter(t => t.name_en.toLowerCase().includes(testSearch.toLowerCase())).map(test => (
                    <div 
                      key={test.id} 
                      onClick={() => {
                        if (!selectedTests.find(t => t.id === test.id)) setSelectedTests([...selectedTests, test]);
                        setTestSearch('');
                      }}
                      className="p-2 hover:bg-slate-50 cursor-pointer flex justify-between"
                    >
                      <span>{test.name_en}</span>
                      <span className="font-bold">${test.cost}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 mt-4">
                {selectedTests.map(test => (
                  <div key={test.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border">
                    <span>{test.name_en}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold">${test.cost}</span>
                      <button type="button" onClick={() => setSelectedTests(selectedTests.filter(t => t.id !== test.id))} className="text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right font-bold text-lg mt-2">
                Total: ${selectedTests.reduce((a,b)=>a+b.cost, 0)}
              </div>
            </>
          )}

          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={processStatus === 'processing'}>{t('submit')}</Button>
          </div>
        </form>
      </Modal>

      {/* --- MODAL 4: VIEW HISTORY --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title={t('patients_modal_view_title')}>
        {selectedPatient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-2xl font-bold text-primary-600 shadow-sm">
                {selectedPatient.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedPatient.fullName}</h2>
                <div className="flex gap-2 text-sm text-slate-500 mt-1">
                   <Badge color="gray">{selectedPatient.patientId}</Badge>
                   <Badge color={selectedPatient.type === 'inpatient' ? 'red' : 'green'}>{selectedPatient.type}</Badge>
                </div>
              </div>
            </div>

            {/* Tabs for 360 View */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
                {[
                    {id: 'info', label: t('patients_modal_view_overview_tab')},
                    {id: 'visits', label: t('patients_modal_view_timeline_tab')},
                    {id: 'labs', label: t('patients_modal_action_lab')},
                    {id: 'financials', label: t('patients_modal_view_financials_tab')},
                ].map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setViewTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Info Tab */}
            {viewTab === 'info' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_contact_personal')}</h4>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-500">{t('patients_modal_view_phone')}</span>
                                <span className="font-medium">{selectedPatient.phone}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-500">{t('patients_modal_form_age')} / {t('patients_modal_form_gender')}</span>
                                <span className="font-medium">{selectedPatient.age} / {selectedPatient.gender}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-500">{t('patients_modal_view_address')}</span>
                                <span className="font-medium truncate max-w-[150px]">{selectedPatient.address || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_medical_profile')}</h4>
                        <div className="text-sm space-y-2">
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-500">{t('patients_modal_view_blood_group')}</span>
                                <span className="font-bold text-red-500">{selectedPatient.bloodGroup || '-'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                <span className="text-slate-500">{t('patients_modal_view_allergies')}</span>
                                <span className="font-medium text-red-600 truncate max-w-[150px]">{selectedPatient.allergies || 'None'}</span>
                            </div>
                        </div>
                    </div>
                    </div>

                    {selectedPatient.emergencyContact && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_emergency_contact')}</h4>
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-sm border border-slate-100 dark:border-slate-800">
                                <span className="font-bold text-slate-800 dark:text-white">{selectedPatient.emergencyContact.name}</span>
                                <span className="text-slate-500"> ({selectedPatient.emergencyContact.relation})</span>
                                <div className="text-slate-600 dark:text-slate-400 mt-1">{selectedPatient.emergencyContact.phone}</div>
                            </div>
                        </div>
                    )}

                    {selectedPatient.insuranceDetails && selectedPatient.hasInsurance && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_insurance_coverage')}</h4>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm border border-blue-100 dark:border-blue-800">
                                <div className="flex justify-between mb-1">
                                    <span className="text-blue-600 dark:text-blue-400 font-bold">{selectedPatient.insuranceDetails.provider}</span>
                                    <span className="text-blue-500 text-xs">{selectedPatient.insuranceDetails.expiryDate}</span>
                                </div>
                                <div className="text-blue-700 dark:text-blue-300 font-mono text-xs">#{selectedPatient.insuranceDetails.policyNumber}</div>
                            </div>
                        </div>
                    )}

                    <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_medical_history')}</h4>
                        <p className="text-sm bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                            {selectedPatient.medicalHistory || t('patients_modal_view_no_history')}
                        </p>
                    </div>
                </div>
            )}

            {/* Visits Tab */}
            {viewTab === 'visits' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in">
                    {appointments.filter(a => a.patientId === selectedPatient.id).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">{t('patients_modal_view_no_timeline')}</p>
                    ) : (
                        appointments.filter(a => a.patientId === selectedPatient.id).sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()).map(apt => (
                            <div key={apt.id} className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex flex-col items-center min-w-[60px]">
                                    <span className="text-xs font-bold text-slate-500">{new Date(apt.datetime).toLocaleDateString()}</span>
                                    <span className="text-xs text-slate-400">{new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div>
                                    <div className="font-bold text-sm text-slate-800 dark:text-white">{apt.type}</div>
                                    <div className="text-xs text-slate-500">Dr. {apt.staffName}</div>
                                    <Badge color={apt.status === 'completed' ? 'green' : 'blue'} className="mt-1">{apt.status}</Badge>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Labs Tab */}
            {viewTab === 'labs' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in">
                    {allLabRequests.filter(l => l.patient_id === selectedPatient.id).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">{t('lab_empty', {tab: 'history'})}</p>
                    ) : (
                        allLabRequests.filter(l => l.patient_id === selectedPatient.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(lab => (
                            <div key={lab.id} className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                <div className="flex flex-col items-center min-w-[60px] justify-center">
                                    <FlaskConical size={20} className="text-orange-500 mb-1" />
                                    <span className="text-xs font-bold text-slate-500">{new Date(lab.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-sm text-slate-800 dark:text-white">{lab.testNames || 'Lab Request'}</div>
                                    <div className="text-xs text-slate-500">ID: {lab.id}</div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <Badge color={lab.status === 'completed' ? 'green' : 'yellow'}>{lab.status}</Badge>
                                    <span className="text-xs font-mono font-bold mt-1">${lab.projected_cost}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Financials Tab */}
            {viewTab === 'financials' && (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar animate-in fade-in">
                    {bills.filter(b => b.patientId === selectedPatient.id).length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">{t('patients_modal_view_no_billing')}</p>
                    ) : (
                        bills.filter(b => b.patientId === selectedPatient.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(bill => (
                            <div key={bill.id} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
                                            <DollarSign size={14} className="text-emerald-600" />
                                            Invoice #{bill.billNumber}
                                        </div>
                                        <div className="text-xs text-slate-500">{new Date(bill.date).toLocaleDateString()}</div>
                                    </div>
                                    <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : 'red'}>{bill.status}</Badge>
                                </div>
                                <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                                    <span className="text-slate-500">{t('patients_modal_view_billing_amount')}</span>
                                    <span className="font-bold font-mono">${bill.totalAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">{t('billing_table_paid_amount')}</span>
                                    <span className="font-bold font-mono text-emerald-600">${bill.paidAmount.toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

          </div>
        )}
        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>{t('close')}</Button>
        </div>
      </Modal>

    </div>
  );
};
