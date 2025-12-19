
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { 
  Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, AlertTriangle,
  HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, 
  DollarSign, Loader2, XCircle, Sparkles, Thermometer, ChevronRight, X, Info, Save, Trash2,
  ExternalLink, ChevronDown, ChevronUp, Stethoscope, LayoutGrid, List, Download, Filter
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
  
  const [activeTab, setActiveTab] = useState<'ward' | 'records'>('ward');
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState<any>({ isOpen: false, title: '', message: '', action: () => {}, type: 'danger' });
  
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<any>(null);
  const [inpatientDetails, setInpatientDetails] = useState<any>(null);
  const [careTab, setCareTab] = useState<'overview' | 'notes' | 'discharge'>('overview');
  const [expandedBillId, setExpandedBillId] = useState<number | null>(null);
  
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] = useState<any>(null);
  
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', spo2: '', insulin: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });

  const [historyFilter, setHistoryFilter] = useState({ search: '', status: 'all' });

  // Sync Header
  useHeader(
    t('admissions_title'), 
    t('admissions_subtitle'),
    <Badge color="blue" className="px-4 py-2 font-bold">{activeAdmissions.length} {t('admissions_legend_occupied')} / {beds.length} Total</Badge>
  );

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
        else setProcessStatus('error'), setProcessMessage('No beds available for new admission.');
      }
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (activeTab === 'records') {
        setLoading(true);
        api.getAdmissionHistory()
           .then(setHistory)
           .finally(() => setLoading(false));
    }
  }, [activeTab]);

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

  const filteredHistory = useMemo(() => {
      return history.filter(h => {
          const matchSearch = h.patientName.toLowerCase().includes(historyFilter.search.toLowerCase()) || 
                              h.roomNumber.toLowerCase().includes(historyFilter.search.toLowerCase()) ||
                              h.doctorName?.toLowerCase().includes(historyFilter.search.toLowerCase());
          const matchStatus = historyFilter.status === 'all' || h.status === historyFilter.status;
          return matchSearch && matchStatus;
      });
  }, [history, historyFilter]);

  const handleExportHistory = () => {
    const headers = ["Admission ID", "Patient", "Room", "Type", "Doctor", "Entry Date", "Discharge Date", "Status", "Outcome", "Est. Cost"];
    const rows = filteredHistory.map(h => [
        h.id,
        h.patientName,
        h.roomNumber,
        h.bedType,
        h.doctorName,
        new Date(h.entry_date).toLocaleDateString(),
        h.actual_discharge_date ? new Date(h.actual_discharge_date).toLocaleDateString() : 'N/A',
        h.status,
        h.discharge_status || '-',
        h.projected_cost
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(',')).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `AllCare_Admission_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        setProcessStatus('processing');
        setProcessMessage('Loading inpatient chart...');
        try {
          const details = await api.getInpatientDetails(admission.id);
          setInpatientDetails(details);
          setCareTab('overview');
          setExpandedBillId(null);
          setIsCareModalOpen(true);
        } catch (e) {
          console.error(e);
        } finally {
          setProcessStatus('idle');
        }
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
        title: 'Mark as Cleaned', 
        message: 'Is the room sanitized and ready for the next patient?', 
        type: 'info', 
        action: async () => { 
          await api.markBedClean(bed.id); 
          loadData(true); 
        } 
      });
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAdmission || !selectedPatientForAdmission || !admitForm.doctorId) return;
    
    setProcessStatus('processing');
    setProcessMessage('Creating admission record...');
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
      setProcessMessage(err.response?.data?.error || 'Failed to admit patient.'); 
    }
  };

  const handleConfirmAdmission = async () => {
    if (!selectedAdmission) return;
    setProcessStatus('processing');
    setProcessMessage('Confirming patient arrival and occupancy...');
    try {
      await api.confirmAdmissionDeposit(selectedAdmission.id);
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsConfirmModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (err: any) { 
      setProcessStatus('error'); 
      setProcessMessage(err.response?.data?.error || 'Failed to confirm arrival. Ensure deposit is paid.'); 
    }
  };

  const handleCancelAdmission = () => {
    if (!selectedAdmission) return;
    setConfirmState({
      isOpen: true,
      title: t('admissions_bed_cancel_reservation'),
      message: 'Are you sure you want to cancel this reservation? This will free up the bed.',
      type: 'danger',
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Cancelling reservation...');
        try {
          await api.cancelAdmission(selectedAdmission.id);
          setProcessStatus('success');
          await loadData(true);
          setTimeout(() => { setIsConfirmModalOpen(false); setProcessStatus('idle'); }, 1500);
        } catch (e) {
          setProcessStatus('error');
          setProcessMessage('Failed to cancel reservation.');
        }
      }
    });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inpatientDetails || !noteForm.note) return;
    setProcessStatus('processing');
    setProcessMessage('Saving clinical note...');
    try {
      await api.addInpatientNote(inpatientDetails.id, {
        doctorId: inpatientDetails.doctorId,
        note: noteForm.note,
        vitals: {
          bp: noteForm.bp,
          temp: noteForm.temp,
          pulse: noteForm.pulse,
          spo2: noteForm.spo2, 
          insulin: noteForm.insulin
        }
      });
      const updated = await api.getInpatientDetails(inpatientDetails.id);
      setInpatientDetails(updated);
      setNoteForm({ note: '', bp: '', temp: '', pulse: '', spo2: '', insulin: '' });
      setProcessStatus('success');
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage('Failed to save note.');
    }
  };

  const handleDischarge = () => {
    if (!inpatientDetails) return;
    const totalDue = inpatientDetails.unpaidBills?.reduce((sum: number, b: any) => sum + (b.total_amount - (b.paid_amount || 0)), 0) || 0;
    if (totalDue > 0.01) {
      setProcessStatus('error');
      setProcessMessage(`Patient discharge blocked. There is an outstanding balance of $${totalDue.toLocaleString()}. Please settle all invoices in the Billing section before proceeding.`);
      return;
    }
    setConfirmState({
      isOpen: true, 
      title: t('admissions_dialog_discharge_title'), 
      message: t('admissions_dialog_discharge_message'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Processing final discharge logic...');
        try {
          await api.dischargePatient(inpatientDetails.id, { 
            dischargeNotes: dischargeForm.notes, 
            dischargeStatus: dischargeForm.status 
          });
          setProcessStatus('success');
          await loadData(true);
          setTimeout(() => { setIsCareModalOpen(false); setProcessStatus('idle'); }, 2000);
        } catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || 'Ensure all bills are paid before discharge.'); 
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

      {/* Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit mb-6 overflow-x-auto no-print">
          <button onClick={() => setActiveTab('ward')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ward' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              <LayoutGrid size={18} /> Ward View
          </button>
          <button onClick={() => setActiveTab('records')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'records' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              <List size={18} /> Admission Records
          </button>
      </div>

      {activeTab === 'ward' && (
        <>
          <div className="flex gap-3 text-xs font-black uppercase tracking-widest flex-wrap mb-2 no-print">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('admissions_legend_available')}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> {t('admissions_legend_reserved')}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> {t('admissions_legend_occupied')}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Cleaning</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary-600 mb-2"/><p className="text-slate-500 font-medium">{t('admissions_loading')}</p></div> : 
            beds.map(bed => {
              const admission = activeAdmissions.find(a => a.bedId === bed.id);
              const isOccupied = bed.status === 'occupied';
              const isReserved = bed.status === 'reserved';
              const isCleaning = bed.status === 'cleaning';
              const isAvailable = bed.status === 'available';

              return (
                <div 
                  key={bed.id} 
                  onClick={() => handleBedClick(bed)} 
                  className={`
                    relative rounded-2xl border transition-all cursor-pointer group flex flex-col h-48 shadow-sm hover:shadow-lg hover:-translate-y-1 overflow-hidden
                    ${isOccupied ? 'bg-rose-50/50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-900/50 hover:border-rose-400' : 
                      isReserved ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 hover:border-blue-400' : 
                      isCleaning ? 'bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:border-purple-400' : 
                      'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:ring-1 hover:ring-emerald-400/30'
                    }
                  `}
                >
                  {/* Header Status Strip */}
                  <div className={`h-1.5 w-full ${
                    isOccupied ? 'bg-rose-500' : isReserved ? 'bg-blue-500' : isCleaning ? 'bg-purple-500' : 'bg-emerald-500'
                  }`} />

                  <div className="flex-1 flex flex-col p-4 justify-between">
                    
                    {/* Card Header: Room Number and Type */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-slate-800 dark:text-white text-2xl leading-none tracking-tight">{bed.roomNumber}</h3>
                        <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded mt-1.5 ${
                          isOccupied ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                          isReserved ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                          isCleaning ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                          'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {bed.type}
                        </span>
                      </div>
                      {/* Status Indicator / Icon */}
                      <div className={`p-1.5 rounded-full ${
                        isOccupied ? 'bg-rose-100 text-rose-600' : 
                        isReserved ? 'bg-blue-100 text-blue-600' : 
                        isCleaning ? 'bg-purple-100 text-purple-600' : 
                        'bg-emerald-50 text-emerald-600'
                      }`}>
                        {isCleaning ? <Sparkles size={14} /> : isOccupied || isReserved ? <User size={14} /> : <CheckCircle size={14} />}
                      </div>
                    </div>

                    {/* Card Body: Patient Name or Action */}
                    <div className="flex-1 flex flex-col justify-center">
                      {isOccupied || isReserved ? (
                        <div className="w-full">
                          <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug" title={admission?.patientName}>
                            {admission?.patientName || 'Unknown Patient'}
                          </p>
                        </div>
                      ) : (
                        <div className={`flex flex-col items-center justify-center transition-all ${isCleaning ? 'opacity-50' : 'opacity-40 group-hover:opacity-100 group-hover:scale-105'}`}>
                          {isCleaning ? (
                            <>
                              <Wrench size={24} className="text-purple-400 mb-1"/>
                              <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Cleaning</p>
                            </>
                          ) : (
                            <>
                              <Plus size={28} className="text-emerald-500 mb-1"/>
                              <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">{t('admissions_bed_click_to_admit')}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Metadata */}
                    {(isOccupied || isReserved) && (
                      <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1 truncate max-w-[60%]" title={`Dr. ${admission?.doctorName}`}>
                          <Stethoscope size={12} className="shrink-0" />
                          <span className="truncate">{admission?.doctorName?.split(' ').slice(-1)[0]}</span>
                        </div>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700 shadow-sm">
                          <Clock size={10} className="text-slate-400" />
                          <span className="font-bold">{calculateDays(admission?.entry_date)}d</span>
                        </div>
                      </div>
                    )}
                    
                    {isAvailable && (
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
                          <p className="text-[10px] text-slate-400 font-mono">${bed.costPerDay}/day</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {activeTab === 'records' && (
        <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                        type="text"
                        placeholder="Search patient, room, doctor..."
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        value={historyFilter.search}
                        onChange={e => setHistoryFilter({...historyFilter, search: e.target.value})}
                    />
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                        <select 
                            className="pl-9 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
                            value={historyFilter.status}
                            onChange={e => setHistoryFilter({...historyFilter, status: e.target.value})}
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="discharged">Discharged</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="reserved">Reserved</option>
                        </select>
                    </div>
                    <Button variant="outline" onClick={handleExportHistory} icon={Download} className="whitespace-nowrap">Export CSV</Button>
                </div>
            </div>
            
            <div className="overflow-x-auto min-h-[400px]">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Patient Info</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Outcome</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? <tr><td colSpan={5} className="text-center py-20 text-slate-400">Loading records...</td></tr> :
                         filteredHistory.length === 0 ? <tr><td colSpan={5} className="text-center py-20 text-slate-400">No records found.</td></tr> :
                         filteredHistory.map(h => {
                             const days = calculateDays(h.entry_date, h.actual_discharge_date);
                             return (
                                 <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         <div className="font-bold text-slate-900 dark:text-white">{h.patientName}</div>
                                         <div className="text-xs text-slate-500">ID: {h.patientCode}</div>
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         <div className="font-bold">Room {h.roomNumber}</div>
                                         <div className="text-xs text-slate-500">{h.bedType}</div>
                                         <div className="text-xs text-slate-400 mt-0.5">Dr. {h.doctorName}</div>
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         <div className="text-sm font-medium">{new Date(h.entry_date).toLocaleDateString()}</div>
                                         {h.actual_discharge_date && (
                                             <div className="text-xs text-slate-500">
                                                 to {new Date(h.actual_discharge_date).toLocaleDateString()} ({days} days)
                                             </div>
                                         )}
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         <Badge color={h.status === 'active' ? 'green' : h.status === 'discharged' ? 'blue' : h.status === 'cancelled' ? 'red' : 'yellow'}>
                                             {h.status}
                                         </Badge>
                                     </td>
                                     <td className="px-6 py-4 whitespace-nowrap">
                                         {h.discharge_status ? (
                                             <span className="text-sm font-medium">{h.discharge_status}</span>
                                         ) : <span className="text-slate-300">-</span>}
                                     </td>
                                 </tr>
                             );
                         })}
                    </tbody>
                </table>
            </div>
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
          <Textarea label={t('admissions_care_admission_note')} rows={2} placeholder="Initial clinical summary..." value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />
          <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={!selectedPatientForAdmission || !admitForm.doctorId}>{t('admissions_modal_reserve_button')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Manage Reservation">
        {selectedAdmission && (
          <div className="space-y-6">
             <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Reservation Holder</p>
                <h3 className="text-2xl font-black text-blue-900 dark:text-blue-100 leading-tight">{selectedAdmission.patientName}</h3>
                <div className="flex items-center gap-3 mt-4 text-sm font-bold text-blue-700 dark:text-blue-300">
                  <div className="flex items-center gap-1.5"><Calendar size={16}/> {new Date(selectedAdmission.entry_date).toLocaleDateString()}</div>
                  <div className="flex items-center gap-1.5"><Bed size={16}/> Room {selectedAdmission.roomNumber}</div>
                </div>
             </div>
             <div className="space-y-3">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Payment Status</h4>
               <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedAdmission.billStatus === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                       {selectedAdmission.billStatus === 'paid' ? <CheckCircle size={20}/> : <Clock size={20}/>}
                    </div>
                    <div>
                      <p className="font-bold text-sm">Deposit Payment</p>
                      <p className="text-xs text-slate-500 capitalize">{selectedAdmission.billStatus}</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-lg">${selectedAdmission.projected_cost.toLocaleString()}</span>
               </div>
               {selectedAdmission.billStatus !== 'paid' && (
                 <p className="text-xs text-rose-500 font-bold flex items-center gap-1.5 px-1 pt-1">
                   <AlertTriangle size={14}/> Admission cannot be confirmed until deposit is paid in full.
                 </p>
               )}
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t dark:border-slate-700">
                <Button variant="danger" icon={X} onClick={handleCancelAdmission} className="w-full">{t('admissions_bed_cancel_reservation')}</Button>
                <Button 
                  icon={CheckCircle} 
                  disabled={selectedAdmission.billStatus !== 'paid'} 
                  onClick={handleConfirmAdmission}
                  className="w-full"
                >
                  Confirm Arrival
                </Button>
             </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')}>
        {inpatientDetails && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4 p-5 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/20">
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
                   <Badge color="red" className="mb-1 font-black">Room {inpatientDetails.roomNumber}</Badge>
                   <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Dr. {inpatientDetails.doctorName}</p>
                </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
              {[
                { id: 'overview', label: 'Stay Overview', icon: Info },
                { id: 'notes', label: 'Daily Notes & Vitals', icon: Activity },
                { id: 'discharge', label: 'Discharge Plan', icon: LogOut }
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
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Date</p>
                            <p className="font-black text-slate-800 dark:text-white">{new Date(inpatientDetails.entry_date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Days Admitted</p>
                            <p className="font-black text-slate-800 dark:text-white text-2xl">{inpatientDetails.daysStayed}</p>
                        </div>
                        <div className="bg-primary-50 dark:bg-primary-900/10 p-4 rounded-2xl border border-primary-100 dark:border-primary-800 text-center">
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mb-1">Stay Cost</p>
                            <p className="font-black text-primary-700 dark:text-primary-400 text-2xl">${(inpatientDetails.daysStayed * inpatientDetails.costPerDay).toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="space-y-3">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Active Medical Bills</h4>
                       <div className="space-y-3 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden">
                          {inpatientDetails.unpaidBills?.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 italic text-sm">No outstanding bills for this stay.</div>
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
                                        <p className="font-bold text-sm">Bill #{bill.bill_number}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{new Date(bill.bill_date).toLocaleDateString()}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <div className="text-right">
                                        <p className="font-black text-rose-600 font-mono">${(bill.total_amount - (bill.paid_amount || 0)).toLocaleString()}</p>
                                        <button onClick={(e) => { e.stopPropagation(); navigate('/billing'); }} className="text-[10px] font-black uppercase text-primary-600 hover:underline">Pay Now</button>
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
                                          <span className="text-[10px] font-black text-slate-400 uppercase">Total Invoice</span>
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
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={14}/> Add New Entry</h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                       <Input label="BP" placeholder="120/80" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="text-xs" />
                       <Input label="Temp (°C)" placeholder="37.2" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="text-xs" />
                       <Input label="Pulse" placeholder="72" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="text-xs" />
                       <Input label="SpO2 (%)" placeholder="98" value={noteForm.spo2} onChange={e => setNoteForm({...noteForm, spo2: e.target.value})} className="text-xs" />
                       <Input label="Insulin" placeholder="Units" value={noteForm.insulin} onChange={e => setNoteForm({...noteForm, insulin: e.target.value})} className="text-xs" />
                    </div>
                    <Textarea label="Observations" rows={3} required placeholder="Enter clinical notes and progress..." value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} />
                    <Button type="submit" className="w-full" icon={Save}>Add Note to Chart</Button>
                 </form>
                 <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {/* FIX: Improved empty state check for visibility after add */}
                    {(inpatientDetails.notes || []).length === 0 ? (
                      <div className="p-10 text-center text-slate-300 font-bold italic">No notes recorded yet.</div>
                    ) : (
                      inpatientDetails.notes.map((note: any) => (
                        <div key={note.id} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border shadow-sm relative overflow-hidden group">
                           <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-20"></div>
                           <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleString()}</span>
                              <Badge color="blue">{note.doctorName}</Badge>
                           </div>
                           <div className="grid grid-cols-5 gap-2 mb-2 py-2 border-y border-slate-50 dark:border-slate-700">
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">BP</p><p className="text-xs font-bold">{note.vitals?.bp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Temp</p><p className="text-xs font-bold">{note.vitals?.temp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Pulse</p><p className="text-xs font-bold">{note.vitals?.pulse || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">SpO2</p><p className="text-xs font-bold">{note.vitals?.spo2 || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Insulin</p><p className="text-xs font-bold">{note.vitals?.insulin || '-'}</p></div>
                           </div>
                           <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">"{note.note}"</p>
                        </div>
                      ))
                    )}
                 </div>
              </div>
            )}
            {careTab === 'discharge' && (
                <div className="space-y-6 animate-in fade-in">
                    {totalOutstandingBalance > 0.01 ? (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-3xl border border-amber-200 dark:border-amber-800 flex flex-col gap-4">
                        <div className="flex items-start gap-4">
                           <AlertTriangle size={24} className="text-amber-500 shrink-0 mt-1" />
                           <div>
                              <h4 className="font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest text-xs">Pending Invoices Detected</h4>
                              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                                Patient has an outstanding balance of <span className="font-bold">${totalOutstandingBalance.toLocaleString()}</span>. 
                                Discharge is <span className="underline decoration-2">not possible</span> until all pending bills are settled.
                              </p>
                           </div>
                        </div>
                        <div className="flex justify-end">
                           <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate('/billing')} icon={ExternalLink}>
                             Go to Billing to Settle
                           </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-3xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-4">
                          <AlertCircle className="text-rose-500 shrink-0 mt-1" />
                          <div>
                             <h4 className="font-black text-rose-900 dark:text-rose-200 uppercase tracking-widest text-xs">Ready for Departure?</h4>
                             <p className="text-sm text-rose-700 dark:text-rose-400 mt-1">Patient will be removed from the active ward list. Bed will be marked for cleaning.</p>
                          </div>
                      </div>
                    )}
                    <div className="space-y-4">
                       <Select label={t('admissions_care_discharge_status')} value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                          <option value="Recovered">Recovered / Healthy</option>
                          <option value="Stable">Stable / Home Care</option>
                          <option value="Transferred">Transferred to Specialized Facility</option>
                          <option value="AMA">Discharged Against Medical Advice</option>
                       </Select>
                       <Textarea label={t('admissions_care_discharge_summary')} rows={4} placeholder="Final summary of the stay..." value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} />
                       <Button 
                         className="w-full py-4 text-md" 
                         icon={totalOutstandingBalance > 0.01 ? DollarSign : LogOut} 
                         onClick={totalOutstandingBalance > 0.01 ? () => navigate('/billing') : handleDischarge}
                         variant={totalOutstandingBalance > 0.01 ? 'secondary' : 'primary'}
                       >
                         {totalOutstandingBalance > 0.01 ? 'Go to Billing to Settle Balance' : 'Complete Final Discharge'}
                       </Button>
                    </div>
                </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationDialog 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })} 
        onConfirm={() => { confirmState.action(); setConfirmState({ ...confirmState, isOpen: false }); }} 
        title={confirmState.title} 
        message={confirmState.message} 
        type={confirmState.type} 
      />
    </div>
  );
};
