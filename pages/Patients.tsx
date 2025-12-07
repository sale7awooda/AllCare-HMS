import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Plus, Search, Filter, Phone, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { Patient } from '../types';

export const Patients = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState<Partial<Patient>>({
    fullName: '',
    age: 0,
    phone: '',
    gender: 'male',
    type: 'outpatient',
    address: ''
  });

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
      await api.addPatient(formData as any);
      setIsModalOpen(false);
      loadPatients();
      setFormData({ fullName: '', age: 0, phone: '', gender: 'male', type: 'outpatient', address: '' });
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
              className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age/Gender</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
              ) : filteredPatients.length === 0 ? (
                 <tr><td colSpan={6} className="text-center py-8 text-gray-500">No patients found.</td></tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{patient.patientId}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{patient.fullName}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={12}/> {patient.address}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-2">
                      <Phone size={14} /> {patient.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {patient.age} / <span className="capitalize">{patient.gender}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={patient.type === 'emergency' ? 'red' : patient.type === 'inpatient' ? 'blue' : 'green'}>
                        {patient.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-primary-600 hover:text-primary-900 mr-3">View</button>
                      <button className="text-gray-400 hover:text-gray-600">Edit</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Register New Patient">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input 
            label="Full Name" 
            placeholder="John Doe" 
            required 
            value={formData.fullName} 
            onChange={e => setFormData({...formData, fullName: e.target.value})} 
          />
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <Input 
            label="Phone Number" 
            placeholder="555-0123" 
            required 
            value={formData.phone} 
            onChange={e => setFormData({...formData, phone: e.target.value})} 
          />
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
          
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Register Patient</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
