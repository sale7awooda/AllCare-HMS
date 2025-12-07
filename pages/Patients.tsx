import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { Plus, Search, Filter, Heart, Shield, AlertTriangle, Edit, Eye, Calendar } from 'lucide-react';
import { api } from '../services/api';
import { Patient, EmergencyContact, InsuranceDetails, Appointment } from '../types';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewTab, setViewTab] = useState<'info' | 'records'>('info');
  const [isEditing, setIsEditing] = useState(false);

  // SUDAN INSURANCE PROVIDERS
  const SUDAN_INSURANCE_PROVIDERS = [
    "Shiekan Insurance", "The United Insurance", "Blue Nile Insurance",
    "Al-Salama Insurance", "Juba Insurance", "Prime Health",
    "Wataniya Insurance", "General Insurance"
  ];

  // Form State
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
    const [pts, apts] = await Promise.all([api.getPatients(), api.getAppointments()]);
    setPatients(pts);
    setAllAppointments(apts);
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
    // Fetch full details (in case list view is simplified)
    const fullDetails = await api.getPatient(patient.id);
    
    // Map to form state
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

  const openViewModal = async (patient: Patient) => {
    const fullDetails = await api.getPatient(patient.id);
    setSelectedPatient(fullDetails);
    setViewTab('info');
    setIsViewModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

  // --- Filtering ---
  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    const matchesGender = filterGender === 'all' || p.gender === filterGender;
    return matchesSearch && matchesType && matchesGender;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
        <Button onClick={openCreateModal} icon={Plus}>Register Patient</Button>
      </div>

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
            <Button 
              variant={showFilters ? 'primary' : 'outline'} 
              icon={Filter} 
              onClick={() => setShowFilters(!showFilters)}
            >
              Filter
            </Button>
          </div>
          
          {/* Collapsible Filter Bar */}
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">ID</th>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap w-1/5">Patient Name</th>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Address</th>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Phone</th>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Age/Sex</th>
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Type</th>
                <th className="px-2 py-3 text-right text-xs font-bold text-gray-500 uppercase whitespace-nowrap">Actions</th>
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
                    {/* ID */}
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">{patient.patientId}</span>
                      {patient.hasInsurance && (
                        <div className="mt-1"><Badge color="blue">Insured</Badge></div>
                      )}
                    </td>
                    
                    {/* Name (Address removed from here) */}
                    <td className="px-2 py-2 align-top">
                      <div className="font-bold text-gray-900 break-words leading-tight">{patient.fullName}</div>
                    </td>

                    {/* Address Column (New) */}
                    <td className="px-2 py-2 align-top">
                      <div className="text-gray-600 text-xs break-words max-w-[150px] leading-tight">
                         {patient.address}
                      </div>
                    </td>

                    {/* Phone (Icon removed) */}
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <span className="font-medium text-gray-700">{patient.phone}</span>
                    </td>

                    {/* Age/Gender */}
                    <td className="px-2 py-2 align-top whitespace-nowrap text-gray-700">
                      {patient.age} / <span className="capitalize">{patient.gender}</span>
                    </td>

                    {/* Type */}
                    <td className="px-2 py-2 align-top whitespace-nowrap">
                      <Badge color={patient.type === 'emergency' ? 'red' : patient.type === 'inpatient' ? 'blue' : 'green'}>
                        {patient.type}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2 text-right align-top whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openViewModal(patient)} 
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" 
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => openEditModal(patient)} 
                          className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" 
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* --- Create/Edit Modal --- */}
      <Modal 
        isOpen={isFormModalOpen} 
        onClose={() => setIsFormModalOpen(false)} 
        title={isEditing ? "Edit Patient Details" : "Register New Patient"}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Reusing existing form layout from previous implementation */}
          {/* Basic Info */}
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

          {/* Medical Info */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100 pb-1 flex items-center gap-2"><Heart size={14}/> Medical History</h4>
            <div className="grid grid-cols-1 gap-3">
              <Textarea label="Symptoms" rows={2} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} />
              <Textarea label="History" rows={2} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} />
              <Input label="Allergies" value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} />
            </div>
          </div>

          {/* Emergency & Insurance (Simplified for brevity in this response, assumed same as previous) */}
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

      {/* --- View Details Modal --- */}
      <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Patient Profile">
        {selectedPatient && (
          <div className="space-y-6">
            {/* Header / Tabs */}
            <div className="flex items-center gap-4 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setViewTab('info')}
                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${viewTab === 'info' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Information
              </button>
              <button 
                onClick={() => setViewTab('records')}
                className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-all ${viewTab === 'records' ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Hospital Records
              </button>
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
                <h3 className="text-lg font-bold text-gray-800">Appointment History</h3>
                <div className="space-y-3">
                  {allAppointments.filter(a => a.patientId === selectedPatient.id).length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No records found for this patient.</p>
                  ) : (
                    allAppointments.filter(a => a.patientId === selectedPatient.id).map(apt => (
                      <div key={apt.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-50 text-blue-600 rounded-full"><Calendar size={16}/></div>
                           <div>
                             <p className="text-sm font-bold text-gray-800">{new Date(apt.datetime).toLocaleDateString()}</p>
                             <p className="text-xs text-gray-500">{apt.type} with {apt.staffName}</p>
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