import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Plus, Search, Filter, Mail, Phone, Briefcase, Lock } from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, User } from '../types';
import { hasPermission, Permissions } from '../utils/rbac'; // Import Permissions

export const Staff = () => { // This component is now HR Management
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState<Partial<MedicalStaff>>({
    fullName: '',
    type: 'doctor', // Default type
    department: '',
    specialization: '',
    consultationFee: 0,
    email: '',
    phone: '',
    isAvailable: true
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, user] = await Promise.all([
        api.getStaff(), // This now maps to /api/hr
        api.me()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setCurrentUser(user);
    } catch (e) {
      console.error("Failed to load staff/HR data:", e);
      setStaff([]); // Ensure staff is an array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fullName && formData.type) {
      try {
        await api.addStaff(formData as any); // This now maps to /api/hr
        setIsModalOpen(false);
        loadData();
        setFormData({ 
          fullName: '', type: 'doctor', department: '', 
          specialization: '', consultationFee: 0, email: '', phone: '', isAvailable: true 
        });
      } catch (err: any) {
        console.error("Failed to add staff:", err);
        alert(err.response?.data?.error || "Failed to add staff member.");
      }
    }
  };

  const toggleAvailability = async (id: number, currentStatus: boolean) => {
    if (!canManageHR) return; // Use new permission
    try {
      await api.updateStaff(id, { isAvailable: !currentStatus }); // This now maps to /api/hr
      loadData();
    } catch (err: any) {
      console.error("Failed to update staff availability:", err);
      alert(err.response?.data?.error || "Failed to update availability.");
    }
  };

  const filteredStaff = staff.filter(s => {
    const matchesSearch = s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.employeeId && s.employeeId.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesFilter = filterType === 'all' || s.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const canManageHR = hasPermission(currentUser, Permissions.MANAGE_HR); // New permission check

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">HR Management (Medical Staff)</h1> {/* Updated title */}
        {canManageHR ? (
          <Button onClick={() => setIsModalOpen(true)} icon={Plus}>Add Staff Member</Button>
        ) : (
          <Button 
            disabled 
            className="opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200" 
            variant="secondary"
            icon={Lock}
          >
            Add Staff Member
          </Button>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search staff by name or ID..." 
              className="pl-10 w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 text-slate-900 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="technician">Technician</option>
              <option value="anesthesiologist">Anesthesiologist</option> 
              <option value="medical_assistant">Medical Assistant</option>
              <option value="pharmacist">Pharmacist</option> 
              <option value="admin_staff">Admin Staff</option>
              <option value="hr_manager">HR Manager</option>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Role/Dept</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Fee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Availability</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
              ) : filteredStaff.length === 0 ? (
                 <tr><td colSpan={6} className="text-center py-8 text-gray-500">No staff members found.</td></tr>
              ) : (
                filteredStaff.map((person) => (
                  <tr key={person.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold mt-1 shadow-sm">
                          {person.fullName.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-bold text-gray-900 break-words leading-tight">{person.fullName}</div>
                          <div className="text-xs text-gray-500 whitespace-nowrap font-mono">{person.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm text-gray-900 capitalize font-medium">{person.type}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 break-words">
                        <Briefcase size={12} className="shrink-0 text-gray-400"/> {person.department}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col gap-1">
                        {person.email && (
                          <div className="flex items-center text-xs text-gray-500 break-words">
                            <Mail size={12} className="mr-1.5 shrink-0 text-gray-400"/> 
                            <span className="truncate max-w-[150px]">{person.email}</span>
                          </div>
                        )}
                        {person.phone && (
                          <div className="flex items-center text-xs text-gray-500 whitespace-nowrap">
                            <Phone size={12} className="mr-1.5 shrink-0 text-gray-400"/> {person.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 align-top whitespace-nowrap font-medium">
                      ${person.consultationFee}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <button 
                        onClick={() => toggleAvailability(person.id, person.isAvailable)}
                        disabled={!canManageHR}
                        className={`group relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${person.isAvailable ? 'bg-emerald-500' : 'bg-gray-300'} ${!canManageHR ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${person.isAvailable ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium align-top whitespace-nowrap">
                      {canManageHR && ( 
                        <button className="text-primary-600 hover:text-primary-900 transition-colors">Edit</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Staff Member">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input 
            label="Full Name" 
            placeholder="Dr. John Smith" 
            required 
            value={formData.fullName} 
            onChange={e => setFormData({...formData, fullName: e.target.value})} 
          />
          
          <div className="grid grid-cols-2 gap-4">
             <Select 
              label="Role" 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value as any})}
            >
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="technician">Technician</option>
              <option value="anesthesiologist">Anesthesiologist</option> 
              <option value="medical_assistant">Medical Assistant</option>
              <option value="pharmacist">Pharmacist</option> 
              <option value="admin_staff">Admin Staff</option>
              <option value="hr_manager">HR Manager</option>
            </Select>
            <Input 
              label="Department" 
              placeholder="Cardiology" 
              required 
              value={formData.department} 
              onChange={e => setFormData({...formData, department: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Specialization" 
              placeholder="Surgeon" 
              value={formData.specialization} 
              onChange={e => setFormData({...formData, specialization: e.target.value})} 
            />
            <Input 
              label="Consultation Fee ($)" 
              type="number" 
              value={formData.consultationFee} 
              onChange={e => setFormData({...formData, consultationFee: parseFloat(e.target.value || '0'))} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Email" 
              type="email"
              placeholder="email@allcare.com" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
            />
            <Input 
              label="Phone" 
              placeholder="555-0000" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Member</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};