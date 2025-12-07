
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Heart, Shield, AlertTriangle, Edit, Eye, Calendar, Lock, 
  Stethoscope, FlaskConical, Bed, Activity, FileClock, Settings, Thermometer
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, User, MedicalStaff } from '../types';
import { hasPermission } from '../utils/rbac';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false); // The Selection Menu
  const [isActionModalOpen, setIsActionModalOpen] = useState(false); // The Specific Action Form
  
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
    subtype: '' // For Lab Type, Operation Name, etc.
  });

  // SUDAN INSURANCE PROVIDERS
  const SUDAN_INSURANCE_PROVIDERS = [
    "Shiekan Insurance", "The United Insurance", "Blue Nile Insurance",
    "Al-Salama Insurance", "Juba Insurance", "Prime Health",
    "Wataniya Insurance", "General Insurance"
  ];

  // Form State for Registration/Edit
  const initialFormState = {
    fullName: '', age: 0, phone: '', gender: 'male' as const, type: 'outpatient' as const, address: '',
    symptoms: '', medicalHistory: '', allergies: '', bloodGroup: '',
    hasInsurance: false,
    emergencyName: '', emergencyPhone: '', emergencyRelation: '',
    insProvider: '', insPolicy: '', insExpiry: '', insNotes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const loadData = async () => {
    setLoading(true);
    const [pts, apts, stf, user] = await Promise.all([
      api.getPatients(), 
      api.getAppointments(),
      api.getStaff(),
      api.me()
    ]);
    setPatients(pts);
    setAllAppointments(apts);
    setStaff(stf);
    setCurrentUser(user);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Handlers ---

  const openCreateModal = () => {
    setFormData(initialFormState);
    setIsEditing(false);
    setIsFormModalOpen(true);
  };

  const openEditModal = async (patient: Patient) => {
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
  };

  // --- ACTION MENU HANDLERS ---

  const openActionMenu = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsActionMenuOpen(true);
  };

  const handleActionSelect = (action: 'appointment' | 'lab' | 'nurse' | 'admission' | 'operation' | 'history') => {
    setIsActionMenuOpen(false); // Close menu
    
    if (action === 'history') {
      // Direct to View Modal
      openViewModal(selectedPatient!);
      return;
    }

    // Prepare Form for specific action
    setCurrentAction(action);
    setActionFormData({
      staffId: '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      notes: '',
      subtype: ''
    });
    setIsActionModalOpen(true);
  };

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    let type = 'Consultation';
    let details = actionFormData.notes;

    // Map actions to appointment types for scheduling
    switch (currentAction) {
      case 'lab':
        type = 'Lab Test';
        details = `Test: ${actionFormData.subtype}. ${actionFormData.notes}`;
        break;
      case 'nurse':
        type = 'Nurse Service';
        details = `Service: ${actionFormData.subtype}. ${actionFormData.notes}`;
        break;
      case 'operation':
        type = 'Operation';
        details = `Surgery: ${actionFormData.subtype}. ${actionFormData.notes}`;
        break;
      case 'admission':
        type = 'Inpatient Admission';
        details = `Room: ${actionFormData.subtype}. ${actionFormData.notes}`;
        break;
      case 'appointment':
        type = actionFormData.subtype || 'Consultation'; // e.g. Follow-up
        break;
    }

    // Find staff name
    const selectedStaff = staff.find(s => s.id === parseInt(actionFormData.staffId));
    
    await api.createAppointment({
      patientId: selectedPatient.id,
      patientName: selectedPatient.fullName,
      staffId: selectedStaff?.id || 0, // Fallback if no staff selected (should be required though)
      staffName: selectedStaff?.fullName || 'Unassigned',
      datetime: `${actionFormData.date}T${actionFormData.time}`,
      type: type,
      reason: details,
      status: 'pending' // Default to pending
    });

    setIsActionModalOpen(false);
    loadData(); // Refresh to show new history
  };

  const openViewModal = async (patient: Patient) => {
    const fullDetails = await api.getPatient(patient.id);
    setSelectedPatient(fullDetails);
    setViewTab('info');
    setIsViewModalOpen(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName || !formData.phone) return;

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
        name: formData.emergencyName,
        phone: formData.emergencyPhone,
        relation: formData.emergencyRelation
      } : undefined,
      insuranceDetails: formData.hasInsurance ? {
        provider: formData.insProvider,
        policyNumber: formData.insPolicy,
        expiryDate: formData.insExpiry,
        notes: formData.insNotes
      } : undefined
    };

    if (isEditing && selectedPatient) {
      await api.updatePatient(selectedPatient.id, payload as any);
    } else {
      await api.addPatient(payload as any);
    }

    setIsFormModalOpen(false);
    loadData();
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesGender = filterGender === 'all' || p.gender === filterGender;
    return matchesSearch && matchesType && matchesGender;
  });

  const canManagePatients = hasPermission(currentUser, 'MANAGE_PATIENTS');

  // --- Render Helpers ---
  
  const getActionModalTitle = () => {
    switch (currentAction) {
      case 'appointment': return 'Book Appointment';
      case 'lab': return 'Order Lab Test';
      case 'nurse': return 'Request Nurse Service';
      case 'admission': return 'Room Admission';
      case 'operation': return 'Schedule Operation';
      default: return 'Action';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
        {canManagePatients ? (
          <Button onClick={openCreateModal} icon={Plus}>Register Patient</Button>
        ) : (
          <Button disabled className="opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200" variant="secondary" icon={Lock}>Register Patient</Button>
        )}
      </div>

      {/* Filters */}
      <Card className="!p-0 overflow-visible z-10">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search patients by name or ID..." 
                className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 text-slate-900 bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant={showFilters ? 'primary' : 'outline'} icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filter</Button>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm animate-in slide-in-from-top-2">
               <Select label="Type" value={filterType} onChange={e => setFilterType(e.target.value)}>
                 <option value="all">All Types</option>
                 <option value="outpatient">Outpatient</option>
                 <option value="inpatient">Inpatient</option>
                 <option value="emergency">Emergency</option>
               </Select>
               <Select label="Gender" value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                 <option value="all">All Genders</option>
                 <option value="male">Male</option>
                 <option value="female">Female</option>
               </Select>
            </div>
          )}
        </div>

        {/* Table */}
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
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8">Loading...</td></tr>
              ) : filteredPatients.length === 0 ? (
                 <tr><td colSpan={7} className="text-center py-8 text-gray-500">No patients found.</td></tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors group text-sm">
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{patient.patientId}</span>
                      {patient.hasInsurance && <div className="mt-1"><Badge color="blue">Insured</Badge></div>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="font-bold text-gray-900 break-words leading-tight">{patient.fullName}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-gray-600 text-xs break-words max-w-[150px] leading-tight">{patient.address}</div>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      <span className="font-medium text-gray-700">{patient.phone}</span>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap text-gray-700">
                      {patient.age} / <span className="capitalize">{patient.gender}</span>
                    </td>
                    <td className="px-3 py-3 align-top whitespace-nowrap">
                      <Badge color={patient.type === 'emergency' ? 'red' : patient.type === 'inpatient' ? 'blue' : 'green'}>{patient.type}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right align-top whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <Button 
                          onClick={() => openActionMenu(patient)} 
                          size="sm" 
                          variant="secondary"
                          icon={Settings}
                          className="!py-1 !px-2 !text-xs"
                        >
                          Manage
                        </Button>
                        {canManagePatients && (
                          <button onClick={() => openEditModal(patient)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Edit"><Edit size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- MENU MODAL (Action Selector) --- */}
      <Modal 
        isOpen={isActionMenuOpen} 
        onClose={() => setIsActionMenuOpen(false)} 
        title={`Actions for ${selectedPatient?.fullName || 'Patient'}`}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <button onClick={() => handleActionSelect('appointment')} className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition-all border border-blue-100 hover:shadow-md">
            <Calendar size={28} className="mb-2" />
            <span className="font-semibold text-sm">Appointment</span>
          </button>

          <button onClick={() => handleActionSelect('lab')} className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl transition-all border border-purple-100 hover:shadow-md">
            <FlaskConical size={28} className="mb-2" />
            <span className="font-semibold text-sm">Lab Test</span>
          </button>

          <button onClick={() => handleActionSelect('nurse')} className="flex flex-col items-center justify-center p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-all border border-emerald-100 hover:shadow-md">
            <Thermometer size={28} className="mb-2" />
            <span className="font-semibold text-sm">Nurse Service</span>
          </button>

          <button onClick={() => handleActionSelect('admission')} className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl transition-all border border-orange-100 hover:shadow-md">
            <Bed size={28} className="mb-2" />
            <span className="font-semibold text-sm">Room Admission</span>
          </button>

          <button onClick={() => handleActionSelect('operation')} className="flex flex-col items-center justify-center p-4 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-all border border-red-100 hover:shadow-md">
            <Activity size={28} className="mb-2" />
            <span className="font-semibold text-sm">Operation</span>
          </button>

          <button onClick={() => handleActionSelect('history')} className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all border border-gray-100 hover:shadow-md">
            <FileClock size={28} className="mb-2" />
            <span className="font-semibold text-sm">History / View</span>
          </button>
        </div>
      </Modal>

      {/* --- SPECIFIC ACTION FORM MODAL --- */}
      <Modal 
        isOpen={isActionModalOpen} 
        onClose={() => setIsActionModalOpen(false)} 
        title={getActionModalTitle()}
      >
        <form onSubmit={submitAction} className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4 text-sm">
             <span className="font-bold text-gray-700">Patient:</span> {selectedPatient?.fullName} ({selectedPatient?.patientId})
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Date" 
              type="date" 
              required
              value={actionFormData.date}
              onChange={e => setActionFormData({...actionFormData, date: e.target.value})}
            />
            <Input 
              label="Time" 
              type="time" 
              required
              value={actionFormData.time}
              onChange={e => setActionFormData({...actionFormData, time: e.target.value})}
            />
          </div>

          {/* Dynamic Fields based on Action */}
          
          {currentAction === 'appointment' && (
             <Select 
                label="Type"
                value={actionFormData.subtype}
                onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}
             >
                <option value="Consultation">General Consultation</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Emergency">Emergency</option>
             </Select>
          )}

          {currentAction === 'lab' && (
             <Input 
                label="Test Name" 
                placeholder="e.g., CBC, Lipid Profile" 
                required
                value={actionFormData.subtype}
                onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}
             />
          )}

          {currentAction === 'nurse' && (
             <Input 
                label="Procedure Name" 
                placeholder="e.g., Injection, Dressing Change" 
                required
                value={actionFormData.subtype}
                onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}
             />
          )}

          {currentAction === 'admission' && (
             <Input 
                label="Room Number / Ward" 
                placeholder="e.g., Room 101, ICU" 
                required
                value={actionFormData.subtype}
                onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}
             />
          )}

          {currentAction === 'operation' && (
             <Input 
                label="Operation Name" 
                placeholder="e.g., Appendectomy" 
                required
                value={actionFormData.subtype}
                onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}
             />
          )}

          {/* Staff Selection */}
          <Select 
            label={currentAction === 'nurse' ? 'Assign Nurse' : 'Assign Doctor'}
            required
            value={actionFormData.staffId}
            onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}
          >
             <option value="">Select Staff...</option>
             {staff.filter(s => {
                if (currentAction === 'nurse') return s.type === 'nurse';
                if (currentAction === 'lab') return s.type === 'technician';
                return s.type === 'doctor' || s.type === 'specialist';
             }).map(s => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.specialization})</option>
             ))}
          </Select>

          <Textarea 
             label="Notes / Instructions" 
             placeholder="Additional details..."
             rows={3}
             value={actionFormData.notes}
             onChange={e => setActionFormData({...actionFormData, notes: e.target.value})}
          />

          <div className="pt-4 flex justify-end gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>Cancel</Button>
             <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* --- Register/Edit Modal (Existing) --- */}
      <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={isEditing ? "Edit Patient Details" : "Register New Patient"}>
        <form onSubmit={handleRegisterSubmit} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1">Personal Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              <Input label="Phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Age" type="number" required value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} />
              <Select label="Gender" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
               <Select label="Blood Group" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})}>
                <option value="">Unknown</option>
                <option value="A+">A+</option> <option value="A-">A-</option> <option value="B+">B+</option> <option value="B-">B-</option>
                <option value="O+">O+</option> <option value="O-">O-</option> <option value="AB+">AB+</option> <option value="AB-">AB-</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Address" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              <Select label="Type" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                <option value="outpatient">Outpatient</option>
                <option value="inpatient">Inpatient</option>
                <option value="emergency">Emergency</option>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1 flex items-center gap-2"><Heart size={14}/> Medical History</h4>
            <div className="grid grid-cols-1 gap-3">
              <Textarea label="Symptoms" rows={2} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
              <Textarea label="History" rows={2} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
              <Input label="Allergies" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            </div>
          </div>

           <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1 flex items-center gap-2"><AlertTriangle size={14}/> Emergency Contact</h4>
             <div className="grid grid-cols-3 gap-3">
              <Input label="Name" value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} />
              <Input label="Phone" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} />
              <Input label="Relation" value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <div className="flex items-center justify-between">
               <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-2"><Shield size={14}/> Insurance</h4>
               <label className="flex items-center cursor-pointer">
                 <input type="checkbox" className="mr-2" checked={formData.hasInsurance} onChange={e => setFormData({...formData, hasInsurance: e.target.checked})}/>
                 <span className="text-sm text-gray-700">Has Insurance?</span>
               </label>
             </div>
             {formData.hasInsurance && (
               <div className="grid grid-cols-2 gap-3">
                  <Select label="Provider" value={formData.insProvider} onChange={e => setFormData({...formData, insProvider: e.target.value})}>
                    <option value="">Select...</option>
                    {SUDAN_INSURANCE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                  <Input label="Policy #" value={formData.insPolicy} onChange={e => setFormData({...formData, insPolicy: e.target.value})} />
                  <Input label="Expiry" type="date" value={formData.insExpiry} onChange={e => setFormData({...formData, insExpiry: e.target.value})} />
               </div>
             )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>Cancel</Button>
            <Button type="submit">{isEditing ? 'Update Patient' : 'Register Patient'}</Button>
          </div>
        </form>
      </Modal>

      {/* --- View Details Modal (Existing) --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Patient Profile">
        {selectedPatient && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button onClick={() => setViewTab('info')} className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${viewTab === 'info' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Information</button>
              <button onClick={() => setViewTab('records')} className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${viewTab === 'records' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Hospital Records</button>
            </div>

            {viewTab === 'info' ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedPatient.fullName}</h2>
                    <p className="text-sm text-gray-500 font-mono">{selectedPatient.patientId}</p>
                  </div>
                  <Badge color={selectedPatient.type === 'inpatient' ? 'blue' : 'green'}>{selectedPatient.type}</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                  <div><span className="text-gray-500 block">Phone</span> {selectedPatient.phone}</div>
                  <div><span className="text-gray-500 block">Age / Sex</span> {selectedPatient.age} / {selectedPatient.gender}</div>
                  <div><span className="text-gray-500 block">Address</span> {selectedPatient.address}</div>
                  <div><span className="text-gray-500 block">Blood Group</span> {selectedPatient.bloodGroup || 'N/A'}</div>
                </div>

                {selectedPatient.emergencyContact && (
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                    <h5 className="text-xs font-bold text-amber-700 uppercase mb-2">Emergency Contact</h5>
                    <div className="text-sm text-amber-900">
                      <span className="font-semibold">{selectedPatient.emergencyContact.name}</span> ({selectedPatient.emergencyContact.relation})
                      <div className="mt-1">{selectedPatient.emergencyContact.phone}</div>
                    </div>
                  </div>
                )}
                
                <div className="bg-slate-50 p-4 rounded-lg">
                   <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Medical History</h5>
                   <p className="text-sm text-gray-700 mb-2"><span className="font-semibold">Symptoms:</span> {selectedPatient.symptoms || 'None recorded'}</p>
                   <p className="text-sm text-gray-700"><span className="font-semibold">History:</span> {selectedPatient.medicalHistory || 'None recorded'}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-800">Appointment & Activity History</h3>
                <div className="space-y-3">
                  {allAppointments.filter(a => a.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No records found for this patient.</p>
                  ) : (
                    allAppointments.filter(a => a.patientId === selectedPatient.id).map(apt => (
                      <div key={apt.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className={`p-2 rounded-full ${
                             apt.type.includes('Lab') ? 'bg-purple-50 text-purple-600' :
                             apt.type.includes('Nurse') ? 'bg-emerald-50 text-emerald-600' :
                             apt.type.includes('Admission') ? 'bg-orange-50 text-orange-600' :
                             'bg-blue-50 text-blue-600'
                           }`}>
                             {apt.type.includes('Lab') ? <FlaskConical size={16}/> :
                              apt.type.includes('Nurse') ? <Thermometer size={16}/> :
                              apt.type.includes('Admission') ? <Bed size={16}/> :
                              <Calendar size={16}/>}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-gray-800">{new Date(apt.datetime).toLocaleDateString()}</p>
                             <p className="text-xs text-gray-500">{apt.type} with {apt.staffName}</p>
                             {apt.reason && <p className="text-xs text-gray-400 italic mt-0.5">{apt.reason}</p>}
                           </div>
                        </div>
                        <Badge color={apt.status === 'completed' ? 'green' : 'yellow'}>{apt.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
