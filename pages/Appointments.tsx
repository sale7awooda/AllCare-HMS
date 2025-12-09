
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Calendar as CalendarIcon, Clock, User, Lock, 
  ChevronLeft, ChevronRight, MoreVertical, 
  CheckCircle, X, Search, Filter, Play, DollarSign, LayoutGrid, List
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

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200', // Unpaid
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200', // Paid/Waiting
    waiting: 'bg-blue-50 text-blue-700 border-blue-200',
    checked_in: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    in_progress: 'bg-green-50 text-green-700 border-green-200 animate-pulse',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };
  
  const labels: Record<string, string> = {
    pending: 'Payment Pending',
    confirmed: 'In Queue',
    waiting: 'In Queue',
    checked_in: 'Ready',
    in_progress: 'In Consultation',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${styles[status] || styles.pending}`}>
      {labels[status] || status.replace('_', ' ')}
    </span>
  );
};

interface DoctorQueueColumnProps {
  doctor: MedicalStaff;
  appointments: Appointment[];
  onStatusUpdate: (id: number, status: string) => void;
}

const DoctorQueueColumn: React.FC<DoctorQueueColumnProps> = ({ doctor, appointments, onStatusUpdate }) => {
  // 1. Separate Active vs Waiting
  const activePatient = appointments.find(a => a.status === 'in_progress');
  
  // Queue: pending, confirmed, checked_in, waiting
  // Exclude completed/cancelled from the main queue view to keep it clean
  const queue = appointments.filter(a => 
    ['pending', 'confirmed', 'checked_in', 'waiting'].includes(a.status)
  );

  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 h-full overflow-hidden">
      {/* Column Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
            {doctor.fullName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white truncate w-48" title={doctor.fullName}>{doctor.fullName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{doctor.specialization}</p>
          </div>
        </div>
        <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
          <span>In Queue: <strong className="text-slate-800 dark:text-white">{queue.length}</strong></span>
          <span>Done: <strong className="text-slate-800 dark:text-white">{completedCount}</strong></span>
        </div>
      </div>

      {/* Scrollable Queue Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        
        {/* Active Slot */}
        {activePatient ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-green-500 border border-slate-200 dark:border-slate-700 shadow-md p-4 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Current Patient
              </span>
              <span className="font-mono text-xs text-slate-400">#{activePatient.appointmentNumber.slice(-4)}</span>
            </div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{activePatient.patientName}</h4>
            <p className="text-xs text-slate-500 mb-3">{activePatient.type} • {new Date(activePatient.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="w-full bg-green-600 hover:bg-green-700 text-white border-none"
                onClick={() => onStatusUpdate(activePatient.id, 'completed')}
                icon={CheckCircle}
              >
                Complete
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 h-24 bg-slate-50/50 dark:bg-slate-900/20">
            <User size={20} className="mb-1 opacity-50"/>
            <span className="text-xs font-medium">No patient in room</span>
          </div>
        )}

        {/* Waiting List */}
        {queue.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 pl-1">Up Next ({queue.length})</h5>
            {queue.map((apt, index) => {
              const isNext = index === 0;
              const isPaid = apt.status !== 'pending'; // Assuming pending means unpaid in this workflow

              return (
                <div 
                  key={apt.id} 
                  className={`
                    bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm transition-all relative group
                    ${isNext ? 'border-primary-200 dark:border-primary-900' : 'border-slate-100 dark:border-slate-700 opacity-90'}
                  `}
                >
                  <div className="absolute top-3 right-3 font-mono text-xs font-bold text-slate-300">
                    #{index + 1}
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${isPaid ? 'bg-blue-500' : 'bg-yellow-500'}`}></div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{apt.patientName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={apt.status} />
                        <span className="text-[10px] text-slate-400">{new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-50 dark:border-slate-700 flex justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isPaid && (
                       <Button 
                         size="sm" 
                         variant="outline" 
                         className="h-7 text-xs px-2 text-yellow-700 border-yellow-200 bg-yellow-50 hover:bg-yellow-100"
                         onClick={() => onStatusUpdate(apt.id, 'confirmed')}
                         icon={DollarSign}
                       >
                         Pay
                       </Button>
                    )}
                    {isPaid && !activePatient && isNext && (
                      <Button 
                        size="sm" 
                        className="h-7 text-xs px-2"
                        onClick={() => onStatusUpdate(apt.id, 'in_progress')}
                        icon={Play}
                      >
                        Start
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-400"
                      title="Cancel"
                      onClick={() => onStatusUpdate(apt.id, 'cancelled')}
                    >
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing'>('idle');

  // Form State
  const [formData, setFormData] = useState({
    patientId: '',
    staffId: '',
    date: formatDate(new Date()),
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), // Default to now
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
    
    if (patient && doctor && formData.date) {
      setProcessStatus('processing');
      try {
        // For Walk-ins, we default status to 'pending' (if unpaid) or 'confirmed' (if paid).
        // Standard flow: Book -> Pending -> Pay -> Confirmed -> In Progress -> Completed
        await api.createAppointment({
          patientId: patient.id,
          patientName: patient.fullName,
          staffId: doctor.id,
          staffName: doctor.fullName,
          datetime: `${formData.date}T${formData.time}`,
          type: formData.type,
          reason: formData.reason,
          status: 'pending' // Starts as pending payment
        });
        await loadData();
        setIsModalOpen(false);
        setFormData({ ...formData, reason: '', patientId: '', staffId: '' }); 
      } catch (e) {
        console.error(e);
      } finally {
        setProcessStatus('idle');
      }
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      // Optimistic update
      setAppointments(prev => prev.map(a => a.id === id ? { ...a, status: newStatus as any } : a));
      
      // Special Logic: If moving to 'in_progress', check if doctor already has an active patient?
      // For simplicity, we allow it, but UI highlights the top one.
      
      await api.updateAppointmentStatus(id, newStatus);
      
      // If completing, maybe reload to ensure billing/history sync
      if (newStatus === 'completed') {
        setTimeout(loadData, 500); 
      }
    } catch (e) {
      console.error(e);
      loadData(); // Revert on error
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
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0,0,0,0);
    
    // Filter by date
    const filtered = appointments.filter(apt => isSameDay(new Date(apt.datetime), selectedDate));
    
    // Sort by Creation Time (ID proxy) to simulate FIFO Arrival
    return filtered.sort((a, b) => a.id - b.id);
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
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-2 rounded-lg transition-colors hidden sm:block"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Select 
            value={selectedDept} 
            onChange={e => setSelectedDept(e.target.value)}
            className="!w-40 !py-2 !text-sm"
          >
            <option value="all">All Depts</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>

          <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('board')}
              title="Queue Board"
              className={`p-2 rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-slate-500'}`}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary-600 dark:text-white' : 'text-slate-500'}`}
            >
              <List size={18} />
            </button>
          </div>

          {canManageAppointments ? (
            <Button size="sm" onClick={() => setIsModalOpen(true)} icon={Plus}>Walk-In</Button>
          ) : (
            <Button size="sm" disabled variant="secondary" icon={Lock}>Locked</Button>
          )}
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        
        {viewMode === 'board' ? (
          <div className="h-full overflow-x-auto overflow-y-hidden p-4 bg-slate-50/50 dark:bg-slate-900/20">
            {doctors.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">No doctors scheduled.</div>
            ) : (
              <div className="flex gap-4 h-full min-w-max">
                {doctors.map(doc => (
                  <DoctorQueueColumn 
                    key={doc.id} 
                    doctor={doc} 
                    appointments={dailyAppointments.filter(a => a.staffId === doc.id)}
                    onStatusUpdate={updateStatus} 
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // LIST VIEW FALLBACK (Standard Table)
          <div className="h-full overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Token / Time</th>
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
                  dailyAppointments.map((apt, idx) => (
                    <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-slate-600 dark:text-slate-300">
                         #{idx + 1} <span className="text-slate-400 text-xs ml-1">({new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
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

      {/* CREATE MODAL (Walk-In Optimized) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Walk-In Appointment">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm border border-blue-100 flex gap-2">
            <Clock size={16} className="shrink-0 mt-0.5" />
            <p>This will be added to the queue immediately as a <strong>Walk-in</strong>.</p>
          </div>

          <Select 
            label="Patient" 
            required
            value={formData.patientId} 
            onChange={e => setFormData({...formData, patientId: e.target.value})}
          >
            <option value="">Select Patient...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientId})</option>)}
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
            <Select 
              label="Type" 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="Consultation">Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Emergency">Emergency</option>
            </Select>
            
            {/* Read-only date/time to confirm queue position */}
            <div className="opacity-70">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Booking Time</label>
                <div className="w-full rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 py-2.5 px-4 text-sm text-slate-600 dark:text-slate-300">
                    Now ({new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                </div>
            </div>
          </div>

          <Textarea 
            label="Reason / Symptoms" 
            rows={2}
            value={formData.reason}
            onChange={e => setFormData({...formData, reason: e.target.value})}
          />

          <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={processStatus === 'processing'}>
               {processStatus === 'processing' ? 'Booking...' : 'Add to Queue'}
             </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
