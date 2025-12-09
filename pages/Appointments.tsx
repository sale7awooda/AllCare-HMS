
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Calendar as CalendarIcon, Clock, User, Lock, 
  ChevronLeft, ChevronRight, MoreVertical, 
  CheckCircle, X, Search, Filter
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, MedicalStaff, User as UserType } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

// Date Helpers
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const isSameDay = (d1: Date, d2: Date) => 
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00'
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-blue-50 text-blue-700 border-blue-100',
    confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-100',
    checked_in: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    in_progress: 'bg-orange-50 text-orange-700 border-orange-100',
    completed: 'bg-green-50 text-green-700 border-green-100',
    cancelled: 'bg-red-50 text-red-700 border-red-100',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${styles[status] || styles.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export const Appointments = () => {
  // Data State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);

  // UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing'>('idle');

  // Form State
  const [formData, setFormData] = useState({
    patientId: '',
    staffId: '',
    date: formatDate(new Date()),
    time: '09:00',
    type: 'Consultation',
    reason: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [apts, pts, stf, user] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getStaff(),
        api.me()
      ]);
      setAppointments(Array.isArray(apts) ? apts : []);
      setPatients(Array.isArray(pts) ? pts : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setCurrentUser(user);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === parseInt(formData.patientId));
    const doctor = staff.find(s => s.id === parseInt(formData.staffId));
    
    if (patient && doctor && formData.date && formData.time) {
      setProcessStatus('processing');
      try {
        await api.createAppointment({
          patientId: patient.id,
          patientName: patient.fullName,
          staffId: doctor.id,
          staffName: doctor.fullName,
          datetime: `${formData.date}T${formData.time}`,
          type: formData.type,
          reason: formData.reason
        });
        await loadData();
        setIsModalOpen(false);
        setFormData({ ...formData, reason: '' }); 
      } catch (e) {
        console.error(e);
      } finally {
        setProcessStatus('idle');
      }
    }
  };

  const handleSlotClick = (staffId: number, time: string) => {
    if (!hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS)) return;
    setFormData({
      ...formData,
      staffId: staffId.toString(),
      date: formatDate(selectedDate),
      time: time
    });
    setIsModalOpen(true);
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a));
      await api.updateAppointmentStatus(id, newStatus);
    } catch (e) {
      console.error(e);
      loadData();
    }
  };

  // --- Filtering Logic ---
  const doctors = useMemo(() => {
    return staff.filter(s => s.type === 'doctor' && (selectedDept === 'all' || s.department === selectedDept));
  }, [staff, selectedDept]);

  const departments = useMemo(() => {
    return Array.from(new Set(staff.filter(s => s.type === 'doctor').map(s => s.department))).filter(Boolean);
  }, [staff]);

  const dailyAppointments = useMemo(() => {
    return appointments.filter(apt => isSameDay(new Date(apt.datetime), selectedDate));
  }, [appointments, selectedDate]);

  const canManageAppointments = hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button 
              onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 font-bold text-slate-800 dark:text-white min-w-[140px] text-center">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <button 
              onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setSelectedDate(new Date())} 
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-2 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select 
            value={selectedDept} 
            onChange={e => setSelectedDept(e.target.value)}
            className="!w-48 !py-2 !text-sm"
          >
            <option value="all">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>

          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              Grid
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              List
            </button>
          </div>

          {canManageAppointments ? (
            <Button size="sm" onClick={() => setIsModalOpen(true)} icon={Plus}>New</Button>
          ) : (
            <Button size="sm" disabled variant="secondary" icon={Lock}>Locked</Button>
          )}
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        
        {viewMode === 'grid' ? (
          <div className="h-full overflow-auto custom-scrollbar">
            <div className="min-w-max">
              {/* Grid Header (Doctors) */}
              <div className="flex sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <div className="w-20 shrink-0 sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-3 flex items-center justify-center font-bold text-xs text-slate-400">
                  TIME
                </div>
                {doctors.map(doc => (
                  <div key={doc.id} className="w-48 shrink-0 p-3 border-r border-slate-100 dark:border-slate-800 text-center">
                    <div className="flex justify-center mb-2">
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold">
                        {doc.fullName.charAt(0)}
                      </div>
                    </div>
                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{doc.fullName}</div>
                    <div className="text-xs text-slate-500 truncate">{doc.specialization}</div>
                  </div>
                ))}
              </div>

              {/* Grid Body (Time Slots) */}
              <div className="relative">
                {TIME_SLOTS.map((time, i) => (
                  <div key={time} className="flex border-b border-slate-100 dark:border-slate-800 h-24 group">
                    {/* Time Label */}
                    <div className="w-20 shrink-0 sticky left-0 z-10 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-2 text-xs font-mono text-slate-400 text-right">
                      {time}
                    </div>

                    {/* Doctor Slots */}
                    {doctors.map(doc => {
                      // Find appointment for this doctor at this time
                      const appointment = dailyAppointments.find(a => 
                        a.staffId === doc.id && 
                        new Date(a.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) === time
                      );

                      return (
                        <div 
                          key={`${doc.id}-${time}`} 
                          className="w-48 shrink-0 border-r border-slate-100 dark:border-slate-800 relative p-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        >
                          {appointment ? (
                            <div 
                              className={`
                                h-full w-full rounded-lg p-2 text-xs border-l-4 shadow-sm flex flex-col justify-between cursor-pointer hover:brightness-95 transition-all
                                ${appointment.type === 'Emergency' ? 'bg-red-50 border-red-500 text-red-900' : 
                                  appointment.status === 'completed' ? 'bg-green-50 border-green-500 text-green-900' :
                                  'bg-blue-50 border-blue-500 text-blue-900'}
                              `}
                              onClick={() => { /* In future: Open edit modal */ }}
                            >
                              <div>
                                <div className="font-bold truncate">{appointment.patientName}</div>
                                <div className="opacity-75 truncate">{appointment.type}</div>
                              </div>
                              <div className="flex justify-between items-center mt-1">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold bg-white/50`}>
                                  {appointment.status.replace('_',' ')}
                                </span>
                                {appointment.status !== 'completed' && appointment.status !== 'cancelled' && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); updateStatus(appointment.id, 'completed'); }}
                                    className="p-1 hover:bg-white/50 rounded text-green-700" title="Complete"
                                  >
                                    <CheckCircle size={14}/>
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="w-full h-full opacity-0 hover:opacity-100 flex items-center justify-center cursor-pointer"
                              onClick={() => handleSlotClick(doc.id, time)}
                            >
                              <div className="bg-primary-50 text-primary-600 p-1.5 rounded-lg">
                                <Plus size={16} />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // LIST VIEW FALLBACK
          <div className="h-full overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Doctor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {dailyAppointments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No appointments for this day.</td></tr>
                ) : (
                  dailyAppointments.map(apt => (
                    <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 dark:text-slate-300">
                         {new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-white">{apt.patientName}</div>
                        <div className="text-xs text-slate-500">#{apt.appointmentNumber}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{apt.staffName}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{apt.type}</td>
                      <td className="px-6 py-4"><StatusBadge status={apt.status} /></td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-primary-600 transition-colors"><MoreVertical size={18}/></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Appointment">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select 
            label="Patient" 
            required
            value={formData.patientId} 
            onChange={e => setFormData({...formData, patientId: e.target.value})}
          >
            <option value="">Select Patient...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>

          <Select 
            label="Doctor" 
            required
            value={formData.staffId} 
            onChange={e => setFormData({...formData, staffId: e.target.value})}
          >
             <option value="">Select Doctor...</option>
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
            <option value="Consultation">Consultation</option>
            <option value="Follow-up">Follow-up</option>
            <option value="Emergency">Emergency</option>
          </Select>

          <Textarea 
            label="Reason / Notes" 
            rows={2}
            value={formData.reason}
            onChange={e => setFormData({...formData, reason: e.target.value})}
          />

          <div className="pt-4 flex justify-end gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={processStatus === 'processing'}>
               {processStatus === 'processing' ? 'Booking...' : 'Book Appointment'}
             </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
