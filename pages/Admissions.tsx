
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, DollarSign, Loader2, XCircle, Sparkles, Thermometer } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useHeader } from '../context/HeaderContext';

export const Admissions = () => {
  const { accent } = useTheme();
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // Sync Header
  useHeader(
    t('admissions_title'), 
    t('admissions_subtitle'),
    <Badge color="blue" className="px-4 py-2 font-bold">{activeAdmissions.length} {t('admissions_legend_occupied')} / {beds.length} Total</Badge>
  );

  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', action: () => {}, type: 'danger' as any });
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<any>(null);
  const [inpatientDetails, setInpatientDetails] = useState<any>(null);
  const [careTab, setCareTab] = useState<'overview' | 'notes' | 'discharge'>('overview');
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] = useState<any>(null);
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', resp: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });

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
    } catch (e) { console.error(e); } finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

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
      if (admission) { setSelectedAdmission(admission); setIsConfirmModalOpen(true); }
      return;
    }
    if (bed.status === 'occupied') {
      const admission = activeAdmissions.find(a => a.bedId === bed.id && a.status === 'active');
      if (admission) {
        setProcessStatus('processing');
        const details = await api.getInpatientDetails(admission.id);
        setInpatientDetails(details);
        setCareTab('overview');
        setIsCareModalOpen(true);
        setProcessStatus('idle');
      }
      return;
    }
    if (bed.status === 'available') {
      setSelectedBedForAdmission(bed);
      setAdmitForm({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: bed.costPerDay.toString(), notes: '' });
      setPatientSearchTerm('');
      setSelectedPatientForAdmission(null);
      setIsAdmitModalOpen(true);
      return;
    }
    if (bed.status === 'cleaning') {
      setConfirmState({ isOpen: true, title: 'Mark as Cleaned', message: 'Room ready for next patient?', type: 'info', action: async () => { await api.markBedClean(bed.id); loadData(true); } });
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAdmission || !selectedPatientForAdmission) return;
    setProcessStatus('processing');
    try {
      await api.createAdmission({ patientId: selectedPatientForAdmission.id, bedId: selectedBedForAdmission.id, doctorId: parseInt(admitForm.doctorId), entryDate: admitForm.entryDate, deposit: parseFloat(admitForm.deposit), notes: admitForm.notes });
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsAdmitModalOpen(false); setProcessStatus('idle'); }, 2000);
    } catch (err: any) { setProcessStatus('error'); setProcessMessage(err.response?.data?.error || 'Failed'); }
  };

  const handleConfirmAdmission = async () => {
    if (!selectedAdmission) return;
    setProcessStatus('processing');
    try {
      await api.confirmAdmissionDeposit(selectedAdmission.id);
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsConfirmModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (err: any) { setProcessStatus('error'); setProcessMessage(err.response?.data?.error || 'Failed'); }
  };

  const handleDischarge = () => {
    setConfirmState({
      isOpen: true, title: t('admissions_dialog_discharge_title'), message: t('admissions_dialog_discharge_message'),
      action: async () => {
        setProcessStatus('processing');
        try {
          await api.dischargePatient(inpatientDetails.id, { dischargeNotes: dischargeForm.notes, dischargeStatus: dischargeForm.status });
          setProcessStatus('success');
          await loadData(true);
          setTimeout(() => { setIsCareModalOpen(false); setProcessStatus('idle'); }, 2000);
        } catch (e: any) { setProcessStatus('error'); setProcessMessage(e.response?.data?.error || 'Ensure all bills are paid.'); }
      }
    });
  };

  const filteredPatientsForAdmission = patients.filter(p => {
    const matchesSearch = p.fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) || (p.patientId && p.patientId.toLowerCase().includes(patientSearchTerm.toLowerCase()));
    const isAlreadyAdmitted = activeAdmissions.some(a => a.patient_id === p.id);
    return matchesSearch && !isAlreadyAdmitted && p.type !== 'inpatient';
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-3 text-xs font-medium flex-wrap mb-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800"><div className="w-2 h-2 rounded-full bg-green-500"></div> {t('admissions_legend_available')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {t('admissions_legend_reserved')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-800"><div className="w-2 h-2 rounded-full bg-red-500"></div> {t('admissions_legend_occupied')}</div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800"><div className="w-2 h-2 rounded-full bg-purple-500"></div> Cleaning</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <p className="col-span-full text-center py-10 text-gray-500">{t('admissions_loading')}</p> : 
        beds.map(bed => {
          const admission = activeAdmissions.find(a => a.bedId === bed.id);
          const isOccupied = bed.status === 'occupied';
          const isReserved = bed.status === 'reserved';
          return (
            <div key={bed.id} onClick={() => handleBedClick(bed)} className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col h-48 shadow-sm hover:shadow-md ${isOccupied ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/50 hover:border-red-300' : isReserved ? 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900/50 hover:border-blue-300' : bed.status === 'cleaning' ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 hover:border-purple-400' : 'bg-green-50 dark:bg-green-900/20 border-green-200 hover:border-green-400'}`}>
              <div className="flex justify-between items-start">
                <div><h3 className="font-bold text-slate-800 dark:text-white text-lg leading-none">{bed.roomNumber}</h3><p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{bed.type}</p></div>
                <div className={`w-3 h-3 rounded-full shrink-0 ${isOccupied ? 'bg-red-500' : isReserved ? 'bg-blue-500' : bed.status === 'cleaning' ? 'bg-purple-500' : 'bg-green-500'}`} />
              </div>
              <div className="flex-1 flex flex-col justify-center items-center w-full">
                {isOccupied || isReserved ? (
                  <div className="w-full text-center">
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2">{admission?.patientName}</p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 w-full border-t pt-2"><span className="truncate max-w-[60%]">Dr. {admission?.doctorName}</span><span>{calculateDays(admission?.entry_date || admission?.entryDate)} d</span></div>
                  </div>
                ) : (
                   <div className="text-center opacity-70 group-hover:opacity-100 transition-opacity"><CheckCircle size={40} className="text-green-500 mx-auto mb-2"/><p className="text-sm font-bold text-green-800 dark:text-green-300">Available</p></div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* MODALS */}
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={t('admissions_modal_reserve_title', { room: selectedBedForAdmission?.roomNumber })}>
        <form onSubmit={handleAdmitSubmit} className="space-y-4">
          {!selectedPatientForAdmission ? (
            <div className="relative">
              <Input label={t('patients_table_header_patient')} placeholder={t('patients_search_placeholder')} value={patientSearchTerm} onChange={e => {setPatientSearchTerm(e.target.value); setShowPatientResults(true); }} />
              {showPatientResults && filteredPatientsForAdmission.length > 0 && (
                <div className="absolute z-10 w-full bg-white dark:bg-slate-700 border rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                  {filteredPatientsForAdmission.map(p => (<div key={p.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer" onClick={() => { setSelectedPatientForAdmission(p); setShowPatientResults(false); }}>{p.fullName}</div>))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
              <span className="font-medium">{selectedPatientForAdmission.fullName}</span>
              <button type="button" onClick={() => setSelectedPatientForAdmission(null)} className="text-xs text-red-500">Change</button>
            </div>
          )}
          <Select label={t('patients_modal_action_assign_doctor')} required value={admitForm.doctorId} onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})}>
            <option value="">{t('patients_modal_action_select_doctor')}</option>
            {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('patients_modal_action_admission_date')} type="date" required value={admitForm.entryDate} onChange={e => setAdmitForm({...admitForm, entryDate: e.target.value})} />
            <Input label={t('patients_modal_action_required_deposit')} type="number" required value={admitForm.deposit} onChange={e => setAdmitForm({...admitForm, deposit: e.target.value})} />
          </div>
          <Textarea label={t('admissions_care_admission_note')} rows={2} value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />
          <div className="flex justify-end pt-4 border-t gap-3"><Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button><Button type="submit">{t('admissions_modal_reserve_button')}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')}>
        {inpatientDetails && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
                <h3 className="font-bold text-lg">{inpatientDetails.patientName}</h3>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1"><span>{inpatientDetails.age}yrs / {inpatientDetails.gender}</span><span>Room {inpatientDetails.roomNumber}</span><span>Dr. {inpatientDetails.doctorName}</span></div>
            </div>
            <div className="flex border-b">
              {['overview', 'notes', 'discharge'].map(t_id => (<button key={t_id} onClick={() => setCareTab(t_id as any)} className={`px-4 py-2 text-sm font-medium ${careTab === t_id ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500'}`}>{t_id.toUpperCase()}</button>))}
            </div>
            {careTab === 'overview' && (<div className="space-y-4 animate-in fade-in"><div className="grid grid-cols-3 gap-4 text-center"><div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg"><p className="text-xs text-slate-400">Entry</p><p className="font-bold">{new Date(inpatientDetails.entry_date).toLocaleDateString()}</p></div><div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg"><p className="text-xs text-slate-400">Days</p><p className="font-bold">{calculateDays(inpatientDetails.entry_date)}</p></div><div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg"><p className="text-xs text-slate-400">Rate</p><p className="font-bold">${inpatientDetails.costPerDay}</p></div></div></div>)}
            {careTab === 'discharge' && (
                <div className="space-y-4 animate-in fade-in">
                    <form className="space-y-3 pt-4 border-t"><Select label={t('admissions_care_discharge_status')} value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}><option value="Recovered">Recovered</option><option value="Transferred">Transferred</option></Select><Textarea label={t('admissions_care_discharge_summary')} rows={2} value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} /><Button className="w-full" onClick={handleDischarge}>Complete Discharge</Button></form>
                </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={() => { confirmState.action(); setConfirmState({ ...confirmState, isOpen: false }); }} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
};
