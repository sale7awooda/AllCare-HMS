
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Heart, Shield, AlertTriangle, Edit, Eye, Calendar, Lock, 
  Stethoscope, FlaskConical, Bed, Activity, FileClock, Settings, Thermometer, Trash2, CheckCircle,
  Phone, User as UserIcon, AlertCircle, Pill, Syringe
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, User, MedicalStaff, LabTestCatalog, NurseServiceCatalog, Bed as BedType, OperationCatalog } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
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
  const [viewTab, setViewTab] = useState<'info' | 'records'>('info');
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
    others: ''
  });

  // SUDAN INSURANCE PROVIDERS
  const SUDAN_INSURANCE_PROVIDERS = [
    "Shiekan Insurance", "The United Insurance", "Blue Nile Insurance",
    "Al-Salama Insurance", "Juba Insurance", "Prime Health",
    "Wataniya Insurance", "General Insurance"
  ];

  // Registration Form State
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
      const [pts, apts, stf, user] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(),
        api.getStaff(),
        api.me()
      ]);
      setPatients(Array.isArray(pts) ? pts : []);
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
    setOpDetails({ assistantId: '', anesthesiologistId: '', nurseId: '', drugs: '', equipment: '', others: '' });
    
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      notes: '',
      subtype: '',
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
      totalCost: op ? op.baseCost : 0
    });
  };

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
          deposit: selectedBed.costPerDay
        });

      } else if (currentAction === 'operation') {
        if (!actionFormData.subtype) return alert('Enter operation name.');
        if (!staffAssignedId) return alert('Select a surgeon.');
        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffAssignedId, 
          notes: actionFormData.notes,
          optionalFields: opDetails,
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
          status: 'pending'
        });
        
        if (doc.consultationFee > 0) {
          await api.createBill({
            patientId: selectedPatient.id,
            patientName: selectedPatient.fullName,
            totalAmount: doc.consultationFee,
            date: new Date().toISOString().split('T')[0],
            items: [{description: `Consultation: ${doc.fullName} for ${selectedPatient.fullName}`, amount: doc.consultationFee}]
          });
        }
      }

      setIsActionModalOpen(false);
      loadData();
      loadCatalogs();
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
  
  const getDocFee = () => {
    const d = staff.find(s => s.id === parseInt(actionFormData.staffId));
    return d ? d.consultationFee : 0;
  };

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

  return (
    <div className="space-y-6">
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

      {/* Register/Edit Modal */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? "Edit Patient" : "Register Patient"}>
         <form onSubmit={handleRegisterSubmit} className="space-y-6">
           {/* Section 1: Personal Info */}
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

           {/* Section 2: Medical Profile */}
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

           {/* Section 3: Emergency Contact */}
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

           {/* Section 4: Insurance */}
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

      {/* Action Menu Modal */}
      <Modal isOpen={isActionMenuOpen} onClose={() => setIsActionMenuOpen(false)} title={`Actions for ${selectedPatient?.fullName}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { id: 'appointment', icon: Calendar, label: 'Appointment', color: 'blue' },
            { id: 'lab', icon: FlaskConical, label: 'Lab Test', color: 'purple' },
            { id: 'nurse', icon: Thermometer, label: 'Nurse Service', color: 'emerald' },
            { id: 'admission', icon: Bed, label: 'Admission', color: 'orange' }, 
            { id: 'operation', icon: Activity, label: 'Operation', color: 'red' },
            { id: 'history', icon: FileClock, label: 'History / View', color: 'gray' },
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
               {actionFormData.staffId && <div className="text-xs font-bold text-green-600 bg-green-50 p-2 rounded border border-green-100">Consultation Fee: ${getDocFee()}</div>}
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
               {selectedBed && <p className="text-xs text-right font-bold text-slate-500">Cost: ${selectedBed.costPerDay}/day</p>}
             </>
          )}

          {/* OPERATION FORM */}
          {currentAction === 'operation' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
               <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex items-start gap-2 mb-2">
                 <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                 Confirming this operation will generate a bill. Ensure all resource usage is estimated correctly.
               </div>

               {/* Operation Selection */}
               <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Search Operation</label>
                  <input 
                    type="text" 
                    list="ops-list" 
                    className="w-full rounded-xl border-slate-300 py-2 px-3 text-sm" 
                    placeholder="Type to search..."
                    value={actionFormData.subtype} 
                    onChange={e => handleOperationSelect(e.target.value)} 
                  />
                  <datalist id="ops-list">{operations.map(o => <option key={o.id} value={o.name}/>)}</datalist>
               </div>

               {/* Staffing */}
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                 <Select label="Lead Surgeon" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                   <option value="">Select Surgeon...</option>
                   {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                 </Select>

                 <Select label="Anesthesiologist" value={opDetails.anesthesiologistId} onChange={e => setOpDetails({...opDetails, anesthesiologistId: e.target.value})}>
                   <option value="">Select Anesthesiologist...</option>
                   {staff.filter(s => s.type === 'anesthesiologist' || s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                 </Select>

                 <Select label="Medical Assistant" value={opDetails.assistantId} onChange={e => setOpDetails({...opDetails, assistantId: e.target.value})}>
                   <option value="">Select Assistant...</option>
                   {staff.filter(s => s.type === 'medical_assistant' || s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                 </Select>

                 <Select label="Scrub Nurse" value={opDetails.nurseId} onChange={e => setOpDetails({...opDetails, nurseId: e.target.value})}>
                   <option value="">Select Nurse...</option>
                   {staff.filter(s => s.type === 'nurse').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                 </Select>
               </div>

               {/* Resources */}
               <div className="space-y-3 pt-2 border-t border-slate-100">
                  <Textarea label="Drugs & Consumables" placeholder="List anesthesia, antibiotics, sutures..." rows={2} value={opDetails.drugs} onChange={e => setOpDetails({...opDetails, drugs: e.target.value})} />
                  <Textarea label="Equipment Used" placeholder="Specialized equipment..." rows={2} value={opDetails.equipment} onChange={e => setOpDetails({...opDetails, equipment: e.target.value})} />
               </div>

               {/* Costing */}
               <div className="pt-2 border-t border-slate-100">
                  <Input 
                    label="Total Operation Cost ($)" 
                    type="number" 
                    required 
                    value={actionFormData.totalCost} 
                    onChange={e => setActionFormData({...actionFormData, totalCost: parseFloat(e.target.value)})} 
                  />
                  <p className="text-xs text-slate-500 mt-1">Base cost pre-filled. Adjust based on additional resources.</p>
               </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
             <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
             <Button type="submit">Confirm & Generate Bill</Button>
          </div>
        </form>
      </Modal>

      {/* Patient History / View Modal */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Patient File">
        {selectedPatient && (
          <div className="space-y-6">
            {/* Header / Basic Info */}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Medical History */}
              <Card title="Medical Profile" className="h-full">
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
                {/* Emergency Contact */}
                <Card title="Emergency Contact">
                   {selectedPatient.emergencyContact ? (
                     <div className="space-y-2">
                       <p className="font-bold text-slate-800">{selectedPatient.emergencyContact.name} <span className="text-xs font-normal text-slate-500">({selectedPatient.emergencyContact.relation})</span></p>
                       <p className="flex items-center gap-2 text-slate-600"><Phone size={14}/> {selectedPatient.emergencyContact.phone}</p>
                     </div>
                   ) : <p className="text-slate-400 italic">No emergency contact.</p>}
                </Card>

                {/* Insurance */}
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
            
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={() => setIsViewModalOpen(false)}>Close File</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
