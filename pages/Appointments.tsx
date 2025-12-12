
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Calendar as CalendarIcon, Clock, User, Lock, 
  ChevronLeft, ChevronRight, MoreVertical, 
  CheckCircle, X, Search, Filter, Play, DollarSign, LayoutGrid, List as ListIcon, Edit,
  Loader2, XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, MedicalStaff, User as UserType, NurseServiceCatalog } from '@/types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

// Date Helpers
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const isSameDay = (d1: Date, d2: Date) => 
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate();

const StatusBadge = ({ status }: { status: string }) => {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    waiting: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400',
    checked_in: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400',
    in_progress: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 animate-pulse',
    completed: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400',
  };
  
  const labels: Record<string, string> = {
    pending: t('appointments_status_unpaid'),
    confirmed: t('appointments_status_in_queue'),
    waiting: t('appointments_status_in_queue'),
    checked_in: t('appointments_status_ready'),
    in_progress: t('appointments_status_in_consultation'),
    completed: t('appointments_status_completed'),
    cancelled: t('appointments_status_cancelled')
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
  onStatusUpdate: (id: number, status: string, patientName: string) => void;
  onCancel: (id: number) => void;
  canManage: boolean;
}

const DoctorQueueColumn: React.FC<DoctorQueueColumnProps> = ({ doctor, appointments, onStatusUpdate, onCancel, canManage }) => {
  const { t } = useTranslation();
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
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{doctor.type === 'nurse' ? t('appointments_form_select_nurse') : doctor.specialization}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg border border-blue-100 dark:border-blue-800">
             <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">{t('appointments_queue_waiting')}</span>
             <span className="text-3xl font-bold text-blue-800 dark:text-blue-300">{queue.length}</span>
          </div>
          <div className="flex flex-col items-center bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-100 dark:border-green-800">
             <span className="text-[10px] uppercase font-bold text-green-600 dark:text-green-400">{t('appointments_queue_done')}</span>
             <span className="text-3xl font-bold text-green-800 dark:text-green-300">{completedCount}</span>
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
                {t('appointments_queue_now_seeing')}
              </span>
              <span className="font-mono text-xs text-slate-400">#{activePatient.dailyToken}</span>
            </div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{activePatient.patientName}</h4>
            <p className="text-xs text-slate-500 mb-3">{activePatient.type} • {activePatient.datetime && new Date(activePatient.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            {doctor.type === 'nurse' && activePatient.reason && (
                <p className="text-xs text-slate-500 italic bg-slate-50 p-1 rounded mb-3">{activePatient.reason}</p>
            )}
            
            {canManage && (
              <Button 
                size="sm" 
                className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-green-200 dark:shadow-none"
                onClick={() => onStatusUpdate(activePatient.id, 'completed', activePatient.patientName)}
                icon={CheckCircle}
              >
                {t('appointments_queue_complete_button')}
              </Button>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 h-28 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
               <User size={20} className="opacity-50"/>
            </div>
            <span className="text-xs font-medium">{t('appointments_queue_room_empty')}</span>
          </div>
        )}

        {/* Waiting List */}
        {queue.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 pl-1 flex justify-between items-center">{t('appointments_queue_up_next')} <span className="text-[10px] font-medium normal-case">{t('appointments_queue_sort_label')}</span></h5>
            {queue.map((apt, index) => {
              const isFirstWaiting = !activePatient && index === 0;
              // Robust check: Is paid if billingStatus is paid OR actual paidAmount covers totalAmount
              const isPaid = apt.billingStatus === 'paid' || (apt.totalAmount !== undefined && (apt.paidAmount || 0) >= (apt.totalAmount || 0));

              return (
                <div key={apt.id} className={`bg-white dark:bg-slate-800 p-3 rounded-xl border transition-all duration-200 ${isFirstWaiting ? 'border-primary-300 dark:border-primary-700 shadow-md ring-2 ring-primary-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${apt.status === 'pending' && !isPaid ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {apt.status === 'pending' && !isPaid ? t('appointments_status_unpaid') : t('appointments_status_in_queue')}
                    </span>
                    <span className="font-mono text-xs text-slate-400">#{apt.dailyToken}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1" title={apt.patientName}>{apt.patientName}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{apt.type} • {apt.datetime && new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  
                  {apt.status === 'pending' && !isPaid && (
                    <p className="text-xs font-semibold text-orange-500 mt-1">{t('appointments_queue_payment_needed')}</p>
                  )}
                  {apt.status === 'pending' && isPaid && (
                    <p className="text-xs font-semibold text-green-600 mt-1 flex items-center gap-1"><CheckCircle size={10}/> Paid - Ready</p>
                  )}

                  {canManage && (
                    <div className="flex gap-2 mt-3">
                      {['confirmed', 'checked_in', 'waiting', 'pending'].includes(apt.status) && (
                        <>
                          <Button
                              size="sm"
                              variant="danger"
                              onClick={() => onCancel(apt.id)}
                              icon={X}
                              className="flex-1"
                          >
                              {t('cancel')}
                          </Button>
                          {/* Enable Start if Paid, regardless of pending status */}
                          {isPaid && (
                            <Button 
                                size="sm" 
                                variant={isFirstWaiting ? 'primary' : 'outline'}
                                className="flex-1"
                                onClick={() => onStatusUpdate(apt.id, 'in_progress', apt.patientName)}
                                disabled={!isFirstWaiting}
                                title={!isFirstWaiting ? t('appointments_queue_start_tooltip') : ''}
                                icon={Play}
                            >
                                {t('appointments_queue_start_button')}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const ListView = ({ appointments, onEdit, onCancel, canManage }: any) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">No.</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_token')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_patient')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_staff')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_type')}</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_status')}</th>
                {canManage && <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_list_header_actions')}</th>}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
              {appointments.length === 0 ? (
                  <tr><td colSpan={canManage ? 7 : 6} className="py-10 text-center text-slate-400">{t('appointments_list_empty')}</td></tr>
              ) : (
                appointments.map((apt: Appointment, index: number) => (
                  <tr key={apt.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-mono text-sm font-bold text-slate-800 dark:text-white">
                        #{apt.dailyToken}
                      </div>
                      <div className="text-xs text-slate-500">{apt.datetime && new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 dark:text-white">{apt.patientName}</div>
                      <div className="text-xs text-slate-400">{apt.patientId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{apt.staffName}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{apt.type}</td>
                    <td className="px-6 py-4"><StatusBadge status={apt.status} /></td>
                    {canManage && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                           <Button 
                             size="sm" 
                             variant="outline" 
                             icon={Edit} 
                             onClick={() => onEdit(apt)}
                             disabled={apt.status === 'completed' || apt.status === 'cancelled'}
                           >
                            {t('edit')}
                           </Button>
                           {apt.status !== 'cancelled' && apt.status !== 'completed' && <Button size="sm" variant="danger" icon={X} onClick={() => onCancel(apt.id)}>{t('cancel')}</Button>}
                        </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    )
}

export const Appointments = () => {
  const [viewMode, setViewMode] = useState<'queue' | 'list'>('queue');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filterDept, setFilterDept] = useState('all');
  const { t } = useTranslation();

  // Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = useState<number | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingForm, setEditingForm] = useState({
    patientId: '',
    staffId: '',
    date: formatDate(selectedDate),
    time: '09:00',
    type: 'Consultation',
    reason: '',
  });

  const checkAvailability = (doc: MedicalStaff, dateStr: string) => {
    if (doc.status !== 'active') return false;
    if (!doc.availableDays || doc.availableDays.length === 0) return true; // Assume available if not specified
    try {
        const scheduleDays = doc.availableDays.map((d: string) => d.toLowerCase());
        // To get weekday correctly across timezones, add T00:00:00 to parse as local time.
        const appointmentDate = new Date(dateStr + 'T00:00:00');
        const weekday = appointmentDate.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        return scheduleDays.includes(weekday);
    } catch (e) {
        console.error("Date parsing error for availability check:", e);
        return true; // Default to available on error
    }
  };

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [apts, pts, stf, depts] = await Promise.all([
        api.getAppointments(),
        api.getPatients(),
        api.getStaff(),
        api.getDepartments(),
      ]);
      setAppointments(Array.isArray(apts) ? apts : []);
      setPatients(Array.isArray(pts) ? pts : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setDepartments(Array.isArray(depts) ? depts : []);
    } catch (e) {
      console.error("Failed to load appointment data", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  const dailyAppointments = useMemo(() => {
    // 1. Filter appointments for the day
    const appointmentsForDay = appointments.filter(apt => {
        if (!apt || !apt.datetime) return false;
        return isSameDay(new Date(apt.datetime), selectedDate);
    });

    // 2. Filter by Department if needed
    const filteredByDept = appointmentsForDay.filter(apt => {
        return filterDept === 'all' || staff.find(s => s.id === apt.staffId)?.department === filterDept;
    });

    // 3. Group by Staff ID
    const groupedByStaff: Record<string, Appointment[]> = {};
    filteredByDept.forEach(apt => {
        if (!groupedByStaff[apt.staffId]) groupedByStaff[apt.staffId] = [];
        groupedByStaff[apt.staffId].push(apt);
    });

    // 4. Sort and Assign Token Per Staff
    const statusPriority: Record<string, number> = {
      'in_progress': 0, 'confirmed': 1, 'checked_in': 2, 'waiting': 3, 'pending': 4,
      'completed': 6, 'cancelled': 7
    };

    const finalGrouped: Record<string, Appointment[]> = {};

    Object.keys(groupedByStaff).forEach(staffId => {
        const staffAppts = groupedByStaff[staffId];
        
        // Sort for token assignment: Time based
        const sortedForToken = [...staffAppts].sort((a,b) => (a.datetime && b.datetime) ? new Date(a.datetime).getTime() - new Date(b.datetime).getTime() : 0);
        
        // Assign Token (1...N)
        const withTokens = sortedForToken.map((apt, index) => ({
            ...apt,
            dailyToken: index + 1
        }));

        // Sort for display (Priority)
        const sortedForDisplay = [...withTokens].sort((a, b) => {
            if (!a || !b) return 0;
            
            // Derive effective status for sorting: Treat PAID pending appointments as confirmed
            const getEffectiveStatus = (item: Appointment) => {
                const isItemPaid = item.billingStatus === 'paid' || (item.totalAmount !== undefined && (item.paidAmount || 0) >= item.totalAmount);
                if (item.status === 'pending' && isItemPaid) return 'confirmed'; // Treat as confirmed if paid
                return item.status;
            };

            const statusA = statusPriority[getEffectiveStatus(a)] ?? 99;
            const statusB = statusPriority[getEffectiveStatus(b)] ?? 99;
            if (statusA !== statusB) return statusA - statusB;
            // Then by time 
            return (a.datetime && b.datetime) ? new Date(a.datetime).getTime() - new Date(b.datetime).getTime() : 0;
        });

        finalGrouped[staffId] = sortedForDisplay;
    });

    return finalGrouped;
  }, [appointments, selectedDate, filterDept, staff]);

  const activeStaff = useMemo(() => {
    const activeStaffIds = new Set(Object.keys(dailyAppointments));
    return staff.filter(s => activeStaffIds.has(s.id.toString()));
  }, [dailyAppointments, staff]);

  const openModal = () => {
    setIsEditing(false);
    setEditingAppointment(null);
    setEditingForm({
      patientId: '',
      staffId: '',
      date: formatDate(selectedDate),
      time: '09:00',
      type: 'Consultation',
      reason: ''
    });
    setIsModalOpen(true);
  };
  
  const openEditModal = (apt: Appointment) => {
    if (!apt) return;
    setEditingAppointment(apt);
    setIsEditing(true);
    setEditingForm({
      patientId: apt?.patientId.toString() || '',
      staffId: apt?.staffId.toString() || '',
      date: apt && apt.datetime ? formatDate(new Date(apt.datetime)) : formatDate(selectedDate),
      time: apt && apt.datetime ? new Date(apt.datetime).toTimeString().slice(0, 5) : '09:00',
      type: apt.type,
      reason: apt.reason || '',
    });
    setIsModalOpen(true);
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(isEditing ? t('appointments_process_updating') : t('appointments_process_creating'));

    const payload = {
      ...editingForm,
      datetime: `${editingForm.date}T${editingForm.time}`,
      patientId: parseInt(editingForm.patientId),
      staffId: parseInt(editingForm.staffId),
    };
    
    try {
      if (isEditing && editingAppointment) {
        // Update existing appointment without recreating (prevents double billing)
        await api.updateAppointment(editingAppointment.id, payload);
      } else {
        await api.createAppointment(payload);
      }

      setProcessStatus('success');
      setProcessMessage(isEditing ? t('appointments_process_update_success') : t('appointments_process_create_success'));
      
      setIsModalOpen(false);
      await loadData(true);

      setTimeout(() => {
        setProcessStatus('idle');
      }, 1500);

    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || t('appointments_process_save_fail'));
    }
  };

  const handleStatusUpdate = async (id: number, status: string) => {
    await api.updateAppointmentStatus(id, status);
    await loadData(true);
  };

  const confirmCancel = (id: number) => {
    setAppointmentToCancel(id);
    setIsCancelConfirmOpen(true);
  };

  const handleCancel = async () => {
    if (!appointmentToCancel) return;
    
    setProcessStatus('processing');
    setProcessMessage(t('appointments_process_cancelling'));

    try {
      await api.cancelAppointment(appointmentToCancel);

      setProcessStatus('success');
      setProcessMessage(t('appointments_process_cancel_success'));
      
      await loadData(true);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || t('appointments_process_cancel_fail'));
    } finally {
      setIsCancelConfirmOpen(false);
      setAppointmentToCancel(null);
      setTimeout(() => setProcessStatus('idle'), 1500);
    }
  };

  const changeDate = (offset: number) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + offset);
      return newDate;
    });
  };

  const canManage = hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS);
  
  // Sort overall list by time only, ignoring doctor groups, for the ListView
  const listAllAppointments = Object.values(dailyAppointments).flat().sort((a: Appointment, b: Appointment) => 
    (a.datetime && b.datetime) ? new Date(a.datetime).getTime() - new Date(b.datetime).getTime() : 0
  );

  return (
    <div className="space-y-6">

      {/* Process Status Overlay */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
                {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
                {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
                {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
                <p className="font-medium text-slate-700 dark:text-slate-200 mb-4">{processMessage}</p>
                {processStatus === 'error' && (
                  <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('close')}</Button>
                )}
            </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appointments_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('appointments_subtitle')}</p>
        </div>
        <div className="flex gap-3">
          {canManage && <Button onClick={openModal} icon={Plus}>{t('appointments_new_walkin_button')}</Button>}
        </div>
      </div>

      {/* Toolbar */}
      <Card className="!p-3 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => changeDate(-1)} icon={ChevronLeft} className="!p-2 h-10 w-10" />
          <div className="text-center">
            <h3 className="font-bold text-lg text-slate-800 dark:text-white">{selectedDate.toLocaleDateString([], { weekday: 'long' })}</h3>
            <p className="text-sm text-slate-500">{selectedDate.toLocaleDateString()}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => changeDate(1)} icon={ChevronRight} className="!p-2 h-10 w-10" />
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())} className="ml-2">{t('dashboard_today')}</Button>
        </div>
        
        <div className="flex items-center gap-2">
           <Select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
             <option value="all">{t('appointments_filter_all_depts')}</option>
             {departments.map(d => <option key={d.id} value={d.name_en}>{d.name_en}</option>)}
           </Select>
           <div className="p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex gap-1">
             <Button variant={viewMode === 'queue' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('queue')} icon={LayoutGrid} className={viewMode === 'queue' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}>{t('appointments_view_queue')}</Button>
             <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('list')} icon={ListIcon} className={viewMode === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''}>{t('appointments_view_list')}</Button>
           </div>
        </div>
      </Card>
      
      {/* Main Content */}
      {viewMode === 'queue' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar -mx-8 px-8">
          {loading ? <p>{t('loading')}</p> :
           activeStaff.length === 0 ? <p className="text-slate-400 mx-auto py-10">{t('appointments_queue_no_staff')}</p> :
           activeStaff.map(doc => (
            <DoctorQueueColumn 
              key={doc.id} 
              doctor={doc} 
              appointments={dailyAppointments[doc.id] || []}
              onStatusUpdate={handleStatusUpdate}
              onCancel={confirmCancel}
              canManage={canManage}
            />
          ))}
        </div>
      ) : (
        <Card className="!p-0 animate-in fade-in">
           <ListView appointments={listAllAppointments} onEdit={openEditModal} onCancel={confirmCancel} canManage={canManage} />
        </Card>
      )}

      {/* Appointment Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? t('appointments_modal_edit_title') : t('appointments_modal_title')}>
        <form onSubmit={handleCreateAppointment} className="space-y-4">
          <Select 
            label={t('appointments_form_select_patient')} 
            required 
            value={editingForm.patientId} 
            onChange={e => setEditingForm({...editingForm, patientId: e.target.value})}
            disabled={isEditing}
          >
            <option value="">{t('appointments_form_select_patient')}</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientId})</option>)}
          </Select>

          <Select 
            label={t('appointments_form_select_staff')} 
            required 
            value={editingForm.staffId} 
            onChange={e => setEditingForm({...editingForm, staffId: e.target.value})}
          >
            <option value="">{t('appointments_form_select_staff')}</option>
            {staff
              .filter(s => (s.type === 'doctor' || s.type === 'nurse') && checkAvailability(s, editingForm.date))
              .map(s => (
                <option key={s.id} value={s.id}>{s.fullName} - {s.type === 'nurse' ? t('appointments_form_select_nurse') : s.specialization}</option>
            ))}
          </Select>
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date" type="date" required value={editingForm.date} onChange={e => setEditingForm({...editingForm, date: e.target.value})} />
            <Input label={t('appointments_form_time')} type="time" required value={editingForm.time} onChange={e => setEditingForm({...editingForm, time: e.target.value})} />
          </div>

          <Select label={t('appointments_form_type')} value={editingForm.type} onChange={e => setEditingForm({...editingForm, type: e.target.value})}>
            <option>Consultation</option>
            <option>Follow-up</option>
            <option>Emergency</option>
            <option>Procedure</option>
          </Select>

          <Textarea label={t('appointments_form_reason')} value={editingForm.reason} onChange={e => setEditingForm({...editingForm, reason: e.target.value})} />
          
          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{isEditing ? t('appointments_form_update_button') : t('appointments_form_create_button')}</Button>
          </div>
        </form>
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmationDialog 
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleCancel}
        title={t('appointments_cancel_dialog_title')}
        message={<p>{t('appointments_cancel_dialog_message')}</p>}
      />
    </div>
  );
};
