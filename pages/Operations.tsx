
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Modal, Input, Select, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Activity, CheckCircle, Clock, User, Syringe, Plus, Trash2, 
  Calculator, Save, ChevronRight, AlertTriangle, Stethoscope, 
  Package, Zap, Calendar, DollarSign, ChevronDown, ChevronUp, FileText, Briefcase, Search, History, Filter
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

export const Operations = () => {
  const { t } = useTranslation();
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'schedule' | 'history'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sync Header
  useHeader(t('operations_title'), t('operations_subtitle'));

  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string>('team');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} });
  
  const [costForm, setCostForm] = useState({ surgeonFee: 0, theaterFee: 0, participants: [] as any[], consumables: [] as any[], equipment: [] as any[], others: [] as any[] });
  const [processStatus, setProcessStatus] = useState('idle');

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsDataRaw, staffDataRaw] = await Promise.all([api.getScheduledOperations(), api.getStaff()]);
      setOps(Array.isArray(opsDataRaw) ? opsDataRaw : []); 
      setStaff(Array.isArray(staffDataRaw) ? staffDataRaw : []);
    } catch (e) { 
      console.error(e); 
      setOps([]);
      setStaff([]);
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const openEstimateModal = (op: any) => {
    let initialSurgeonFee = 0;
    if (op.doctor_id) {
        const doctor = staff.find(s => s.id === op.doctor_id);
        if (doctor) initialSurgeonFee = doctor.consultationFee * 5;
    }
    setCostForm({ surgeonFee: initialSurgeonFee, theaterFee: initialSurgeonFee, participants: [], consumables: [], equipment: [], others: [] });
    setSelectedOp(op);
    setIsEstimateModalOpen(true);
  };

  const handleSurgeonFeeChange = (val: string) => {
    const newFee = parseFloat(val) || 0;
    setCostForm(prev => ({ ...prev, surgeonFee: newFee, theaterFee: newFee, participants: prev.participants.map(p => ({ ...p, fee: Math.round(newFee * (FEE_RATIOS[p.role] || 0)) })) }));
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
    try { await api.processOperationRequest(selectedOp.id, { details: costForm, totalCost: calculateTotal() }); setProcessStatus('success'); setIsEstimateModalOpen(false); loadData(); } catch (e) { alert("Failed to process request"); } finally { setProcessStatus('idle'); }
  };

  const handleCompleteOp = (opId: number) => {
    setConfirmState({ isOpen: true, title: t('operations_dialog_complete_title'), message: t('operations_dialog_complete_message'), action: async () => { try { await api.completeOperation(opId); loadData(); } catch (e) { alert("Failed to update status"); } } });
  };

  const filteredOps = useMemo(() => {
    if (!Array.isArray(ops)) return [];
    const search = searchTerm.toLowerCase();
    return ops.filter(op => 
        (op.patientName?.toLowerCase() || '').includes(search) || 
        (op.operation_name?.toLowerCase() || '').includes(search)
    );
  }, [ops, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder={t('operations_search_placeholder')} className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg shrink-0 overflow-x-auto"><button onClick={() => setActiveTab('requests')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'requests' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><FileText size={16}/> {t('operations_tab_requests')} <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full ml-1">{filteredOps.filter(o => o.status === 'requested').length}</span></button><button onClick={() => setActiveTab('schedule')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><Calendar size={16}/> {t('operations_tab_schedule')}</button><button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><History size={16}/> {t('operations_tab_history')}</button></div>
      </div>

      {activeTab === 'requests' && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredOps.filter(o => o.status === 'requested' || o.status === 'pending_payment').map(op => (<Card key={op.id} className="relative group border-l-4 border-l-yellow-400"><div className="flex justify-between items-start mb-3"><Badge color={op.status === 'pending_payment' ? 'blue' : 'yellow'}>{op.status === 'pending_payment' ? t('operations_card_awaiting_payment') : t('operations_card_needs_estimation')}</Badge><span className="text-xs text-slate-400">{new Date(op.created_at).toLocaleDateString()}</span></div><h3 className="font-bold text-lg mb-1">{op.operation_name}</h3><p className="text-sm text-slate-500 mb-4">{op.patientName} • Dr. {op.doctorName}</p>{op.status === 'pending_payment' ? (<div className="bg-slate-50 p-3 rounded-lg flex justify-between items-center"><span className="text-sm font-medium">Est. Cost</span><span className="font-bold text-lg">${op.projected_cost.toLocaleString()}</span></div>) : (<Button className="w-full" onClick={() => openEstimateModal(op)} icon={Calculator}>{t('operations_card_process_button')}</Button>)}</Card>))}</div>)}
      {activeTab === 'schedule' && (<Card className="!p-0 overflow-hidden"><table className="min-w-full divide-y"><thead className="bg-slate-50"><tr><th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">{t('status')}</th><th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">{t('date')}</th><th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">{t('operations_schedule_header_procedure')}</th><th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase">{t('actions')}</th></tr></thead><tbody className="bg-white divide-y">{filteredOps.filter(o => o.status === 'confirmed').map(op => (<tr key={op.id} className="hover:bg-slate-50"><td className="px-6 py-4"><Badge color="green">Confirmed</Badge></td><td className="px-6 py-4 text-sm text-gray-500">{new Date(op.created_at).toLocaleDateString()}</td><td className="px-6 py-4"><div className="font-bold">{op.operation_name}</div><div className="text-xs text-slate-400">{op.patientName}</div></td><td className="px-6 py-4 text-right"><Button size="sm" variant="outline" onClick={() => handleCompleteOp(op.id)}>Complete</Button></td></tr>))}</tbody></table></Card>)}

      <Modal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} title={t('operations_modal_title')}>
        <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar"><div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center sticky top-0 z-10"><div><h4 className="font-bold text-lg">{selectedOp?.operation_name}</h4><p className="text-xs text-slate-400">Dr. {selectedOp?.doctorName}</p></div><div className="text-right"><span className="block text-xs uppercase text-slate-400 font-bold">{t('ops_total_estimate')}</span><span className="text-2xl font-bold text-green-400">${calculateTotal().toLocaleString()}</span></div></div><div className="space-y-4"><Input label={t('operations_modal_surgeon_fee')} type="number" value={costForm.surgeonFee} onChange={e => handleSurgeonFeeChange(e.target.value)} /><Input label={t('operations_modal_theater_fee')} type="number" value={costForm.theaterFee} onChange={e => setCostForm({...costForm, theaterFee: parseFloat(e.target.value) || 0})} /><div className="space-y-3 pt-2"><div className="flex justify-between items-center"><h5 className="text-sm font-bold uppercase">{t('operations_modal_additional_staff')}</h5><Button size="sm" variant="secondary" onClick={addParticipant} icon={Plus} /></div>{costForm.participants.map((p, idx) => (<div key={p.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border"><select className="w-1/3 rounded-md border-slate-300 text-xs py-1.5" value={p.role} onChange={e => updateParticipant(idx, 'role', e.target.value)}>{Object.keys(FEE_RATIOS).map(r => <option key={r} value={r}>{r}</option>)}</select><select className="flex-1 rounded-md border-slate-300 text-xs py-1.5" value={p.staffId} onChange={e => updateParticipant(idx, 'staffId', e.target.value)}><option value="">Select Staff...</option>{staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select><input type="number" className="w-20 rounded-md border-slate-300 text-xs py-1.5 px-2 font-bold" value={p.fee} onChange={e => updateParticipant(idx, 'fee', e.target.value)} /><button onClick={() => setCostForm(prev => ({...prev, participants: prev.participants.filter((_,i)=>i!==idx)}))} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button></div>))}</div></div><div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white py-2"><Button variant="secondary" onClick={() => setIsEstimateModalOpen(false)}>{t('cancel')}</Button><Button onClick={handleProcessSubmit} disabled={processStatus === 'processing'} icon={Save}>{processStatus === 'processing' ? t('processing') : t('operations_modal_invoice_button')}</Button></div></div>
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message}/>
    </div>
  );
};
