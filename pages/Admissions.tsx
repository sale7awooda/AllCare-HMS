
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, DollarSign, Loader2, XCircle, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Admissions = () => {
  const { accent } = useTheme();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Advanced Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Modals
  const [isCareModalOpen, setIsCareModalOpen] = useState(false); // For Active Patients
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false); // For New Reservation
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false); // For Reserved -> Active

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  // Selection States
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<any>(null);
  const [inpatientDetails, setInpatientDetails] = useState<any>(null);
  const [careTab, setCareTab] = useState<'overview' | 'notes' | 'discharge'>('overview');

  // Search State for Admission
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [selectedPatientForAdmission, setSelectedPatientForAdmission] = useState<any>(null);

  // Forms
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', resp: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [bedsData, admissionsData, patientsData, staffData] = await Promise.all([
        api.getBeds(),
        api.getActiveAdmissions(),
        api.getPatients(),
        api.getStaff()
      ]);
      setBeds(bedsData);
      setActiveAdmissions(admissionsData);
      setPatients(patientsData);
      setStaff(staffData);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateDays = (dateString: string) => {
    const start = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleBedClick = async (bed: any) => {
    // 1. RESERVED BED -> CONFIRMATION
    if (bed.status === 'reserved') {
      const admission = activeAdmissions.find(a => a.bedId === bed.id && a.status === 'reserved');
      if (admission) {
        setSelectedAdmission(admission);
        setIsConfirmModalOpen(true);
      }
      return;
    }

    // 2. OCCUPIED BED -> PATIENT CARE
    if (bed.status === 'occupied') {
      const admission = activeAdmissions.find(a => a.bedId === bed.id && a.status === 'active');
      if (admission) {
        setSelectedAdmission(admission);
        try {
          setProcessStatus('processing');
          setProcessMessage('Loading patient file...');
          const details = await api.getInpatientDetails(admission.id);
          setInpatientDetails(details);
          setCareTab('overview');
          setProcessStatus('idle');
          setIsCareModalOpen(true);
        } catch (e) {
          console.error("Failed to load details", e);
          setProcessStatus('error');
          setProcessMessage("Failed to load patient details. The admission record might be incomplete.");
        }
      }
      return;
    }

    // 3. AVAILABLE BED -> NEW ADMISSION (RESERVATION)
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

    // 4. CLEANING BED -> MARK AVAILABLE
    if (bed.status === 'cleaning') {
      setConfirmState({
        isOpen: true,
        title: 'Mark as Cleaned',
        message: 'Has this room been cleaned and prepared for the next patient?',
        type: 'info',
        action: async () => {
          try {
            await api.markBedClean(bed.id);
            loadData(true);
          } catch (e) { console.error(e); }
        }
      });
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAdmission || !selectedPatientForAdmission) return;
    
    setProcessStatus('processing');
    setProcessMessage(t('processing'));

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
      setProcessMessage(t('patients_process_success_admission'));
      await loadData(true);
      
      setTimeout(() => {
        setIsAdmitModalOpen(false);
        setProcessStatus('idle');
      }, 2000);
    } catch (err: any) {
       setProcessStatus('error');
       setProcessMessage(err.response?.data?.error || 'Failed to admit patient.');
    }
  };

  const handleConfirmAdmission = async () => {
    if (!selectedAdmission) return;
    
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    
    try {
      await api.confirmAdmissionDeposit(selectedAdmission.id);
      
      setProcessStatus('success');
      setProcessMessage('Admission Confirmed. Patient is now an Inpatient.');
      await loadData(true);
      
      setTimeout(() => {
        setIsConfirmModalOpen(false);
        setProcessStatus('idle');
      }, 2000);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || 'Confirmation failed.');
    }
  };

  const handleCancelReservation = async () => {
    if (!selectedAdmission) return;
    setConfirmState({
      isOpen: true,
      title: t('admissions_dialog_cancel_title'),
      message: t('admissions_dialog_cancel_message'),
      action: async () => {
        setIsConfirmModalOpen(false);
        setProcessStatus('processing');
        setProcessMessage('Cancelling reservation...');
        try {
          await api.cancelAdmission(selectedAdmission.id);
          setProcessStatus('success');
          setProcessMessage(t('admissions_toast_cancel_success'));
          await loadData(true);
          setTimeout(() => setProcessStatus('idle'), 1500);
        } catch (e: any) {
          setProcessStatus('error');
          setProcessMessage(e.response?.data?.error || 'Failed to cancel reservation.');
        }
      }
    });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inpatientDetails || !currentUser) return;
    try {
      await api.addInpatientNote(inpatientDetails.id, {
        doctorId: currentUser.id, 
        note: noteForm.note,
        vitals: { bp: noteForm.bp, temp: noteForm.temp, pulse: noteForm.pulse, resp: noteForm.resp }
      });
      const details = await api.getInpatientDetails(inpatientDetails.id);
      setInpatientDetails(details);
      setNoteForm({ note: '', bp: '', temp: '', pulse: '', resp: '' });
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || 'Failed to add note');
    }
  };

  const handleDischarge = async () => {
    setConfirmState({
      isOpen: true,
      title: t('admissions_dialog_discharge_title'),
      message: t('admissions_dialog_discharge_message'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage(t('processing'));

        try {
          await api.dischargePatient(inpatientDetails.id, {
            dischargeNotes: dischargeForm.notes,
            dischargeStatus: dischargeForm.status
          });
          
          setProcessStatus('success');
          setProcessMessage('Patient discharged successfully. Bed marked for cleaning.');
          await loadData(true);
          
          setTimeout(() => {
            setIsCareModalOpen(false);
            setProcessStatus('idle');
          }, 2000);
        } catch (e: any) {
          setProcessStatus('error');
          setProcessMessage(e.response?.data?.error || 'Discharge failed');
        }
      }
    });
  };

  // --- Helper for Patient Search ---
  const filteredPatientsForAdmission = patients.filter(p => {
    // Basic search text filter
    const matchesSearch = 
      p.fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
      p.patientId.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
      p.phone.includes(patientSearchTerm);
    
    // Check if patient is NOT currently admitted or reserved
    // 'activeAdmissions' contains entries with 'patient_id'
    const isAlreadyAdmitted = activeAdmissions.some(a => a.patient_id === p.id);
    
    return matchesSearch && !isAlreadyAdmitted && p.type !== 'inpatient';
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admissions_title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('admissions_subtitle')}</p>
        </div>
        <div className="flex gap-3 text-xs font-medium flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-100 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500"></div> {t('admissions_legend_available')}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div> {t('admissions_legend_reserved')}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg border border-red-100 dark:border-red-800">
            <div className="w-2 h-2 rounded-full bg-red-500"></div> {t('admissions_legend_occupied')}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg border border-purple-100 dark:border-purple-800">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div> Cleaning
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg border border-yellow-100 dark:border-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div> {t('admissions_legend_maintenance')}
          </div>
        </div>
      </div>

      {/* Ward Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <p className="col-span-full text-center py-10 text-gray-500">{t('admissions_loading')}</p> : 
         beds.map(bed => {
           // Find any admission (active OR reserved) for this bed
           const admission = activeAdmissions.find(a => a.bedId === bed.id);
           const isOccupied = bed.status === 'occupied';
           const isReserved = bed.status === 'reserved';
           const isMaintenance = bed.status === 'maintenance';
           const isCleaning = bed.status === 'cleaning';
           
           const doctorName = admission?.doctorName || 'Unassigned';

           return (
             <div 
               key={bed.id} 
               onClick={() => handleBedClick(bed)}
               className={`
                 relative p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col justify-between h-40 shadow-sm hover:shadow-md
                 ${isOccupied 
                   ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/50 hover:border-red-300' 
                   : isReserved
                     ? 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900/50 hover:border-blue-300'
                     : isCleaning
                       ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:border-purple-400'
                       : isMaintenance 
                         ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 cursor-not-allowed' 
                         : 'bg-white dark:bg-slate-800 border-green-100 dark:border-green-900/50 hover:border-green-400'
                 }
               `}
             >
               {/* Header: Room Number */}
               <div className="flex justify-between items-start">
                 <span className={`text-xl font-bold ${isOccupied ? 'text-red-600' : isReserved ? 'text-blue-600' : isCleaning ? 'text-purple-600' : isMaintenance ? 'text-yellow-600' : 'text-green-600'}`}>
                   {bed.roomNumber}
                 </span>
                 {isCleaning ? <Sparkles size={20} className="text-purple-400" /> : <Bed size={20} className={`${isOccupied ? 'text-red-400' : isReserved ? 'text-blue-400' : isMaintenance ? 'text-yellow-400' : 'text-green-400'}`} />}
               </div>
               
               {/* Body: Status/Details */}
               <div className="flex-1 flex flex-col justify-center">
                 {isOccupied || isReserved ? (
                   <div className="space-y-1">
                     <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={admission?.patientName}>{admission?.patientName}</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><User size={10}/> {t('admissions_bed_doctor', {name: doctorName.split(' ')[1] || doctorName})}</p>
                     
                     {isOccupied && (
                       <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-bold mt-1">
                         <Clock size={10}/> {t('admissions_bed_days', {count: calculateDays(admission?.entry_date)})}
                       </div>
                     )}
                     {isReserved && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-bold mt-1">
                          <DollarSign size={10}/> {t('admissions_bed_payment_pending')}
                        </div>
                     )}
                   </div>
                 ) : isMaintenance ? (
                   <p className="text-sm text-yellow-700 dark:text-yellow-500 font-medium text-center">{t('admissions_bed_maintenance')}</p>
                 ) : isCleaning ? (
                   <div className="text-center">
                     <p className="text-sm text-purple-600 dark:text-purple-400 font-bold mb-1">Cleaning</p>
                     <p className="text-xs text-purple-500/70 font-semibold group-hover:text-purple-600">Tap to Mark Ready</p>
                   </div>
                 ) : (
                   <div className="text-center group-hover:scale-105 transition-transform">
                     <p className="text-sm text-green-600 dark:text-green-400 font-bold mb-1">{t('admissions_bed_available')}</p>
                     <p className="text-xs text-green-500/70 uppercase tracking-wider font-semibold group-hover:text-green-600">{t('admissions_bed_click_to_admit')}</p>
                   </div>
                 )}
               </div>
               
               {/* Footer: Type */}
               <div className="mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 uppercase tracking-wide flex justify-between">
                 <span>{bed.type}</span>
                 {(isOccupied || isReserved) && <span className="text-primary-500 font-bold">{t('admissions_bed_manage')} &rarr;</span>}
               </div>
             </div>
           );
         })
        }
      </div>

      {/* MODAL 1: ADMIT (RESERVE) PATIENT */}
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={t('admissions_modal_reserve_title', { room: selectedBedForAdmission?.roomNumber })}>
        <form onSubmit={handleAdmitSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg text-sm text-blue-800 flex items-center gap-2 mb-2">
            <CheckCircle size={16} />
            <span>{t('admissions_modal_reserve_note', { room: selectedBedForAdmission?.roomNumber })}</span>
          </div>

          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('patients_table_header_patient')}</label>
            {selectedPatientForAdmission ? (
              <div className="flex items-center justify-between p-3 border border-primary-200 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-800 rounded-xl">
                <div>
                  <div className="font-bold text-primary-900 dark:text-primary-100">{selectedPatientForAdmission.fullName}</div>
                  <div className="text-xs text-primary-700 dark:text-primary-300">{selectedPatientForAdmission.patientId}</div>
                </div>
                <button type="button" onClick={() => setSelectedPatientForAdmission(null)} className="text-primary-500 hover:text-primary-700 p-1">
                  <XCircle size={18} />
                </button>
              </div>
            ) : (
              <div>
                <input 
                  type="text" 
                  className="block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border"
                  placeholder="Search by name or ID..."
                  value={patientSearchTerm}
                  onChange={e => {
                    setPatientSearchTerm(e.target.value);
                    setShowPatientResults(true);
                  }}
                  onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && patientSearchTerm && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-auto">
                    {filteredPatientsForAdmission.length === 0 ? (
                      <div className="p-3 text-sm text-slate-500 text-center">No eligible patients found.</div>
                    ) : (
                      filteredPatientsForAdmission.map(p => (
                        <div 
                          key={p.id} 
                          className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-0"
                          onClick={() => {
                            setSelectedPatientForAdmission(p);
                            setAdmitForm({...admitForm, patientId: p.id.toString()});
                            setShowPatientResults(false);
                          }}
                        >
                          <div className="font-medium text-slate-900 dark:text-white">{p.fullName}</div>
                          <div className="text-xs text-slate-500">{p.patientId} • {p.phone}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <Select 
            label={t('patients_modal_action_assign_doctor')}
            required 
            value={admitForm.doctorId} 
            onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})}
          >
            <option value="">{t('patients_modal_action_select_doctor')}</option>
            {staff.filter(s => s.type === 'doctor').map(s => (
              <option key={s.id} value={s.id}>{s.fullName} - {s.specialization}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label={t('patients_modal_action_admission_date')} 
              type="date" 
              required 
              min={new Date().toISOString().split('T')[0]}
              value={admitForm.entryDate} 
              onChange={e => setAdmitForm({...admitForm, entryDate: e.target.value})} 
            />
            <Input label={t('patients_modal_action_required_deposit')} type="number" required value={admitForm.deposit} onChange={e => setAdmitForm({...admitForm, deposit: e.target.value})} />
          </div>

          <Textarea label={t('admissions_care_admission_note')} rows={2} value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={!selectedPatientForAdmission}>{t('admissions_modal_reserve_button')}</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CONFIRM ADMISSION (PAYMENT) */}
      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title={t('admissions_modal_confirm_title')}>
        <div className="space-y-6">
          <div className="text-center p-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
              <DollarSign size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t('admissions_modal_confirm_subtitle')}</h3>
            <p className="text-gray-500 mt-2">
              {t('admissions_modal_confirm_message', { name: selectedAdmission?.patientName, amount: selectedAdmission?.projected_cost })}
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-xl text-sm space-y-2">
            <div className="flex justify-between"><span>{t('nav_admissions')}:</span> <strong>{selectedAdmission?.roomNumber}</strong></div>
            <div className="flex justify-between"><span>{t('appointments_form_select_staff')}:</span> <strong>{selectedAdmission?.doctorName}</strong></div>
            <div className="flex justify-between"><span>{t('date')}:</span> <strong>{selectedAdmission?.entry_date ? new Date(selectedAdmission.entry_date).toLocaleDateString() : '-'}</strong></div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t dark:border-slate-700">
            <Button variant="danger" onClick={handleCancelReservation}>Cancel Reservation</Button>
            <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setIsConfirmModalOpen(false)}>{t('close')}</Button>
                <Button onClick={handleConfirmAdmission} icon={CheckCircle}>{t('admissions_modal_confirm_button')}</Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: PATIENT CARE (EXISTING LOGIC) */}
      {isCareModalOpen && inpatientDetails && (
        <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')}>
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="h-14 w-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-primary-600 font-bold text-xl shadow-sm border dark:border-slate-700">
                {inpatientDetails.patientName.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{inpatientDetails.patientName}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="flex items-center gap-1"><User size={14}/> {inpatientDetails.age} yrs / {inpatientDetails.gender}</span>
                  <span className="flex items-center gap-1"><Bed size={14}/> Room {inpatientDetails.roomNumber}</span>
                  <span className="flex items-center gap-1 text-primary-600"><User size={14}/> Dr. {inpatientDetails.doctorName}</span>
                </div>
              </div>
              <div className="text-right">
                <Badge color="green">Active</Badge>
                <p className="text-xs text-gray-400 mt-1">ID: {inpatientDetails.patientCode}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              {[
                {id: 'overview', label: t('admissions_modal_care_tab_overview')}, 
                {id: 'notes', label: t('admissions_modal_care_tab_notes')}, 
                {id: 'discharge', label: t('admissions_modal_care_tab_discharge')}
              ].map((tab: any) => (
                <button 
                  key={tab.id}
                  onClick={() => setCareTab(tab.id)}
                  className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${careTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
              
              {/* OVERVIEW TAB */}
              {careTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Calendar size={18}/> {t('admissions_care_stay_details')}</h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3 text-sm">
                      <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                        <span className="text-gray-500">{t('admissions_care_admission_date')}</span>
                        <span className="font-medium">{new Date(inpatientDetails.entry_date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                        <span className="text-gray-500">{t('admissions_care_duration')}</span>
                        <span className="font-medium">{inpatientDetails.daysStayed} {t('admissions_bed_days', {count: ''}).trim()}</span>
                      </div>
                      <div className="flex justify-between pb-2">
                        <span className="text-gray-500">{t('admissions_care_daily_rate')}</span>
                        <span className="font-medium">${inpatientDetails.costPerDay}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Activity size={18}/> {t('admissions_care_clinical_info')}</h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('patients_modal_view_blood_group')}</span>
                        <span className="font-bold text-red-500">{inpatientDetails.bloodGroup || t('patients_modal_view_na')}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">{t('admissions_care_admission_note')}</span>
                        <p className="text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900 p-2 rounded">{inpatientDetails.notes || t('admissions_care_no_initial_notes')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CLINICAL NOTES TAB */}
              {careTab === 'notes' && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Plus size={16}/> {t('admissions_care_add_note')}</h4>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <Input placeholder={t('admissions_care_vitals_bp')} value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="bg-white" />
                      <Input placeholder={t('admissions_care_vitals_temp')} value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="bg-white" />
                      <Input placeholder={t('admissions_care_vitals_pulse')} value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="bg-white" />
                      <Input placeholder={t('admissions_care_vitals_resp')} value={noteForm.resp} onChange={e => setNoteForm({...noteForm, resp: e.target.value})} className="bg-white" />
                    </div>
                    <Textarea placeholder={t('admissions_care_observations_placeholder')} value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} className="bg-white mb-3" rows={2} required />
                    <div className="flex justify-end">
                      <Button size="sm" type="submit">{t('admissions_care_save_note_button')}</Button>
                    </div>
                  </form>

                  {/* Notes Timeline */}
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {inpatientDetails.notes.length === 0 ? <p className="text-center text-gray-400 py-4">{t('admissions_care_no_notes')}</p> : 
                     inpatientDetails.notes.map((note: any) => (
                       <div key={note.id} className="relative pl-6 pb-4 border-l-2 border-gray-200 dark:border-slate-700 last:pb-0">
                         <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary-100 border-2 border-primary-500"></div>
                         <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-sm text-gray-800 dark:text-slate-200">{note.doctorName}</span>
                           <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> {new Date(note.created_at).toLocaleString()}</span>
                         </div>
                         <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{note.note}</p>
                         {/* Vitals Tags */}
                         {(note.vitals.bp || note.vitals.temp) && (
                           <div className="flex flex-wrap gap-2">
                             {note.vitals.bp && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-100 font-mono">BP: {note.vitals.bp}</span>}
                             {note.vitals.temp && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded border border-orange-100 font-mono">T: {note.vitals.temp}°C</span>}
                             {note.vitals.pulse && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100 font-mono">HR: {note.vitals.pulse}</span>}
                           </div>
                         )}
                       </div>
                     ))}
                  </div>
                </div>
              )}

              {/* DISCHARGE TAB */}
              {careTab === 'discharge' && (
                <div className="space-y-6 animate-in fade-in">
                  
                  {/* Financial Status Check */}
                  {inpatientDetails.outstandingBalance > 0 ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-4 rounded-xl flex gap-3">
                      <AlertCircle className="text-red-600 shrink-0" size={24} />
                      <div>
                        <h4 className="font-bold text-red-800 dark:text-red-500">Unsettled Bills Detected</h4>
                        <p className="text-sm text-red-700 dark:text-red-600/80 mb-2">Patient has outstanding bills totaling <strong>${inpatientDetails.outstandingBalance.toLocaleString()}</strong>. Discharge is disabled until full payment is received.</p>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-100" onClick={() => navigate('/billing')}>Go to Billing</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50 p-4 rounded-xl flex gap-3">
                      <AlertCircle className="text-yellow-600 shrink-0" size={20} />
                      <div>
                        <h4 className="font-bold text-yellow-800 dark:text-yellow-500">{t('admissions_care_discharge_process')}</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-600/80">{t('admissions_care_discharge_note')}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                      <span className="text-gray-500 text-xs uppercase font-bold">{t('admissions_care_total_stay')}</span>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white">{inpatientDetails.daysStayed} {t('admissions_bed_days', {count: ''}).trim()}</p>
                    </div>
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 text-center">
                      <span className="text-primary-600 text-xs uppercase font-bold">{t('admissions_care_estimated_bill')}</span>
                      <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">${inpatientDetails.estimatedBill}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <Select label={t('admissions_care_discharge_status')} value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                      <option value="Recovered">{t('admissions_care_discharge_status_recovered')}</option>
                      <option value="Transferred">{t('admissions_care_discharge_status_transferred')}</option>
                      <option value="AMA">{t('admissions_care_discharge_status_ama')}</option>
                      <option value="Deceased">{t('admissions_care_discharge_status_deceased')}</option>
                    </Select>
                    <Textarea label={t('admissions_care_discharge_summary')} required rows={3} value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} />
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                    <Button 
                      variant="danger" 
                      icon={LogOut} 
                      onClick={handleDischarge}
                      disabled={inpatientDetails.outstandingBalance > 0}
                    >
                      {t('admissions_discharge_button')}
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </Modal>
      )}

      {/* PROCESS STATUS OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">{t('processing')}</h3>
                <p className="text-slate-500">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{t('success')}</h3>
                <p className="text-slate-600 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{t('patients_process_title_failed')}</h3>
                <p className="text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type as any || "warning"}
      />
    </div>
  );
};
