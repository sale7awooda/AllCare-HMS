

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog, CancellationModal } from '../components/UI';
import { 
  Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, AlertTriangle,
  HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, 
  DollarSign, Loader2, XCircle, Sparkles, Thermometer, ChevronRight, X, Info, Save, Trash2,
  ExternalLink, ChevronDown, ChevronUp, History, Filter, ChevronLeft, LayoutGrid, Printer, ClipboardList
} from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

export const Admissions = () => {
  const { accent } = useTheme();
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [activeMainTab, setActiveMainTab] = useState<'ward' | 'history'>('ward');
  
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // History State
  const [historyAdmissions, setHistoryAdmissions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('All');
  const [historyPage, setHistoryPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState<any>({ isOpen: false, title: '', message: '', action: () => {}, type: 'danger' });
  const [cancellationModal, setCancellationModal] = useState<{isOpen: boolean, admissionId: number | null}>({ isOpen: false, admissionId: null });
  
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<any>(null);
  const [inpatientDetails, setInpatientDetails] = useState<any>(null);
  const [careTab, setCareTab] = useState<'overview' | 'notes' | 'reports'>('overview');
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] = useState<any>(null);
  
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', resp: '', insulin: '', gcs: '', spo2: '', sugar: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });

  // Sync Header - Unified with Appointments Style
  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
      <button 
        onClick={() => setActiveMainTab('ward')} 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeMainTab === 'ward' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
      >
        <LayoutGrid size={14}/> {t('admissions_title')} 
        <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeMainTab === 'ward' ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>{activeAdmissions.length}</span>
      </button>
      <button 
        onClick={() => setActiveMainTab('history')} 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeMainTab === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
      >
        <History size={14}/> {t('admissions_tab_history')}
      </button>
    </div>
  ), [activeMainTab, activeAdmissions.length, t]);

  useHeader(t('admissions_title'), t('admissions_subtitle'), HeaderTabs);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bedsData, admissionsData, patientsData, staffData] = await Promise.all([
        api.getBeds(), api.getActiveAdmissions(), api.getPatients(), api.getStaff(),
      ]);
      setBeds(bedsData);
      setActiveAdmissions(admissionsData);
      setPatients(patientsData);
      setStaff(staffData);
      
      const state = location.state as any;
      if (state?.trigger === 'new') {
        const availableBed = bedsData.find((b: any) => b.status === 'available');
        if (availableBed) handleBedClick(availableBed);
        else setProcessStatus('error'), setProcessMessage(t('admissions_process_discharge_fail'));
      }
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
        const data = await api.getAdmissionsHistory();
        setHistoryAdmissions(data);
    } catch(e) { console.error(e); }
    finally { setHistoryLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeMainTab === 'history') loadHistory(); }, [activeMainTab]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculateDays = (dateString: string, endDateString?: string) => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const end = endDateString ? new Date(endDateString) : new Date();
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleBedClick = async (bed: any) => {
    if (bed.status === 'reserved') {
      const admission = activeAdmissions.find(a => a.bedId === bed.id && a.status === 'reserved');
      if (admission) { 
        setSelectedAdmission(admission); 
        setIsConfirmModalOpen(true); 
      }
      return;
    }
    
    if (bed.status === 'occupied') {
      const admission = activeAdmissions.find(a => a.bedId === bed.id && a.status === 'active');
      if (admission) {
        handleViewAdmissionDetails(admission.id);
      }
      return;
    }
    
    if (bed.status === 'available') {
      setSelectedBedForAdmission(bed);
      setAdmitForm({ 
        patientId: '', 
        doctorId: '', 
        entryDate: new Date().toISOString().split('T')[0], 
        deposit: bed.costPerDay.toString(), 
        notes: '' 
      });
      setPatientSearchTerm('');
      setSelectedPatientForAdmission(null);
      setIsAdmitModalOpen(true);
      return;
    }
    
    if (bed.status === 'cleaning') {
      setConfirmState({ 
        isOpen: true, 
        title: t('admissions_dialog_clean_title'), 
        message: t('admissions_dialog_clean_msg'), 
        type: 'info', 
        action: async () => { 
          await api.markBedClean(bed.id); 
          loadData(true); 
        } 
      });
    }
  };

  const handleViewAdmissionDetails = async (admissionId: number) => {
    setProcessStatus('processing');
    setProcessMessage(t('admissions_process_loading_chart'));
    try {
      const details = await api.getInpatientDetails(admissionId);
      setInpatientDetails(details);
      // Pre-fill discharge form if data exists
      if (details.status === 'discharged') {
          setDischargeForm({
              status: details.discharge_status || 'Recovered',
              notes: details.discharge_notes || ''
          });
      } else {
          setDischargeForm({ status: 'Recovered', notes: '' });
      }
      setCareTab('overview');
      setExpandedBillId(null);
      setIsCareModalOpen(true);
    } catch (e) {
      console.error(e);
    } finally {
      setProcessStatus('idle');
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAdmission || !selectedPatientForAdmission || !admitForm.doctorId) return;
    
    setProcessStatus('processing');
    setProcessMessage(t('admissions_process_creating'));
    try {
      await api.createAdmission({ 
        patientId: selectedPatientForAdmission.id, 
        bedId: selectedBedForAdmission.id, 
        doctorId: parseInt(admitForm.doctorId), 
        entryDate: admitForm.entryDate, 
        deposit: parseFloat(admitForm.deposit), 
        notes: admitForm.notes 
      });
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsAdmitModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (err: any) { 
      setProcessStatus('error'); 
      setProcessMessage(err.response?.data?.error || t('error')); 
    }
  };

  const handleConfirmAdmission = async () => {
    if (!selectedAdmission) return;
    setProcessStatus('processing');
    setProcessMessage(t('admissions_process_confirming'));
    try {
      await api.confirmAdmissionDeposit(selectedAdmission.id);
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsConfirmModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (err: any) { 
      setProcessStatus('error'); 
      setProcessMessage(err.response?.data?.error || t('admissions_process_confirm_fail')); 
    }
  };

  const handleCancelClick = () => {
    if (selectedAdmission) {
        setCancellationModal({ isOpen: true, admissionId: selectedAdmission.id });
    }
  };

  const confirmCancel = async (reason: string, note: string) => {
    if (!cancellationModal.admissionId) return;
    setCancellationModal({ isOpen: false, admissionId: null });
    setProcessStatus('processing');
    setProcessMessage(t('admissions_process_cancelling'));
    try {
      await api.cancelAdmission(cancellationModal.admissionId, { reason, note });
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsConfirmModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage(t('admissions_process_cancel_fail'));
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inpatientDetails || !noteForm.note) return;
    setProcessStatus('processing');
    setProcessMessage(t('admissions_process_saving_note'));
    try {
      await api.addInpatientNote(inpatientDetails.id, {
        doctorId: inpatientDetails.doctorId,
        note: noteForm.note,
        vitals: {
          bp: noteForm.bp,
          temp: noteForm.temp,
          pulse: noteForm.pulse,
          resp: noteForm.resp,
          insulin: noteForm.insulin,
          gcs: noteForm.gcs,
          spo2: noteForm.spo2,
          sugar: noteForm.sugar
        }
      });
      const updated = await api.getInpatientDetails(inpatientDetails.id);
      setInpatientDetails(updated);
      setNoteForm({ note: '', bp: '', temp: '', pulse: '', resp: '', insulin: '', gcs: '', spo2: '', sugar: '' });
      setProcessStatus('success');
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage(t('admissions_process_save_note_fail'));
    }
  };

  const handleDischarge = () => {
    if (!inpatientDetails) return;
    const totalDue = inpatientDetails.unpaidBills?.reduce((sum: number, b: any) => sum + (b.total_amount - (b.paid_amount || 0)), 0) || 0;
    if (totalDue > 0.01) {
      setProcessStatus('error');
      setProcessMessage(t('admissions_report_blocked_msg', { balance: totalDue.toLocaleString() }));
      return;
    }
    setConfirmState({
      isOpen: true, 
      title: t('admissions_dialog_discharge_title'), 
      message: t('admissions_dialog_discharge_message'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage(t('admissions_process_discharging'));
        try {
          await api.dischargePatient(inpatientDetails.id, { 
            dischargeNotes: dischargeForm.notes, 
            dischargeStatus: dischargeForm.status 
          });
          setProcessStatus('success');
          await loadData(true);
          // Refresh details to show read-only state
          const updated = await api.getInpatientDetails(inpatientDetails.id);
          setInpatientDetails(updated);
          setTimeout(() => { setProcessStatus('idle'); }, 1000);
        } catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || t('admissions_process_discharge_fail')); 
        }
      }
    });
  };

  const filteredPatientsForAdmission = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) || (p.patientId && p.patientId.toLowerCase().includes(patientSearchTerm.toLowerCase()));
    const isAlreadyAdmitted = activeAdmissions.some(a => a.patientId === p.id);
    return matchesSearch && !isAlreadyAdmitted && p.type !== 'inpatient';
  }).slice(0, 5);

  const totalOutstandingBalance = useMemo(() => {
    if (!inpatientDetails?.unpaidBills) return 0;
    return inpatientDetails.unpaidBills.reduce((sum: number, b: any) => sum + (b.total_amount - (b.paid_amount || 0)), 0);
  }, [inpatientDetails]);

  // History Filtering Logic
  const filteredHistory = useMemo(() => {
    return historyAdmissions.filter(a => {
        const matchesSearch = a.patientName.toLowerCase().includes(historySearch.toLowerCase()) || (a.patientCode && a.patientCode.toLowerCase().includes(historySearch.toLowerCase()));
        const matchesStatus = historyFilterStatus === 'All' || a.status === historyFilterStatus.toLowerCase();
        return matchesSearch && matchesStatus;
    });
  }, [historyAdmissions, historySearch, historyFilterStatus]);

  const paginatedHistory = filteredHistory.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage);
  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'active': return <Badge color="red">{t('admissions_status_occupied')}</Badge>;
          case 'reserved': return <Badge color="blue">{t('admissions_status_reserved')}</Badge>;
          case 'discharged': return <Badge color="green">{t('admissions_status_discharged')}</Badge>;
          case 'cancelled': return <Badge color="gray">{t('appointments_status_cancelled')}</Badge>;
          case 'cleaning': return <Badge color="purple">{t('admissions_status_cleaning')}</Badge>;
          default: return <Badge color="gray">{t(status) || status}</Badge>;
      }
  };

  const formatDoctorName = (name: string) => {
    if (!name) return '';
    const cleanName = name.replace(/^Dr\.\s+/i, '');
    return `Dr. ${cleanName}`;
  };

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2 leading-relaxed">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      {activeMainTab === 'ward' && (
        <>
            <div className="flex gap-3 text-xs font-black uppercase tracking-widest flex-wrap mb-2 no-print">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('admissions_legend_available')}</div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> {t('admissions_legend_reserved')}</div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> {t('admissions_legend_occupied')}</div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800"><div className="w-2 h-2 rounded-full bg-purple-500"></div> {t('admissions_status_cleaning')}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {loading ? (
                  <div className="col-span-full flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="text-slate-500 font-medium">{t('admissions_loading')}</p>
                  </div>
                ) : 
                beds.map(bed => {
                const admission = activeAdmissions.find(a => a.bedId === bed.id);
                const isOccupied = bed.status === 'occupied';
                const isReserved = bed.status === 'reserved';
                return (
                    <div 
                    key={bed.id} 
                    onClick={() => handleBedClick(bed)} 
                    className={`relative p-5 rounded-2xl border-2 transition-all cursor-pointer group flex flex-col h-52 shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                        isOccupied ? 'bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-900/50 hover:border-red-400' : 
                        isReserved ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800 hover:border-blue-500' : 
                        bed.status === 'cleaning' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 hover:border-purple-400' : 
                        'bg-green-50/50 dark:bg-green-900/10 border-green-200 hover:border-green-400'
                    }`}
                    >
                    <div className="flex justify-between items-start mb-3">
                        <div>
                        <h3 className="font-black text-slate-800 dark:text-white text-xl leading-none">{bed.roomNumber}</h3>
                        <p className="text-[10px] font-black uppercase text-slate-400 mt-1 tracking-widest">{bed.type}</p>
                        </div>
                        <div className={`w-3 h-3 rounded-full shrink-0 shadow-sm ${isOccupied ? 'bg-red-500 animate-pulse' : isReserved ? 'bg-blue-500' : bed.status === 'cleaning' ? 'bg-purple-500' : 'bg-green-500'}`} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center w-full min-h-0">
                        {isOccupied || isReserved ? (
                        <div className="w-full text-center flex flex-col justify-center items-center flex-1">
                            <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2 w-full">{admission?.patientName}</p>
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 w-full border-t border-slate-200 dark:border-slate-700 pt-2 mt-auto">
                            <span className="truncate max-w-[60%]">{formatDoctorName(admission?.doctorName)}</span>
                            <span className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border">{calculateDays(admission?.entry_date)}d</span>
                            </div>
                        </div>
                        ) : (
                        <div className="text-center opacity-40 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110 flex flex-col justify-center items-center flex-1">
                            <Plus size={40} className="text-slate-300 dark:text-slate-600 mb-1"/>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{bed.status === 'cleaning' ? t('admissions_status_cleaning') : t('admissions_status_available')}</p>
                        </div>
                        )}
                    </div>
                    </div>
                )
                })}
            </div>
        </>
      )}

      {activeMainTab === 'history' && (
        <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder={t('patients_search_placeholder')}
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        value={historySearch}
                        onChange={e => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <Filter className="text-slate-400 w-4 h-4" />
                    <select 
                        className="pl-2 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
                        value={historyFilterStatus}
                        onChange={e => { setHistoryFilterStatus(e.target.value); setHistoryPage(1); }}
                    >
                        <option value="All">{t('admissions_history_filter_all')}</option>
                        <option value="active">{t('admissions_status_occupied')}</option>
                        <option value="discharged">{t('admissions_status_discharged')}</option>
                        <option value="cancelled">{t('appointments_status_cancelled')}</option>
                        <option value="reserved">{t('admissions_status_reserved')}</option>
                        <option value="cleaning">{t('admissions_status_cleaning')}</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_patient')}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admissions_history_header_room')}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admissions_history_header_dates')}</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('admissions_history_header_doctor')}</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                            <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {historyLoading ? (
                            <tr><td colSpan={6} className="text-center py-20 text-slate-400">{t('loading')}</td></tr>
                        ) : paginatedHistory.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-20 text-slate-400">{t('no_data')}</td></tr>
                        ) : (
                            paginatedHistory.map((adm) => (
                                <tr key={adm.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-bold text-slate-900 dark:text-white">{adm.patientName}</div>
                                        <div className="text-xs text-slate-500">{adm.patientCode}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{adm.roomNumber || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-xs">
                                            <span className="font-bold text-emerald-600">{new Date(adm.entry_date).toLocaleDateString()}</span>
                                            <span className="mx-1 text-slate-400">→</span>
                                            <span className={adm.actual_discharge_date ? 'font-bold text-rose-600' : 'text-slate-400 italic'}>
                                                {adm.actual_discharge_date ? new Date(adm.actual_discharge_date).toLocaleDateString() : t('admissions_date_current')}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5">{t('admissions_bed_days', {count: adm.stayDuration})}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">{adm.doctorName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">{getStatusBadge(adm.status)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <Button size="sm" variant="ghost" onClick={() => handleViewAdmissionDetails(adm.id)}>{t('admissions_history_action_details')}</Button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {!historyLoading && (
                <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 gap-4">
                    <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                        <span>{t('patients_pagination_showing')} {paginatedHistory.length} {t('patients_pagination_of')} {filteredHistory.length}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                            <select 
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setHistoryPage(1); }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setHistoryPage(p => Math.max(1, p-1))} disabled={historyPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p+1))} disabled={historyPage === totalHistoryPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                    </div>
                </div>
            )}
        </Card>
      )}
      
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={t('admissions_modal_reserve_title', { room: selectedBedForAdmission?.roomNumber })}>
        <form onSubmit={handleAdmitSubmit} className="space-y-5">
          <div className="relative space-y-1.5" ref={patientSearchRef}>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{t('patients_table_header_patient')}</label>
            {selectedPatientForAdmission ? (
              <div className="flex items-center justify-between p-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl">
                 <div className="flex flex-col">
                   <span className="font-black text-primary-900 dark:text-primary-100">{selectedPatientForAdmission.fullName}</span>
                   <span className="text-[10px] text-primary-600 dark:text-primary-400 font-black tracking-widest uppercase">ID: {selectedPatientForAdmission.patientId}</span>
                 </div>
                 <button type="button" onClick={() => { setSelectedPatientForAdmission(null); setPatientSearchTerm(''); }} className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full transition-colors">
                   <X size={16} className="text-primary-600" />
                 </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder={t('patients_search_placeholder')}
                  className="pl-9 pr-4 py-3 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  value={patientSearchTerm}
                  onChange={e => {setPatientSearchTerm(e.target.value); setShowPatientResults(true); }}
                  onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && filteredPatientsForAdmission.length > 0 && (
                  <div className="absolute z-50 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl mt-1 shadow-2xl overflow-hidden animate-in fade-in duration-200">
                    {filteredPatientsForAdmission.map(p => (
                      <div key={p.id} className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center" onClick={() => { setSelectedPatientForAdmission(p); setShowPatientResults(false); }}>
                        <span className="font-bold text-sm">{p.fullName}</span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <Select label={t('patients_modal_action_assign_doctor')} required value={admitForm.doctorId} onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})}>
            <option value="">{t('patients_modal_action_select_doctor')}</option>
            {staff.filter(s => s.type === 'doctor' && s.status === 'active').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName} ({doc.specialization})</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('patients_modal_action_admission_date')} type="date" required value={admitForm.entryDate} onChange={e => setAdmitForm({...admitForm, entryDate: e.target.value})} />
            <Input label={t('patients_modal_action_required_deposit')} type="number" required value={admitForm.deposit} onChange={e => setAdmitForm({...admitForm, deposit: e.target.value})} prefix={<DollarSign size={14}/>} />
          </div>
          <Textarea label={t('admissions_care_admission_note')} rows={2} placeholder={t('admissions_modal_reserve_notes_placeholder')} value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />
          <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={!selectedPatientForAdmission || !admitForm.doctorId}>{t('admissions_modal_reserve_button')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title={t('admissions_modal_reserve_manage')}>
        {selectedAdmission && (
          <div className="space-y-6">
             <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">{t('admissions_modal_reserve_holder')}</p>
                <h3 className="text-2xl font-black text-blue-900 dark:text-blue-100 leading-tight">{selectedAdmission.patientName}</h3>
                <div className="flex items-center gap-3 mt-4 text-sm font-bold text-blue-700 dark:text-blue-300">
                  <div className="flex items-center gap-1.5"><Calendar size={16}/> {new Date(selectedAdmission.entry_date).toLocaleDateString()}</div>
                  <div className="flex items-center gap-1.5"><Bed size={16}/> {t('admissions_history_header_room')} {selectedAdmission.roomNumber}</div>
                </div>
             </div>
             <div className="space-y-3">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('admissions_modal_reserve_payment_status')}</h4>
               <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedAdmission.billStatus === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                       {selectedAdmission.billStatus === 'paid' ? <CheckCircle size={20}/> : <Clock size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{t('admissions_modal_reserve_payment_label')}</p>
                      <p className="text-xs text-slate-500 capitalize">{selectedAdmission.billStatus}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg">${selectedAdmission.projected_cost.toLocaleString()}</span>
               </div>
               {selectedAdmission.billStatus !== 'paid' && (
                 <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5 px-1 pt-1">
                   <AlertTriangle size={14}/> {t('admissions_modal_reserve_payment_error')}
                 </p>
               )}
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t dark:border-slate-700">
                <Button variant="danger" icon={X} onClick={handleCancelClick} className="w-full">{t('admissions_bed_cancel_reservation')}</Button>
                <Button 
                  icon={CheckCircle} 
                  disabled={selectedAdmission.billStatus !== 'paid'} 
                  onClick={handleConfirmAdmission}
                  className="w-full"
                >
                  {t('admissions_modal_reserve_confirm_arrival')}
                </Button>
             </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')}>
        {inpatientDetails && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 p-5 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20 no-print">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary-600 shadow-sm font-black text-xl">
                  {inpatientDetails.patientName?.charAt(0)}
                </div>
                <div className="flex-1">
                   <h3 className="font-black text-xl text-slate-900 dark:text-white leading-tight">{inpatientDetails.patientName}</h3>
                   <div className="flex items-center gap-3 text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                     <span className="flex items-center gap-1"><User size={12}/> {inpatientDetails.age}yrs • {inpatientDetails.gender}</span>
                     <span className="flex items-center gap-1 text-red-600"><HeartPulse size={12}/> {inpatientDetails.bloodGroup || 'N/A'}</span>
                   </div>
                </div>
                <div className="text-right">
                   <Badge color="red" className="mb-1 font-black">{t('admissions_history_header_room')} {inpatientDetails.roomNumber}</Badge>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{formatDoctorName(inpatientDetails.doctorName)}</p>
                </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto no-print">
              {[
                { id: 'overview', label: t('admissions_care_tab_overview_label'), icon: Info },
                { id: 'notes', label: t('admissions_care_tab_notes_label'), icon: Activity },
                { id: 'reports', label: t('admissions_care_tab_report_label'), icon: FileText }
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setCareTab(tab.id as any)} 
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${careTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <tab.icon size={14}/> {tab.label}
                </button>
              ))}
            </div>
            {careTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('admissions_care_entry_date_label')}</p>
                            <p className="font-black text-slate-800 dark:text-white">{new Date(inpatientDetails.entry_date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('admissions_care_days_admitted')}</p>
                            <p className="font-black text-slate-800 dark:text-white text-2xl">{inpatientDetails.daysStayed}</p>
                        </div>
                        <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800 text-center">
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">{t('admissions_care_stay_cost')}</p>
                            <p className="font-black text-primary-700 dark:text-primary-400 text-2xl">${(inpatientDetails.daysStayed * inpatientDetails.costPerDay).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('admissions_care_active_bills')}</h4>
                       <div className="space-y-3 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                          {inpatientDetails.unpaidBills?.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 italic text-sm">{t('admissions_care_no_bills')}</div>
                          ) : (
                            inpatientDetails.unpaidBills.map((bill: any) => {
                              const isExpanded = expandedBillId === bill.id;
                              return (
                                <div key={bill.id} className="border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm">
                                  <div 
                                    className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                                    onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 transition-colors ${isExpanded ? 'text-primary-600' : ''}`}>
                                        <DollarSign size={16}/>
                                      </div>
                                      <div>
                                        <p className="font-bold text-sm">{t('admissions_care_bill_prefix')} {bill.bill_number}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{new Date(bill.bill_date).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <p className="font-black text-rose-600 font-mono">${(bill.total_amount - (bill.paid_amount || 0)).toLocaleString()}</p>
                                        <button onClick={(e) => { e.stopPropagation(); navigate('/billing'); }} className="text-[10px] font-black uppercase text-primary-600 hover:underline">{t('admissions_care_pay_now')}</button>
                                      </div>
                                      {isExpanded ? <ChevronUp size={16} className="text-slate-300"/> : <ChevronDown size={16} className="text-slate-300"/>}
                                    </div>
                                  </div>
                                  {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-50 dark:border-slate-800 animate-in slide-in-from-top-2 duration-200">
                                      <div className="space-y-3 pt-3">
                                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('billing_modal_create_items_label')}</h5>
                                        <div className="space-y-2">
                                          {(bill.items || []).map((item: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-xs">
                                              <span className="text-slate-600 dark:text-slate-400 font-medium">{item.description}</span>
                                              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">${item.amount.toLocaleString()}</span>
                                            </div>
                                          ))}
                                        </div>
                                        <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-400 uppercase">{t('admissions_care_total_invoice')}</span>
                                          <span className="font-mono font-black text-slate-900 dark:text-white">${bill.total_amount.toLocaleString()}</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                       </div>
                    </div>
                </div>
            )}
            {careTab === 'notes' && (
              <div className="space-y-6 animate-in fade-in">
                 <form onSubmit={handleAddNote} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={14}/> {t('admissions_care_add_entry')}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       <Input label={t('admissions_care_vitals_bp_short')} placeholder="120/80" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="text-xs" />
                       <Input label={t('admissions_care_vitals_temp_short')} placeholder="37.2" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="text-xs" />
                       <Input label={t('admissions_care_vitals_pulse_short')} placeholder="72" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="text-xs" />
                       <Input label={t('admissions_care_vitals_resp_short')} placeholder="18" value={noteForm.resp} onChange={e => setNoteForm({...noteForm, resp: e.target.value})} className="text-xs" />
                       <Input label="SpO2 (%)" placeholder="98" value={noteForm.spo2} onChange={e => setNoteForm({...noteForm, spo2: e.target.value})} className="text-xs" />
                       <Input label="GCS" placeholder="15/15" value={noteForm.gcs} onChange={e => setNoteForm({...noteForm, gcs: e.target.value})} className="text-xs" />
                       <Input label="Insulin (U)" placeholder="0" value={noteForm.insulin} onChange={e => setNoteForm({...noteForm, insulin: e.target.value})} className="text-xs" />
                       <Input label="Sugar (mg/dL)" placeholder="100" value={noteForm.sugar} onChange={e => setNoteForm({...noteForm, sugar: e.target.value})} className="text-xs" />
                    </div>
                    <Textarea label={t('admissions_care_observations')} rows={3} required placeholder={t('admissions_care_observations_placeholder')} value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} />
                    <Button type="submit" className="w-full" icon={Save}>{t('admissions_care_add_note_button')}</Button>
                 </form>
                 <div className="space-y-4 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {(inpatientDetails.notes || []).length === 0 ? (
                      <div className="p-10 text-center text-slate-300 font-bold italic">{t('admissions_care_no_notes')}</div>
                    ) : (
                      inpatientDetails.notes.map((note: any) => (
                        <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm relative overflow-hidden group">
                           <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-20"></div>
                           <div className="flex justify-between items-start mb-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleString()}</span>
                              <Badge color="blue">{formatDoctorName(note.doctorName)}</Badge>
                           </div>
                           <div className="grid grid-cols-4 gap-2 mb-3 py-2 border-y border-slate-50 dark:border-slate-700">
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">{t('admissions_care_vitals_bp_short')}</p><p className="text-xs font-bold">{note.vitals?.bp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">{t('admissions_care_vitals_temp_short')}</p><p className="text-xs font-bold">{note.vitals?.temp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">{t('admissions_care_vitals_pulse_short')}</p><p className="text-xs font-bold">{note.vitals?.pulse || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">SpO2</p><p className="text-xs font-bold">{note.vitals?.spo2 || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">GCS</p><p className="text-xs font-bold">{note.vitals?.gcs || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Insulin</p><p className="text-xs font-bold">{note.vitals?.insulin || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Sugar</p><p className="text-xs font-bold">{note.vitals?.sugar || '-'}</p></div>
                           </div>
                           <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">"{note.note}"</p>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            )}
            {careTab === 'reports' && (
                <div className="space-y-6 animate-in fade-in" id="medical-report-content">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 no-print">
                       <div>
                          <h4 className="font-bold text-slate-800 dark:text-white">{t('admissions_report_title')}</h4>
                          <p className="text-xs text-slate-500">{t('admissions_report_subtitle')}</p>
                       </div>
                       <Button variant="outline" size="sm" icon={Printer} onClick={() => window.print()}>{t('admissions_report_print')}</Button>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 print:border-none print:p-0 print:shadow-none">
                       {/* Header for Print */}
                       <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-700 pb-6 mb-6">
                          <div>
                             <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('admissions_report_header')}</h2>
                             <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                                <p><span className="font-bold">{t('admissions_report_patient_label')}</span> {inpatientDetails.patientName} ({inpatientDetails.patientCode})</p>
                                <p><span className="font-bold">{t('admissions_report_admission_label')}</span> {new Date(inpatientDetails.entry_date).toLocaleDateString()}</p>
                                <p><span className="font-bold">{t('admissions_report_doctor_label')}</span> {formatDoctorName(inpatientDetails.doctorName)}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg inline-block mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{t('status')}</span>
                                <p className="font-black text-lg text-slate-800 dark:text-white capitalize">{inpatientDetails.status}</p>
                             </div>
                             {inpatientDetails.actual_discharge_date && (
                                <p className="text-sm text-slate-500"><span className="font-bold">{t('admissions_report_discharged_label')}</span> {new Date(inpatientDetails.actual_discharge_date).toLocaleDateString()}</p>
                             )}
                          </div>
                       </div>

                       {/* Clinical Timeline */}
                       <div className="mb-8">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{t('admissions_report_clinical_course')}</h4>
                          {(inpatientDetails.notes || []).length === 0 ? (
                             <p className="text-sm text-slate-400 italic">{t('admissions_report_no_notes')}</p>
                          ) : (
                             <div className="space-y-4">
                                {inpatientDetails.notes.map((note: any) => (
                                   <div key={note.id} className="relative pl-4 border-l-2 border-slate-200 dark:border-slate-700 pb-4 last:pb-0">
                                      <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
                                      <div className="flex justify-between items-baseline mb-1">
                                         <span className="text-xs font-bold text-slate-500">{new Date(note.created_at).toLocaleString()}</span>
                                      </div>
                                      <p className="text-sm text-slate-800 dark:text-slate-300 mb-2 leading-relaxed">{note.note}</p>
                                      <div className="flex flex-wrap gap-3 text-[10px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded inline-flex">
                                         <span>{t('admissions_care_vitals_bp_short')}: {note.vitals?.bp || '-'}</span>
                                         <span className="w-px h-3 bg-slate-300 dark:bg-slate-600"></span>
                                         <span>{t('admissions_care_vitals_temp_short')}: {note.vitals?.temp || '-'}°C</span>
                                         <span className="w-px h-3 bg-slate-300 dark:bg-slate-600"></span>
                                         <span>SpO2: {note.vitals?.spo2 || '-'}%</span>
                                         <span className="w-px h-3 bg-slate-300 dark:bg-slate-600"></span>
                                         <span>Sugar: {note.vitals?.sugar || '-'}</span>
                                      </div>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>

                       {/* Discharge Section */}
                       <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">{t('admissions_report_discharge_summary')}</h4>
                          {inpatientDetails.status === 'active' ? (
                             <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 no-print">
                                {totalOutstandingBalance > 0.01 ? (
                                  <div className="flex items-start gap-3 text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800 mb-4">
                                     <AlertTriangle className="shrink-0 mt-0.5" size={18}/>
                                     <div>
                                        <p className="font-bold text-sm">{t('admissions_report_blocked_title')}</p>
                                        <p className="text-xs mt-1">{t('admissions_report_blocked_msg', { balance: totalOutstandingBalance.toLocaleString() })}</p>
                                        <button onClick={() => navigate('/billing')} className="text-xs underline font-bold mt-2 hover:text-amber-800">{t('admissions_report_go_billing')}</button>
                                     </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Select label={t('admissions_care_discharge_status')} value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                                           <option value="Recovered">{t('admissions_care_discharge_status_recovered')}</option>
                                           <option value="Stable">{t('admissions_care_discharge_status_stable')}</option>
                                           <option value="Transferred">{t('admissions_care_discharge_status_transferred')}</option>
                                           <option value="AMA">{t('admissions_care_discharge_status_ama')}</option>
                                           <option value="Deceased">{t('admissions_care_discharge_status_deceased')}</option>
                                        </Select>
                                     </div>
                                     <Textarea label={t('admissions_report_final_note_label')} rows={4} placeholder={t('admissions_report_final_note_placeholder')} value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} />
                                     <div className="flex justify-end pt-2">
                                        <Button icon={LogOut} onClick={handleDischarge}>{t('admissions_report_finalize_button')}</Button>
                                     </div>
                                  </div>
                                )}
                             </div>
                          ) : (
                             <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                   <div><p className="text-xs text-slate-500 uppercase font-bold">{t('admissions_report_outcome_label')}</p><p className="font-bold text-slate-800 dark:text-white">{inpatientDetails.discharge_status}</p></div>
                                   <div><p className="text-xs text-slate-500 uppercase font-bold">{t('admissions_report_discharge_date_label')}</p><p className="font-bold text-slate-800 dark:text-white">{new Date(inpatientDetails.actual_discharge_date).toLocaleDateString()}</p></div>
                                </div>
                                <div>
                                   <p className="text-xs text-slate-500 uppercase font-bold mb-1">{t('admissions_report_final_note_header')}</p>
                                   <p className="text-sm text-slate-700 dark:text-slate-300 italic">"{inpatientDetails.discharge_notes || t('admissions_report_no_discharge_notes')}"</p>
                                </div>
                             </div>
                          )}
                       </div>
                    </div>
                </div>
            )}
          </div>
        )}
      </Modal>

      <CancellationModal
        isOpen={cancellationModal.isOpen}
        onClose={() => setCancellationModal({ isOpen: false, admissionId: null })}
        onConfirm={confirmCancel}
        title={t('admissions_bed_cancel_reservation')}
      />
      <ConfirmationDialog 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })} 
        onConfirm={() => { confirmState.action(); setConfirmState({ ...confirmState, isOpen: false }); }} 
        title={confirmState.title} 
        message={confirmState.message} 
        type={confirmState.type} 
      />
      <style>{`
        @media print {
          body * { display: none !important; }
          #medical-report-content, #medical-report-content * { display: block !important; visibility: visible !important; }
          #medical-report-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; background: white; color: black; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};
