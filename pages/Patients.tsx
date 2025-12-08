
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Heart, Shield, AlertTriangle, Edit, Calendar, Lock, 
  Stethoscope, FlaskConical, Bed, Activity, FileClock, Settings, Thermometer, Trash2, CheckCircle,
  Phone, User as UserIcon, History
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, User, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog, Bill } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Catalogs
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [beds, setBeds] = useState<BedType[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);

  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewTab, setViewTab] = useState<'info' | 'history'>('info');
  const [isEditing, setIsEditing] = useState(false);

  // Action Logic
  const [currentAction, setCurrentAction] = useState<'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | null>(null);
  const [actionFormData, setActionFormData] = useState({
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    notes: '',
    subtype: '',
    dischargeDate: '',
    totalCost: 0
  });

  // Specific States for Complex Forms
  const [selectedTests, setSelectedTests] = useState<LabTestCatalog[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedService, setSelectedService] = useState<NurseServiceCatalog | null>(null);
  const [selectedBed, setSelectedBed] = useState<BedType | null>(null);
  
  // Operation specific
  const [opDetails, setOpDetails] = useState({
    assistantId: '', 
    anesthesiologistId: '', 
    nurseId: '', 
    drugs: '', 
    equipment: '', 
    others: '',
    // Costs
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [pts, apts, b, stf, user] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(),
        api.getBills(),
        api.getStaff(),
        api.me()
      ]);
      setPatients(Array.isArray(pts) ? pts : []);
      setAppointments(Array.isArray(apts) ? apts : []);
      setBills(Array.isArray(b) ? b : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to load core data:", error);
    }
    setLoading(false);
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

  // --- Handlers ---
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

  const handleActionSelect = (action: 'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | 'history') => {
    setIsActionMenuOpen(false);
    if (action === 'history') {
      openViewModal(selectedPatient!);
      return;
    }
    setSelectedTests([]);
    setTestSearch('');
    setSelectedService(null);
    setSelectedBed(null);
    setOpDetails({ 
      assistantId: '', anesthesiologistId: '', nurseId: '', drugs: '', equipment: '', others: '',
      surgeonCost: 0, anesthesiologistCost: 0, assistantCost: 0, nurseCost: 0, drugsCost: 0, equipmentCost: 0, othersCost: 0, theaterCost: 0
    });
    
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      notes: '',
      subtype: '', // Reset subtype
      dischargeDate: '',
      totalCost: 0
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

  // Effect to calculate Operation Total Cost
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

  // Effect to set Theater Cost (1x Surgeon as requested)
  useEffect(() => {
    if (currentAction === 'operation') {
       setOpDetails(prev => ({...prev, theaterCost: (prev.surgeonCost || 0) * 1}));
    }
  }, [opDetails.surgeonCost, currentAction]);

  // Effect to calculate Appointment Cost
  useEffect(() => {
    if (currentAction === 'appointment' && actionFormData.staffId && actionFormData.subtype) {
       const doc = staff.find(s => s.id === parseInt(actionFormData.staffId));
       if (doc) {
         let cost = doc.consultationFee;
         if (actionFormData.subtype === 'Follow-up') cost = cost * 0.5;
         if (actionFormData.subtype === 'Emergency') cost = cost * 1.5;
         setActionFormData(prev => ({...prev, totalCost: cost}));
       }
    }
  }, [actionFormData.staffId, actionFormData.subtype, currentAction, staff]);

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    try {
      let staffAssignedId: number | undefined = actionFormData.staffId ? parseInt(actionFormData.staffId) : undefined;

      if (currentAction === 'lab') {
        if (selectedTests.length === 0) return alert('Select at least one test');
        await api.createLabRequest({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          testIds: selectedTests.map(t => t.id),
          totalCost: selectedTests.reduce((a,b)=>a+b.cost, 0)
        });

      } else if (currentAction === 'nurse') {
        if (!selectedService) return alert('Select a service.');
        if (!staffAssignedId) return alert('Select a nurse.');
        await api.createNurseRequest({
          patientId: selectedPatient.id,
          serviceName: selectedService.name,
          cost: selectedService.cost,
          notes: actionFormData.notes,
          staffId: staffAssignedId
        });

      } else if (currentAction === 'admission') {
        if (!selectedBed) return alert('Select a bed.');
        if (!staffAssignedId) return alert('Select a treating doctor.');
        await api.createAdmission({
          patientId: selectedPatient.id,
          bedId: selectedBed.id,
          doctorId: staffAssignedId,
          entryDate: actionFormData.date,
          dischargeDate: actionFormData.dischargeDate,
          deposit: selectedBed.costPerDay,
          notes: actionFormData.notes 
        });

      } else if (currentAction === 'operation') {
        if (!actionFormData.subtype) return alert('Enter operation name.');
        if (!staffAssignedId) return alert('Select a surgeon.');
        
        const breakdown = {
          ...opDetails,
          breakdownString: `Surgeon: ${opDetails.surgeonCost}, Anest: ${opDetails.anesthesiologistCost}, Asst: ${opDetails.assistantCost}, Nurse: ${opDetails.nurseCost}, Drugs: ${opDetails.drugsCost}, Equip: ${opDetails.equipmentCost}, Theater: ${opDetails.theaterCost}, Other: ${opDetails.othersCost}`
        };

        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffAssignedId, 
          notes: actionFormData.notes,
          optionalFields: breakdown,
          totalCost: actionFormData.totalCost
        });

      } else if (currentAction === 'appointment') {
        if (!staffAssignedId) return alert('Select a doctor.');
        const doc = staff.find(s => s.id === staffAssignedId);
        if (!doc) return alert('Selected doctor not found.');

        await api.createAppointment({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          staffId: doc.id,
          staffName: doc.fullName,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: actionFormData.subtype || 'Consultation',
          reason: actionFormData.notes,
          status: 'pending' // Creates request, confirm in Appointments to bill
        });
      }

      setIsActionModalOpen(false);
      loadData();
      alert('Request submitted successfully. Please confirm in the related module to generate billing.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to submit request.');
    }
  };

  const openViewModal = async (patient: Patient) => {
    try {
      const fullDetails = await api.getPatient(patient.id);
      setSelectedPatient(fullDetails);
      setViewTab('info');
      setIsViewModalOpen(true);
    } catch (e) { console.error(e); }
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

    try {
      if (isEditing && selectedPatient) {
        await api.updatePatient(selectedPatient.id, payload as any);
      } else {
        await api.addPatient(payload as any);
      }
      setIsFormModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Failed to save patient data.');
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && (filterType === 'all' || p.type === filterType) && (filterGender === 'all' || p.gender === filterGender);
  });

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
    const historyApps = appointments.filter(a => a.patientId === selectedPatient.id);
    const historyBills = bills.filter(b => b.patientId === selectedPatient.id);
    return { historyApps, historyBills };
  };

  return (
    <div className="space-y-6">
      {/* ... (Existing Patient List UI - Unchanged) ... */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
        {canManagePatients ? <Button onClick={openCreateModal} icon={Plus}>Register Patient</Button> : <Button disabled variant="secondary" icon={Lock}>Register Patient</Button>}
      </div>

      <Card className="!p-0 overflow-visible z-10">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
           {/* Filters UI */}
           <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Search patients..." className="pl-10 w-full rounded-lg border-gray-300 py-2 text-slate-900 bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button variant={showFilters ? 'primary' : 'outline'} icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filter</Button>
          </div>
          {showFilters && (
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
               <Select label="Type" value={filterType} onChange={e => setFilterType(e.target.value)}><option value="all">All</option><option value="outpatient">Outpatient</option><option value="inpatient">Inpatient</option><option value="emergency">Emergency</option></Select>
               <Select label="Gender" value={filterGender} onChange={e => setFilterGender(e.target.value)}><option value="all">All</option><option value="male">Male</option><option value="female">Female</option></Select>
             </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">ID</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap w-1/5">Patient Name</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Address</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Age/Sex</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Type</th>
                <th className="px-3 py-3 text-right text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (<tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>) : 
               filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors group text-sm">
                    <td className="px-3 py-3 align-top whitespace-nowrap"><span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{patient.patientId}</span></td>
                    <td className="px-3 py-3 align-top font-bold text-gray-900">{patient.fullName}</td>
                    <td className="px-3 py-3 align-top text-xs text-gray-600 max-w-[150px]">{patient.address}</td>
                    <td className="px-3 py-3 align-top">{patient.phone}</td>
                    <td className="px-3 py-3 align-top">{patient.age} / <span className="capitalize">{patient.gender}</span></td>
                    <td className="px-3 py-3 align-top"><Badge color={patient.type === 'emergency' ? 'red' : 'green'}>{patient.type}</Badge></td>
                    <td className="px-3 py-3 text-right align-top">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => openActionMenu(patient)} size="sm" variant="secondary" icon={Settings} className="!py-1 !px-2 !text-xs">Manage</Button>
                        {canManagePatients && <button onClick={() => openEditModal(patient)} className="p-1.5 text-gray-400 hover:text-green-600"><Edit size={16}/></button>}
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Register/Edit Modal (Unchanged) */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? "Edit Patient" : "Register Patient"}>
         <form onSubmit={handleRegisterSubmit} className="space-y-6">
           <div className="space-y-4">
             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-1 mb-2 flex items-center gap-2">
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
             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-1 mb-2 flex items-center gap-2">
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
             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b pb-1 mb-2 flex items-center gap-2">
               <Phone size={16} /> Emergency Contact
             </h4>
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <Input label="Contact Name" value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
               <Input label="Phone" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
               <Input label="Relation" placeholder="e.g. Father" value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
             </div>
           </div>

           <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
             <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield size={16} /> Insurance Details
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm font-medium text-slate-700">Has Insurance?</span>
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

           <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
             <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
             <Button type="submit">Save Patient Record</Button>
           </div>
         </form>
      </Modal>

      {/* Action Menu Modal (Unchanged) */}
      <Modal isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} title={`Actions for ${selectedPatient?.fullName}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'appointment', icon: Calendar, label: 'Appointment', color: 'blue' },
            { id: 'lab', icon: FlaskConical, label: 'Lab Test', color: 'purple' },
            { id: 'nurse', icon: Thermometer, label: 'Nurse Service', color: 'emerald' },
            { id: 'admission', icon: Bed, label: 'Admission', color: 'orange' }, 
            { id: 'operation', icon: Activity, label: 'Operation', color: 'red' },
            { id: 'history', icon: History, label: 'History / View', color: 'gray' },
          ].map((action: any) => (
            <button key={action.id} onClick={() => handleActionSelect(action.id)} 
              className={`flex flex-col items-center justify-center p-4 bg-${action.color}-50 hover:bg-${action.color}-100 text-${action.color}-700 rounded-xl transition-all border border-${action.color}-100`}>
              <action.icon size={28} className="mb-2" />
              <span className="font-semibold text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Specific Action Modal */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={getActionModalTitle()}>
        <form onSubmit={submitAction} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 text-sm"><span className="font-bold">Patient:</span> {selectedPatient?.fullName}</div>

          {/* APPOINTMENT FORM */}
          {currentAction === 'appointment' && (
            <>
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Date" type="date" required value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                  <Input label="Time" type="time" required value={actionFormData.time} onChange={e => setActionFormData({...actionFormData, time: e.target.value})} />
               </div>
               
               <Select label="Assign Doctor" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                 <option value="">Select Doctor...</option>
                 {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
               </Select>

               {actionFormData.staffId && (
                 <Select label="Type" value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                   <option value="">Select Type...</option>
                   <option value="Consultation">Consultation</option>
                   <option value="Follow-up">Follow-up</option>
                   <option value="Emergency">Emergency</option>
                 </Select>
               )}

               {/* Show Fees ONLY after type is selected */}
               {actionFormData.subtype && actionFormData.totalCost > 0 && (
                  <div className="text-sm font-bold text-green-700 bg-green-50 p-3 rounded border border-green-100 flex justify-between items-center animate-in fade-in">
                    <span>Calculated Fee:</span>
                    <span className="text-lg">${actionFormData.totalCost}</span>
                  </div>
               )}
               
               <Textarea label="Reason" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </>
          )}

          {/* LAB TEST FORM */}
          {currentAction === 'lab' && (
            <>
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Search & Add Tests</label>
                  <input type="text" className="w-full rounded-xl border-slate-300 py-2 px-3 text-sm" placeholder="Type test name..." value={testSearch} onChange={e => setTestSearch(e.target.value)} />
                  {testSearch && (
                    <div className="mt-1 border rounded-lg max-h-32 overflow-y-auto bg-white shadow-sm">
                      {labTests.filter(t => t.name.toLowerCase().includes(testSearch.toLowerCase())).map(t => (
                        <button key={t.id} type="button" className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm flex justify-between" onClick={() => { if(!selectedTests.find(x => x.id===t.id)) setSelectedTests([...selectedTests, t]); setTestSearch(''); }}>
                          <span>{t.name}</span><span className="font-mono text-xs">${t.cost}</span>
                        </button>
                      ))}
                    </div>
                  )}
               </div>
               <div className="border rounded-xl overflow-hidden">
                 <table className="w-full text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Test</th><th className="px-3 py-2 text-right">Cost</th><th></th></tr></thead>
                 <tbody>
                   {selectedTests.map((t, i) => (
                     <tr key={i} className="border-t border-slate-100"><td className="px-3 py-2">{t.name}</td><td className="px-3 py-2 text-right">${t.cost}</td><td className="text-center"><button type="button" onClick={() => setSelectedTests(selectedTests.filter(x => x.id !== t.id))} className="text-red-500"><Trash2 size={14}/></button></td></tr>
                   ))}
                   <tr className="bg-slate-50 font-bold border-t"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">${selectedTests.reduce((a,b)=>a+b.cost,0)}</td><td></td></tr>
                 </tbody></table>
               </div>
            </>
          )}

          {/* NURSE SERVICE FORM */}
          {currentAction === 'nurse' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Select Service</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1">
                  {nurseServices.map(svc => (
                    <div key={svc.id} onClick={() => setSelectedService(svc)} className={`p-3 rounded-xl border cursor-pointer ${selectedService?.id === svc.id ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex justify-between"><h4 className="font-bold text-sm">{svc.name}</h4><span className="text-xs font-bold bg-white border px-1 rounded">${svc.cost}</span></div>
                      <p className="text-xs text-slate-500 mt-1">{svc.description}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <Select label="Assign Nurse" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                 <option value="">Select Nurse...</option>
                 {staff.filter(s => s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>

              <Textarea label="Notes / Instructions" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
            </div>
          )}

          {/* ADMISSION FORM */}
          {currentAction === 'admission' && (
             <>
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Entry Date" type="date" required value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                  <Input label="Discharge Date" type="date" value={actionFormData.dischargeDate} onChange={e => setActionFormData({...actionFormData, dischargeDate: e.target.value})} />
               </div>
               <Select label="Treating Doctor" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                 <option value="">Select Doctor...</option>
                 {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
               </Select>
               <label className="block text-sm font-semibold text-slate-700">Select Bed</label>
               <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1">
                 {beds.map(bed => (
                   <button key={bed.id} type="button" disabled={bed.status === 'occupied'} onClick={() => setSelectedBed(bed)}
                     className={`flex flex-col items-center p-2 rounded border text-xs relative ${bed.status === 'occupied' ? 'bg-red-50 border-red-200 text-red-400' : selectedBed?.id === bed.id ? 'bg-primary-600 text-white' : 'bg-white text-slate-600'}`}>
                     <Bed size={16} className="mb-1"/> <span className="font-bold">{bed.roomNumber}</span>
                     {selectedBed?.id === bed.id && <CheckCircle size={12} className="absolute top-1 right-1 text-white"/>}
                   </button>
                 ))}
               </div>
               {selectedBed && <p className="text-xs text-right font-bold text-slate-500">Deposit: ${selectedBed.costPerDay}</p>}
               <Textarea label="Admission Notes" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
             </>
          )}

          {/* OPERATION FORM */}
          {currentAction === 'operation' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
               <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex items-start gap-2 mb-2">
                 <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                 Confirming this operation will schedule it. Billing happens in the Operations module.
               </div>

               {/* Operation Selection */}
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Operation Name</label>
                  <input 
                    type="text" 
                    list="ops-list" 
                    className="w-full rounded-xl border-slate-300 py-2 px-3 text-sm text-slate-900" 
                    placeholder="Type to search..."
                    value={actionFormData.subtype} 
                    onChange={e => handleOperationSelect(e.target.value)} 
                  />
                  <datalist id="ops-list">{operations.map(o => <option key={o.id} value={o.name}/>)}</datalist>
               </div>

               {/* Staffing & Costs */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <div className="col-span-1">
                    <Select label="Lead Surgeon" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                      <option value="">Select Surgeon...</option>
                      {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Select>
                    <Input className="mt-1" type="number" placeholder="Cost" value={opDetails.surgeonCost} onChange={e => setOpDetails({...opDetails, surgeonCost: parseFloat(e.target.value || '0')})} />
                 </div>

                 <div className="col-span-1">
                    <Select label="Anesthesiologist" value={opDetails.anesthesiologistId} onChange={e => setOpDetails({...opDetails, anesthesiologistId: e.target.value})}>
                      <option value="">Select Anesthesiologist...</option>
                      {staff.filter(s => s.type === 'anesthesiologist' || s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Select>
                    <Input className="mt-1" type="number" placeholder="Cost" value={opDetails.anesthesiologistCost} onChange={e => setOpDetails({...opDetails, anesthesiologistCost: parseFloat(e.target.value || '0')})} />
                 </div>

                 <div className="col-span-1">
                    <Select label="Medical Assistant" value={opDetails.assistantId} onChange={e => setOpDetails({...opDetails, assistantId: e.target.value})}>
                      <option value="">Select Assistant...</option>
                      {staff.filter(s => s.type === 'medical_assistant' || s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Select>
                    <Input className="mt-1" type="number" placeholder="Cost" value={opDetails.assistantCost} onChange={e => setOpDetails({...opDetails, assistantCost: parseFloat(e.target.value || '0')})} />
                 </div>

                 <div className="col-span-1">
                    <Select label="Scrub Nurse" value={opDetails.nurseId} onChange={e => setOpDetails({...opDetails, nurseId: e.target.value})}>
                      <option value="">Select Nurse...</option>
                      {staff.filter(s => s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                    </Select>
                    <Input className="mt-1" type="number" placeholder="Cost" value={opDetails.nurseCost} onChange={e => setOpDetails({...opDetails, nurseCost: parseFloat(e.target.value || '0')})} />
                 </div>
               </div>

               {/* Resources & Costs */}
               <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-3 gap-2">
                     <div className="col-span-2 flex items-center"><span className="text-sm font-semibold text-slate-700">Theater Charges (1x Surgeon Fee)</span></div>
                     <div className="col-span-1"><Input label="Cost" type="number" value={opDetails.theaterCost} onChange={e => setOpDetails({...opDetails, theaterCost: parseFloat(e.target.value || '0')})} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="col-span-2"><Input label="Drugs & Consumables" placeholder="Anesthesia, antibiotics..." value={opDetails.drugs} onChange={e => setOpDetails({...opDetails, drugs: e.target.value})} /></div>
                     <div className="col-span-1"><Input label="Cost" type="number" value={opDetails.drugsCost} onChange={e => setOpDetails({...opDetails, drugsCost: parseFloat(e.target.value || '0')})} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="col-span-2"><Input label="Equipment Used" placeholder="Specialized equipment..." value={opDetails.equipment} onChange={e => setOpDetails({...opDetails, equipment: e.target.value})} /></div>
                     <div className="col-span-1"><Input label="Cost" type="number" value={opDetails.equipmentCost} onChange={e => setOpDetails({...opDetails, equipmentCost: parseFloat(e.target.value || '0')})} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                     <div className="col-span-2"><Input label="Others" placeholder="Other charges..." value={opDetails.others} onChange={e => setOpDetails({...opDetails, others: e.target.value})} /></div>
                     <div className="col-span-1"><Input label="Cost" type="number" value={opDetails.othersCost} onChange={e => setOpDetails({...opDetails, othersCost: parseFloat(e.target.value || '0')})} /></div>
                  </div>
               </div>

               {/* Costing */}
               <div className="pt-2 border-t border-slate-100 bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                  <span className="font-bold text-gray-700">Projected Operation Cost:</span>
                  <span className="text-xl font-bold text-gray-900">${actionFormData.totalCost.toFixed(2)}</span>
               </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
             <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
             <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* Patient History / View Modal (Unchanged) */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Patient File">
        {selectedPatient && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-primary-600 shadow-sm border border-slate-200 shrink-0">
                {selectedPatient.fullName.charAt(0)}
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selectedPatient.fullName}</h2>
                  <div className="flex flex-wrap gap-2 text-sm text-slate-500 mt-1">
                    <span className="bg-white px-2 py-0.5 rounded border">{selectedPatient.patientId}</span>
                    <span className="flex items-center gap-1"><UserIcon size={14}/> {selectedPatient.age} yrs / {selectedPatient.gender}</span>
                    <span className="flex items-center gap-1"><Phone size={14}/> {selectedPatient.phone}</span>
                  </div>
                </div>
                <div className="text-sm text-slate-600 border-t pt-2 mt-1">
                   <span className="font-semibold">Address:</span> {selectedPatient.address}
                </div>
              </div>
              <div className="text-right">
                <Badge color={selectedPatient.type === 'inpatient' ? 'orange' : selectedPatient.type === 'emergency' ? 'red' : 'green'}>
                  {selectedPatient.type.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div className="flex border-b border-gray-200">
              <button onClick={() => setViewTab('info')} className={`px-4 py-2 font-medium text-sm ${viewTab === 'info' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>Medical Profile</button>
              <button onClick={() => setViewTab('history')} className={`px-4 py-2 font-medium text-sm ${viewTab === 'history' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-500 hover:text-gray-700'}`}>History & Records</button>
            </div>

            {viewTab === 'info' ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                 <Card title="Medical Details" className="h-full">
                   <div className="space-y-4">
                     <div className="flex items-start gap-3">
                       <div className="mt-1"><Heart className="text-red-500" size={18} /></div>
                       <div>
                         <p className="text-xs font-bold text-slate-500 uppercase">Blood Group</p>
                         <p className="font-semibold text-slate-800">{selectedPatient.bloodGroup || 'Not recorded'}</p>
                       </div>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="mt-1"><AlertTriangle className="text-orange-500" size={18} /></div>
                       <div>
                         <p className="text-xs font-bold text-slate-500 uppercase">Allergies</p>
                         <p className="text-sm text-slate-700">{selectedPatient.allergies || 'None known'}</p>
                       </div>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="mt-1"><Activity className="text-blue-500" size={18} /></div>
                       <div>
                         <p className="text-xs font-bold text-slate-500 uppercase">Current Symptoms</p>
                         <p className="text-sm text-slate-700">{selectedPatient.symptoms || 'None recorded'}</p>
                       </div>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="mt-1"><FileClock className="text-slate-400" size={18} /></div>
                       <div>
                         <p className="text-xs font-bold text-slate-500 uppercase">Medical History</p>
                         <p className="text-sm text-slate-700 leading-relaxed">{selectedPatient.medicalHistory || 'No history recorded'}</p>
                       </div>
                     </div>
                   </div>
                 </Card>
   
                 <div className="space-y-6">
                   <Card title="Emergency Contact">
                      {selectedPatient.emergencyContact ? (
                        <div className="space-y-2">
                          <p className="font-bold text-slate-800">{selectedPatient.emergencyContact.name} <span className="text-xs font-normal text-slate-500">({selectedPatient.emergencyContact.relation})</span></p>
                          <p className="flex items-center gap-2 text-slate-600"><Phone size={14}/> {selectedPatient.emergencyContact.phone}</p>
                        </div>
                      ) : <p className="text-slate-400 italic">No emergency contact.</p>}
                   </Card>
   
                   <Card title="Insurance">
                      {selectedPatient.hasInsurance && selectedPatient.insuranceDetails ? (
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Provider</span>
                            <span className="font-bold text-slate-800">{selectedPatient.insuranceDetails.provider}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Policy #</span>
                            <span className="font-mono text-sm bg-slate-50 px-2 py-0.5 rounded">{selectedPatient.insuranceDetails.policyNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-slate-500">Expires</span>
                            <span className={`text-sm font-medium ${new Date(selectedPatient.insuranceDetails.expiryDate) < new Date() ? 'text-red-600' : 'text-green-600'}`}>{selectedPatient.insuranceDetails.expiryDate}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-500 italic bg-slate-50 p-3 rounded-lg">
                          <Shield size={16} className="text-slate-400"/> Self Pay / No Insurance
                        </div>
                      )}
                   </Card>
                 </div>
               </div>
            ) : (
               <div className="space-y-6 animate-in fade-in">
                  <div className="space-y-4">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Appointment History</h3>
                     {getPatientHistory().historyApps.length > 0 ? (
                       <div className="border rounded-lg overflow-hidden">
                         <table className="w-full text-sm">
                           <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">Doctor</th><th className="px-3 py-2">Status</th></tr></thead>
                           <tbody>
                             {getPatientHistory().historyApps.map(a => (
                               <tr key={a.id} className="border-t">
                                 <td className="px-3 py-2">{new Date(a.datetime).toLocaleDateString()}</td>
                                 <td className="px-3 py-2">{a.type}</td>
                                 <td className="px-3 py-2">{a.staffName}</td>
                                 <td className="px-3 py-2 text-center"><Badge color={a.status==='confirmed'?'green':a.status==='cancelled'?'red':'yellow'}>{a.status}</Badge></td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     ) : <p className="text-slate-400 text-sm italic">No appointment history found.</p>}
                  </div>

                  <div className="space-y-4">
                     <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Billing History</h3>
                     {getPatientHistory().historyBills.length > 0 ? (
                       <div className="border rounded-lg overflow-hidden">
                         <table className="w-full text-sm">
                           <thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Invoice #</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Status</th></tr></thead>
                           <tbody>
                             {getPatientHistory().historyBills.map(b => (
                               <tr key={b.id} className="border-t">
                                 <td className="px-3 py-2">{b.date}</td>
                                 <td className="px-3 py-2 font-mono text-xs">{b.billNumber}</td>
                                 <td className="px-3 py-2 text-right font-bold">${b.totalAmount}</td>
                                 <td className="px-3 py-2 text-center"><Badge color={b.status==='paid'?'green':'yellow'}>{b.status}</Badge></td>
                               </tr>
                             ))}
                           </tbody>
                         </table>
                       </div>
                     ) : <p className="text-slate-400 text-sm italic">No billing records found.</p>}
                  </div>
               </div>
            )}
            
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>Close File</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
