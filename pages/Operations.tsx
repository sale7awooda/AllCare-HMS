
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Modal, Input, Select, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Activity, CheckCircle, Clock, User, Syringe, Plus, Trash2, 
  Calculator, Save, ChevronRight, AlertTriangle, Stethoscope, 
  Package, Zap, Calendar, DollarSign, ChevronDown, ChevronUp, FileText, Briefcase, Search, History, Filter, Info, X, Loader2, XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

const FEE_RATIOS: Record<string, number> = {
  'anesthesiologist': 0.5,
  'assistant': 0.5,
  'nurse': 0.33,
  'technician': 0.25
};

// Helper for currency formatting
const formatNumber = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US').format(num);
};

const parseNumber = (val: string) => {
  return val.replace(/,/g, '');
};

// Formatted Currency Input Component
const CurrencyInput = ({ label, value, onChange, prefix, ...props }: any) => {
  const [displayValue, setDisplayValue] = useState(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNumber(e.target.value);
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setDisplayValue(e.target.value); 
      onChange(raw);
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatNumber(value));
  };

  return (
    <Input
      {...props}
      type="text" 
      label={label}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      prefix={prefix}
    />
  );
};

export const Operations = () => {
  const { t, language } = useTranslation();
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Unified Header Tabs
  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setActiveTab('active')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <Activity size={14}/> {t('operations_tab_active')} 
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'active' ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              {ops.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length}
            </span>
        </button>
        <button 
            onClick={() => setActiveTab('history')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <History size={14}/> {t('operations_tab_history')}
        </button>
    </div>
  ), [activeTab, ops, t]);

  useHeader(t('nav_operations'), '', HeaderTabs);

  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  const [viewingOp, setViewingOp] = useState<any>(null);
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} });
  
  const [costForm, setCostForm] = useState({ 
    surgeonFee: 0, 
    theaterFee: 0, 
    participants: [] as any[], 
    consumables: [] as any[], 
    equipment: [] as any[], 
    others: [] as any[],
    notes: '' 
  });
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, staffData] = await Promise.all([api.getScheduledOperations(), api.getStaff()]);
      setOps(opsData); setStaff(staffData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openEstimateModal = (op: any) => {
    let initialSurgeonFee = 0;
    if (op.doctor_id) {
        const doctor = staff.find(s => s.id === op.doctor_id);
        if (doctor) initialSurgeonFee = doctor.consultationFee * 5;
    }
    setCostForm({ 
        surgeonFee: initialSurgeonFee, 
        theaterFee: initialSurgeonFee, 
        participants: [], 
        consumables: [], 
        equipment: [], 
        others: [], 
        notes: '' 
    });
    setSelectedOp(op);
    setIsEstimateModalOpen(true);
  };

  const openDetailModal = (op: any) => {
    setViewingOp(op);
    setIsDetailModalOpen(true);
  };

  const handleSurgeonFeeChange = (val: string) => {
    const newFee = parseFloat(val) || 0;
    setCostForm(prev => ({ 
      ...prev, 
      surgeonFee: newFee, 
      theaterFee: newFee, 
      participants: prev.participants.map(p => ({ ...p, fee: Math.round(newFee * (FEE_RATIOS[p.role] || 0)) })) 
    }));
  };

  const addParticipant = () => {
    setCostForm(prev => ({ ...prev, participants: [...prev.participants, { id: Date.now(), role: 'nurse', staffId: '', name: '', fee: Math.round(prev.surgeonFee * 0.33) }] }));
  };

  const updateParticipant = (index: number, field: string, value: any) => {
    setCostForm(prev => {
      const updatedList = [...prev.participants];
      const item = { ...updatedList[index] };
      if (field === 'role') { item.role = value; item.fee = Math.round(prev.surgeonFee * (FEE_RATIOS[value] || 0)); item.staffId = ''; }
      else if (field === 'staffId') { item.staffId = value; item.name = staff.find(s => s.id.toString() === value)?.fullName || ''; }
      else if (field === 'fee') item.fee = parseFloat(value) || 0;
      updatedList[index] = item; return { ...prev, participants: updatedList };
    });
  };

  const addItem = (section: 'consumables' | 'equipment' | 'others') => {
    setCostForm(prev => ({
      ...prev,
      [section]: [...prev[section], { id: Date.now(), name: '', cost: 0 }]
    }));
  };

  const updateItem = (section: 'consumables' | 'equipment' | 'others', index: number, field: string, value: any) => {
    setCostForm(prev => {
      const list = [...prev[section]];
      list[index] = { ...list[index], [field]: field === 'cost' ? (parseFloat(value) || 0) : value };
      return { ...prev, [section]: list };
    });
  };

  const removeItem = (section: 'consumables' | 'equipment' | 'others', index: number) => {
    setCostForm(prev => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    const partSum = costForm.participants.reduce((sum, p) => sum + p.fee, 0);
    const conSum = costForm.consumables.reduce((sum, i) => sum + i.cost, 0);
    const eqSum = costForm.equipment.reduce((sum, i) => sum + i.cost, 0);
    const otSum = costForm.others.reduce((sum, i) => sum + i.cost, 0);
    return costForm.surgeonFee + costForm.theaterFee + partSum + conSum + eqSum + otSum;
  };

  const handleProcessSubmit = async () => {
    if (!selectedOp) return;
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try { 
      await api.processOperationRequest(selectedOp.id, { details: costForm, totalCost: calculateTotal() }); 
      setProcessStatus('success'); 
      setIsEstimateModalOpen(false); 
      loadData(); 
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e: any) { 
        setProcessStatus('error');
        setProcessMessage(e.response?.data?.error || t('error'));
    }
  };

  const handleCompleteOp = (opId: number) => {
    setConfirmState({ 
        isOpen: true, 
        title: t('operations_dialog_complete_title'), 
        message: t('operations_dialog_complete_message'), 
        action: async () => { 
            setProcessStatus('processing');
            try { 
                await api.completeOperation(opId); 
                setProcessStatus('success');
                loadData(); 
                setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { 
                setProcessStatus('error');
                setProcessMessage(e.response?.data?.error || t('error'));
            } 
        } 
    });
  };

  const getTranslatedStatus = (status: string) => {
    const key = `operations_status_${status.toLowerCase()}`;
    const val = t(key);
    return val === key ? status : val;
  };

  const filteredOps = ops.filter(op => { const search = searchTerm.toLowerCase(); return op.patientName.toLowerCase().includes(search) || op.operation_name.toLowerCase().includes(search); });

  const requestsAndEstimates = filteredOps.filter(o => o.status === 'requested' || o.status === 'pending_payment');
  const scheduledOps = filteredOps.filter(o => o.status === 'confirmed');
  const historyOps = filteredOps.filter(o => o.status === 'completed' || o.status === 'cancelled');

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder={t('operations_search_placeholder')} 
              className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-slate-500 font-medium">{t('loading')}</p>
        </div>
      ) : (
        <>
          {activeTab === 'active' && (
            <div className="space-y-8 animate-in fade-in">
                {/* Requests Grid */}
                <div>
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2"><FileText size={16}/> {t('operations_section_requests')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {requestsAndEstimates.length === 0 ? (
                            <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                <p className="text-slate-400">{t('operations_requests_empty')}</p>
                            </div>
                        ) : (
                            requestsAndEstimates.map(op => (
                                <Card key={op.id} className="relative group border-l-4 border-l-yellow-400">
                                    <div className="flex justify-between items-start mb-3">
                                        <Badge color={op.status === 'pending_payment' ? 'blue' : 'yellow'}>
                                            {op.status === 'pending_payment' ? t('operations_card_awaiting_payment') : t('operations_card_needs_estimation')}
                                        </Badge>
                                        <span className="text-xs text-slate-400">{new Date(op.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="font-bold text-lg mb-1">{op.operation_name}</h3>
                                    <p className="text-sm text-slate-500 mb-4">{op.patientName} • Dr. {op.doctorName}</p>
                                    {op.status === 'pending_payment' ? (
                                        <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center">
                                            <span className="text-sm font-medium">{t('operations_card_est_cost')}</span>
                                            <span className="font-bold text-lg">${op.projected_cost.toLocaleString()}</span>
                                        </div>
                                    ) : (
                                        <Button className="w-full" onClick={() => openEstimateModal(op)} icon={Calculator}>{t('operations_card_process_button')}</Button>
                                    )}
                                </Card>
                            ))
                        )}
                    </div>
                </div>

                {/* Confirmed Schedule Table */}
                <div>
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest mb-4 flex items-center gap-2"><Calendar size={16}/> {t('operations_section_confirmed')}</h3>
                    <Card className="!p-0 overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('operations_schedule_header_procedure')}</th>
                                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                {scheduledOps.length === 0 ? (
                                    <tr><td colSpan={4} className="text-center py-10 text-slate-400">{t('operations_schedule_empty')}</td></tr>
                                ) : (
                                    scheduledOps.map(op => (
                                        <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4"><Badge color="green">{getTranslatedStatus('confirmed')}</Badge></td>
                                            <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{new Date(op.created_at).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-800 dark:text-white">{op.operation_name}</div>
                                                <div className="text-xs text-slate-400">{op.patientName} • Dr. {op.doctorName}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button size="sm" variant="outline" onClick={() => handleCompleteOp(op.id)}>{t('completed')}</Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </Card>
                </div>
            </div>
          )}

          {activeTab === 'history' && (
            <Card className="!p-0 overflow-hidden animate-in fade-in">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('operations_history_header_date')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('operations_schedule_header_procedure')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('operations_history_header_cost')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {historyOps.length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-10 text-slate-400">{t('operations_history_empty')}</td></tr>
                        ) : (
                            historyOps.map(op => (
                                <tr key={op.id} onClick={() => openDetailModal(op)} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer group">
                                    <td className="px-6 py-4"><Badge color={op.status === 'completed' ? 'gray' : 'red'}>{getTranslatedStatus(op.status)}</Badge></td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{new Date(op.created_at).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-800 dark:text-white group-hover:text-primary-600 transition-colors">{op.operation_name}</div>
                                        <div className="text-xs text-slate-400">{op.patientName} • Dr. {op.doctorName}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-primary-600">${op.projected_cost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight size={16} className={`text-slate-300 group-hover:text-primary-500 transition-colors inline-block ${language === 'ar' ? 'rotate-180' : ''}`} />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </Card>
          )}
        </>
      )}

      {/* ESTIMATION MODAL */}
      <Modal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} title={t('operations_modal_estimate_title')}>
        <div className="flex flex-col h-[75vh] min-h-[400px]">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex justify-between items-center shrink-0 mb-4 mx-1">
                <div>
                    <h4 className="font-black text-xl tracking-tight">{selectedOp?.operation_name}</h4>
                    <p className="text-xs text-slate-400 font-medium mt-1 flex items-center gap-1">
                        <Stethoscope size={12} /> Dr. {selectedOp?.doctorName}
                    </p>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t('operations_modal_total_label')}</span>
                    <span className="text-3xl font-black text-emerald-400 tracking-tighter">${calculateTotal().toLocaleString()}</span>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-6 pb-4">
                
                {/* Section 1: Base Fees */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <DollarSign size={14} className="text-primary-600"/> {t('operations_modal_section_base')}
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                        <CurrencyInput label={t('operations_modal_surgeon_fee')} value={costForm.surgeonFee} onChange={(val: string) => handleSurgeonFeeChange(val)} className="font-mono font-bold" />
                        <CurrencyInput label={t('operations_modal_theater_fee')} value={costForm.theaterFee} onChange={(val: string) => setCostForm({...costForm, theaterFee: parseFloat(val) || 0})} className="font-mono font-bold" />
                    </div>
                </div>
                
                {/* Section 2: Clinical Team */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <User size={16} className="text-blue-500"/> {t('operations_modal_section_team')}
                        </h5>
                        <Button size="sm" variant="ghost" onClick={addParticipant} icon={Plus} className="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">{t('operations_modal_add_member')}</Button>
                    </div>
                    
                    <div className="space-y-3">
                        {costForm.participants.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">{t('no_data')}</p>}
                        {costForm.participants.map((p, idx) => (
                            <div key={p.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 transition-colors">
                                <div className="col-span-3">
                                    <select className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 px-2 font-medium focus:ring-2 focus:ring-blue-500/20 outline-none" value={p.role} onChange={e => updateParticipant(idx, 'role', e.target.value)}>
                                        {Object.keys(FEE_RATIOS).map(r => <option key={r} value={r}>{t(`staff_role_${r}`)}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-5">
                                    <select className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 px-2 focus:ring-2 focus:ring-blue-500/20 outline-none" value={p.staffId} onChange={e => updateParticipant(idx, 'staffId', e.target.value)}>
                                        <option value="">{t('appointments_form_select_staff')}</option>
                                        {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <div className="relative">
                                        <span className={`absolute ${language === 'ar' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 text-slate-400 text-[10px]`}>$</span>
                                        <input 
                                          type="text" 
                                          className={`w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 ${language === 'ar' ? 'pr-5 pl-2' : 'pl-5 pr-2'} font-mono font-bold focus:ring-2 focus:ring-blue-500/20 outline-none`} 
                                          value={formatNumber(p.fee)} 
                                          onChange={e => updateParticipant(idx, 'fee', parseNumber(e.target.value))} 
                                        />
                                    </div>
                                </div>
                                <div className="col-span-1 text-center">
                                    <button onClick={() => setCostForm(prev => ({...prev, participants: prev.participants.filter((_,i)=>i!==idx)}))} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                                        <Trash2 size={14}/>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section 3: Consumables */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Package size={16} className="text-orange-500"/> {t('operations_modal_section_supplies')}
                        </h5>
                        <Button size="sm" variant="ghost" onClick={() => addItem('consumables')} icon={Plus} className="text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20">{t('operations_modal_add_item')}</Button>
                    </div>
                    <div className="space-y-2">
                        {costForm.consumables.map((item, idx) => (
                            <div key={item.id} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-orange-200 transition-colors">
                                <input placeholder={t('operations_modal_item_name')} className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 px-3 focus:ring-2 focus:ring-orange-500/20 outline-none" value={item.name} onChange={e => updateItem('consumables', idx, 'name', e.target.value)} />
                                <div className="relative w-28">
                                    <span className={`absolute ${language === 'ar' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 text-slate-400 text-[10px]`}>$</span>
                                    <input 
                                      type="text" 
                                      placeholder="0.00" 
                                      className={`w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 ${language === 'ar' ? 'pr-5 pl-2' : 'pl-5 pr-2'} font-mono font-bold focus:ring-2 focus:ring-orange-500/20 outline-none`} 
                                      value={formatNumber(item.cost)} 
                                      onChange={e => updateItem('consumables', idx, 'cost', parseNumber(e.target.value))}
                                    />
                                </div>
                                <button onClick={() => removeItem('consumables', idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                            </div>
                        ))}
                        {costForm.consumables.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">{t('no_data')}</p>}
                    </div>
                </div>

                {/* Section 4: Equipment */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Zap size={16} className="text-yellow-500"/> {t('operations_modal_section_equipment')}
                        </h5>
                        <Button size="sm" variant="ghost" onClick={() => addItem('equipment')} icon={Plus} className="text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20">{t('operations_modal_add_item')}</Button>
                    </div>
                    <div className="space-y-2">
                        {costForm.equipment.map((item, idx) => (
                            <div key={item.id} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-yellow-200 transition-colors">
                                <input placeholder={t('operations_modal_item_name')} className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 px-3 focus:ring-2 focus:ring-yellow-500/20 outline-none" value={item.name} onChange={e => updateItem('equipment', idx, 'name', e.target.value)} />
                                <div className="relative w-28">
                                    <span className={`absolute ${language === 'ar' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 text-slate-400 text-[10px]`}>$</span>
                                    <input 
                                      type="text" 
                                      placeholder="0.00" 
                                      className={`w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 ${language === 'ar' ? 'pr-5 pl-2' : 'pl-5 pr-2'} font-mono font-bold focus:ring-2 focus:ring-yellow-500/20 outline-none`} 
                                      value={formatNumber(item.cost)} 
                                      onChange={e => updateItem('equipment', idx, 'cost', parseNumber(e.target.value))}
                                    />
                                </div>
                                <button onClick={() => removeItem('equipment', idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                            </div>
                        ))}
                        {costForm.equipment.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">{t('no_data')}</p>}
                    </div>
                </div>

                {/* Section 5: Other Fees */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                        <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Briefcase size={16} className="text-violet-500"/> {t('operations_modal_section_misc')}
                        </h5>
                        <Button size="sm" variant="ghost" onClick={() => addItem('others')} icon={Plus} className="text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20">{t('operations_modal_add_item')}</Button>
                    </div>
                    <div className="space-y-2">
                        {costForm.others.map((item, idx) => (
                            <div key={item.id} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-violet-200 transition-colors">
                                <input placeholder={t('billing_treasury_table_description')} className="flex-1 rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 px-3 focus:ring-2 focus:ring-violet-500/20 outline-none" value={item.name} onChange={e => updateItem('others', idx, 'name', e.target.value)} />
                                <div className="relative w-28">
                                    <span className={`absolute ${language === 'ar' ? 'right-2' : 'left-2'} top-1/2 -translate-y-1/2 text-slate-400 text-[10px]`}>$</span>
                                    <input 
                                      type="text" 
                                      placeholder="0.00" 
                                      className={`w-full rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs py-2 ${language === 'ar' ? 'pr-5 pl-2' : 'pl-5 pr-2'} font-mono font-bold focus:ring-2 focus:ring-violet-500/20 outline-none`} 
                                      value={formatNumber(item.cost)} 
                                      onChange={e => updateItem('others', idx, 'cost', parseNumber(e.target.value))}
                                    />
                                </div>
                                <button onClick={() => removeItem('others', idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={14}/></button>
                            </div>
                        ))}
                        {costForm.others.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">{t('no_data')}</p>}
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <Textarea label={t('operations_modal_notes_label')} placeholder={t('operations_modal_notes_placeholder')} rows={3} value={costForm.notes} onChange={e => setCostForm({...costForm, notes: e.target.value})} className="bg-white dark:bg-slate-900" />
                </div>
            </div>
            
            <div className="pt-4 border-t dark:border-slate-700 flex justify-end gap-3 shrink-0 bg-white dark:bg-slate-800 py-3 mt-auto">
                <Button variant="secondary" onClick={() => setIsEstimateModalOpen(false)}>{t('cancel')}</Button>
                <Button onClick={handleProcessSubmit} disabled={processStatus === 'processing'} icon={Save}>
                    {processStatus === 'processing' ? t('processing') : t('operations_modal_invoice_button')}
                </Button>
            </div>
        </div>
      </Modal>

      {/* DETAILS VIEW MODAL */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={t('admissions_history_action_details')}>
        {viewingOp && (
            <div className="space-y-6">
                <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-100">
                    <div>
                        <h4 className="text-lg font-black text-slate-800 dark:text-white mb-1">{viewingOp.operation_name}</h4>
                        <p className="text-sm text-slate-500">{viewingOp.patientName}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-400">
                            <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(viewingOp.created_at).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Stethoscope size={12}/> Dr. {viewingOp.doctorName}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <Badge color={viewingOp.status === 'completed' ? 'gray' : viewingOp.status === 'cancelled' ? 'red' : 'green'}>{getTranslatedStatus(viewingOp.status)}</Badge>
                        <p className="font-mono font-black text-2xl text-primary-600 mt-2">${viewingOp.projected_cost.toLocaleString()}</p>
                    </div>
                </div>

                {viewingOp.costDetails && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 border rounded-xl bg-white dark:bg-slate-800">
                                <p className="text-[10px] font-black uppercase text-slate-400">{t('operations_modal_surgeon_fee')}</p>
                                <p className="font-bold text-slate-800 dark:text-white">${(viewingOp.costDetails.surgeonFee || 0).toLocaleString()}</p>
                            </div>
                            <div className="p-3 border rounded-xl bg-white dark:bg-slate-800">
                                <p className="text-[10px] font-black uppercase text-slate-400">{t('operations_modal_theater_fee')}</p>
                                <p className="font-bold text-slate-800 dark:text-white">${(viewingOp.costDetails.theaterFee || 0).toLocaleString()}</p>
                            </div>
                        </div>

                        {viewingOp.costDetails.participants && viewingOp.costDetails.participants.length > 0 && (
                            <div>
                                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{t('operations_modal_section_team')}</h5>
                                <div className="space-y-2">
                                    {viewingOp.costDetails.participants.map((p: any, i: number) => (
                                        <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-sm">
                                            <span><span className="font-bold">{p.name || t('patients_modal_view_na')}</span> <span className="text-slate-400 text-xs">({t(`staff_role_${p.role}`)})</span></span>
                                            <span className="font-mono">${p.fee.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {['consumables', 'equipment', 'others'].map(cat => {
                            const items = viewingOp.costDetails[cat];
                            if (!items || items.length === 0) return null;
                            const sectionKey = cat === 'consumables' ? 'operations_modal_section_supplies' : cat === 'equipment' ? 'operations_modal_section_equipment' : 'operations_modal_section_misc';
                            return (
                                <div key={cat}>
                                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1 capitalize">{t(sectionKey)}</h5>
                                    <div className="space-y-2">
                                        {items.map((item: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 text-sm">
                                                <span className="text-slate-700 dark:text-slate-300">{item.name}</span>
                                                <span className="font-mono">${item.cost.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {viewingOp.notes && (
                    <div>
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{t('patients_modal_action_notes')}</h5>
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 italic">
                            {viewingOp.notes}
                        </div>
                    </div>
                )}

                <div className="pt-4 flex justify-end">
                    <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>{t('close')}</Button>
                </div>
            </div>
        )}
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message}/>
    </div>
  );
};
