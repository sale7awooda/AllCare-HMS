import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { Plus, Search, Filter, Phone, MapPin, Heart, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { Patient, EmergencyContact, InsuranceDetails } from '../types';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // SUDAN INSURANCE PROVIDERS
  const SUDAN_INSURANCE_PROVIDERS = [
    "Shiekan Insurance",
    "The United Insurance",
    "Blue Nile Insurance",
    "Al-Salama Insurance",
    "Juba Insurance",
    "Prime Health",
    "Wataniya Insurance",
    "General Insurance"
  ];

  // Form State
  const initialFormState: Partial<Patient> & { 
    emergencyName?: string, emergencyPhone?: string, emergencyRelation?: string,
    insProvider?: string, insPolicy?: string, insExpiry?: string, insNotes?: string
  } = {
    fullName: '',
    age: 0,
    phone: '',
    gender: 'male',
    type: 'outpatient',
    address: '',
    symptoms: '',
    medicalHistory: '',
    allergies: '',
    bloodGroup: '',
    hasInsurance: false,
    
    // Flattened states for sub-objects to make binding easier
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    
    insProvider: '',
    insPolicy: '',
    insExpiry: '',
    insNotes: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const loadPatients = async () => {
    setLoading(true);
    const data = await api.getPatients();
    setPatients(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fullName && formData.phone) {
      
      // Construct nested objects
      const emergencyContact: EmergencyContact | undefined = formData.emergencyName ? {
        name: formData.emergencyName,
        phone: formData.emergencyPhone || '',
        relation: formData.emergencyRelation || ''
      } : undefined;

      const insuranceDetails: InsuranceDetails | undefined = formData.hasInsurance ? {
        provider: formData.insProvider || '',
        policyNumber: formData.insPolicy || '',
        expiryDate: formData.insExpiry || '',
        notes: formData.insNotes
      } : undefined;

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
        emergencyContact,
        insuranceDetails
      };

      await api.addPatient(payload as any);
      setIsModalOpen(false);
      loadPatients();
      setFormData(initialFormState);
    }
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.patientId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus}>Register Patient</Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
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
          <Button variant="outline" icon={Filter}>Filters</Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-1/4">Patient Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Age/Gender</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
              ) : filteredPatients.length === 0 ? (
                 <tr><td colSpan={6} className="text-center py-8 text-gray-500">No patients found.</td></tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 align-top whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{patient.patientId}</span>
                      {patient.hasInsurance && (
                        <div className="mt-1">
                          <Badge color="blue">Insured</Badge>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-bold text-gray-900 break-words leading-tight">{patient.fullName}</div>
                      <div className="text-xs text-gray-500 flex items-start gap-1 mt-1 break-words leading-tight">
                        <MapPin size={12} className="shrink-0 mt-0.5 text-gray-400"/> {patient.address}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Phone size={13} className="text-gray-400"/> 
                        <span className="font-medium text-gray-700">{patient.phone}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 align-top whitespace-nowrap">
                      {patient.age} <span className="text-gray-400 mx-1">/</span> <span className="capitalize">{patient.gender}</span>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <Badge color={patient.type === 'emergency' ? 'red' : patient.type === 'inpatient' ? 'blue' : 'green'}>
                        {patient.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium align-top whitespace-nowrap">
                      <button className="text-primary-600 hover:text-primary-900 mr-3 transition-colors">View</button>
                      <button className="text-gray-400 hover:text-gray-600 transition-colors">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Patient">
        <form onSubmit={handleCreate} className="space-y-6">
          
          {/* Section: Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Full Name" 
                placeholder="Full Name" 
                required 
                value={formData.fullName} 
                onChange={e => setFormData({...formData, fullName: e.target.value})} 
              />
               <Input 
                label="Phone Number" 
                placeholder="555-0123" 
                required 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <Input 
                label="Age" 
                type="number" 
                required 
                value={formData.age} 
                onChange={e => setFormData({...formData, age: parseInt(e.target.value)})} 
              />
              <Select 
                label="Gender" 
                value={formData.gender} 
                onChange={e => setFormData({...formData, gender: e.target.value as any})}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
               <Select 
                label="Blood Group" 
                value={formData.bloodGroup} 
                onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
              >
                <option value="">Unknown</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input 
                label="Address" 
                placeholder="123 Main St" 
                required 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})} 
              />
              <Select 
                label="Patient Type" 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as any})}
              >
                <option value="outpatient">Outpatient</option>
                <option value="inpatient">Inpatient</option>
                <option value="emergency">Emergency</option>
              </Select>
            </div>
          </div>

          {/* Section: Medical Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 flex items-center gap-2">
              <Heart size={16} className="text-primary-600"/> Medical Details
            </h4>
            <div className="grid grid-cols-1 gap-4">
               <Textarea 
                label="Presenting Symptoms" 
                placeholder="e.g. Fever, Headache..." 
                rows={2}
                value={formData.symptoms} 
                onChange={e => setFormData({...formData, symptoms: e.target.value})} 
              />
              <Textarea 
                label="Medical History" 
                placeholder="Chronic diseases, past surgeries..." 
                rows={2}
                value={formData.medicalHistory} 
                onChange={e => setFormData({...formData, medicalHistory: e.target.value})} 
              />
              <Input 
                label="Allergies" 
                placeholder="e.g. Penicillin, Peanuts (Comma separated)" 
                value={formData.allergies} 
                onChange={e => setFormData({...formData, allergies: e.target.value})} 
              />
            </div>
          </div>

          {/* Section: Emergency Contact */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-100 pb-2 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500"/> Emergency Contact
            </h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input 
                label="Contact Name" 
                placeholder="Relative Name" 
                value={formData.emergencyName} 
                onChange={e => setFormData({...formData, emergencyName: e.target.value})} 
              />
              <Input 
                label="Phone" 
                placeholder="Emergency Phone" 
                value={formData.emergencyPhone} 
                onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} 
              />
               <Input 
                label="Relation" 
                placeholder="e.g. Brother" 
                value={formData.emergencyRelation} 
                onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} 
              />
            </div>
          </div>

          {/* Section: Insurance */}
          <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between">
               <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Shield size={16} className="text-primary-600"/> Insurance Info
              </h4>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={formData.hasInsurance} 
                    onChange={e => setFormData({...formData, hasInsurance: e.target.checked})}
                  />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${formData.hasInsurance ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.hasInsurance ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <div className="ml-3 text-sm font-medium text-gray-700">Has Insurance?</div>
              </label>
            </div>

            {formData.hasInsurance && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Select 
                  label="Insurance Provider" 
                  value={formData.insProvider} 
                  onChange={e => setFormData({...formData, insProvider: e.target.value})}
                >
                  <option value="">Select Provider</option>
                  {SUDAN_INSURANCE_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </Select>
                <Input 
                  label="Policy Number" 
                  placeholder="POL-XXXXX" 
                  value={formData.insPolicy} 
                  onChange={e => setFormData({...formData, insPolicy: e.target.value})} 
                />
                <Input 
                  label="Expiry Date" 
                  type="date"
                  value={formData.insExpiry} 
                  onChange={e => setFormData({...formData, insExpiry: e.target.value})} 
                />
                <Input 
                  label="Notes" 
                  placeholder="Coverage limits, etc." 
                  value={formData.insNotes} 
                  onChange={e => setFormData({...formData, insNotes: e.target.value})} 
                />
              </div>
            )}
          </div>
          
          <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white pb-2 border-t border-slate-100 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Register Patient</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};