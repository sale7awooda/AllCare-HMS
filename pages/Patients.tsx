
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Shield, AlertTriangle, Edit, Calendar, Lock, 
  FlaskConical, Bed, Activity, FileClock, Settings, Thermometer, Trash2, CheckCircle,
  Phone, User as UserIcon, History, DollarSign, Loader2, ArrowRight,
  ChevronLeft, ChevronRight, MapPin, XCircle, FileText, Stethoscope
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, User, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog, Bill } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Catalogs
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [loading, setLoading] = useState(true);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
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
  
  // Operation specific
  const [opDetails, setOpDetails] = useState({
    anesthesiologistId: '',
    assistantId: '',
    nurseId: '', 
    drugs: '', 
    equipment: '', 
    others: '',
    surgeonCost: 0,
    anesthesiologistCost: 0,
    assistantCost: 0,
    nurseCost: 0,
    drugsCost: 0,
    equipmentCost: 0,
    othersCost: 0,
    theaterCost: 0, 
  });

  const SUDAN_INSURANCE_PROVIDERS = [
    "Shiekan Insurance", "The United Insurance", "Blue Nile Insurance",
    "Al-Salama Insurance", "Juba Insurance", "Prime Health",
    "Wataniya Insurance", "General Insurance"
  ];

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

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    
    try {
        const user = await api.me();
        setCurrentUser(user);
    } catch (e) {
        console.error("Failed to fetch current user:", e);
    }

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
      const [l, n, b, o] = await Promise.all([
        api.getLabTests(), api.getNurseServices(), api.getBeds(), api.getOperations()
      ]);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setBeds(Array.isArray(b) ? b : []);
      setOperations(Array.isArray(o) ? o : []);
    } catch (e) {
      console.error("Failed to load catalogs:", e);
      setLabTests([]); setNurseServices([]); setBeds([]); setOperations([]);
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
      setIsFormModalOpen(true);
    } catch (err) {
      console.error("Failed to load patient details", err);
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
    setProcessMessage('Loading patient file...');
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
    setOpDetails({ 
      anesthesiologistId: '', assistantId: '', nurseId: '',
      drugs: '', equipment: '', others: '',
      surgeonCost: 0, anesthesiologistCost: 0, assistantCost: 0, nurseCost: 0, 
      drugsCost: 0, equipmentCost: 0, othersCost: 0, theaterCost: 0
    });
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

  const handleOperationSelect = (opName: string) => {
    const op = operations.find(o => o.name === opName);
    setActionFormData({
      ...actionFormData,
      subtype: opName,
    });
    if (op) {
      setOpDetails(prev => ({...prev, surgeonCost: op.baseCost}));
    }
  };

  useEffect(() => {
    if (currentAction === 'operation') {
      const total = 
        (opDetails.surgeonCost || 0) +
        (opDetails.anesthesiologistCost || 0) +
        (opDetails.assistantCost || 0) +
        (opDetails.nurseCost || 0) +
        (opDetails.drugsCost || 0) +
        (opDetails.equipmentCost || 0) +
        (opDetails.othersCost || 0) +
        (opDetails.theaterCost || 0);
      setActionFormData(prev => ({...prev, totalCost: total}));
    }
  }, [opDetails, currentAction]);

  useEffect(() => {
    if (currentAction === 'operation' && opDetails.theaterCost === 0 && opDetails.surgeonCost > 0) {
       setOpDetails(prev => ({...prev, theaterCost: (prev.surgeonCost || 0) * 1}));
    }
  }, [opDetails.surgeonCost, currentAction]);

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
    if (!doc.isAvailable) return false;
    if (!doc.schedule) return true; 
    try {
      const scheduleDays = JSON.parse(doc.schedule); 
      const today = new Date();
      const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }); 
      return scheduleDays.includes(dayName);
    } catch (e) {
      return true; 
    }
  };

  const APPOINTMENT_TYPES = [
    { id: 'Consultation', label: 'Consultation', icon: UserIcon },
    { id: 'Follow-up', label: 'Follow Up', icon: History },
    { id: 'Emergency', label: 'Emergency', icon: AlertTriangle },
  ];

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    setProcessStatus('processing');
    setProcessMessage('Submitting request...');
    
    try {
      let staffAssignedId: number | undefined = actionFormData.staffId ? parseInt(actionFormData.staffId) : undefined;
      let successMessage = 'Request submitted successfully.';

      await new Promise(resolve => setTimeout(resolve, 800));

      if (currentAction === 'lab') {
        if (selectedTests.length === 0) throw new Error('Select at least one test');
        await api.createLabRequest({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          testIds: selectedTests.map(t => t.id),
          totalCost: selectedTests.reduce((a,b)=>a+b.cost, 0)
        });
        successMessage = 'Lab Request created. Confirm in Laboratory to bill.';

      } else if (currentAction === 'nurse') {
        if (!selectedService) throw new Error('Select a service.');
        if (!staffAssignedId) throw new Error('Select a nurse.');
        await api.createNurseRequest({
          patientId: selectedPatient.id,
          serviceName: selectedService.name,
          cost: selectedService.cost,
          notes: actionFormData.notes,
          staffId: staffAssignedId
        });
        successMessage = 'Nurse Service recorded.';

      } else if (currentAction === 'admission') {
        if (!selectedBed) throw new Error('Select a bed.');
        if (!staffAssignedId) throw new Error('Select a treating doctor.');
        
        await api.createAdmission({
          patientId: selectedPatient.id,
          bedId: selectedBed.id,
          doctorId: staffAssignedId,
          entryDate: actionFormData.date,
          dischargeDate: actionFormData.dischargeDate,
          deposit: actionFormData.deposit, 
          notes: actionFormData.notes 
        });
        successMessage = 'Bed Reserved. Payment required to confirm admission.';

      } else if (currentAction === 'operation') {
        if (!actionFormData.subtype) throw new Error('Select an operation.');
        if (!staffAssignedId) throw new Error('Select a surgeon.');
        
        // Basic Breakdown
        const breakdown = {
          ...opDetails,
          breakdownString: `Surgeon: ${opDetails.surgeonCost}, Theater: ${opDetails.theaterCost}`
        };

        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffAssignedId, 
          notes: actionFormData.notes,
          optionalFields: breakdown,
          totalCost: actionFormData.totalCost
        });
        successMessage = 'Operation Scheduled. Confirm in Operations to bill.';

      } else if (currentAction === 'appointment') {
        if (!staffAssignedId) throw new Error('Select a doctor.');
        const doc = staff.find(s => s.id === staffAssignedId);
        if (!doc) throw new Error('Selected doctor not found.');

        await api.createAppointment({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          staffId: doc.id,
          staffName: doc.fullName,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: actionFormData.subtype || 'Consultation',
          reason: actionFormData.notes,
          status: 'pending' 
        });
        successMessage = 'Appointment Scheduled. Confirm in Appointments.';
      }

      setProcessStatus('success');
      setProcessMessage(successMessage);
      
      await loadData(true);

      setTimeout(() => {
        setIsActionModalOpen(false);
        setProcessStatus('idle');
        setProcessMessage('');
      }, 2000); 

    } catch (err: any) {
      console.error(err);
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || err.message || 'Failed to submit request.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payload = {
      fullName: formData.fullName,
      age: formData.age,
      phone: formData.phone,
      gender: formData.gender,
      type: formData.type,
      address: formData.address,
      symptoms: formData.symptoms,
      medicalHistory: formData.medicalHistory,
      allergies: formData.allergies,
      bloodGroup: formData.bloodGroup,
      hasInsurance: formData.hasInsurance,
      emergencyContact: formData.emergencyName ? {
        name: formData.emergencyName, phone: formData.emergencyPhone, relation: formData.emergencyRelation
      } : undefined,
      insuranceDetails: formData.hasInsurance ? {
        provider: formData.insProvider, policyNumber: formData.insPolicy, expiryDate: formData.insExpiry, notes: formData.insNotes
      } : undefined
    };

    setProcessStatus('processing');
    setProcessMessage(isEditing ? 'Updating patient record...' : 'Registering new patient...');

    try {
      await new Promise(resolve => setTimeout(resolve, 600));

      if (isEditing && selectedPatient) {
        await api.updatePatient(selectedPatient.id, payload as any);
      } else {
        await api.addPatient(payload as any);
      }
      
      setProcessStatus('success');
      setProcessMessage(isEditing ? 'Patient details updated successfully.' : 'Patient registered successfully.');
      
      await loadData(true); 

      setTimeout(() => {
        setIsFormModalOpen(false);
        setProcessStatus('idle');
        setProcessMessage('');
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || 'Failed to save patient data.');
    }
  };

  // FILTER & PAGINATION LOGIC
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
      const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            p.phone.includes(searchTerm);
      const matchesType = filterType === 'all' || p.type === filterType;
      const matchesGender = filterGender === 'all' || p.gender === filterGender;
      return matchesSearch && matchesType && matchesGender;
    });
  }, [patients, searchTerm, filterType, filterGender]);

  const totalPages = Math.ceil(filteredPatients.length / itemsPerPage);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const canManagePatients = hasPermission(currentUser, Permissions.MANAGE_PATIENTS);
  
  const getActionModalTitle = () => {
    switch (currentAction) {
      case 'appointment': return 'Schedule Appointment';
      case 'lab': return 'Order Lab Test';
      case 'nurse': return 'Request Nurse Service';
      case 'admission': return 'Admit Patient';
      case 'operation': return 'Schedule Operation';
      default: return 'Medical Action';
    }
  };

  const getPatientHistory = () => {
    if (!selectedPatient) return { historyApps: [], historyBills: [] };
    const historyApps = appointments.filter(a => a.patientId === selectedPatient.id).sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    const historyBills = bills.filter(b => b.patientId === selectedPatient.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { historyApps, historyBills };
  };

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  const getAvatarColor = (name: string) => {
    const colors = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Patient Registry</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage patient records, admissions, and medical history.</p>
        </div>
        {canManagePatients ? <Button onClick={openCreateModal} icon={Plus}>Register Patient</Button> : <Button disabled variant="secondary" icon={Lock}>Register Patient</Button>}
      </div>

      <Card className="!p-0 overflow-visible z-10 border-0 shadow-lg">
        {/* Toolbar */}
        <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-t-2xl flex flex-col sm:flex-row gap-4 justify-between items-center">
           <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search by name, ID or phone..." 
                className="pl-9 pr-4 w-full rounded-xl border-gray-200 dark:border-slate-700 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all dark:bg-slate-800 dark:text-white"
                value={searchTerm} 
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
              />
           </div>
           
           <div className="flex gap-2 w-full sm:w-auto">
             <div className="relative">
                <select 
                  className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  value={filterType}
                  onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">All Types</option>
                  <option value="outpatient">Outpatient</option>
                  <option value="inpatient">Inpatient</option>
                  <option value="emergency">Emergency</option>
                </select>
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
             </div>
             
             <div className="relative hidden sm:block">
                <select 
                   className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                   value={filterGender}
                   onChange={e => { setFilterGender(e.target.value); setCurrentPage(1); }}
                >
                  <option value="all">Any Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
             </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Demographics</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-100 dark:divide-slate-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-10 w-32 bg-slate-100 dark:bg-slate-800 rounded-full"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-full"></div></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded"></div></td>
                    <td className="px-6 py-4"></td>
                  </tr>
                ))
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <UserIcon size={48} strokeWidth={1} className="text-slate-200 dark:text-slate-700"/>
                      <p>No patients found matching your criteria.</p>
                      <Button variant="outline" size="sm" onClick={() => {setSearchTerm(''); setFilterType('all');}}>Clear Filters</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center cursor-pointer" onClick={() => openViewModal(patient)}>
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${getAvatarColor(patient.fullName)}`}>
                          {getInitials(patient.fullName)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">{patient.fullName}</div>
                          <div className="text-xs text-gray-500 font-mono">{patient.patientId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-900 dark:text-gray-300 flex items-center gap-2"><Phone size={14} className="text-gray-400"/> {patient.phone}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-500 truncate max-w-[150px] flex items-center gap-2 mt-1"><MapPin size={14} className="text-gray-400"/> {patient.address}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <Badge color={patient.type === 'emergency' ? 'red' : patient.type === 'inpatient' ? 'orange' : 'green'}>
                         {patient.type === 'inpatient' && <Bed size={12} className="mr-1 inline-block" />}
                         {patient.type}
                       </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {patient.age} yrs <span className="text-gray-300 mx-2">|</span> <span className="capitalize">{patient.gender}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end items-center gap-2">
                        <Button 
                           size="sm"
                           variant="secondary"
                           onClick={() => openActionMenu(patient)}
                           className="!bg-primary-50 !text-primary-700 hover:!bg-primary-100 border-primary-100 dark:!bg-primary-900/30 dark:!text-primary-400 dark:border-primary-800"
                           icon={Settings}
                        >
                           Manage
                        </Button>
                        {canManagePatients && (
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(patient)}
                            className="text-slate-500"
                            icon={Edit}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && filteredPatients.length > 0 && (
           <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 rounded-b-2xl">
             <span className="text-sm text-gray-500 dark:text-gray-400">
                Showing <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredPatients.length)}</span> of <span className="font-medium text-gray-900 dark:text-white">{filteredPatients.length}</span> results
             </span>
             <div className="flex gap-2">
               <button 
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage === 1}
                 className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
               >
                 <ChevronLeft size={16} />
               </button>
               <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages}
                 className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
               >
                 <ChevronRight size={16} />
               </button>
             </div>
           </div>
        )}
      </Card>

      {/* PROCESS STATUS OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95 border dark:border-slate-700">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Processing</h3>
                <p className="text-slate-500 dark:text-slate-400">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Success!</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Action Failed</h3>
                <p className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">Close & Fix</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Register/Edit Modal */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? "Edit Patient" : "Register Patient"}>
         <form onSubmit={handleRegisterSubmit} className="space-y-6">
           <div className="space-y-4">
             <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 mb-2 flex items-center gap-2">
               <UserIcon size={16} /> Personal Information
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <Input label="Full Name" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
               <Input label="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
             </div>
             <div className="grid grid-cols-3 gap-4">
                <Input label="Age" type="number" required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
                <Select label="Gender" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}><option value="male">Male</option><option value="female">Female</option></Select>
                <Select label="Type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}><option value="outpatient">Outpatient</option><option value="inpatient">Inpatient</option><option value="emergency">Emergency</option></Select>
             </div>
             <Input label="Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
           </div>

           <div className="space-y-4">
             <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 mb-2 flex items-center gap-2">
               <Stethoscope size={16} /> Medical Profile
             </h4>
             <div className="grid grid-cols-2 gap-4">
               <Select label="Blood Group" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                  <option value="">Unknown</option>
                  <option value="A+">A+</option><option value="A-">A-</option>
                  <option value="B+">B+</option><option value="B-">B-</option>
                  <option value="AB+">AB+</option><option value="AB-">AB-</option>
                  <option value="O+">O+</option><option value="O-">O-</option>
               </Select>
               <Input label="Allergies" placeholder="e.g. Penicillin, Peanuts" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
             </div>
             <Textarea label="Current Symptoms" rows={2} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
             <Textarea label="Medical History" placeholder="Chronic conditions, past surgeries..." rows={2} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
           </div>

           <div className="space-y-4">
             <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 mb-2 flex items-center gap-2">
               <Phone size={16} /> Emergency Contact
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <Input label="Contact Name" value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
               <Input label="Phone" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
               <Input label="Relation" placeholder="e.g. Father" value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
             </div>
           </div>

           <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} /> Insurance Details
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Has Insurance?</span>
                  <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500" checked={formData.hasInsurance} onChange={e => setFormData({...formData, hasInsurance: e.target.checked})} />
                </label>
             </div>
             
             {formData.hasInsurance && (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                 <Select label="Insurance Provider" value={formData.insProvider} onChange={e => setFormData({...formData, insProvider: e.target.value})}>
                    <option value="">Select Provider...</option>
                    {SUDAN_INSURANCE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                 </Select>
                 <Input label="Policy Number" value={formData.insPolicy} onChange={e => setFormData({...formData, insPolicy: e.target.value})} />
                 <Input label="Expiry Date" type="date" value={formData.insExpiry} onChange={e => setFormData({...formData, insExpiry: e.target.value})} />
                 <Input label="Notes / Coverage" value={formData.insNotes} onChange={e => setFormData({...formData, insNotes: e.target.value})} />
               </div>
             )}
           </div>

           <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
             <Button type="submit">Save Patient Record</Button>
           </div>
         </form>
      </Modal>

      {/* Action Menu Modal */}
      <Modal isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} title={`Actions for ${selectedPatient?.fullName}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'appointment', icon: Calendar, label: 'Appointment', color: 'blue' },
            { id: 'lab', icon: FlaskConical, label: 'Lab Test', color: 'purple' },
            { id: 'nurse', icon: Thermometer, label: 'Nurse Service', color: 'emerald' },
            { id: 'admission', icon: Bed, label: 'Admission', color: 'orange' }, 
            { id: 'operation', icon: Activity, label: 'Operation', color: 'red' },
            { id: 'history', icon: FileText, label: 'Patient File', color: 'gray' },
          ].map((action: any) => {
            const isAdmissionDisabled = action.id === 'admission' && selectedPatient?.type === 'inpatient';
            return (
              <button 
                key={action.id} 
                onClick={() => !isAdmissionDisabled && handleActionSelect(action.id)}
                disabled={isAdmissionDisabled}
                className={`
                  flex flex-col items-center justify-center p-6 rounded-2xl transition-all border shadow-sm hover:shadow-md
                  ${isAdmissionDisabled 
                    ? 'bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600 cursor-not-allowed' 
                    : `bg-white dark:bg-slate-800 hover:bg-${action.color}-50 dark:hover:bg-${action.color}-900/20 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-${action.color}-200 dark:hover:border-${action.color}-800`
                  }
                `}
              >
                <div className={`p-3 rounded-full bg-${action.color}-50 dark:bg-${action.color}-900/30 text-${action.color}-600 dark:text-${action.color}-400 mb-3`}>
                  <action.icon size={28} />
                </div>
                <span className="font-bold text-sm">
                  {isAdmissionDisabled ? 'Already Admitted' : action.label}
                </span>
              </button>
            )
          })}
        </div>
      </Modal>

      {/* Specific Action Modal */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={getActionModalTitle()}>
        <form onSubmit={submitAction} className="space-y-4">
           {currentAction === 'appointment' && (
            <>
               <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 p-4 rounded-xl flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-primary-600">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary-500 mb-0.5">Booking Date</h4>
                    <p className="text-lg font-bold text-slate-800 dark:text-white capitalize">
                      {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} (Today)
                    </p>
                  </div>
               </div>
               
               <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Department / Specialty</label>
               <select 
                className="block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm py-2.5 px-4 border mb-2"
                value={selectedSpecialty}
                onChange={e => { setSelectedSpecialty(e.target.value); setActionFormData({...actionFormData, staffId: '', subtype: ''}); }}
               >
                 <option value="">Select Specialty...</option>
                 {Array.from(new Set(staff.filter(s => s.type === 'doctor').map(s => s.specialization))).map(spec => (
                   <option key={spec} value={spec}>{spec}</option>
                 ))}
               </select>

               {selectedSpecialty && (
                 <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Doctor</label>
                   <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar">
                     {staff.filter(s => s.type === 'doctor' && s.specialization === selectedSpecialty).map(doc => {
                       const isAvail = checkAvailability(doc); 
                       return (
                         <div 
                           key={doc.id} 
                           onClick={() => isAvail && setActionFormData({...actionFormData, staffId: doc.id.toString(), subtype: ''})}
                           className={`
                             min-w-[160px] p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between
                             ${actionFormData.staffId === doc.id.toString() ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-200 dark:ring-primary-800' : ''}
                             ${!isAvail ? 'opacity-60 bg-gray-50 dark:bg-slate-800 cursor-not-allowed grayscale' : 'hover:border-primary-300 bg-white dark:bg-slate-900 dark:border-slate-700'}
                           `}
                         >
                            <div>
                              <div className="font-bold text-sm text-gray-900 dark:text-white truncate" title={doc.fullName}>{doc.fullName}</div>
                              <div className="text-xs text-gray-500 mb-2">{doc.specialization}</div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-slate-700">
                               <div className={`text-xs font-bold flex items-center gap-1 ${isAvail ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                                 <div className={`w-2 h-2 rounded-full ${isAvail ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                 {isAvail ? 'Available' : 'Unavailable'}
                                </div>
                            </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}

               {actionFormData.staffId && (
                 <div className="space-y-2">
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Appointment Type</label>
                   <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar">
                      {APPOINTMENT_TYPES.map(type => {
                        const doctor = staff.find(s => s.id === parseInt(actionFormData.staffId));
                        
                        let fee = 0;
                        if (doctor) {
                          if (type.id === 'Consultation') fee = doctor.consultationFee;
                          if (type.id === 'Follow-up') fee = doctor.consultationFeeFollowup || 0;
                          if (type.id === 'Emergency') fee = doctor.consultationFeeEmergency || 0;
                        }

                        const isSelected = actionFormData.subtype === type.id;
                        
                        return (
                          <div 
                            key={type.id}
                            onClick={() => setActionFormData({...actionFormData, subtype: type.id, totalCost: fee})}
                            className={`
                              flex-shrink-0 min-w-[140px] p-3 rounded-xl border cursor-pointer transition-all
                              ${isSelected 
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-200 dark:ring-primary-800 shadow-md' 
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                            `}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${isSelected ? 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                              <type.icon size={16} />
                            </div>
                            <div className="font-bold text-sm text-slate-900 dark:text-white">{type.label}</div>
                            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">${fee}</div>
                          </div>
                        );
                      })}
                   </div>
                 </div>
               )}

               <Textarea label="Reason" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {currentAction === 'lab' && (
            <>
               <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Search & Add Tests</label>
                  <input type="text" className="w-full rounded-xl border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white py-2 px-3 text-sm" placeholder="Type test name..." value={testSearch} onChange={e => setTestSearch(e.target.value)} />
                  {testSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 border border-slate-200 dark:border-slate-700 rounded-lg max-h-48 overflow-y-auto bg-white dark:bg-slate-800 shadow-xl z-50">
                      {labTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).map(t => (
                        <button key={t.id} type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex justify-between border-b border-gray-50 dark:border-slate-700 last:border-0 dark:text-white" onClick={() => { if(!selectedTests.find(x => x.id===t.id)) setSelectedTests([...selectedTests, t]); setTestSearch(''); }}>
                          <span>{t.name}</span><span className="font-mono text-xs font-bold text-gray-600 dark:text-gray-400">${t.cost}</span>
                        </button>
                      ))}
                    </div>
                  )}
               </div>
               <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mt-4">
                 <table className="w-full text-sm">
                   <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                     <tr><th className="px-3 py-2 text-left">Test</th><th className="px-3 py-2 text-right">Cost</th><th></th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                   {selectedTests.length === 0 ? (
                     <tr><td colSpan={3} className="text-center py-4 text-gray-400 italic">No tests selected</td></tr>
                   ) : (
                    selectedTests.map((t, i) => (
                      <tr key={i} className="dark:text-white"><td className="px-3 py-2">{t.name}</td><td className="px-3 py-2 text-right">${t.cost}</td><td className="text-center"><button type="button" onClick={() => setSelectedTests(selectedTests.filter(x => x.id !== t.id))} className="text-red-500"><Trash2 size={14}/></button></td></tr>
                    ))
                   )}
                   <tr className="bg-slate-50 dark:bg-slate-800 font-bold border-t dark:border-slate-700 dark:text-white"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">${selectedTests.reduce((a,b)=>a+b.cost,0)}</td><td></td></tr>
                 </tbody></table>
               </div>
            </>
          )}

          {currentAction === 'nurse' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Service</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {nurseServices.map(svc => (
                    <div key={svc.id} onClick={() => setSelectedService(svc)} className={`p-3 rounded-xl border cursor-pointer ${selectedService?.id === svc.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-2 ring-primary-200 dark:ring-primary-800' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-white'}`}>
                      <div className="flex justify-between"><h4 className="font-bold text-sm">{svc.name}</h4><span className="text-xs font-bold bg-white dark:bg-slate-700 border dark:border-slate-600 px-1 rounded">${svc.cost}</span></div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{svc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Select label="Assign Nurse" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                 <option value="">Select Nurse...</option>
                 {staff.filter(s => s.type === 'nurse').map(n => <option key={n.id} value={n.id}>{n.fullName}</option>)}
              </Select>
              <Textarea label="Notes" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </div>
          )}

          {currentAction === 'admission' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Room / Bed</label>
                   <select 
                    className="block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm py-2.5 px-4 border"
                    value={selectedBed?.id || ''}
                    onChange={e => {
                      const bed = beds.find(b => b.id === parseInt(e.target.value));
                      setSelectedBed(bed || null);
                    }}
                   >
                     <option value="">Choose Bed...</option>
                     {beds.filter(b => b.status === 'available').map(b => (
                       <option key={b.id} value={b.id}>{b.roomNumber} ({b.type}) - ${b.costPerDay}/day</option>
                     ))}
                   </select>
                </div>
                <Select label="Treating Doctor" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                   <option value="">Select Doctor...</option>
                   {staff.filter(s => s.type === 'doctor').map(d => <option key={d.id} value={d.id}>{d.fullName} - {d.specialization}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <Input label="Admission Date" type="date" required value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                 <Input label="Discharge (Est.)" type="date" value={actionFormData.dischargeDate} onChange={e => setActionFormData({...actionFormData, dischargeDate: e.target.value})} />
              </div>
              
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-100 dark:border-orange-900/50">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-orange-800 dark:text-orange-300 font-bold text-sm">Required Deposit</h4>
                  <Badge color="orange">Unpaid</Badge>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-xl font-bold text-slate-800 dark:text-white">$</span>
                   <input 
                    type="number" 
                    className="bg-transparent text-xl font-bold text-slate-800 dark:text-white w-full focus:outline-none border-b border-orange-200 focus:border-orange-500"
                    value={actionFormData.deposit}
                    onChange={e => setActionFormData({...actionFormData, deposit: parseFloat(e.target.value)})}
                   />
                </div>
                <p className="text-xs text-orange-600/70 mt-1">Minimum calculated based on estimated stay.</p>
              </div>
            </div>
          )}

          {currentAction === 'operation' && (
             <div className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <Select label="Operation Type" required value={actionFormData.subtype} onChange={e => handleOperationSelect(e.target.value)}>
                    <option value="">Select Procedure...</option>
                    {operations.map(op => <option key={op.id} value={op.name}>{op.name} (Base: ${op.baseCost})</option>)}
                 </Select>
                 <Select label="Lead Surgeon" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                    <option value="">Select Surgeon...</option>
                    {staff.filter(s => s.type === 'doctor').map(d => <option key={d.id} value={d.id}>{d.fullName}</option>)}
                 </Select>
               </div>

               <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                 <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Surgical Team</h4>
                 <div className="grid grid-cols-3 gap-3">
                   <Select value={opDetails.anesthesiologistId} onChange={e => setOpDetails({...opDetails, anesthesiologistId: e.target.value, anesthesiologistCost: 200})}>
                      <option value="">Anesthesiologist</option>
                      {staff.filter(s => s.type === 'anesthesiologist').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                   </Select>
                   <Select value={opDetails.assistantId} onChange={e => setOpDetails({...opDetails, assistantId: e.target.value, assistantCost: 100})}>
                      <option value="">Assistant</option>
                      {staff.filter(s => ['doctor', 'medical_assistant'].includes(s.type)).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                   </Select>
                   <Select value={opDetails.nurseId} onChange={e => setOpDetails({...opDetails, nurseId: e.target.value, nurseCost: 50})}>
                      <option value="">Scrub Nurse</option>
                      {staff.filter(s => s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                   </Select>
                 </div>
               </div>

               <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 p-3 rounded-xl">
                 <span className="font-bold text-slate-700 dark:text-slate-300">Total Estimated Cost</span>
                 <span className="text-xl font-bold text-primary-600">${actionFormData.totalCost}</span>
               </div>
             </div>
          )}

          <div className="flex justify-end pt-4 gap-3 border-t border-slate-100 dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={processStatus === 'processing'}>Confirm Request</Button>
          </div>
        </form>
      </Modal>
      
      {/* View Patient Modal (Patient 360) */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Patient 360° View">
        {selectedPatient && (
          <div className="space-y-6">
             {/* Header Card */}
             <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold shadow-sm border-2 border-white dark:border-slate-700 ${getAvatarColor(selectedPatient.fullName)}`}>
                   {getInitials(selectedPatient.fullName)}
                </div>
                <div className="flex-1">
                   <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedPatient.fullName}</h2>
                   <div className="flex flex-wrap gap-2 mt-2">
                      <Badge color="blue">{selectedPatient.patientId}</Badge>
                      <Badge color={selectedPatient.gender === 'male' ? 'blue' : 'pink'}>{selectedPatient.gender}</Badge>
                      <Badge color="gray">{selectedPatient.age} Years</Badge>
                      <Badge color={selectedPatient.type === 'inpatient' ? 'orange' : 'green'}>{selectedPatient.type}</Badge>
                   </div>
                </div>
             </div>

             {/* Tabs */}
             <div className="flex border-b border-gray-200 dark:border-slate-700">
                <button onClick={() => setViewTab('info')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === 'info' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Overview</button>
                <button onClick={() => setViewTab('timeline')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === 'timeline' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Timeline</button>
                <button onClick={() => setViewTab('billing')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${viewTab === 'billing' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Financials</button>
             </div>

             {/* Content */}
             <div className="min-h-[300px]">
                {viewTab === 'info' && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                      <div className="space-y-4">
                         <h3 className="font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-slate-700">Contact & Personal</h3>
                         <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Phone</span> <span className="font-medium dark:text-gray-300">{selectedPatient.phone}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Address</span> <span className="font-medium dark:text-gray-300 text-right">{selectedPatient.address}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Emergency</span> <span className="font-medium dark:text-gray-300">{selectedPatient.emergencyContact?.name || 'N/A'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Contact</span> <span className="font-medium dark:text-gray-300">{selectedPatient.emergencyContact?.phone || 'N/A'}</span></div>
                         </div>
                      </div>
                      <div className="space-y-4">
                         <h3 className="font-bold text-gray-900 dark:text-white border-b pb-2 dark:border-slate-700">Medical Profile</h3>
                         <div className="space-y-3 text-sm">
                            <div className="flex justify-between"><span className="text-gray-500">Blood Group</span> <span className="font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 rounded">{selectedPatient.bloodGroup || 'Unknown'}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Allergies</span> <span className="font-medium text-right text-red-500">{selectedPatient.allergies || 'None'}</span></div>
                            <div className="col-span-2">
                               <span className="text-gray-500 block mb-1">Medical History</span>
                               <p className="bg-gray-50 dark:bg-slate-800 p-2 rounded text-gray-700 dark:text-gray-300">{selectedPatient.medicalHistory || 'No history recorded.'}</p>
                            </div>
                         </div>
                      </div>
                      {selectedPatient.hasInsurance && (
                         <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2"><Shield size={16}/> Insurance Coverage</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                               <div><span className="text-blue-600/70 block text-xs">Provider</span> <span className="font-bold text-blue-900 dark:text-blue-200">{selectedPatient.insuranceDetails?.provider}</span></div>
                               <div><span className="text-blue-600/70 block text-xs">Policy No</span> <span className="font-mono text-blue-900 dark:text-blue-200">{selectedPatient.insuranceDetails?.policyNumber}</span></div>
                            </div>
                         </div>
                      )}
                   </div>
                )}

                {viewTab === 'timeline' && (
                   <div className="space-y-4 animate-in fade-in">
                      {getPatientHistory().historyApps.length === 0 ? (
                         <div className="text-center py-8 text-gray-500">No appointment history.</div>
                      ) : (
                         getPatientHistory().historyApps.map((apt: any) => (
                            <div key={apt.id} className="flex gap-4 relative">
                               <div className="flex flex-col items-center">
                                  <div className="w-2 h-2 rounded-full bg-primary-500 z-10"></div>
                                  <div className="w-0.5 bg-gray-200 dark:bg-slate-700 h-full -mt-1"></div>
                               </div>
                               <div className="pb-6">
                                  <p className="text-xs text-gray-400 font-mono mb-1">{new Date(apt.datetime).toLocaleString()}</p>
                                  <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm w-full min-w-[300px]">
                                     <div className="flex justify-between items-start">
                                        <div>
                                           <p className="font-bold text-gray-800 dark:text-white">{apt.type}</p>
                                           <p className="text-sm text-gray-500">Dr. {apt.staffName}</p>
                                        </div>
                                        <Badge color={apt.status === 'completed' ? 'green' : 'gray'}>{apt.status}</Badge>
                                     </div>
                                     {apt.reason && <p className="text-xs text-gray-400 mt-2 bg-gray-50 dark:bg-slate-900 p-1.5 rounded">"{apt.reason}"</p>}
                                  </div>
                               </div>
                            </div>
                         ))
                      )}
                   </div>
                )}

                {viewTab === 'billing' && (
                   <div className="space-y-4 animate-in fade-in">
                      {getPatientHistory().historyBills.length === 0 ? (
                         <div className="text-center py-8 text-gray-500">No billing history.</div>
                      ) : (
                         <div className="overflow-hidden border border-gray-200 dark:border-slate-700 rounded-xl">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                               <thead className="bg-gray-50 dark:bg-slate-800">
                                  <tr>
                                     <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                     <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                     <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                                     <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                                  </tr>
                               </thead>
                               <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-800 text-sm">
                                  {getPatientHistory().historyBills.map((bill: any) => (
                                     <tr key={bill.id}>
                                        <td className="px-4 py-2 text-gray-500">{new Date(bill.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-2">
                                           <div className="truncate max-w-[150px]">{bill.items?.[0]?.description || 'Medical Services'}</div>
                                           {bill.items?.length > 1 && <span className="text-xs text-gray-400">+{bill.items.length - 1} more</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white">${bill.totalAmount}</td>
                                        <td className="px-4 py-2 text-center">
                                           <Badge color={bill.status === 'paid' ? 'green' : 'red'}>{bill.status}</Badge>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                         </div>
                      )}
                   </div>
                )}
             </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
