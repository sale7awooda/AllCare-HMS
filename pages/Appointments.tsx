import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Plus, Calendar, Clock, User } from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, MedicalStaff } from '../types';

export const Appointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form
  const [formData, setFormData] = useState({
    patientId: '',
    staffId: '',
    date: '',
    time: '',
    type: 'Consultation'
  });

  const loadData = async () => {
    setLoading(true);
    const [apts, pts, stf] = await Promise.all([
      api.getAppointments(),
      api.getPatients(),
      api.getStaff()
    ]);
    setAppointments(apts);
    setPatients(pts);
    setStaff(stf);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === parseInt(formData.patientId));
    const doctor = staff.find(s => s.id === parseInt(formData.staffId));
    
    if (patient && doctor && formData.date && formData.time) {
      await api.createAppointment({
        patientId: patient.id,
        patientName: patient.fullName,
        staffId: doctor.id,
        staffName: doctor.fullName,
        datetime: `${formData.date}T${formData.time}`,
        type: formData.type
      });
      setIsModalOpen(false);
      loadData();
      setFormData({ patientId: '', staffId: '', date: '', time: '', type: 'Consultation' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus}>Book Appointment</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-3">
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Appt ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Doctor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.map((apt) => (
                    <tr key={apt.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top">{apt.appointmentNumber}</td>
                      <td className="px-6 py-4 align-top">
                         <div className="text-sm text-gray-900 font-medium break-words">{apt.patientName}</div>
                      </td>
                      <td className="px-6 py-4 align-top">
                        <div className="text-sm text-gray-500 break-words">{apt.staffName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 align-top whitespace-nowrap">
                        {new Date(apt.datetime).toLocaleDateString()} <span className="text-gray-400">|</span> {new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </td>
                      <td className="px-6 py-4 align-top whitespace-nowrap">
                         <Badge color={apt.status === 'confirmed' ? 'green' : apt.status === 'cancelled' ? 'red' : 'yellow'}>{apt.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-right text-sm align-top whitespace-nowrap">
                        {apt.status === 'pending' && (
                          <button 
                            onClick={() => { api.updateAppointmentStatus(apt.id, 'confirmed'); loadData(); }}
                            className="text-green-600 hover:text-green-800 font-medium mr-2"
                          >
                            Confirm
                          </button>
                        )}
                         <button className="text-gray-400 hover:text-gray-600">Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Appointment">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select 
            label="Select Patient" 
            required
            value={formData.patientId} 
            onChange={e => setFormData({...formData, patientId: e.target.value})}
          >
            <option value="">Select a patient...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientId})</option>)}
          </Select>

          <Select 
            label="Select Doctor" 
            required
            value={formData.staffId} 
            onChange={e => setFormData({...formData, staffId: e.target.value})}
          >
             <option value="">Select a doctor...</option>
             {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName} - {s.specialization}</option>)}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Date" 
              type="date" 
              required
              value={formData.date}
              onChange={e => setFormData({...formData, date: e.target.value})}
            />
            <Input 
              label="Time" 
              type="time" 
              required
              value={formData.time}
              onChange={e => setFormData({...formData, time: e.target.value})}
            />
          </div>

          <Select 
            label="Type" 
            value={formData.type} 
            onChange={e => setFormData({...formData, type: e.target.value})}
          >
            <option value="Consultation">General Consultation</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Emergency">Emergency</option>
            <option value="Lab">Lab Test</option>
          </Select>

          <div className="pt-4 flex justify-end gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
             <Button type="submit">Schedule</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};