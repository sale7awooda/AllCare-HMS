import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Calendar as CalendarIcon, Clock, User, Lock, 
  ChevronLeft, ChevronRight, MoreVertical, 
  CheckCircle, X, Search, Filter, Play, DollarSign, LayoutGrid, List as ListIcon, Edit
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
    pending: 'Unpaid',
    confirmed: 'In Queue',
    waiting: 'In Queue',
    checked_in: 'Ready',
    in_progress: 'In Consultation',
    completed: 'Completed',
    cancelled: 'Cancelled'
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${styles[status] || styles.pending}`}>
      {labels[status] || status.replace('_', ' ')}
    </span>
  );
};

interface DoctorQueueColumnProps {
  doctor: MedicalStaff;
  appointments: Appointment[];
  onStatusUpdate: (id: number, status: string) => void;
  onCancel: (id: number) => void;
}

const DoctorQueueColumn: React.FC<DoctorQueueColumnProps> = ({ doctor, appointments, onStatusUpdate, onCancel }) => {
  // 1. Separate Active vs Waiting
  const activePatient = appointments.find(a => a.status === 'in_progress');
  
  // Queue: pending, confirmed, checked_in, waiting
  // The parent component 'dailyAppointments' logic already sorts these by Priority (Paid > Unpaid) then FIFO
  const queue = appointments.filter(a => 
    ['pending', 'confirmed', 'checked_in', 'waiting'].includes(a.status)
  );

  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 h-full overflow-hidden">
      {/* Column Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-lg shadow-sm border border-slate-200 dark:border-slate-600 ${doctor.type === 'nurse' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'}`}>
            {doctor.fullName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 dark:text-white truncate" title={doctor.fullName}>{doctor.fullName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{doctor.type === 'nurse' ? 'Nurse' : doctor.specialization}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
             <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Waiting</span>
             <span className="text-lg font-bold text-blue-800 dark:text-blue-300">{queue.length}</span>
          </div>
          <div className="flex flex-col items-center bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800">
             <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">Done</span>
             <span className="text-lg font-bold text-green-800 dark:text-green-300">{completedCount}</span>
          </div>
        </div>
      </div>

      {/* Scrollable Queue Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50 dark:bg-slate-950/30">
        
        {/* Active Slot */}
        {activePatient ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-green-500 border border-slate-200 dark:border-slate-700 shadow-md p-4 animate-in fade-in zoom-in-95 duration-300 ring-4 ring-green-500/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-green-100 dark:border-green-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Now Seeing
              </span>
              <span className="font-mono text-xs text-slate-400">#{activePatient.appointmentNumber.slice(-4)}</span>
            </div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1 truncate">{activePatient.patientName}</h4>
            <p className="text-xs text-slate-500 mb-3">{activePatient.type} • {new Date(activePatient.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            {/* Show nurse service reason if available */}
            {doctor.type === 'nurse' && activePatient.reason && (
                <p className="text-xs text-slate-500 italic bg-slate-50 p-1 rounded mb-3">{activePatient.reason}</p>
            )}
            
            <Button 
              size="sm" 
              className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-green-200 dark:shadow-none"
              onClick={() => onStatusUpdate(activePatient.id, 'completed')}
              icon={CheckCircle}
            >
              Complete Visit
            </Button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 h-28 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
               <User size={20} className="opacity-50"/>
            </div>
            <span className="text-xs font-medium">Room Empty</span>
          </div>
        )}

        {/* Waiting List */}
        {queue.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 pl-1 flex justify-between items-end">
                <span>Up Next</span>
                <span className="text-[10px] font-normal bg-slate-200 dark:bg-slate-700 px-1.5 rounded-md text-slate-600 dark:text-slate-300">Sorted by Payment & Time</span>
            </h5>
            {queue.map((apt, index) => {
              const isPaid = apt.status !== 'pending'; // Assuming pending means unpaid in this workflow
              
              // Only the TOP PAID patient can be started. Unpaid patients (even if at top) cannot be started in strict mode, but here we allow actions based on status.
              // Logic: If I am #1, or if everyone above me is unpaid and I am paid (which shouldn't happen with our sort), or everyone above is waiting.
              // Simplified: You can start the top card if it's paid.
              const isNextCallable = index === 0 && isPaid; 

              return (
                <div 
                  key={apt.id} 
                  className={`
                    bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm transition-all relative group hover:border-primary-200 dark:hover:border-primary-800
                    ${isNextCallable ? 'border-l-4 border-l-blue-500' : 'border-slate-100 dark:border-slate-700'}
                    ${!isPaid ? 'opacity-80 bg-yellow-50/30 dark:bg-yellow-900/10' : ''}
                  `}
                >
                  <div className="absolute top-3 right-3 font-mono text-xs font-bold text-slate-300">
                    #{index + 1}
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isPaid ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'bg-yellow-500 animate-pulse'}`}></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{apt.patientName}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={apt.status} />
                        <span className="text-[10px] text-slate-400">{new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      {/* Show nurse service reason if available */}
                      {doctor.type === 'nurse' && apt.reason && (
                        <p className="text-[10px] text-slate-500 italic mt-1 truncate">{apt.reason}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-50 dark:border-slate-700 flex justify-end gap-2">
                    {!isPaid && (
                       <Button 
                         size="sm" 
                         variant="outline" 
                         className="h-7 text-xs px-2 text-yellow-700 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400"
                         onClick={() => onStatusUpdate(apt.id, 'confirmed')}
                         icon={DollarSign}
                       >
                         Pay
                       </Button>
                    )}
                    
                    {/* Show Start button only if paid. If not active patient, highlight the first one. */}
                    {isPaid && !activePatient && (
                      <Button 
                        size="sm" 
                        className={`h-7 text-xs px-3 ${!isNextCallable ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600' : ''}`}
                        onClick={() => onStatusUpdate(apt.id, 'in_progress')}
                        icon={Play}
                        disabled={!isNextCallable} // Enforce queue order for starting
                        title={!isNextCallable ? "Complete the top patient first" : "Start Consultation"}
                      >
                        Start
                      </Button>
                    )}
                    
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      title="Cancel"
                      onClick={() => onCancel(apt.id)}
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
  const [viewMode, setViewMode] = useState<'queue' | 'list'>('queue');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing'>('idle');

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

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
      await api.updateAppointmentStatus(id, newStatus);
      // If completing, reload to ensure billing/history sync
      if (newStatus === 'completed') {
        setTimeout(loadData, 500); 
      }
    } catch (e) {
      console.error(e);
      loadData(); // Revert on error
    }
  };

  const handleCancel = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Cancel Appointment',
      message: 'Are you sure you want to cancel this appointment?',
      action: () => updateStatus(id, 'cancelled')
    });
  };

  // --- Filtering & Sorting Logic ---
  
  // Helper for Queue Priority
  const getQueuePriority = (status: string) => {
    switch(status) {
      case 'in_progress': return 0; // Active is always top
      case 'checked_in': return 1;  // Ready
      case 'waiting': return 1;     // Ready
      case 'confirmed': return 1;   // Paid (Ready)
      case 'pending': return 2;     // Unpaid (Lower priority)
      default: return 3;            // History (completed/cancelled)
    }
  };

  const doctors = useMemo(() => {
    // Include active doctors and nurses in the queue view
    return staff.filter(s => 
      s.status === 'active' &&
      (s.type === 'doctor' || s.type === 'nurse') && 
      (selectedDept === 'all' || s.department === selectedDept)
    );
  }, [staff, selectedDept]);

  const departments = useMemo(() => {
    return Array.from(new Set(staff.filter(s => s.type === 'doctor' || s.type === 'nurse').map(s => s.department))).filter(Boolean);
  }, [staff]);

  const dailyAppointments = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0,0,0,0);
    
    // 1. Filter by date
    const filtered = appointments.filter(apt => isSameDay(new Date(apt.datetime), selectedDate));
    
    // 2. Sort by Priority (Paid > Unpaid), then by ID (FIFO)
    return filtered.sort((a, b) => {
      const pA = getQueuePriority(a.status);
      const pB = getQueuePriority(b.status);
      
      if (pA !== pB) return pA - pB; // Primary sort by priority group
      return a.id - b.id; // Secondary sort by FIFO (ID/Time)
    });
  }, [appointments, selectedDate]);

  const canManageAppointments = hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      
      {/* HEADER & CONTROLS - REARRANGED */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shrink-0 bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        
        {/* Left: Date Navigation */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1 shadow-inner">
            <button 
              onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all text-slate-500 dark:text-slate-300 hover:shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-3 font-bold text-slate-800 dark:text-white min-w-[130px] text-center text-sm">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <button 
              onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}
              className="p-1.5 hover:bg-white dark:hover:bg-slate-600 rounded-md transition-all text-slate-500 dark:text-slate-300 hover:shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          
          <button 
            onClick={() => setSelectedDate(new Date())} 
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 rounded-lg transition-colors border border-primary-100 dark:border-primary-800 whitespace-nowrap"
          >
            Today
          </button>
        </div>

        {/* Right: Filters & Actions */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
          
          <Select 
            value={selectedDept} 
            onChange={e => setSelectedDept(e.target.value)}
            className="!w-40 !py-2 !text-sm !rounded-lg !border-slate-200"
          >
            <option value="all">All Depts</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </Select>

          {/* View Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setViewMode('queue')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'queue' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <LayoutGrid size={14} />
              Queue
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              <ListIcon size={14} />
              List
            </button>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block"></div>

          {canManageAppointments ? (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all transform active:scale-95 font-bold text-sm whitespace-nowrap"
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>New Walk-In</span>
            </button>
          ) : (
            <Button size="sm" disabled variant="secondary" icon={Lock}>Locked</Button>
          )}
        </div>
      </div>

      {/* MAIN VIEW CONTENT */}
      <div className="flex-1 min-h-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        
        {viewMode === 'queue' ? (
          <div className="h-full overflow-x-auto overflow-y-hidden p-4 bg-slate-50/50 dark:bg-slate-950/20">
            {doctors.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">No staff scheduled.</div>
            ) : (
              <div className="flex gap-4 h-full min-w-max">
                {doctors.map(doc => (
                  <DoctorQueueColumn 
                    key={doc.id} 
                    doctor={doc} 
                    appointments={dailyAppointments.filter(a => a.staffId === doc.id)}
                    onStatusUpdate={updateStatus}
                    onCancel={handleCancel}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          // LIST VIEW
          <div className="h-full overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Token / Time</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Staff</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
                {dailyAppointments.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400">No appointments for this day.</td></tr>
                