
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Play, LayoutGrid, List as ListIcon, Edit, Eye,
  Loader2, XCircle, CheckCircle, X, ChevronLeft, ChevronRight,
  CalendarDays, Search, Filter, User, Hash, Info, Clock, Stethoscope, Briefcase, History
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, Appointment, MedicalStaff } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

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
  const activePatient = appointments.find(a => a.status === 'in_progress');
  const queue = appointments.filter(a => ['pending', 'confirmed', 'checked_in', 'waiting'].includes(a.status));
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="flex flex-col min-w-[320px] max-w-[320px] bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 h-full overflow-hidden">
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
             <span className="text-3xl font-bold text-green-800 dark:text-blue-300">{completedCount}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar bg-slate-50 dark:bg-slate-950/30">
        {activePatient ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border-l-4 border-l-green-500 border border-slate-200 dark:border-slate-700 shadow-md p-4 animate-in fade-in zoom-in-95 duration-300 ring-4 ring-green-500/10">
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-bold uppercase text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1.5 border border-green-100 dark:border-green-800">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                {t('appointments_queue_now_seeing')}
              </span>
              <span className="font-mono text-xs text-slate-400">#{activePatient.dailyToken}</span>
            </div>
            <h4 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{activePatient.patientName}</h4>
            <p className="text-xs text-slate-500 mb-3">{activePatient.type} • {activePatient.datetime && new Date(activePatient.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            {canManage && (
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white border-none shadow-green-200 dark:shadow-none" onClick={() => onStatusUpdate(activePatient.id, 'completed', activePatient.patientName)} icon={CheckCircle}>{t('appointments_queue_complete_button')}</Button>
            )}
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 h-28 bg-slate-50/50 dark:bg-slate-900/20">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2"><div className="w-5 h-5 rounded-full border-2 border-slate-300"></div></div>
            <span className="text-xs font-medium">{t('appointments_queue_room_empty')}</span>
          </div>
        )}

        {queue.length > 0 && (
          <div className="space-y-2 mt-4">
            <h5 className="text-xs font-bold uppercase text-slate-400 pl-1 flex justify-between items-center">{t('appointments_queue_up_next')} <span className="text-[10px] font-medium normal-case">{t('appointments_queue_sort_label')}</span></h5>
            {queue.map((apt, index) => {
              const isFirstWaiting = !activePatient && index === 0;
              const isPaid = apt.billingStatus === 'paid' || (apt.totalAmount !== undefined && (apt.paidAmount || 0) >= (apt.totalAmount || 0));
              return (
                <div key={apt.id} className={`bg-white dark:bg-slate-800 p-3 rounded-xl border transition-all duration-200 ${isFirstWaiting ? 'border-primary-300 dark:border-primary-700 shadow-md ring-2 ring-primary-500/10' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${apt.status === 'pending' && !isPaid ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {apt.status === 'pending' && !isPaid ? t('appointments_status_unpaid') : t('appointments_status_in_queue')}
                    </span>
                    <span className="font-mono text-xs text-slate-400">#{apt.dailyToken}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1 truncate" title={apt.patientName}>{apt.patientName}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{apt.type} • {apt.datetime && new Date(apt.datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  {apt.status === 'pending' && !isPaid && (<p className="text-xs font-semibold text-orange-500 mt-1">{t('appointments_queue_payment_needed')}</p>)}
                  {canManage && (
                    <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="danger" onClick={() => onCancel(apt.id)} icon={X} className="flex-1">{t('cancel')}</Button>
                        {isPaid && (<Button size="sm" variant={isFirstWaiting ? 'primary' : 'outline'} className="flex-1" onClick={() => onStatusUpdate(apt.id, 'in_progress', apt.patientName)} disabled={!isFirstWaiting} icon={Play}>{t('appointments_queue_start_button')}</Button>)}
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

const ListView = ({ appointments, onEdit, onView, onCancel, canManage }: { appointments: Appointment[], onEdit: (apt: Appointment) => void, onView: (apt: Appointment) => void, onCancel: (id: number) => void, canManage: boolean }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const filtered = useMemo(() => {
        return appointments.filter(a => {
            const matchesSearch = 
                a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                a.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.dailyToken && a.dailyToken.toString().includes(searchTerm));
            const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [appointments, searchTerm, statusFilter]);

    return (
        <div className="flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder={t('patients_search_placeholder')}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0">
              <Filter size={14} className="text-slate-400" />
              <select 
                className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer" 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="All">{t('records_filter_all')}</option>
                <option value="pending">{t('appointments_status_unpaid')}</option>
                <option value="confirmed">{t('appointments_status_in_queue')}</option>
                <option value="checked_in">{t('appointments_status_ready')}</option>
                <option value="in_progress">{t('appointments_status_in_consultation')}</option>
                <option value="completed">{t('appointments_status_completed')}</option>
                <option value="cancelled">{t('appointments_status_cancelled')}</option>
              </select>
            </div>
          </div>

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
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">{t('no_data')}</td></tr>
                ) : (
                  filtered.map((apt: Appointment) => {
                    const isHistorical = apt.status === 'completed' || apt.status === 'cancelled';
                    return (
                      <tr key={apt.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">#{apt.dailyToken || apt.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800 dark:text-white">{apt.patientName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{apt.staffName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(apt.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{apt.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={apt.status} /></td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex gap-2 justify-end">
                            {isHistorical ? (
                              <Button size="sm" variant="outline" icon={Eye} onClick={() => onView(apt)}>{t('view')}</Button>
                            ) : (
                              <>
                                <Button size="sm" variant="ghost" icon={Eye} onClick={() => onView(apt)} title={t('view')} />
                                {canManage && (
                                  <>
                                    <Button size="sm" variant="outline" icon={Edit} onClick={() => onEdit(apt)}>{t('edit')}</Button>
                                    <Button size="sm" variant="danger" icon={X} onClick={() => onCancel(apt.id)} title={t('cancel')} />
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
    );
};

const HistoryView = ({ appointments, onView }: { appointments: Appointment[], onView: (apt: Appointment) => void }) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

    const filtered = useMemo(() => {
        return appointments.filter(a => {
            const matchesSearch = 
                a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                a.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (a.appointmentNumber && a.appointmentNumber.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        }).sort((a,b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime());
    }, [appointments, searchTerm, statusFilter]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder={t('patients_search_placeholder')}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
                    value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0">
              <Filter size={14} className="text-slate-400" />
              <select 
                className="bg-transparent border-none text-xs font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer" 
                value={statusFilter} 
                onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              >
                <option value="All">{t('records_filter_all')}</option>
                <option value="pending">{t('appointments_status_unpaid')}</option>
                <option value="confirmed">{t('appointments_status_in_queue')}</option>
                <option value="in_progress">{t('appointments_status_in_consultation')}</option>
                <option value="completed">{t('appointments_status_completed')}</option>
                <option value="cancelled">{t('appointments_status_cancelled')}</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Patient</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Doctor</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                {paginated.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">{t('no_data')}</td></tr>
                ) : (
                  paginated.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-500">{apt.appointmentNumber || `#${apt.id}`}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{new Date(apt.datetime).toLocaleDateString()}</span>
                                <span className="text-xs text-slate-500">{new Date(apt.datetime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800 dark:text-white">{apt.patientName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{apt.staffName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{apt.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={apt.status} /></td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                            <Button size="sm" variant="ghost" icon={Eye} onClick={() => onView(apt)}>{t('view')}</Button>
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 gap-4 mt-auto">
                <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                    <span>{t('patients_pagination_showing')} {paginated.length} {t('patients_pagination_of')} {filtered.length}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                        <select 
                          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                          value={itemsPerPage}
                          onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                        >
                          <option value={10}>10</option>
                          <option value={15}>15</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                    <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                </div>
            </div>
        </div>
    );
};

export const Appointments = () => {
  const location = useLocation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'history'>('grid');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewDetailModalOpen, setIsViewDetailModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({ patientId: '', staffId: '', date: formatDate(new Date()), time: '09:00', type: 'Consultation', reason: '' });
  
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', action: () => {} });
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const canManage = hasPermission(currentUser, Permissions.MANAGE_APPOINTMENTS);

  // Moved View Tabs to Header
  const HeaderTabs = (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <LayoutGrid size={14} />
            <span className="hidden sm:inline">{t('appointments_view_queue')}</span>
        </button>
        <button 
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <ListIcon size={14} />
            <span className="hidden sm:inline">{t('appointments_view_list')}</span>
        </button>
        <button 
            onClick={() => setViewMode('history')}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-bold transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <History size={14} />
            <span className="hidden sm:inline">{t('operations_tab_history')}</span>
        </button>
    </div>
  );

  useHeader(t('appointments_title'), t('appointments_subtitle'), HeaderTabs);

  const loadData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [apts, stf, pts] = await Promise.all([api.getAppointments(), api.getStaff(), api.getPatients()]);
      setAppointments(Array.isArray(apts) ? apts : []);
      setStaff(Array.isArray(stf) ? stf : []);
      setPatients(Array.isArray(pts) ? pts : []);
    } catch (e) { console.error(e); } finally { if (!isSilent) setLoading(false); }
  };

  useEffect(() => { 
    loadData(); 
  }, []);

  useEffect(() => {
    const state = location.state as any;
    if (state?.trigger === 'new' && canManage) {
      openNewModal();
    }
  }, [location.state, canManage]);

  const openNewModal = () => {
    setEditingAppointment(null); 
    setFormData({ patientId: '', staffId: '', date: formatDate(selectedDate), time: '09:00', type: 'Consultation', reason: '' }); 
    setPatientSearch(''); 
    setIsModalOpen(true);
  };

  const openViewDetailModal = (apt: Appointment) => {
    setViewingAppointment(apt);
    setIsViewDetailModalOpen(true);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dailyAppointments = useMemo(() => {
    return appointments
      .filter(apt => isSameDay(new Date(apt.datetime), selectedDate))
      .sort((a, b) => {
        const aIsPaid = a.billingStatus === 'paid' || (a.totalAmount !== undefined && a.paidAmount !== undefined && a.paidAmount >= a.totalAmount);
        const bIsPaid = b.billingStatus === 'paid' || (b.totalAmount !== undefined && b.paidAmount !== undefined && b.paidAmount >= b.totalAmount);
        if (aIsPaid && !bIsPaid) return -1;
        if (!aIsPaid && bIsPaid) return 1;
        return new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
      });
  }, [appointments, selectedDate]);

  const appointmentsByDoctor = useMemo(() => {
    const doctorsWithAppointments = staff.filter(s => (s.type === 'doctor' || s.type === 'nurse') && dailyAppointments.some(a => a.staffId === s.id));
    return doctorsWithAppointments.map(doc => ({ doctor: doc, appointments: dailyAppointments.filter(a => a.staffId === doc.id) }));
  }, [dailyAppointments, staff]);

  const handleStatusUpdate = async (id: number, status: string, patientName: string) => {
    setProcessStatus('processing');
    setProcessMessage(`Updating status for ${patientName}...`);
    try {
      if (status === 'in_progress') {
        const apt = appointments.find(a => a.id === id);
        if (apt) {
          const otherInProgress = appointments.find(a => a.staffId === apt.staffId && a.status === 'in_progress');
          if (otherInProgress) await api.updateAppointmentStatus(otherInProgress.id, 'checked_in');
        }
      }
      await api.updateAppointmentStatus(id, status);
      await loadData(true);
      setProcessStatus('idle');
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || e.message || 'Failed'); 
      setTimeout(() => setProcessStatus('idle'), 2000); 
    }
  };
  
  const handleCancel = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('appointments_cancel_dialog_title'), message: t('appointments_cancel_dialog_message'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage(t('appointments_process_cancelling'));
        try { 
          await api.cancelAppointment(id); 
          await loadData(true); 
          setProcessStatus('success'); 
          setTimeout(() => setProcessStatus('idle'), 1500); 
        } 
        catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || e.message || t('appointments_process_cancel_fail')); 
          setTimeout(() => setProcessStatus('idle'), 2000); 
        }
      }
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientId || !formData.staffId) return;
    
    setProcessStatus('processing');
    setProcessMessage(editingAppointment ? t('appointments_process_updating') : t('appointments_process_creating'));
    try {
      const payload = { ...formData, patientId: parseInt(formData.patientId), staffId: parseInt(formData.staffId), datetime: `${formData.date}T${formData.time}` };
      if (editingAppointment) await api.updateAppointment(editingAppointment.id, payload);
      else await api.createAppointment(payload);
      await loadData(true);
      setProcessStatus('success');
      setTimeout(() => { setIsModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || e.message || t('appointments_process_save_fail')); 
      setTimeout(() => setProcessStatus('idle'), 2000); 
    }
  };

  const selectedDoctorForFee = useMemo(() => {
    return staff.find(s => s.id.toString() === formData.staffId);
  }, [formData.staffId, staff]);

  const filteredPatientsForModal = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 5);
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || 
      p.patientId.toLowerCase().includes(patientSearch.toLowerCase())
    ).slice(0, 5);
  }, [patients, patientSearch]);

  const selectedPatientData = useMemo(() => {
    return patients.find(p => p.id.toString() === formData.patientId);
  }, [formData.patientId, patients]);

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
    setPatientSearch(apt.patientName);
    setIsModalOpen(true);
  };

  // Helper for availability
  const isDoctorAvailable = (doc: MedicalStaff, dateStr: string) => {
    if (!doc.availableDays || doc.availableDays.length === 0) return true;
    // Robust parsing
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[date.getDay()];
    return doc.availableDays.includes(dayName);
  };

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processStatus === 'processing' ? t('processing') : processStatus === 'success' ? t('success') : t('error')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('close')}</Button>}
          </div>
        </div>
      )}

      {/* COMPACT TOOLBAR - Updated Layout */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-1.5 flex justify-between items-center">
        {/* Left Side: Date Controls */}
        <div className="flex items-center gap-2">
          {viewMode !== 'history' ? (
            <>
                <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500" onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))}>
                        <ChevronLeft size={14} />
                    </button>
                    <div className="relative group">
                        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-primary-500"><CalendarDays size={14}/></div>
                        <input 
                            type="date" 
                            value={formatDate(selectedDate)} 
                            onChange={e => setSelectedDate(new Date(e.target.value))} 
                            className="w-[110px] pl-7 pr-2 py-1 bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none" 
                        />
                    </div>
                    <button className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500" onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))}>
                        <ChevronRight size={14} />
                    </button>
                </div>
                <Button size="sm" variant="secondary" className="text-xs h-7 px-3" onClick={() => setSelectedDate(new Date())}>{t('dashboard_today')}</Button>
            </>
          ) : (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
               <History size={16} className="text-slate-400" />
             </div>
          )}
        </div>
        
        {/* Right Side: New Appointment Button */}
        {canManage && (
            <Button onClick={() => openNewModal()} icon={Plus} size="sm" className="shadow-sm">
                {t('appointments_modal_title')} 
            </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">{t('loading')}</div>
      ) : viewMode === 'grid' ? (
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar -mx-6 px-6">
          {appointmentsByDoctor.length === 0 ? (<div className="flex-1 text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl w-full"><p className="text-slate-500">{t('appointments_list_empty')}</p></div>) : 
           appointmentsByDoctor.map(({ doctor, appointments }) => (<DoctorQueueColumn key={doctor.id} doctor={doctor} appointments={appointments} onStatusUpdate={handleStatusUpdate} onCancel={handleCancel} canManage={canManage} />))}
        </div>
      ) : viewMode === 'list' ? (
        <Card className="!p-0"><ListView appointments={dailyAppointments} onEdit={openEditModal} onView={openViewDetailModal} onCancel={handleCancel} canManage={canManage} /></Card>
      ) : (
        <Card className="!p-0"><HistoryView appointments={appointments} onView={openViewDetailModal} /></Card>
      )}

      {/* NEW/EDIT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAppointment ? t('appointments_modal_edit_title') : t('appointments_modal_title')}>
        <form onSubmit={handleFormSubmit} className="space-y-5">
          
          <div className="space-y-1.5" ref={patientSearchRef}>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
              {t('appointments_form_select_patient')}
            </label>
            {selectedPatientData && !showPatientResults ? (
              <div className="flex items-center justify-between p-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl transition-all">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-primary-600 font-bold text-sm">
                      {selectedPatientData.fullName.charAt(0)}
                   </div>
                   <div className="flex flex-col">
                     <span className="font-black text-primary-900 dark:text-primary-100 leading-none mb-1">{selectedPatientData.fullName}</span>
                     <span className="text-[10px] text-primary-600 dark:text-primary-400 font-black tracking-widest uppercase">ID: {selectedPatientData.patientId}</span>
                   </div>
                 </div>
                 {!editingAppointment && (
                    <button type="button" onClick={() => { setFormData({...formData, patientId: ''}); setPatientSearch(''); setShowPatientResults(true); }} className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full transition-colors">
                      <X size={16} className="text-primary-600" />
                    </button>
                 )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder={t('patients_search_placeholder')}
                  className="pl-9 pr-4 py-3 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientResults(true); }}
                  onFocus={() => setShowPatientResults(true)}
                  disabled={!!editingAppointment}
                />
                {showPatientResults && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-56 overflow-y-auto custom-scrollbar">
                    {filteredPatientsForModal.length > 0 ? (
                      filteredPatientsForModal.map(p => (
                        <button key={p.id} type="button" className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors" onClick={() => { setFormData({ ...formData, patientId: p.id.toString() }); setPatientSearch(p.fullName); setShowPatientResults(false); }}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{p.fullName}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {p.patientId}</span>
                          </div>
                          <ChevronRight size={14} className="text-slate-300" />
                        </button>
                      ))
                    ) : (
                        <div className="p-4 text-center text-slate-400 text-xs italic">{t('no_data')}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Select label={t('appointments_form_select_staff')} required value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})}>
            <option value="">{t('appointments_form_select_staff')}</option>
            {staff.filter(s => s.type === 'doctor' && s.status === 'active').map(s => {
              const isAvailable = isDoctorAvailable(s, formData.date);
              const statusText = isAvailable ? 'Available' : 'Unavailable';
              return (
                <option key={s.id} value={s.id}>{s.fullName} ({s.specialization}) - {statusText}</option>
              );
            })}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label={t('date')} type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
            <Input label={t('appointments_form_time')} type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
          </div>

          <Select label={t('appointments_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
            <option value="Consultation">
              {t('patients_modal_action_consultation')} {selectedDoctorForFee ? ` ($${selectedDoctorForFee.consultationFee})` : ''}
            </option>
            <option value="Follow-up">
              {t('patients_modal_action_followUp')} {selectedDoctorForFee ? ` ($${selectedDoctorForFee.consultationFeeFollowup || 0})` : ''}
            </option>
            <option value="Emergency">
              {t('patients_modal_action_emergency')} {selectedDoctorForFee ? ` ($${selectedDoctorForFee.consultationFeeEmergency || 0})` : ''}
            </option>
          </Select>

          <Textarea label={t('appointments_form_reason')} rows={3} value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
          
          <div className="flex justify-end pt-4 gap-3 border-t">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={!formData.patientId || !formData.staffId} icon={CheckCircle}>
                {editingAppointment ? t('save') : t('appointments_form_create_button')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isViewDetailModalOpen} onClose={() => setIsViewDetailModalOpen(false)} title={t('appointments_modal_view_title')}>
        {viewingAppointment && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
               <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-xl">
                  {viewingAppointment.patientName.charAt(0)}
               </div>
               <div className="flex-1">
                  <h3 className="font-black text-lg text-slate-900 dark:text-white leading-tight">{viewingAppointment.patientName}</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">ID: {viewingAppointment.dailyToken ? `#${viewingAppointment.dailyToken}` : 'N/A'}</p>
               </div>
               <StatusBadge status={viewingAppointment.status} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border rounded-xl">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Stethoscope size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('nav_hr')}</p>
                    <p className="text-sm font-bold">{viewingAppointment.staffName}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border rounded-xl">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Clock size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('date')}</p>
                    <p className="text-sm font-bold">{new Date(viewingAppointment.datetime).toLocaleString()}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border rounded-xl">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Briefcase size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('appointments_form_type')}</p>
                    <p className="text-sm font-bold">{viewingAppointment.type}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border rounded-xl">
                  <div className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg text-slate-400"><Hash size={18}/></div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('patients_modal_view_billing_status')}</p>
                    <p className="text-sm font-bold capitalize">{viewingAppointment.billingStatus}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-2">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('patients_modal_action_reason')}</h4>
               <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border italic text-sm text-slate-600 dark:text-slate-300 min-h-[80px]">
                  "{viewingAppointment.reason || 'No specific reason recorded.'}"
               </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button variant="secondary" onClick={() => setIsViewDetailModalOpen(false)}>{t('close')}</Button>
            </div>
          </div>
        )}
      </Modal>
      
      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({...confirmState, isOpen: false})} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};
