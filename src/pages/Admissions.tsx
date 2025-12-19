
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { 
  Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, AlertTriangle,
  HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, 
  DollarSign, Loader2, XCircle, Sparkles, Thermometer, ChevronRight, X, Info, Save, Trash2,
  ExternalLink, ChevronDown, ChevronUp, Stethoscope, LayoutGrid, List, Download, Filter,
  History, Users, Home, ClipboardList, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { getStatusColor, formatMoney, calculateDurationDays } from '../utils/formatters';

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
  const [confirmState, setConfirmState] = useState<any>({ isOpen: false, title: '', message: '', action: () => {}, type: 'danger', confirmLabel: 'Confirm' });
  
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
    <div className="flex gap-2">
       <Button variant="secondary" size="sm" icon={Download} onClick={() => setActiveTab('records')}>{t('nav_records')}</Button>
    </div>
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

  const totalOutstandingBalance = useMemo(() => {
    if (!inpatientDetails?.unpaidBills) return 0;
    return inpatientDetails.unpaidBills.reduce((sum: number, b: any) => sum + (b.total_amount - (b.paid_amount || 0)), 0);
  }, [inpatientDetails]);

  const wardStats = useMemo(() => {
    const total = beds.length || 0;
    const occupied = beds.filter(b => b.status === 'occupied').length;
    const cleaning = beds.filter(b => b.status === 'cleaning').length;
    const available = beds.filter(b => b.status === 'available').length;
    const reserved = beds.filter(b => b.status === 'reserved').length;
    const occupancyRate = total ? Math.round((occupied / total) * 100) : 0;
    
    return { total, occupied, cleaning, available, reserved, occupancyRate };
  }, [beds]);

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
        setProcessMessage('Accessing patient chart...');
        try {
          const details = await api.getInpatientDetails(admission.id);
          setInpatientDetails(details);
          setCareTab('overview');
          setExpandedBillId(null);
          setIsCareModalOpen(true);
        } catch (e) { console.error(e); } finally { setProcessStatus('idle'); }
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
        title: 'Sanitation Check', 
        message: 'Has this room been fully sanitized and inspected for the next admission?', 
        type: 'info', 
        confirmLabel: 'Ready for Patient',
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
    setProcessMessage('Finalizing admission details...');
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

  // Fixed function name to handleDischarge
  const handleDischarge = () => {
    if (!inpatientDetails) return;
    if (totalOutstandingBalance > 0.01) {
      setProcessStatus('error');
      setProcessMessage(`Discharge Blocked: Outstanding balance of $${totalOutstandingBalance.toLocaleString()} detected. Clearance from billing is mandatory.`);
      return;
    }
    setConfirmState({
      isOpen: true, 
      title: 'Authorize Discharge', 
      message: 'This will finalize clinical records and initiate the room cleaning protocol. Proceed?',
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Processing exit protocol...');
        try {
          await api.dischargePatient(inpatientDetails.id, { 
            dischargeNotes: dischargeForm.notes, 
            dischargeStatus: dischargeForm.status 
          });
          setProcessStatus('success');
          await loadData(true);
          setTimeout(() => { setIsCareModalOpen(false); setProcessStatus('idle'); }, 1500);
        } catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || 'Validation error during discharge.'); 
        }
      }
    });
  };

  // Fixed scoping and dependency for filtered patients
  const filteredPatientsForAdmission = useMemo(() => {
    return patients.filter(p => {
        const matchesSearch = p.fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) || (p.patientId && p.patientId.toLowerCase().includes(patientSearchTerm.toLowerCase()));
        const isAlreadyAdmitted = activeAdmissions.some(a => a.patientId === p.id);
        return matchesSearch && !isAlreadyAdmitted && p.type !== 'inpatient';
    }).slice(0, 5);
  }, [patients, patientSearchTerm, activeAdmissions]);

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('error')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      {/* Ward Dashboard Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 no-print">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm border-l-4 border-l-primary-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Occupancy</p>
            <p className="text-2xl font-black text-slate-800 dark:text-white">{wardStats.occupancyRate}%</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm border-l-4 border-l-emerald-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available</p>
            <p className="text-2xl font-black text-emerald-600">{wardStats.available}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm border-l-4 border-l-blue-400">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reserved</p>
            <p className="text-2xl font-black text-blue-600">{wardStats.reserved}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm border-l-4 border-l-purple-500">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cleaning</p>
            <p className="text-2xl font-black text-purple-600">{wardStats.cleaning}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm border-l-4 border-l-slate-300">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Shift</p>
            <div className="flex items-center gap-1 text-sm font-bold text-slate-600 dark:text-slate-300 mt-1">
               <Clock size={14}/> {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
      </div>

      {/* Main Navigation */}
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit no-print">
          <button onClick={() => setActiveTab('ward')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'ward' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              <LayoutGrid size={18} /> Interactive Ward
          </button>
          <button onClick={() => setActiveTab('records')} className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'records' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
              <History size={18} /> Admission History
          </button>
      </div>

      {activeTab === 'ward' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {loading ? <div className="col-span-full py-20 text-center animate-pulse"><Bed className="mx-auto text-slate-300 mb-2" size={40}/><p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Syncing Floor Plan...</p></div> : 
          beds.map(bed => {
            const admission = activeAdmissions.find(a => a.bedId === bed.id);
            const status = bed.status;
            const days = admission ? calculateDurationDays(admission.entry_date) : 0;

            return (
              <div 
                key={bed.id} 
                onClick={() => handleBedClick(bed)}
                className={`
                  relative rounded-2xl border-2 transition-all duration-300 cursor-pointer group flex flex-col h-48 shadow-sm hover:shadow-xl hover:-translate-y-1.5 overflow-hidden
                  ${status === 'occupied' ? 'border-rose-100 bg-rose-50/20 dark:border-rose-900/40' : 
                    status === 'reserved' ? 'border-blue-100 bg-blue-50/20 dark:border-blue-900/40' : 
                    status === 'cleaning' ? 'border-purple-100 bg-purple-50/20 dark:border-purple-900/40' : 
                    'border-slate-100 bg-white dark:bg-slate-800 dark:border-slate-700 hover:border-emerald-400 hover:ring-4 hover:ring-emerald-400/5'}
                `}
              >
                <div className={`h-1.5 w-full ${
                  status === 'occupied' ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 
                  status === 'reserved' ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 
                  status === 'cleaning' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 
                  'bg-emerald-500'
                }`} />

                <div className="flex-1 flex flex-col p-4">
                  <div className="flex justify-between items-start mb-auto">
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-white text-2xl leading-none tracking-tighter">{bed.roomNumber}</h3>
                      <Badge color="gray" className="mt-2 text-[8px] font-black uppercase tracking-widest opacity-70">{bed.type}</Badge>
                    </div>
                    <div className={`p-2 rounded-xl ${
                      status === 'occupied' ? 'bg-rose-100 text-rose-600' : 
                      status === 'reserved' ? 'bg-blue-100 text-blue-600' : 
                      status === 'cleaning' ? 'bg-purple-100 text-purple-600' : 
                      'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors'
                    }`}>
                      {status === 'cleaning' ? <Sparkles size={16} /> : status === 'occupied' || status === 'reserved' ? <User size={16} /> : <Plus size={16} />}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col justify-center">
                    {admission ? (
                      <div className="w-full">
                        <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-1 leading-snug group-hover:text-primary-600 transition-colors">
                          {admission.patientName}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1 truncate">{admission.patientCode}</p>
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center justify-center transition-all ${status === 'cleaning' ? 'opacity-100' : 'opacity-20 group-hover:opacity-100 group-hover:scale-105'}`}>
                        {status === 'cleaning' ? (
                          <>
                            <Wrench size={24} className="text-purple-400 mb-1"/>
                            <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest">Sanitizing</p>
                          </>
                        ) : (
                          <>
                            <Bed size={28} className="text-emerald-500 mb-1"/>
                            <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">Ready</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {admission && (
                    <div className="pt-3 mt-auto border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                        <Stethoscope size={12} className="shrink-0 text-primary-500" />
                        <span className="truncate">{admission.doctorName}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-50 dark:border-slate-800">
                        <span className="text-primary-600">{days}d</span>
                      </div>
                    </div>
                  )}
                  
                  {status === 'available' && (
                    <div className="pt-3 mt-auto border-t border-slate-50 dark:border-slate-700/50 text-center">
                        <p className="text-[10px] text-slate-400 font-mono font-bold tracking-widest">${bed.costPerDay}/DAY</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Card className="!p-0 overflow-hidden shadow-soft border-slate-200 dark:border-slate-700">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex flex-col md:flex-row gap-4 items-center no-print">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border rounded-xl text-sm outline-none" placeholder="Filter history..." value={historyFilter.search} onChange={e => setHistoryFilter({...historyFilter, search: e.target.value})}/>
                </div>
                <Button variant="outline" onClick={handleExportHistory} icon={Download}>Export Data</Button>
            </div>
            <div className="overflow-x-auto min-h-[400px]">
                <table className="min-w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="px-6 py-4">Patient</th>
                            <th className="px-6 py-4">Stay Context</th>
                            <th className="px-6 py-4">Entry / Exit</th>
                            <th className="px-6 py-4">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredHistory.map(h => (
                            <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td className="px-6 py-4"><p className="font-bold">{h.patientName}</p><p className="text-[10px] text-slate-400 uppercase">{h.patientCode}</p></td>
                                <td className="px-6 py-4"><p className="font-medium">Room {h.roomNumber}</p><p className="text-[10px] text-slate-400">Dr. {h.doctorName}</p></td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-600">{new Date(h.entry_date).toLocaleDateString()}</span>
                                        <ArrowRight size={12} className="text-slate-300"/>
                                        <span className="text-xs font-bold text-slate-600">{h.actual_discharge_date ? new Date(h.actual_discharge_date).toLocaleDateString() : 'Active'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4"><Badge color={getStatusColor(h.status) as any}>{h.status}</Badge></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
      )}

      {/* CONSOLIDATED ADMIT MODAL */}
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={`New Admission Request: ${selectedBedForAdmission?.roomNumber}`}>
         <form onSubmit={handleAdmitSubmit} className="space-y-6">
            <div className="relative space-y-1.5" ref={patientSearchRef}>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Patient Registry</label>
                {selectedPatientForAdmission ? (
                  <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800 rounded-3xl shadow-sm animate-in zoom-in-95">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-primary-600 font-black text-xl shadow-sm">
                          {selectedPatientForAdmission.fullName.charAt(0)}
                       </div>
                       <div className="flex flex-col">
                         <span className="font-black text-primary-900 dark:text-primary-100 leading-none mb-1">{selectedPatientForAdmission.fullName}</span>
                         <span className="text-[10px] text-primary-600 dark:text-primary-400 font-black tracking-widest uppercase">{selectedPatientForAdmission.patientId}</span>
                       </div>
                     </div>
                     <button type="button" onClick={() => { setSelectedPatientForAdmission(null); setPatientSearchTerm(''); }} className="p-2 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-xl transition-colors">
                       <Trash2 size={18} className="text-primary-600" />
                     </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                      type="text"
                      placeholder="Search name, phone or ID..."
                      className="pl-12 pr-4 py-4 w-full rounded-3xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all shadow-sm"
                      value={patientSearchTerm}
                      onChange={e => {setPatientSearchTerm(e.target.value); setShowPatientResults(true); }}
                      onFocus={() => setShowPatientResults(true)}
                    />
                    {showPatientResults && filteredPatientsForAdmission.length > 0 && (
                      <div className="absolute z-50 w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-3xl mt-2 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        {filteredPatientsForAdmission.map(p => (
                          <div key={p.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors group" onClick={() => { setSelectedPatientForAdmission(p); setShowPatientResults(false); }}>
                            <div>
                                <p className="font-black text-sm group-hover:text-primary-600 transition-colors">{p.fullName}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">{p.patientId}</p>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-primary-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="Admitting Physician" required value={admitForm.doctorId} onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})}>
                    <option value="">Choose Physician...</option>
                    {staff.filter(s => s.type === 'doctor' && s.status === 'active').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName} ({doc.specialization})</option>)}
                </Select>
                <Input label="Entry Date" type="date" required value={admitForm.entryDate} onChange={e => setAdmitForm({...admitForm, entryDate: e.target.value})} />
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex justify-between items-center"><h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><DollarSign size={14}/> Financials</h4><Badge color="blue" className="text-[9px] font-black uppercase">${selectedBedForAdmission?.costPerDay}/DAY</Badge></div>
                <Input label="Pre-Admission Deposit" type="number" required value={admitForm.deposit} onChange={e => setAdmitForm({...admitForm, deposit: e.target.value})} />
                <p className="text-[10px] text-slate-500 font-medium italic">Standard hospital policy requires a minimum deposit equivalent to 2 days of ward charges.</p>
            </div>
            <Textarea label="Initial Diagnosis / Reason" rows={3} placeholder="Brief clinical indication for admission..." value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />
            <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" disabled={!selectedPatientForAdmission || !admitForm.doctorId} className="px-8 shadow-lg shadow-primary-500/20">Authorize Admission</Button>
            </div>
         </form>
      </Modal>

      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title="Validate Reservation">
        {selectedAdmission && (
          <div className="space-y-6">
             <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-200 dark:border-blue-800 text-center">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">Reservation Holder</p>
                <h3 className="text-3xl font-black text-blue-900 dark:text-blue-100 leading-tight">{selectedAdmission.patientName}</h3>
                <div className="flex items-center justify-center gap-4 mt-6">
                  <Badge color="blue" className="px-3 py-1 font-black uppercase text-[10px]">Room {selectedAdmission.roomNumber}</Badge>
                  <Badge color="gray" className="px-3 py-1 font-black uppercase text-[10px]">{new Date(selectedAdmission.entry_date).toLocaleDateString()}</Badge>
                </div>
             </div>
             <div className="space-y-4">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Payment Verification</h4>
               <div className="flex justify-between items-center p-5 bg-white dark:bg-slate-800 border-2 rounded-3xl shadow-sm border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${selectedAdmission.billStatus === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600 animate-pulse'}`}>
                       {selectedAdmission.billStatus === 'paid' ? <CheckCircle size={24}/> : <Clock size={24}/>}
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-800 dark:text-white">Admission Deposit</p>
                      <p className={`text-[10px] font-black uppercase ${selectedAdmission.billStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>{selectedAdmission.billStatus}</p>
                    </div>
                  </div>
                  <span className="font-mono font-black text-xl text-primary-600">${selectedAdmission.projected_cost.toLocaleString()}</span>
               </div>
               {selectedAdmission.billStatus !== 'paid' && (
                 <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                      Admission cannot be activated. The deposit invoice must be settled in the Billing module first.
                    </p>
                 </div>
               )}
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t dark:border-slate-700">
                <Button variant="danger" icon={X} onClick={handleCancelAdmission} className="w-full">Release Reservation</Button>
                <Button 
                  icon={CheckCircle} 
                  disabled={selectedAdmission.billStatus !== 'paid'} 
                  onClick={handleConfirmAdmission}
                  className="w-full shadow-lg shadow-primary-500/20"
                >
                  Activate Stay
                </Button>
             </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')} className="max-w-4xl">
        {inpatientDetails && (
          <div className="space-y-6 flex flex-col h-full max-h-[85vh]">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-xl flex flex-wrap items-center gap-6 relative overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/10 rounded-full blur-3xl"></div>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner font-black text-2xl relative z-10">
                  {inpatientDetails.patientName?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 relative z-10">
                   <h3 className="font-black text-2xl truncate tracking-tight">{inpatientDetails.patientName}</h3>
                   <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400 mt-2">
                     <span className="flex items-center gap-1.5"><Users size={14}/> {inpatientDetails.age}Y • {inpatientDetails.gender}</span>
                     <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 text-red-400 rounded-lg border border-red-500/30"><HeartPulse size={14}/> {inpatientDetails.bloodGroup || 'UNK'}</span>
                     <span className="flex items-center gap-1.5"><Home size={14}/> Room {inpatientDetails.roomNumber}</span>
                   </div>
                </div>
                <div className="text-right relative z-10">
                   <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Lead Physician</p>
                   <p className="font-black text-white flex items-center gap-2 justify-end"><Stethoscope size={16} className="text-primary-400"/> Dr. {inpatientDetails.doctorName}</p>
                </div>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 no-print shrink-0">
              {[
                { id: 'overview', label: 'Administration', icon: Info },
                { id: 'notes', label: 'Clinical Charting', icon: ClipboardList },
                { id: 'discharge', label: 'Exit Protocol', icon: LogOut }
              ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setCareTab(tab.id as any)} 
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${careTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-lg scale-[1.02]' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <tab.icon size={16}/> {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0 space-y-6">
              {careTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                    <div className="md:col-span-2 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="!bg-slate-50/50 border-none">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Admission Date</p>
                                <p className="font-black text-lg">{new Date(inpatientDetails.entry_date).toLocaleDateString()}</p>
                            </Card>
                            <Card className="!bg-slate-50/50 border-none">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Stay</p>
                                <div className="flex items-baseline gap-2">
                                    <p className="font-black text-3xl text-primary-600">{inpatientDetails.daysStayed}</p>
                                    <span className="text-xs font-bold text-slate-500">Days</span>
                                </div>
                            </Card>
                        </div>
                        <div className="space-y-4">
                           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><DollarSign size={14}/> Active Invoices</h4>
                           {inpatientDetails.unpaidBills?.length === 0 ? (
                             <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed text-slate-400 text-sm font-bold italic">No outstanding medical bills.</div>
                           ) : (
                             <div className="space-y-3">
                                {inpatientDetails.unpaidBills.map((bill: any) => {
                                  const isExpanded = expandedBillId === bill.id;
                                  return (
                                    <div key={bill.id} className="border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden transition-all shadow-sm group">
                                      <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50" onClick={() => setExpandedBillId(isExpanded ? null : bill.id)}>
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl group-hover:scale-110 transition-transform"><AlertCircle size={20}/></div>
                                            <div>
                                              <p className="font-black text-sm text-slate-800 dark:text-white">Invoice #{bill.bill_number}</p>
                                              <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(bill.bill_date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-right">
                                              <p className="font-black text-rose-600 text-lg font-mono">${formatMoney(bill.total_amount - (bill.paid_amount || 0))}</p>
                                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pending Balance</p>
                                            </div>
                                            {isExpanded ? <ChevronUp className="text-slate-300"/> : <ChevronDown className="text-slate-300"/>}
                                        </div>
                                      </div>
                                      {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 bg-slate-50/50 dark:bg-slate-950/40 animate-in slide-in-from-top-2 border-t border-slate-50 dark:border-slate-800">
                                            <div className="space-y-3 pt-4">
                                              <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Breakdown</h5>
                                              {(bill.items || []).map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                                  <span>{item.description}</span>
                                                  <span className="font-mono">${formatMoney(item.amount)}</span>
                                                </div>
                                              ))}
                                              <div className="pt-3 mt-3 border-t flex justify-between items-center">
                                                <Button size="sm" variant="primary" onClick={() => navigate('/billing')} className="text-[10px] h-8 font-black uppercase">Clear Invoice</Button>
                                                <p className="font-black text-slate-900 dark:text-white font-mono">Total: ${formatMoney(bill.total_amount)}</p>
                                              </div>
                                            </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                             </div>
                           )}
                        </div>
                    </div>
                    <div className="space-y-6">
                        <Card title="Current Accrual" className="!bg-primary-50 dark:!bg-primary-900/10 border-primary-100 dark:border-primary-800 text-center">
                            <p className="text-3xl font-black text-primary-700 dark:text-primary-400 font-mono tracking-tighter">${formatMoney(inpatientDetails.daysStayed * inpatientDetails.costPerDay)}</p>
                            <p className="text-[10px] font-black text-primary-600 uppercase tracking-widest mt-2">Hospitalization Subtotal</p>
                        </Card>
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border shadow-soft space-y-4">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Home size={14}/> Facility Details</h5>
                           <div className="space-y-3">
                              <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold">Room Category</span><span className="font-black text-slate-800 dark:text-white uppercase">{inpatientDetails.bedType || 'General'}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-slate-500 font-bold">Daily Rate</span><span className="font-black text-slate-800 dark:text-white font-mono">${inpatientDetails.costPerDay}</span></div>
                           </div>
                        </div>
                    </div>
                </div>
              )}

              {careTab === 'notes' && (
                <div className="space-y-6 animate-in fade-in">
                   <form onSubmit={handleAddNote} className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-primary-500/10 space-y-5 shadow-inner">
                      <div className="flex justify-between items-center"><h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sparkles size={16} className="text-primary-500"/> Nursing Entry</h4><Badge color="blue" className="text-[9px] font-black uppercase">Shift: Morning</Badge></div>
                      <div className="grid grid-cols-5 gap-3">
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 px-1">BP</label><Input placeholder="120/80" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="!py-2 font-mono text-center" /></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 px-1">Temp</label><Input placeholder="37.2" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="!py-2 font-mono text-center" /></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 px-1">Pulse</label><Input placeholder="72" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="!py-2 font-mono text-center" /></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 px-1">SpO2</label><Input placeholder="98%" value={noteForm.spo2} onChange={e => setNoteForm({...noteForm, spo2: e.target.value})} className="!py-2 font-mono text-center" /></div>
                         <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400 px-1">Insulin</label><Input placeholder="Units" value={noteForm.insulin} onChange={e => setNoteForm({...noteForm, insulin: e.target.value})} className="!py-2 font-mono text-center" /></div>
                      </div>
                      <Textarea label="Observations" rows={3} required placeholder="Enter nursing observations, medications administered, and progress notes..." value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} className="shadow-none border-slate-200" />
                      <Button type="submit" className="w-full h-12 shadow-lg shadow-primary-500/20" icon={Save}>Add to Patient Record</Button>
                   </form>
                   
                   <div className="space-y-4">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Shift History Feed</h4>
                      {(inpatientDetails.notes || []).length === 0 ? (
                        <div className="py-20 text-center text-slate-300 font-black italic uppercase tracking-widest text-[10px]">Empty Chart</div>
                      ) : (
                        <div className="space-y-4 relative before:absolute before:left-3 before:top-0 before:bottom-0 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                          {inpatientDetails.notes.map((note: any) => (
                            <div key={note.id} className="ml-8 relative bg-white dark:bg-slate-800 p-5 rounded-2xl border shadow-sm group hover:border-primary-300 transition-colors">
                               <div className="absolute left-[-26px] top-5 w-4 h-4 rounded-full border-4 border-white dark:border-slate-800 bg-primary-500 shadow-md"></div>
                               <div className="flex justify-between items-start mb-3">
                                  <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">{new Date(note.created_at).toLocaleString()}</span>
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Auth: Dr. {note.doctorName}</span>
                               </div>
                               <div className="flex gap-4 mb-3 overflow-x-auto pb-1 no-scrollbar">
                                  {note.vitals?.bp && <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-nowrap"><Activity size={10} className="text-red-500"/><span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{note.vitals.bp}</span></div>}
                                  {note.vitals?.temp && <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-nowrap"><Thermometer size={10} className="text-orange-500"/><span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{note.vitals.temp}°C</span></div>}
                                  {note.vitals?.pulse && <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-nowrap"><HeartPulse size={10} className="text-rose-500"/><span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{note.vitals.pulse}BPM</span></div>}
                                  {note.vitals?.spo2 && <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-nowrap"><Zap size={10} className="text-blue-500"/><span className="text-[10px] font-black text-slate-700 dark:text-slate-300">{note.vitals.spo2}</span></div>}
                               </div>
                               <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium italic">"{note.note}"</p>
                            </div>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
              )}

              {careTab === 'discharge' && (
                <div className="space-y-6 animate-in fade-in">
                    {totalOutstandingBalance > 0.01 ? (
                      <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-3xl border-2 border-rose-200 dark:border-rose-900/40 flex flex-col gap-5 shadow-lg ring-4 ring-rose-500/5">
                        <div className="flex items-start gap-5">
                           <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm text-rose-500 shrink-0"><AlertTriangle size={32} strokeWidth={2.5}/></div>
                           <div>
                              <h4 className="font-black text-rose-900 dark:text-rose-100 uppercase tracking-widest text-sm mb-1">Financial Block Detected</h4>
                              <p className="text-sm text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                                This patient has <span className="font-black text-rose-900 dark:text-white underline underline-offset-2 decoration-2">${totalOutstandingBalance.toLocaleString()}</span> in unsettled invoices. 
                                Hospital security and billing policy <span className="underline decoration-2 font-black">strictly blocks</span> final discharge until all balances are cleared.
                              </p>
                           </div>
                        </div>
                        <div className="flex justify-end border-t border-rose-200 dark:border-rose-900/30 pt-4">
                           <Button size="md" variant="primary" className="bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200" onClick={() => navigate('/billing')} icon={ExternalLink}>
                             Go to Billing to Settle Account
                           </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-5 shadow-sm">
                          <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-emerald-500 shadow-sm"><CheckCircle size={24}/></div>
                          <div>
                             <h4 className="font-black text-emerald-900 dark:text-emerald-100 uppercase tracking-widest text-xs">Clearance Confirmed</h4>
                             <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1 font-medium">All billing balances are cleared. Patient is medically and administratively cleared for departure.</p>
                          </div>
                      </div>
                    )}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border shadow-soft space-y-6">
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><ClipboardList size={14}/> Discharge Summary</h4>
                       <Select label="Outcome / Disposal" value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                          <option value="Recovered">Recovered / Fully Healed</option>
                          <option value="Stable">Stable / Follow-up Needed</option>
                          <option value="Transferred">Transferred to Specialized Unit</option>
                          <option value="AMA">Discharged Against Medical Advice (AMA)</option>
                       </Select>
                       <Textarea label="Clinical Exit Notes" rows={4} placeholder="Summarize final vitals, prescribed take-home meds, and recovery plan..." value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} className="shadow-none border-slate-200" />
                       <Button 
                         className="w-full py-4 text-md shadow-xl shadow-primary-500/10" 
                         icon={totalOutstandingBalance > 0.01 ? Lock : LogOut} 
                         disabled={totalOutstandingBalance > 0.01}
                         onClick={handleDischarge}
                       >
                         {totalOutstandingBalance > 0.01 ? 'Billing Clearance Required' : 'Authorize Final Discharge'}
                       </Button>
                    </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0 no-print">
               <Button variant="secondary" onClick={() => setIsCareModalOpen(false)}>{t('close')}</Button>
            </div>
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
        confirmLabel={confirmState.confirmLabel || 'Confirm'}
      />
    </div>
  );
};
