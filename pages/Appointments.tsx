

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Play, LayoutGrid, List as ListIcon, Edit,
  Loader2, XCircle, CheckCircle, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, MedicalStaff } from '../types';
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
               {/* User icon placeholder */}
               <div className="w-5 h-5 rounded-full border-2 border-slate-300"></div>
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

const ListView = ({ appointments, onEdit, onCancel, canManage }: { appointments: Appointment[], onEdit: (apt: Appointment) => void, onCancel: (id: number) => void, canManage: boolean }) => {
    const { t } = useTranslation();
    return (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">No.</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {appointments.map((apt: Appointment) => (
                <tr key={apt.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">#{apt.dailyToken || apt.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800 dark:text-white">{apt.patientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{apt.staffName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{apt.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={apt.status} /></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {canManage && (
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" icon={Edit} onClick={() => onEdit(apt)}>Edit</Button>
                        {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                          <Button size="sm" variant="danger" icon={X} onClick={() => onCancel(apt.id)}>Cancel</Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
    );
};

export const Appointments = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    staffId: '',
    date: formatDate(new Date()),
    time: '09:00',
    type: 'Consultation',
    reason: ''
  });
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', action: () => {} });
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const canManage = hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [apts, stf, pts] = await Promise.all([
        api.getAppointments(),
        api.getStaff(),
        api.getPatients()
      ]);
      setAppointments(Array.isArray(apts) ? apts : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setPatients(Array.isArray(pts) ? pts : []);
    } catch (e) {
      console.error("Failed to load appointment data", e);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter and group appointments for the selected date
  const dailyAppointments = useMemo(() => {
    return appointments
      .filter(apt => isSameDay(new Date(apt.datetime), selectedDate))
      .sort((a, b) => {
        // Sort logic: paid > unpaid, then by time
        const aIsPaid = a.billingStatus === 'paid' || (a.totalAmount !== undefined && a.paidAmount !== undefined && a.paidAmount >= a.totalAmount);
        const bIsPaid = b.billingStatus === 'paid' || (b.totalAmount !== undefined && b.paidAmount !== undefined && b.paidAmount >= b.totalAmount);
        if (aIsPaid && !bIsPaid) return -1;
        if (!aIsPaid && bIsPaid) return 1;
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      });
  }, [appointments, selectedDate]);

  const appointmentsByDoctor = useMemo(() => {
    const doctorsWithAppointments = staff.filter(s =>
      (s.type === 'doctor' || s.type === 'nurse') && dailyAppointments.some(a => a.staffId === s.id)
    );

    return doctorsWithAppointments.map(doc => ({
      doctor: doc,
      appointments: dailyAppointments.filter(a => a.staffId === doc.id)
    }));
  }, [dailyAppointments, staff]);

  // Handlers
  const handleStatusUpdate = async (id: number, status: string, patientName: string) => {
    setProcessStatus('processing');
    setProcessMessage(`Updating status for ${patientName}...`);
    try {
      if (status === 'in_progress') {
        const apt = appointments.find(a => a.id === id);
        if (apt) {
          const otherInProgress = appointments.find(a => a.staffId === apt.staffId && a.status === 'in_progress');
          if (otherInProgress) {
             await api.updateAppointmentStatus(otherInProgress.id, 'checked_in');
          }
        }
      }
      await api.updateAppointmentStatus(id, { status });
      await loadData(true);
      setProcessStatus('idle');
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.message || 'Failed to update status');
      setTimeout(() => setProcessStatus('idle'), 2000);
    }
  };
  
  const handleCancel = (id: number) => {
    setConfirmState({
      isOpen: true,
      title: 'Cancel Appointment',
      message: 'Are you sure you want to cancel this appointment? This may affect billing.',
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Cancelling appointment...');
        try {
          await api.cancelAppointment(id);
          await loadData(true);
          setProcessStatus('success');
          setProcessMessage('Appointment cancelled.');
          setTimeout(() => setProcessStatus('idle'), 1500);
        } catch (e: any) {
          setProcessStatus('error');
          setProcessMessage(e.message || 'Failed to cancel.');
          setTimeout(() => setProcessStatus('idle'), 2000);
        }
      }
    });
  };

  const openCreateModal = () => {
    setEditingAppointment(null);
    setFormData({
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
    setEditingAppointment(apt);
    setFormData({
      patientId: apt.patientId.toString(),
      staffId: apt.staffId.toString(),
      date: apt.datetime.split('T')[0],
      time: apt.datetime.split('T')[1].slice(0, 5),
      type: apt.type,
      reason: apt.reason || ''
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(editingAppointment ? 'Updating...' : 'Creating...');
    try {
      const payload = {
        ...formData,
        patientId: parseInt(formData.patientId),
        staffId: parseInt(formData.staffId),
        datetime: `${formData.date}T${formData.time}`
      };

      if (editingAppointment) {
        await api.updateAppointment(editingAppointment.id, payload);
      } else {
        await api.createAppointment(payload);
      }
      await loadData(true);
      setProcessStatus('success');
      setProcessMessage(editingAppointment ? 'Updated successfully!' : 'Created successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        setProcessStatus('idle');
      }, 1500);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.message || 'Failed to save appointment.');
      setTimeout(() => setProcessStatus('idle'), 2000);
    }
  };

  const changeDate = (offset: number) => {
    setSelectedDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + offset);
      return newDate;
    });
  };

  return (
    <div className="space-y-6">
      {/* Loading Overlay */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processStatus === 'processing' ? t('processing') : processStatus === 'success' ? t('success') : 'Failed'}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('close')}</Button>}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('appointments_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('appointments_subtitle')}</p>
        </div>
        {canManage && <Button onClick={openCreateModal} icon={Plus}>{t('appointments_new_button')}</Button>}
      </div>

      {/* Controls */}
      <Card className="!p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" icon={ChevronLeft} onClick={() => changeDate(-1)} />
          <Input type="date" value={formatDate(selectedDate)} onChange={e => setSelectedDate(new Date(e.target.value))} className="w-auto" />
          <Button size="sm" variant="outline" icon={ChevronRight} onClick={() => changeDate(1)} />
          <Button size="sm" variant="secondary" onClick={() => setSelectedDate(new Date())}>{t('today')}</Button>
        </div>
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
          <Button size="sm" variant={viewMode === 'grid' ? 'secondary' : 'ghost'} icon={LayoutGrid} onClick={() => setViewMode('grid')}>{t('appointments_view_queue')}</Button>
          <Button size="sm" variant={viewMode === 'list' ? 'secondary' : 'ghost'} icon={ListIcon} onClick={() => setViewMode('list')}>{t('appointments_view_list')}</Button>
        </div>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">{t('appointments_loading')}</div>
      ) : viewMode === 'grid' ? (
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6">
          {appointmentsByDoctor.length === 0 ? (
            <div className="flex-1 text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl w-full">
              <p className="text-slate-500">{t('appointments_empty')}</p>
            </div>
          ) : (
            appointmentsByDoctor.map(({ doctor, appointments }) => (
              <DoctorQueueColumn 
                key={doctor.id} 
                doctor={doctor} 
                appointments={appointments} 
                onStatusUpdate={handleStatusUpdate}
                onCancel={handleCancel}
                canManage={canManage}
              />
            ))
          )}
        </div>
      ) : (
        <Card className="!p-0">
          <ListView 
            appointments={dailyAppointments} 
            onEdit={openEditModal} 
            onCancel={handleCancel}
            canManage={canManage}
          />
        </Card>
      )}

      {/* Modals */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAppointment ? t('appointments_modal_edit_title') : t('appointments_modal_new_title')}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Select label={t('appointments_form_select_patient')} required value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})}>
            <option value="">{t('appointments_form_select_patient')}</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>
          <Select label={t('appointments_form_select_staff')} required value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})}>
            <option value="">{t('appointments_form_select_staff')}</option>
            {staff.filter(s => s.type === 'doctor').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('date')} type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            <Input label={t('time')} type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
          </div>
          <Select label={t('appointments_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option>Consultation</option>
            <option>Follow-up</option>
            <option>Emergency</option>
          </Select>
          <Textarea label={t('reason')} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
      
      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({...confirmState, isOpen: false})}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        type="danger"
      />
    </div>
  );
};
