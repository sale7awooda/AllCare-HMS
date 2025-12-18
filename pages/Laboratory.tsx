
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea } from '../components/UI';
import { FlaskConical, CheckCircle, Search, Clock, FileText, User, ChevronRight, Activity, History as HistoryIcon, Save, AlertTriangle, Info } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

// Helper to evaluate result against range
const evaluateResult = (value: string, range: string) => {
    if (!value || !range) return 'Normal';
    
    // Check if range is numeric (e.g. "70 - 100")
    const rangeMatch = range.match(/(\d+(\.\d+)?)\s*-\s*(\d+(\.\d+)?)/);
    const numVal = parseFloat(value);
    
    if (rangeMatch && !isNaN(numVal)) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[3]);
        if (numVal < min) return 'Low';
        if (numVal > max) return 'High';
    }
    
    // Qualitative check (e.g. range is "Negative")
    if (range.toLowerCase().includes('neg') && value.toLowerCase().includes('pos')) return 'Positive';
    if (range.toLowerCase().includes('neg') && value.toLowerCase().includes('neg')) return 'Normal';

    return 'Normal';
};

export const Laboratory = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sync Header
  useHeader(t('lab_title'), t('lab_subtitle'));

  // Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  
  // New structured state for results
  const [structuredResults, setStructuredResults] = useState<any[]>([]);
  const [internalNotes, setInternalNotes] = useState('');
  const [processStatus, setProcessStatus] = useState('idle');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingLabRequests(); 
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openProcessModal = (req: any) => {
    setSelectedReq(req);
    
    // Pre-populate structured results based on tests in the request
    if (req.status === 'completed' && req.structuredResults) {
        setStructuredResults(req.structuredResults);
    } else {
        const initial = req.tests.map((test: any) => ({
            testId: test.id,
            name: test.name_en,
            value: '',
            range: test.normal_range || 'N/A',
            evaluation: 'Normal'
        }));
        setStructuredResults(initial);
    }
    
    setInternalNotes(req.notes || '');
    setIsProcessModalOpen(true);
  };

  const handleResultChange = (index: number, val: string) => {
      const updated = [...structuredResults];
      updated[index].value = val;
      updated[index].evaluation = evaluateResult(val, updated[index].range);
      setStructuredResults(updated);
  };

  const handleEvaluationChange = (index: number, evalVal: string) => {
      const updated = [...structuredResults];
      updated[index].evaluation = evalVal;
      setStructuredResults(updated);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setProcessStatus('processing');
    try {
      await api.completeLabRequest(selectedReq.id, {
          results: structuredResults,
          notes: internalNotes
      });
      setProcessStatus('success');
      await loadData();
      setTimeout(() => { setIsProcessModalOpen(false); setProcessStatus('idle'); }, 1000);
    } catch (error) { alert(t('lab_save_error')); setProcessStatus('idle'); }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'queue' ? (r.status === 'pending' || r.status === 'confirmed') : (r.status === 'completed');
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg w-fit">
          <button onClick={() => setActiveTab('queue')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'queue' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><FlaskConical size={16}/> {t('lab_tab_queue')} <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 text-xs px-2 py-0.5 rounded-full ml-1">{requests.filter(r => r.status !== 'completed').length}</span></button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}><HistoryIcon size={16}/> {t('lab_tab_history')}</button>
      </div>

      <Card className="!p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" /><input type="text" placeholder={t('lab_search_placeholder')} className="pl-10 w-full sm:w-96 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div></Card>

      <div className="grid grid-cols-1 gap-4">
        {loading ? <div className="text-center py-20 text-slate-400">{t('lab_loading')}</div> : filteredRequests.length === 0 ? (<div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl"><FlaskConical size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" /><p className="text-slate-500 dark:text-slate-400 font-medium">{t('lab_empty', {tab: activeTab === 'queue' ? t('lab_tab_queue') : t('lab_tab_history')})}</p></div>) : 
        filteredRequests.map(req => (<div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center group"><div className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg min-w-[80px] border border-slate-100 dark:border-slate-700"><span className="text-xs font-bold text-slate-400 uppercase">{new Date(req.created_at).toLocaleString('default', { month: 'short' })}</span><span className="text-xl font-bold text-slate-800 dark:text-slate-200">{new Date(req.created_at).getDate()}</span><span className="text-xs text-slate-400">{new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span></div><div className="flex-1"><div className="flex items-center gap-3 mb-1"><h3 className="text-lg font-bold text-slate-800 dark:text-white">{req.patientName}</h3>{req.status === 'completed' ? <Badge color="green"><CheckCircle size={12} className="inline mr-1"/>{t('lab_card_results_ready')}</Badge> : req.status === 'confirmed' ? <Badge color="blue">{t('lab_card_paid')}</Badge> : <Badge color="yellow">{t('lab_card_payment_pending')}</Badge>}</div><p className="text-sm text-slate-500 dark:text-slate-400">{req.testNames || 'Multiple Tests'}</p></div><div className="text-right"><span className="text-xs text-slate-400">{t('config_field_cost')}</span><p className="text-xl font-bold text-slate-800 dark:text-white">${req.projected_cost.toLocaleString()}</p></div><div className="sm:ml-auto">{req.status === 'confirmed' && <Button onClick={() => openProcessModal(req)} icon={Activity}>{t('lab_card_enter_results')}</Button>}{req.status === 'pending' && <div className="text-sm text-orange-600 font-medium flex items-center gap-2 bg-orange-50 p-3 rounded-lg border border-orange-100"><Clock size={16}/><span>{t('lab_card_awaiting_payment')}</span></div>}{req.status === 'completed' && <Button variant="secondary" icon={FileText} onClick={() => openProcessModal(req)}>{t('lab_view_results')}</Button>}</div></div>))
        }
      </div>

      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title={`${t('lab_modal_title')} - ${selectedReq?.patientName}`}>
        <form onSubmit={handleComplete} className="space-y-6">
          <div className="overflow-x-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                        <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Test Name</th>
                        <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Result Value</th>
                        <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Normal Range</th>
                        <th className="px-4 py-3 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Evaluation</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {structuredResults.map((res, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="px-4 py-3 font-bold text-slate-700 dark:text-slate-300">{res.name}</td>
                            <td className="px-4 py-3">
                                <input 
                                    type="text" 
                                    disabled={selectedReq?.status === 'completed'}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                                    value={res.value} 
                                    onChange={(e) => handleResultChange(idx, e.target.value)} 
                                    placeholder="Enter value..."
                                />
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-xs">{res.range}</td>
                            <td className="px-4 py-3">
                                <select 
                                    disabled={selectedReq?.status === 'completed'}
                                    className={`px-2 py-1 rounded-md text-xs font-bold border-none focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer ${
                                        res.evaluation === 'Normal' ? 'bg-green-50 text-green-700 dark:bg-green-900/30' : 
                                        res.evaluation === 'High' || res.evaluation === 'Low' || res.evaluation === 'Positive' ? 'bg-red-50 text-red-700 dark:bg-red-900/30' : 
                                        'bg-slate-100 text-slate-600'
                                    }`}
                                    value={res.evaluation}
                                    onChange={(e) => handleEvaluationChange(idx, e.target.value)}
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="Low">Low</option>
                                    <option value="High">High</option>
                                    <option value="Positive">Positive</option>
                                    <option value="Negative">Negative</option>
                                    <option value="Borderline">Borderline</option>
                                </select>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-black uppercase text-slate-400 tracking-widest px-1">Technician Notes</label>
             <Textarea 
                placeholder={t('lab_modal_notes_placeholder')} 
                rows={3} 
                value={internalNotes} 
                onChange={e => setInternalNotes(e.target.value)} 
                disabled={selectedReq?.status === 'completed'} 
             />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-800">
            <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t('close')}</Button>
            {selectedReq?.status !== 'completed' && (
                <Button type="submit" icon={Save} disabled={processStatus === 'processing'}>
                    {processStatus === 'processing' ? t('processing') : t('lab_modal_save_button')}
                </Button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
