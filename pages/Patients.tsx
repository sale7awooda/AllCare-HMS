
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Filter, Edit, Calendar, Lock, 
  FlaskConical, Bed, Activity, Trash2, CheckCircle,
  Phone, User, Loader2, Info,
  ChevronLeft, ChevronRight, Stethoscope, FileText, XCircle, DollarSign, Clock, 
  ClipboardCheck, ShoppingCart, Layers, Syringe, Zap, Briefcase, ShieldCheck, Heart, UserPlus, CalendarDays, ChevronDown, ChevronUp, Eye
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog, Bill, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

const { useLocation } = ReactRouterDOM as any;

export const Patients = () => {
  const location = useLocation();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [allLabRequests, setAllLabRequests] = useState<any[]>([]); 
  const { user: currentUser } = useAuth();
  const { t, language } = useTranslation();
  
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  // Fix: Added missing confirmState state definition to satisfy JSX usage
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', action: () => {} });

  const [isFormModalOpen, setIsFormModalOpen] = useState(false); 
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false); 
  const [isActionModalOpen, setIsActionModalOpen] = useState(false); 
  const [isViewModalOpen, setIsViewModalOpen] = useState(false); 
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [viewTab, setViewTab] = useState<'info' | 'visits' | 'labs' | 'financials'>('info');
  const [expandedLabId, setExpandedLabId] = useState<number | null>(null);

  const [currentAction, setCurrentAction] = useState<'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | null>(null);
  
  const [actionFormData, setActionFormData] = useState({
    staffId: '',
    date: new Date().toLocaleDateString('en-CA'),
    time: new Date().toTimeString().slice(0, 5), 
    notes: '',
    subtype: 'Consultation',
    deposit: 0 
  });

  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [selectedTests, setSelectedTests] = useState<LabTestCatalog[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedService, setSelectedService] = useState<NurseServiceCatalog | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedType | null>(null);

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

  const hasPermissionToCreate = hasPermission(currentUser, Permissions.MANAGE_PATIENTS);

  const formatMoney = (val: number | string) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return new Intl.NumberFormat().format(num || 0);
  };

  const formatStaffName = (name: string) => {
    if (!name) return t('patients_modal_view_na');
    const lowerName = name.toLowerCase();
    if (lowerName.startsWith('dr.') || lowerName.startsWith('nurse ') || lowerName.startsWith('tech.')) return name;
    return `${t('admissions_bed_doctor', {name})}`;
  };

  useHeader(
    t('patients_title'), 
    t('patients_subtitle'), 
    hasPermissionToCreate ? (
      <Button onClick={() => openCreateModal()} icon={Plus}>{t('patients_register_button')}</Button>
    ) : (
      <Button disabled variant="secondary" icon={Lock}>{t('patients_register_button_locked')}</Button>
    )
  );

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [pts, apts, b, stf, labs] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(),
        api.getBills(),
        api.getStaff(),
        api.getPendingLabRequests()
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

  useEffect(() => {
    const state = location.state as any;
    if (state?.trigger === 'new' && hasPermissionToCreate) {
      openCreateModal();
    }
  }, [location.state, hasPermissionToCreate]);

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
        emergencyName: fullDetails.emergencyName || '',
        emergencyPhone: fullDetails.emergencyPhone || '',
        emergencyRelation: fullDetails.emergencyRelation || '',
        insProvider: fullDetails.insProvider || '',
        insPolicy: fullDetails.insPolicy || '',
        insExpiry: fullDetails.insExpiry || '',
        insNotes: fullDetails.insNotes || ''
      });
      setSelectedPatient(fullDetails);
      setIsEditing(true);
      setProcessStatus('idle');
      setIsFormModalOpen(true);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || t('patients_process_error_load'));
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
    setIsActionMenuOpen(false);
    setSelectedTests([]);
    setTestSearch('');
    setSelectedService(null);
    setSelectedBed(null);
    setSelectedSpecialty('');
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toTimeString().slice(0, 5), 
      notes: '',
      subtype: 'Consultation', 
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
      setExpandedLabId(null);
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

  const isDoctorAvailableOnDate = (doctor: MedicalStaff, dateString: string) => {
    if (doctor.availableDays && doctor.availableDays.length === 0) return false;
    if (!doctor.availableDays) return true;

    const [y, m, d] = dateString.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayName = dayNames[date.getDay()];
    
    return doctor.availableDays.includes(currentDayName);
  };

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
        await api.createAppointment({
          patientId: selectedPatient.id,
          staffId: staffAssignedId,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: 'Procedure',
          reason: `${language === 'ar' ? selectedService.name_ar : selectedService.name_en}: ${actionFormData.notes}`,
          customFee: parseFloat(selectedService.cost.toString()), 
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
      setProcessMessage(err.response?.data?.error || err.message || t('patients_process_title_failed'));
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
      setProcessMessage(err.response?.data?.error || t('patients_process_error_save'));
    }
  };

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
    let docs = staff.filter(s => s.type === 'doctor');
    if (selectedSpecialty) docs = docs.filter(s => s.specialization === selectedSpecialty);
    return docs;
  };

  const patientVisits = useMemo(() => selectedPatient ? appointments.filter(a => a.patientId === selectedPatient.id).sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime()) : [], [selectedPatient, appointments]);
  const patientFinancials = useMemo(() => selectedPatient ? bills.filter(b => b.patientId === selectedPatient.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [], [selectedPatient, bills]);
  const patientLabs = useMemo(() => selectedPatient ? allLabRequests.filter(l => l.patient_id === selectedPatient.id).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [], [selectedPatient, allLabRequests]);

  const formatDateSafely = (dateStr: any) => {
      if (!dateStr) return t('patients_modal_view_na');
      const normalizedStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
      const d = new Date(normalizedStr);
      if (isNaN(d.getTime())) return t('patients_modal_view_na');
      return d.toLocaleDateString();
  };

  const getBedGrouped = () => {
      const groups: Record<string, BedType[]> = {};
      beds.forEach(bed => {
          if (!groups[bed.type]) groups[bed.type] = [];
          groups[bed.type].push(bed);
      });
      return groups;
  };

  const selectedDocForFee = useMemo(() => {
    return staff.find(s => s.id.toString() === actionFormData.staffId);
  }, [actionFormData.staffId, staff]);

  const translateType = (type: string, t: any) => {
    const key = `patients_modal_action_${type.toLowerCase().replace('-up', 'Up')}`;
    const translation = t(key);
    return translation === key ? type : translation;
  };

  return (
    <div className="space-y-6">
      
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processStatus === 'processing' ? t('processing') : processStatus === 'success' ? t('success') : t('patients_process_title_failed')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>}
          </div>
        </div>
      )}

      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text"
              name="patient_search_query"
              autoComplete="off"
              placeholder={t('patients_search_placeholder')} 
              className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="flex gap-2">
             <select 
               className="pl-3 pr-8 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
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
                <tr>
                  <td colSpan={5} className="p-0">
                    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                      <p className="text-slate-500 font-medium">{t('patients_process_loading')}</p>
                    </div>
                  </td>
                </tr>
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
                      <Badge color={patient.type === 'inpatient' ? 'red' : patient.type === 'emergency' ? 'orange' : 'green'}>{t(`patients_filter_type_${patient.type}`)}</Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {patient.age} {t('patients_table_age_unit')} / {t(`patients_modal_form_gender_${patient.gender}`)}
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
        
        {!loading && (
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                    <span>{t('patients_pagination_showing')} {paginatedPatients.length} {t('patients_pagination_of')} {filteredPatients.length}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                        <select 
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                          value={itemsPerPage}
                          onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                </div>
            </div>
        )}
      </Card>

      {/* PATIENT REGISTRATION MODAL */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)} 
        title={isEditing ? t('patients_modal_edit_title') : t('patients_modal_new_title')}
        footer={
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary-50 dark:bg-primary-900/30 rounded-lg text-primary-600">
                <User size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('patients_table_header_patient')}</p>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{formData.fullName || '...'}</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" form="patient-registration-form" icon={CheckCircle}>{t('patients_modal_save_button')}</Button>
            </div>
          </div>
        }
      >
        <form id="patient-registration-form" onSubmit={handlePatientSubmit} className="space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <UserPlus size={18} className="text-primary-600" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('patients_modal_form_personal_title')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input label={t('patients_modal_form_fullName')} required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
               <Input label={t('patients_modal_form_phone')} required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
               <Input label={t('patients_modal_form_age')} type="number" required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})} />
               <Select label={t('patients_modal_form_gender')} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                  <option value="male">{t('patients_modal_form_gender_male')}</option>
                  <option value="female">{t('patients_modal_form_gender_female')}</option>
                  <option value="other">{t('patients_modal_form_gender_other')}</option>
               </Select>
               <Select label={t('patients_modal_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                  <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                  <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                  <option value="emergency">{t('patients_filter_type_emergency')}</option>
               </Select>
               <Input label={t('patients_modal_form_address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Heart size={18} className="text-red-500" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('patients_modal_form_medical_title')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Select label={t('patients_modal_form_bloodGroup')} value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                  <option value="">{t('patients_modal_form_bloodGroup_unknown')}</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
               </Select>
               <Input label={t('patients_modal_form_allergies')} placeholder={t('patients_modal_form_allergies_placeholder')} value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            </div>
            <Textarea label={t('patients_modal_form_symptoms')} rows={2} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
            <Textarea label={t('patients_modal_form_medicalHistory')} placeholder={t('patients_modal_form_medicalHistory_placeholder')} rows={2} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
          </div>

          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-700">
                <Activity size={18} className="text-orange-500" />
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('patients_modal_form_emergency_title')}</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Input label={t('patients_modal_form_emergency_name')} value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
               <Input label={t('patients_modal_form_emergency_phone')} value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
               <Input label={t('patients_modal_form_emergency_relation')} placeholder={t('patients_modal_form_emergency_relation_placeholder')} value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
            </div>
          </div>

          <div className="space-y-5 bg-primary-50/30 dark:bg-primary-900/10 p-5 rounded-2xl border border-primary-100 dark:border-primary-800">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-primary-100 dark:border-primary-800 mb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-primary-600" />
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('patients_modal_form_insurance_title')}</h4>
                </div>
                <div className="flex items-center gap-2">
                   <input 
                     type="checkbox" 
                     id="hasInsurance" 
                     checked={formData.hasInsurance} 
                     onChange={e => setFormData({...formData, hasInsurance: e.target.checked})}
                     className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                   />
                   <label htmlFor="hasInsurance" className="text-xs font-bold text-slate-600 cursor-pointer">{t('patients_modal_form_has_insurance')}</label>
                </div>
            </div>
            
            {formData.hasInsurance && (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
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
        </form>
      </Modal>

      {/* QUICK ACTION MENU */}
      <Modal isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} title={t('patients_modal_action_menu_title', {name: selectedPatient?.fullName})}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { id: 'appointment', label: t('patients_modal_action_appointment'), icon: Calendar, color: 'bg-violet-100 text-violet-700', allowed: hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS) },
            { id: 'lab', label: t('patients_modal_action_lab'), icon: FlaskConical, color: 'bg-orange-100 text-orange-700', allowed: hasPermission(currentUser, Permissions.MANAGE_LABORATORY) },
            { id: 'nurse', label: t('patients_modal_action_nurse'), icon: Stethoscope, color: 'bg-pink-100 text-pink-700', allowed: true }, 
            { id: 'admission', label: t('patients_modal_action_admission'), icon: Bed, color: 'bg-blue-100 text-blue-700', allowed: hasPermission(currentUser, Permissions.MANAGE_ADMISSIONS), disabled: selectedPatient?.type === 'inpatient' },
            { id: 'operation', label: t('patients_modal_action_operation'), icon: Activity, color: 'bg-red-100 text-red-700', allowed: hasPermission(currentUser, Permissions.MANAGE_OPERATIONS) },
            { id: 'history', label: t('patients_modal_action_history'), icon: FileText, color: 'bg-slate-100 text-slate-700', allowed: true },
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
            </button>
          ))}
        </div>
      </Modal>

      {/* DETAILED ACTION MODAL */}
      <Modal 
        isOpen={isActionModalOpen} 
        onClose={() => setIsActionModalOpen(false)} 
        title={currentAction ? t(`patients_modal_action_specific_title_${currentAction}`) : 'Action'}
        footer={
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 rounded-full text-primary-600">
                <Info size={18} />
              </div>
              <div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{t('patients_table_header_patient')}</p>
                <p className="text-sm font-black text-slate-800 dark:text-white truncate max-w-[150px]">{selectedPatient?.fullName}</p>
              </div>
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>{t('cancel')}</Button>
              <Button type="submit" form="patient-action-form" disabled={processStatus === 'processing'} className="flex-1 sm:flex-none">{processStatus === 'processing' ? t('processing') : t('submit')}</Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col">
          <div className="-mt-1 mb-1">
            <Button size="sm" variant="ghost" icon={ChevronLeft} onClick={handleBackToActionMenu}>{t('patients_modal_action_back_button')}</Button>
          </div>

          <form id="patient-action-form" onSubmit={submitAction} className="space-y-6">
              {currentAction === 'appointment' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select label={t('patients_modal_action_select_specialty')} value={selectedSpecialty} onChange={e => { setSelectedSpecialty(e.target.value); setActionFormData({...actionFormData, staffId: ''}); }}>
                        <option value="">{t('appointments_filter_all_depts')}</option>
                        {[...new Set(staff.filter(s => s.type === 'doctor').map(s => s.specialization))].map(spec => <option key={spec} value={spec}>{spec}</option>)}
                    </Select>
                    <Input type="date" label={t('date')} value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('patients_modal_action_select_doctor')}</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {getFilteredDoctors().map(doc => {
                            const selected = actionFormData.staffId === doc.id.toString();
                            const isAvailable = isDoctorAvailableOnDate(doc, actionFormData.date);
                            const isRtl = language === 'ar';
                            return (
                                <div 
                                    key={doc.id} 
                                    onClick={() => isAvailable && setActionFormData({...actionFormData, staffId: doc.id.toString()})} 
                                    className={`relative py-3 ${isRtl ? 'pl-4 pr-10' : 'pr-4 pl-10'} rounded-xl border-2 transition-all flex flex-col justify-center overflow-hidden min-h-[70px] group
                                      ${selected 
                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 cursor-default' 
                                        : isAvailable 
                                          ? 'border-emerald-100 bg-emerald-50/10 hover:border-emerald-300 dark:border-emerald-900/30 cursor-pointer' 
                                          : 'border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 opacity-50 cursor-not-allowed grayscale'
                                      }`}
                                >
                                    <div className={`absolute top-0 bottom-0 ${isRtl ? 'right-0' : 'left-0'} w-8 flex items-center justify-center transition-colors ${selected ? 'bg-primary-500 text-white' : isAvailable ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}`}>
                                        <span className={`rotate-180 [writing-mode:vertical-lr] text-[9px] font-black uppercase tracking-tighter leading-none whitespace-nowrap`}>
                                            {isAvailable ? t('patients_modal_action_doctor_available') : t('patients_modal_action_off_duty')}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-sm truncate leading-tight ${selected ? 'text-primary-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{doc.fullName}</p>
                                        <p className="text-[10px] text-slate-500 uppercase font-black truncate mt-1 tracking-wider">{doc.specialization}</p>
                                        {!isAvailable && <p className="text-[9px] text-red-500 font-bold mt-0.5">{t('patients_modal_action_doctor_unavailable')}</p>}
                                    </div>
                                    {selected && (
                                      <div className={`absolute top-2 ${isRtl ? 'left-2' : 'right-2'} text-primary-600 animate-in zoom-in-50 duration-200`}>
                                        <CheckCircle size={16} />
                                      </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                      <Select label={t('appointments_form_type')} value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                          <option value="Consultation">{t('patients_modal_action_consultation')} {selectedDocForFee ? ` ($${formatMoney(selectedDocForFee.consultationFee)})` : ''}</option>
                          <option value="Follow-up">{t('patients_modal_action_followUp')} {selectedDocForFee ? ` ($${formatMoney(selectedDocForFee.consultationFeeFollowup || 0)})` : ''}</option>
                          <option value="Emergency">{t('patients_modal_action_emergency')} {selectedDocForFee ? ` ($${formatMoney(selectedDocForFee.consultationFeeEmergency || 0)})` : ''}</option>
                      </Select>
                      <Input type="time" label={t('time')} value={actionFormData.time} onChange={e => setActionFormData({...actionFormData, time: e.target.value})} />
                  </div>
                  <Textarea label={t('patients_modal_action_reason')} rows={3} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
                </>
              )}

              {currentAction === 'lab' && (
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-3 space-y-4 flex flex-col">
                        <div className="relative shrink-0">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <Input placeholder={t('patients_modal_action_search_tests_placeholder')} value={testSearch} onChange={e => setTestSearch(e.target.value)} className="pl-10" />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-900/50 space-y-2 custom-scrollbar">
                            {labTests.filter(t => t.name_en.toLowerCase().includes(testSearch.toLowerCase()) || t.name_ar.includes(testSearch)).map(test => {
                                const inCart = selectedTests.some(t => t.id === test.id);
                                return (
                                    <div key={test.id} className={`p-3 rounded-lg border bg-white dark:bg-slate-800 flex justify-between items-center transition-all ${inCart ? 'border-primary-500 ring-1 ring-primary-500/20' : 'border-slate-200 dark:border-slate-700'}`}>
                                        <div>
                                            <p className="text-sm font-bold">{language === 'ar' ? test.name_ar : test.name_en}</p>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{test.category_en}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-mono font-bold text-sm text-primary-600">${formatMoney(test.cost)}</span>
                                            <button type="button" onClick={() => inCart ? setSelectedTests(prev => prev.filter(t => t.id !== test.id)) : setSelectedTests(prev => [...prev, test])} className={`p-1.5 rounded-lg transition-colors ${inCart ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-primary-50 text-primary-600 hover:bg-primary-100'}`}>
                                                {inCart ? <Trash2 size={16} /> : <Plus size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[360px]">
                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4 shrink-0"><ShoppingCart size={18} /> {t('patients_modal_action_basket_title')}</h4>
                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
                            {selectedTests.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center opacity-60">
                                    <Layers size={32} className="mb-2" />
                                    <p className="text-xs">{t('patients_modal_action_no_tests_selected')}</p>
                                </div>
                            ) : (
                                selectedTests.map(test => (
                                    <div key={test.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-2.5 rounded-lg shadow-sm animate-in zoom-in-95">
                                        <span className="text-xs font-medium truncate max-w-[120px]">{language === 'ar' ? test.name_ar : test.name_en}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold font-mono">${formatMoney(test.cost)}</span>
                                            <button type="button" onClick={() => setSelectedTests(prev => prev.filter(t => t.id !== test.id))} className="text-slate-300 hover:text-red-500"><XCircle size={14} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
                            <div className="flex justify-between text-sm mb-1"><span className="text-slate-500">{t('billing_invoice_subtotal')}</span> <span className="font-mono">${formatMoney(selectedTests.reduce((a,b)=>a+b.cost, 0))}</span></div>
                            <div className="flex justify-between font-black text-xl"><span className="text-slate-800 dark:text-white">{t('billing_invoice_total')}</span> <span className="text-primary-600">${formatMoney(selectedTests.reduce((a,b)=>a+b.cost, 0))}</span></div>
                        </div>
                    </div>
                </div>
              )}

              {currentAction === 'nurse' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3 flex flex-col">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Syringe size={16} className="text-primary-500" /> {t('patients_modal_action_select_service')}</label>
                            <div className="max-h-[300px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl p-1.5 space-y-2 custom-scrollbar">
                                {nurseServices.map(s => (
                                    <div key={s.id} onClick={() => setSelectedService(s)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex justify-between items-center ${selectedService?.id === s.id ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-slate-100 hover:border-slate-200 bg-white dark:bg-slate-800'}`}>
                                        <div>
                                            <p className="font-bold text-sm">{language === 'ar' ? s.name_ar : s.name_en}</p>
                                            <p className="text-[10px] text-slate-400 line-clamp-1">{language === 'ar' ? s.description_ar : s.description_en}</p>
                                        </div>
                                        <Badge color="blue" className="font-mono">${formatMoney(s.cost)}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4 flex flex-col">
                            <div className="space-y-3 flex flex-col">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><User size={16} className="text-primary-500" /> {t('patients_modal_action_select_nurse')}</label>
                                <div className="max-h-[300px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-xl p-1.5 space-y-2 custom-scrollbar">
                                    {staff.filter(s => s.type === 'nurse').map(nurse => {
                                        const isSelected = actionFormData.staffId === nurse.id.toString();
                                        return (
                                            <div key={nurse.id} onClick={() => setActionFormData({...actionFormData, staffId: nurse.id.toString()})} className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${isSelected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500/20' : 'border-slate-100 hover:border-slate-200 bg-white dark:bg-slate-800'}`}>
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-sm font-bold text-slate-800 dark:text-white">{nurse.fullName}</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{nurse.department || 'Nursing Unit'}</span>
                                                </div>
                                                {isSelected ? <CheckCircle size={18} className="text-primary-600 animate-in zoom-in-50" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <Textarea label={t('patients_modal_action_instructions_label')} placeholder={t('patients_modal_action_instructions_placeholder')} rows={3} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
                        </div>
                    </div>
                </div>
              )}

              {currentAction === 'admission' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-3">
                            {Object.entries(getBedGrouped()).map(([type, items]) => (
                                <div key={type} className="space-y-2">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5"><Layers size={12} /> {t(`bed_type_${type.toLowerCase()}`)}</h4>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {items.map(bed => {
                                            const isAvailable = bed.status === 'available';
                                            const isSelected = selectedBed?.id === bed.id;
                                            return (
                                                <div 
                                                  key={bed.id} 
                                                  onClick={() => {
                                                    if (isAvailable) {
                                                      setSelectedBed(bed);
                                                      setActionFormData(prev => ({ ...prev, deposit: bed.costPerDay }));
                                                    }
                                                  }} 
                                                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${isSelected ? 'border-primary-500 bg-primary-50 shadow-md ring-2 ring-primary-500/20' : isAvailable ? 'border-slate-100 hover:border-primary-200 cursor-pointer' : 'opacity-40 grayscale bg-slate-50 cursor-not-allowed'}`}
                                                >
                                                    <Bed size={20} className={isSelected ? 'text-primary-600' : 'text-slate-400'} />
                                                    <span className="text-xs font-black">{bed.roomNumber}</span>
                                                    <span className="text-[10px] font-mono text-slate-500">${formatMoney(bed.costPerDay)}{t('patients_modal_action_bed_cost_per_day')}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 h-fit sticky top-0">
                            <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2"><ClipboardCheck size={18} /> {t('admissions_care_admission_info')}</h4>
                            <Select label={t('patients_modal_action_assign_doctor')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                                <option value="">{t('patients_modal_action_select_doctor')}</option>
                                {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
                            </Select>
                            <Input label={t('patients_modal_action_admission_date')} type="date" value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                            <Input label={t('patients_modal_action_required_deposit')} type="number" value={actionFormData.deposit} onChange={e => setActionFormData({...actionFormData, deposit: parseFloat(e.target.value)})} />
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                                <p className="text-[10px] text-slate-400 font-bold uppercase mb-2">{t('patients_modal_action_selected_accommodation')}</p>
                                {selectedBed ? (
                                    <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-primary-100">
                                        <span className="text-sm font-bold">{t('admissions_history_header_room')} {selectedBed.roomNumber}</span>
                                        <Badge color="blue">${formatMoney(selectedBed.costPerDay)} {t('patients_modal_action_bed_cost_per_day')}</Badge>
                                    </div>
                                ) : <p className="text-xs text-red-500 italic">{t('patients_modal_action_no_bed_selected')}</p>}
                            </div>
                        </div>
                    </div>
                </div>
              )}

              {currentAction === 'operation' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in">
                    <div className="space-y-6">
                        <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 flex items-start gap-4">
                            <Activity className="text-red-500 shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold text-red-900 dark:text-red-200">{t('patients_modal_action_clinical_request')}</h4>
                                <p className="text-xs text-red-700 dark:text-red-400 mt-1">{t('patients_modal_action_clinical_request_desc')}</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Select label={t('patients_modal_action_op_type')} value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                                <option value="">{t('patients_modal_action_select_procedure')}</option>
                                {operations.map(o => <option key={o.id} value={o.name_en}>{language === 'ar' ? o.name_ar : o.name_en} (${formatMoney(o.baseCost)})</option>)}
                            </Select>
                            <Select label={t('patients_modal_action_request_surgeon')} value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                                <option value="">{t('patients_modal_action_select_surgeon')}</option>
                                {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Textarea label={t('patients_modal_action_pre_op_notes')} placeholder={t('patients_modal_action_pre_op_notes_placeholder')} rows={8} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-2"><Briefcase size={14} /> {t('patients_modal_action_estimate_base')}</p>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600">{t('patients_modal_action_base_surgical_fee')}</span>
                                <span className="text-2xl font-black text-slate-900 dark:text-white">${formatMoney(operations.find(o => o.name_en === actionFormData.subtype)?.baseCost || 0)}</span>
                            </div>
                        </div>
                    </div>
                </div>
              )}
          </form>
        </div>
      </Modal>

      {/* VIEW MODAL (360 VIEW) */}
      <Modal 
        isOpen={isViewModalOpen} 
        onClose={() => setIsViewModalOpen(false)} 
        title={t('patients_modal_view_title')}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsViewModalOpen(false)}>{t('close')}</Button>
          </div>
        }
      >
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
                   <Badge color={selectedPatient.type === 'inpatient' ? 'red' : 'green'}>{t(`patients_filter_type_${selectedPatient.type}`)}</Badge>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto no-print">
                {[
                    {id: 'info', label: t('patients_modal_view_overview_tab')},
                    {id: 'visits', label: t('patients_modal_view_timeline_tab')},
                    {id: 'labs', label: t('patients_modal_action_lab')},
                    {id: 'financials', label: t('patients_modal_view_financials_tab')},
                ].map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setViewTab(tab.id)}
                        className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${viewTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
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
                                    <span className="font-medium">{selectedPatient.age} / {t(`patients_modal_form_gender_${selectedPatient.gender}`)}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                    <span className="text-slate-500">{t('patients_modal_view_address')}</span>
                                    <span className="font-medium truncate max-w-[150px]">{selectedPatient.address || t('patients_modal_view_na')}</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_medical_profile')}</h4>
                            <div className="text-sm space-y-2">
                                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                    <span className="text-slate-500">{t('patients_modal_view_blood_group')}</span>
                                    <span className="font-bold text-red-500">{selectedPatient.bloodGroup || t('patients_modal_view_na')}</span>
                                </div>
                                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                                    <span className="text-slate-500">{t('patients_modal_view_allergies')}</span>
                                    <span className="font-medium text-red-600 truncate max-w-[150px]">{selectedPatient.allergies || t('patients_modal_view_none')}</span>
                                </div>
                            </div>
                        </div>
                        </div>
                        {selectedPatient.emergencyContact && (
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('patients_modal_view_emergency_contact')}</h4>
                                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg text-sm border border-slate-100 dark:border-slate-800">
                                    <span className="font-bold text-slate-800 dark:text-white">{selectedPatient.emergencyContact.name}</span>
                                    <span className="text-slate-500"> ({selectedPatient.emergencyContact.relation || t('patients_modal_view_na')})</span>
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
                                    <div className="text-blue-700 dark:text-blue-300 font-mono text-xs">{t('patients_modal_view_policy_no')}: #{selectedPatient.insuranceDetails.policyNumber}</div>
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

                {viewTab === 'visits' && (
                    <div className="space-y-3 animate-in fade-in">
                        {patientVisits.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">{t('patients_modal_view_no_timeline')}</p>
                        ) : (
                            patientVisits.map(apt => (
                                <div key={apt.id} className="flex gap-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex flex-col items-center min-w-[60px]">
                                        <span className="text-xs font-bold text-slate-500">{new Date(apt.datetime).toLocaleDateString()}</span>
                                        <span className="text-[10px] text-slate-400 uppercase font-bold">{new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-slate-800 dark:text-white">{translateType(apt.type, t)}</div>
                                        <div className="text-xs text-slate-500">{formatStaffName(apt.staffName)}</div>
                                        <Badge color={getStatusColor(apt.status) as any} className="mt-1">
                                            {t(`appointments_status_${apt.status}`) || apt.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {viewTab === 'labs' && (
                    <div className="space-y-3 animate-in fade-in">
                        {patientLabs.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">{t('lab_empty', {tab: t('patients_modal_action_lab')})}</p>
                        ) : (
                            patientLabs.map(lab => {
                                const isExpanded = expandedLabId === lab.id;
                                return (
                                    <div key={lab.id} className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800 overflow-hidden">
                                        <div className="flex gap-4 p-3 items-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setExpandedLabId(isExpanded ? null : lab.id)}>
                                            <div className="flex flex-col items-center min-w-[60px] justify-center">
                                                <FlaskConical size={20} className="text-orange-500 mb-1" />
                                                <span className="text-[10px] font-bold text-slate-500">{new Date(lab.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{lab.testNames || t('patients_modal_view_lab_request_label')}</div>
                                                <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">ID: {lab.id}</div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                                <Badge color={lab.status === 'completed' ? 'green' : 'yellow'} className="text-[10px]">{t(`lab_status_${lab.status.toLowerCase()}`) || lab.status}</Badge>
                                                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                                <div className="space-y-4">
                                                    <div>
                                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('billing_modal_create_items_label')}</h5>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">{lab.testNames || 'Multiple tests requested'}</div>
                                                    </div>
                                                    {lab.results && (
                                                        <div>
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('lab_modal_findings')}</h5>
                                                            <div className="text-sm text-slate-700 dark:text-slate-300 bg-emerald-50/30 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800 italic leading-relaxed whitespace-pre-wrap">
                                                                {JSON.stringify(lab.results)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {lab.notes && (
                                                        <div>
                                                            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('lab_modal_notes')}</h5>
                                                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed italic">
                                                                "{lab.notes}"
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="pt-2 flex justify-between items-center border-t border-slate-50 dark:border-slate-800">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase">{t('billing_table_header_amount')}</span>
                                                        <span className="font-mono font-bold text-primary-600">${formatMoney(lab.projected_cost)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {viewTab === 'financials' && (
                    <div className="space-y-3 animate-in fade-in">
                        {patientFinancials.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-8">{t('patients_modal_view_no_billing')}</p>
                        ) : (
                            patientFinancials.map(bill => (
                                <div key={bill.id} className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2 group-hover:text-primary-600 transition-colors">
                                                <DollarSign size={14} className="text-emerald-600" />
                                                {t('patients_modal_view_invoice_label')} #{bill.billNumber}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-bold mt-0.5">{formatDateSafely(bill.date)}</div>
                                        </div>
                                        <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : 'red'}>{translateStatus(bill.status, t)}</Badge>
                                    </div>
                                    <div className="flex justify-between text-sm border-t border-slate-100 dark:border-slate-800 pt-2 mt-2">
                                        <span className="text-slate-500 font-medium">{t('billing_table_header_amount')}</span>
                                        <span className="font-bold font-mono">${formatMoney(bill.totalAmount)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">{t('billing_table_paid_amount')}</span>
                                        <span className="font-bold font-mono text-emerald-600">${formatMoney(bill.paidAmount)}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

          </div>
        )}
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({...confirmState, isOpen: false})} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};

const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('active') || s.includes('regis')) return 'green';
  if (s.includes('pending') || s.includes('waiting') || s.includes('reserved') || s.includes('confirmed')) return 'yellow';
  if (s.includes('cancelled') || s.includes('refunded') || s.includes('overdue')) return 'red';
  return 'blue';
};

const translateStatus = (status: string, t: any) => {
    const s = status.toLowerCase();
    if (s === 'paid') return t('billing_status_paid');
    if (s === 'pending') return t('billing_status_pending');
    if (s === 'partial') return t('billing_status_partial');
    if (s === 'overdue') return t('billing_status_overdue');
    if (s === 'refunded') return t('billing_status_refunded');
    return status;
};
