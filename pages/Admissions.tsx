
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { 
  Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, AlertTriangle,
  HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, 
  DollarSign, Loader2, XCircle, Sparkles, Thermometer, ChevronRight, X, Info, Save, Trash2,
  ExternalLink
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
  
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
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
  
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] = useState<any>(null);
  
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', resp: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });

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
      
      // Check for trigger after data is loaded
      const state = location.state as any;
      if (state?.trigger === 'new') {
        const availableBed = bedsData.find((b: any) => b.status === 'available');
        if (availableBed) handleBedClick(availableBed);
        else setProcessStatus('error'), setProcessMessage('No beds available for new admission.');
      }
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  // Handle outside click for patient search
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
        setProcessStatus('processing');
        setProcessMessage('Loading inpatient chart...');
        try {
          const details = await api.getInpatientDetails(admission.id);
          setInpatientDetails(details);
          setCareTab('overview');
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
          resp: noteForm.resp
        }
      });
      const updated = await api.getInpatientDetails(inpatientDetails.id);
      setInpatientDetails(updated);
      setNoteForm({ note: '', bp: '', temp: '', pulse: '', resp: '' });
      setProcessStatus('success');
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage('Failed to save note.');
    }
  };

  const handleDischarge = () => {
    if (!inpatientDetails) return;

    // FE CHECK: Check for any pending balance before showing confirmation
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
      {/* STANDARD SIZE PROCESS HUD */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2 leading-relaxed">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      <div className="flex gap-3 text-xs font-black uppercase tracking-widest flex-wrap mb-2 no-print">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('admissions_legend_available')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800"><div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div> {t('admissions_legend_reserved')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800"><div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div> {t('admissions_legend_occupied')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Cleaning</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary-600 mb-2"/><p className="text-slate-500 font-medium">{t('admissions_loading')}</p></div> : 
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
              
              <div className="flex-1 flex flex-col justify-center items-center w-full">
                {isOccupied || isReserved ? (
                  <div className="w-full text-center">
                    <p className="text-sm font-black text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2 min-h-[2.5rem]">{admission?.patientName}</p>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 dark:text-slate-400 w-full border-t border-slate-200 dark:border-slate-700 pt-2">
                      <span className="truncate max-w-[60%]">Dr. {admission?.doctorName}</span>
                      <span className="bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border">{calculateDays(admission?.entry_date)}d</span>
                    </div>
                  </div>
                ) : (
                   <div className="text-center opacity-40 group-hover:opacity-100 transition-all duration-300 transform group-hover:scale-110">
                     <Plus size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-1"/>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{bed.status === 'cleaning' ? 'Cleaning' : 'Available'}</p>
                   </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* MODAL: NEW ADMISSION / RESERVE */}
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

      {/* MODAL: MANAGE RESERVED ADMISSION */}
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

      {/* MODAL: ACTIVE INPATIENT CARE */}
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
                       <div className="bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden divide-y">
                          {inpatientDetails.unpaidBills?.length === 0 ? (
                            <div className="p-6 text-center text-slate-400 italic text-sm">No outstanding bills for this stay.</div>
                          ) : (
                            inpatientDetails.unpaidBills.map((bill: any) => (
                              <div key={bill.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                 <div>
                                   <p className="font-bold text-sm">Bill #{bill.bill_number}</p>
                                   <p className="text-[10px] text-slate-400 font-medium">{new Date(bill.bill_date).toLocaleDateString()}</p>
                                 </div>
                                 <div className="text-right">
                                   <p className="font-black text-rose-600 font-mono">${(bill.total_amount - (bill.paid_amount || 0)).toLocaleString()}</p>
                                   <button onClick={() => navigate('/billing')} className="text-[10px] font-black uppercase text-primary-600 hover:underline">Pay Now</button>
                                 </div>
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                </div>
            )}

            {careTab === 'notes' && (
              <div className="space-y-6 animate-in fade-in">
                 <form onSubmit={handleAddNote} className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2"><Sparkles size={14}/> Add New Entry</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       <Input label="BP" placeholder="120/80" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="text-xs" />
                       <Input label="Temp (°C)" placeholder="37.2" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="text-xs" />
                       <Input label="Pulse" placeholder="72" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="text-xs" />
                       <Input label="Resp" placeholder="18" value={noteForm.resp} onChange={e => setNoteForm({...noteForm, resp: e.target.value})} className="text-xs" />
                    </div>
                    <Textarea label="Observations" rows={3} required placeholder="Enter clinical notes and progress..." value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} />
                    <Button type="submit" className="w-full" icon={Save}>Add Note to Chart</Button>
                 </form>

                 <div className="space-y-4 max-h-80 overflow-y-auto pr-1 custom-scrollbar">
                    {inpatientDetails.notes?.length === 0 ? (
                      <div className="p-10 text-center text-slate-300 font-bold italic">No notes recorded yet.</div>
                    ) : (
                      inpatientDetails.notes.map((note: any) => (
                        <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm relative overflow-hidden group">
                           <div className="absolute top-0 left-0 w-1 h-full bg-primary-500 opacity-20"></div>
                           <div className="flex justify-between items-start mb-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(note.created_at).toLocaleString()}</span>
                              <Badge color="blue">Dr. {note.doctorName}</Badge>
                           </div>
                           <div className="grid grid-cols-4 gap-2 mb-3 py-2 border-y border-slate-50 dark:border-slate-700">
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">BP</p><p className="text-xs font-bold">{note.vitals?.bp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Temp</p><p className="text-xs font-bold">{note.vitals?.temp || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Pulse</p><p className="text-xs font-bold">{note.vitals?.pulse || '-'}</p></div>
                              <div className="text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Resp</p><p className="text-xs font-bold">{note.vitals?.resp || '-'}</p></div>
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
                         icon={LogOut} 
                         onClick={handleDischarge}
                         disabled={totalOutstandingBalance > 0.01}
                       >
                         {totalOutstandingBalance > 0.01 ? 'Settle Balance to Discharge' : 'Complete Final Discharge'}
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
