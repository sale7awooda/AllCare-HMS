
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea, Select, ConfirmationDialog } from '../components/UI';
import { Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight, DollarSign, Loader2, XCircle, Sparkles, Thermometer } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

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

  // Advanced Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Modals
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    type?: 'danger' | 'warning' | 'info';
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
        api.getStaff(),
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

  const calculateDays = (dateString: string, endDateString?: string) => {
    if (!dateString) return 0;
    const start = new Date(dateString);
    const end = endDateString ? new Date(endDateString) : new Date();
    const diff = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) || 1;
  };

  const handleViewDetails = async (admissionId: number) => {
    try {
        setProcessStatus('processing');
        setProcessMessage('Loading admission record...');
        const details = await api.getInpatientDetails(admissionId);
        setInpatientDetails(details);
        setCareTab('overview');
        setIsCareModalOpen(true);
    } catch (e) {
        console.error("Failed to load details", e);
        setProcessMessage("Failed to load admission details.");
    } finally {
        setProcessStatus('idle');
    }
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
        await handleViewDetails(admission.id);
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
    setProcessMessage('Confirming admission...');

    try {
      await api.confirmAdmissionDeposit(selectedAdmission.id);
      
      setProcessStatus('success');
      setProcessMessage('Admission confirmed. Patient is now active.');
      
      await loadData(true); // Refresh data
      
      setTimeout(() => {
        setIsConfirmModalOpen(false); // Close the confirmation modal
        setProcessStatus('idle');
      }, 1500);
    } catch (err: any) {
       setProcessStatus('error');
       setProcessMessage(err.response?.data?.error || 'Failed to confirm admission.');
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

  const currentStayCost = inpatientDetails?.estimatedBill ?? 0;
  const depositPaid = inpatientDetails?.depositPaid ?? 0;
  const otherBillsDue = inpatientDetails?.unpaidBills?.reduce((acc: number, bill: any) => acc + (bill.total_amount - bill.paid_amount), 0) ?? 0;
  const balanceDue = (currentStayCost - depositPaid) + otherBillsDue;

  const handleGenerateSettlementBill = () => {
    if (!inpatientDetails) return;
    setConfirmState({
      isOpen: true,
      title: 'Generate Settlement Bill',
      message: `This will create a single bill for the total outstanding balance of $${balanceDue.toFixed(2)}. The patient cannot be discharged until this bill is paid. Continue?`,
      type: 'info',
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Generating settlement bill...');
        try {
          await api.generateSettlementBill(inpatientDetails.id);
          setProcessStatus('success');
          setProcessMessage('Settlement bill created. Please go to Billing to process payment.');
          const details = await api.getInpatientDetails(inpatientDetails.id);
          setInpatientDetails(details);
        } catch (e: any) {
          setProcessStatus('error');
          setProcessMessage(e.response?.data?.error || 'Failed to generate bill.');
        } finally {
          setTimeout(() => setProcessStatus('idle'), 3000);
        }
      }
    });
  };

  const handleDischarge = () => {
    setConfirmState({
      isOpen: true,
      title: t('admissions_dialog_discharge_title'),
      message: balanceDue < 0 
        ? `The patient has a credit of $${Math.abs(balanceDue).toFixed(2)}. This amount will need to be refunded separately. Proceed with discharge?`
        : t('admissions_dialog_discharge_message'),
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
          setProcessMessage(e.response?.data?.error || 'Discharge failed. Ensure all bills are paid.');
        }
      }
    });
  };

  const filteredPatientsForAdmission = patients.filter(p => {
    const matchesSearch = 
      p.fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) || 
      (p.patientId && p.patientId.toLowerCase().includes(patientSearchTerm.toLowerCase())) || 
      (p.phone && p.phone.includes(patientSearchTerm));
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
      </div>

      <div className="flex gap-3 text-xs font-medium flex-wrap mb-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <p className="col-span-full text-center py-10 text-gray-500">{t('admissions_loading')}</p> : 
        beds.map(bed => {
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
                relative p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col h-48 shadow-sm hover:shadow-md
                ${isOccupied 
                  ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/50 hover:border-red-300' 
                  : isReserved
                    ? 'bg-white dark:bg-slate-800 border-blue-100 dark:border-blue-900/50 hover:border-blue-300'
                    : isCleaning
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 hover:border-purple-400'
                      : isMaintenance 
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' 
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 hover:border-green-400'}
              `}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-lg leading-none">{bed.roomNumber}</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{bed.type} / ${bed.costPerDay}</p>
                </div>
                <div className={`w-3 h-3 rounded-full shrink-0 
                  ${isOccupied ? 'bg-red-500' : isReserved ? 'bg-blue-500' : isCleaning ? 'bg-purple-500' : isMaintenance ? 'bg-yellow-500' : 'bg-green-500'}`}
                />
              </div>
              
              <div className="flex-1 flex flex-col justify-center items-center w-full">
                {isOccupied || isReserved ? (
                  <div className="w-full text-center">
                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-tight mb-2 px-1" title={admission?.patientName}>
                        {admission?.patientName}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 w-full px-1 border-t border-slate-100 dark:border-slate-700/50 pt-2 mt-1">
                      <span className="truncate max-w-[60%] text-left" title={doctorName}>{t('admissions_bed_doctor', {name: doctorName})}</span>
                      <span className="font-mono whitespace-nowrap">{t('admissions_bed_days', {count: calculateDays(admission?.entry_date || admission?.entryDate)})}</span>
                    </div>
                    {isReserved && (
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 text-center mt-2 uppercase tracking-wider">
                            Pending
                        </p>
                    )}
                  </div>
                ) : isCleaning ? (
                   <div className="text-center">
                      <Sparkles size={32} className="text-purple-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300">Cleaning</p>
                   </div>
                ) : isMaintenance ? (
                   <div className="text-center">
                      <Wrench size={32} className="text-yellow-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-yellow-700 dark:text-yellow-300">{t('admissions_bed_maintenance')}</p>
                   </div>
                ) : (
                   <div className="text-center opacity-70 group-hover:opacity-100 transition-opacity">
                      <CheckCircle size={40} className="text-green-500 mx-auto mb-2"/>
                      <p className="text-sm font-bold text-green-800 dark:text-green-300">{t('admissions_bed_available')}</p>
                   </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* --- ALL MODALS --- */}
      
      {/* Admit Patient Modal */}
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={t('admissions_modal_reserve_title', { room: selectedBedForAdmission?.roomNumber })}>
        <form onSubmit={handleAdmitSubmit} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
            {t('admissions_modal_reserve_note', { room: selectedBedForAdmission?.roomNumber })}
          </div>
          
          {!selectedPatientForAdmission ? (
            <div className="relative">
              <Input 
                label={t('patients_table_header_patient')} 
                placeholder={t('patients_search_placeholder')}
                value={patientSearchTerm}
                onChange={e => {setPatientSearchTerm(e.target.value); setShowPatientResults(true); }}
              />
              {showPatientResults && filteredPatientsForAdmission.length > 0 && (
                <div className="absolute z-10 w-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                  {filteredPatientsForAdmission.map(p => (
                    <div 
                      key={p.id} 
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer"
                      onClick={() => {
                        setSelectedPatientForAdmission(p);
                        setShowPatientResults(false);
                      }}
                    >
                      {p.fullName} ({p.patientId})
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1">{t('patients_table_header_patient')}</label>
              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <span className="font-medium">{selectedPatientForAdmission.fullName}</span>
                <button type="button" onClick={() => setSelectedPatientForAdmission(null)} className="text-xs text-red-500">Change</button>
              </div>
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

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{t('admissions_modal_reserve_button')}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal for Reserved Beds */}
      <Modal isOpen={isConfirmModalOpen} onClose={() => setIsConfirmModalOpen(false)} title={selectedAdmission?.billStatus === 'paid' ? t('admissions_bed_manage') : t('admissions_modal_confirm_title')}>
        {selectedAdmission && (
          selectedAdmission.billStatus === 'paid' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: t('admissions_confirm_message', { patient: selectedAdmission.patientName, cost: selectedAdmission.projected_cost }) }} />
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{t('admissions_care_deposit_paid')}?</span>
                  <span className="font-bold text-lg text-emerald-600">${selectedAdmission.projected_cost}</span>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="danger" onClick={handleCancelReservation}>
                  {t('admissions_bed_cancel_reservation')}
                </Button>
                <Button onClick={handleConfirmAdmission}>
                  {t('admissions_confirm_and_admit')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
               <h3 className="font-bold text-slate-800 dark:text-white">{t('admissions_modal_confirm_subtitle')}</h3>
               <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
                 <p className="font-bold mb-1">{t('admissions_payment_required')}</p>
                 <p>{t('admissions_modal_confirm_message')}</p>
               </div>
               <div className="flex justify-between items-center text-sm p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                  <span>{t('patients_table_header_patient')}</span>
                  <span className="font-bold">{selectedAdmission.patientName}</span>
               </div>
               <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="danger" onClick={handleCancelReservation}>{t('admissions_bed_cancel_reservation')}</Button>
                <Button onClick={() => { navigate('/billing'); setIsConfirmModalOpen(false); }}>{t('admissions_go_to_billing')}</Button>
              </div>
            </div>
          )
        )}
      </Modal>

      {/* Patient Care Modal */}
      <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title={t('admissions_modal_care_title')}>
        {inpatientDetails && (
          <div className="space-y-4">
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{inpatientDetails.patientName}</h3>
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                            <span>{inpatientDetails.age}yrs / {inpatientDetails.gender}</span>
                            <span>{t('Room')} {inpatientDetails.roomNumber}</span>
                            <span>Dr. {inpatientDetails.doctorName}</span>
                        </div>
                    </div>
                    <Badge color="green">Active</Badge>
                </div>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button onClick={() => setCareTab('overview')} className={`px-4 py-2 text-sm font-medium ${careTab === 'overview' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500'}`}>{t('admissions_modal_care_tab_overview')}</button>
              <button onClick={() => setCareTab('notes')} className={`px-4 py-2 text-sm font-medium ${careTab === 'notes' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500'}`}>{t('admissions_modal_care_tab_notes')}</button>
              <button onClick={() => setCareTab('discharge')} className={`px-4 py-2 text-sm font-medium ${careTab === 'discharge' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-slate-500'}`}>{t('admissions_modal_care_tab_discharge')}</button>
            </div>

            {/* Overview Tab */}
            {careTab === 'overview' && (
                <div className="space-y-4 animate-in fade-in">
                    <h4 className="font-bold text-slate-600 dark:text-slate-300">{t('admissions_care_stay_details')}</h4>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                            <p className="text-xs text-slate-400">{t('admissions_care_admission_date')}</p>
                            <p className="font-bold text-sm">{new Date(inpatientDetails.entry_date).toLocaleDateString()}</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                            <p className="text-xs text-slate-400">{t('admissions_care_duration')}</p>
                            <p className="font-bold text-sm">{calculateDays(inpatientDetails.entry_date)} Days</p>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg">
                            <p className="text-xs text-slate-400">{t('admissions_care_daily_rate')}</p>
                            <p className="font-bold text-sm">${inpatientDetails.costPerDay}/day</p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-600 dark:text-slate-300 mb-1">{t('admissions_care_admission_note')}</h4>
                        <p className="text-sm text-slate-500 italic p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">{inpatientDetails.notes || t('admissions_care_no_initial_notes')}</p>
                    </div>
                </div>
            )}

            {/* Notes Tab */}
            {careTab === 'notes' && (
                <div className="space-y-4 animate-in fade-in max-h-96 overflow-y-auto pr-2">
                    <form onSubmit={handleAddNote} className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-700">
                        <h4 className="font-bold text-slate-600 dark:text-slate-300">{t('admissions_care_add_note')}</h4>
                        <div className="grid grid-cols-4 gap-2">
                            <Input label={t('admissions_care_vitals_bp')} placeholder="120/80" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} />
                            <Input label={t('admissions_care_vitals_temp')} placeholder="37.0" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} />
                            <Input label={t('admissions_care_vitals_pulse')} placeholder="75" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} />
                            <Input label={t('admissions_care_vitals_resp')} placeholder="16" value={noteForm.resp} onChange={e => setNoteForm({...noteForm, resp: e.target.value})} />
                        </div>
                        <Textarea placeholder={t('admissions_care_observations_placeholder')} rows={2} value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} />
                        <div className="text-right">
                            <Button size="sm" type="submit">{t('admissions_care_save_note_button')}</Button>
                        </div>
                    </form>
                    {inpatientDetails.notes.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">{t('admissions_care_no_notes')}</p> : 
                     inpatientDetails.notes.map((note: any) => (
                         <div key={note.id} className="p-3 border-b dark:border-slate-700">
                             <div className="flex justify-between text-xs text-slate-400 mb-1">
                                 <span>Dr. {note.doctorName}</span>
                                 <span>{new Date(note.created_at).toLocaleString()}</span>
                             </div>
                             <p className="text-sm">{note.note}</p>
                             <div className="flex gap-4 text-xs mt-2 text-slate-500">
                                 <span>BP: {note.vitals?.bp}</span>
                                 <span>Temp: {note.vitals?.temp}°C</span>
                                 <span>Pulse: {note.vitals?.pulse}bpm</span>
                                 <span>Resp: {note.vitals?.resp}rpm</span>
                             </div>
                         </div>
                     ))
                    }
                </div>
            )}

            {/* Discharge Tab */}
            {careTab === 'discharge' && (
                <div className="space-y-4 animate-in fade-in">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300">
                        <h4 className="font-bold mb-1">{t('admissions_care_discharge_process')}</h4>
                        <p className="text-sm">{t('admissions_care_discharge_note')}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border dark:border-slate-700">
                        <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">{t('admissions_modal_discharge_summary_title')}</h4>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500">{t('admissions_care_accommodation_cost')} ({inpatientDetails.daysStayed} days)</span> <span>+ ${currentStayCost.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">{t('admissions_care_deposit_paid')}</span> <span className="text-green-600">- ${depositPaid.toFixed(2)}</span></div>
                            {inpatientDetails.unpaidBills.map((bill: any) => (
                                <div key={bill.id} className="flex justify-between pl-4 text-orange-600"><span className="text-slate-500">Invoice #{bill.bill_number}</span> <span>+ ${(bill.total_amount - bill.paid_amount).toFixed(2)}</span></div>
                            ))}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2"><span className="text-slate-700 dark:text-slate-200">{t('admissions_care_balance_due')}</span> <span className="text-red-600">${balanceDue.toFixed(2)}</span></div>
                        </div>
                    </div>
                    
                    {balanceDue > 0.01 && (
                        <Button className="w-full" variant="outline" onClick={handleGenerateSettlementBill}>
                            {t('billing_generate_settlement_button')}
                        </Button>
                    )}

                    <form className="space-y-3 pt-4 border-t dark:border-slate-700">
                        <Select label={t('admissions_care_discharge_status')} value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                            <option value="Recovered">{t('admissions_care_discharge_status_recovered')}</option>
                            <option value="Transferred">{t('admissions_care_discharge_status_transferred')}</option>
                            <option value="Against Medical Advice">{t('admissions_care_discharge_status_ama')}</option>
                            <option value="Deceased">{t('admissions_care_discharge_status_deceased')}</option>
                        </Select>
                        <Textarea label={t('admissions_care_discharge_summary')} rows={2} value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} />
                        <Button className="w-full" onClick={handleDischarge} disabled={balanceDue > 0.01}>
                            {balanceDue > 0.01 ? t('admissions_clear_due_balance', { balance: balanceDue.toFixed(2) }) : t('admissions_discharge_button')}
                        </Button>
                    </form>
                </div>
            )}
          </div>
        )}
      </Modal>

      {/* Generic Confirmation Dialog for Cleaning, etc. */}
      <ConfirmationDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={() => {
          confirmState.action();
          setConfirmState({ ...confirmState, isOpen: false });
        }}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type || 'danger'}
      />
    </div>
  );
};
