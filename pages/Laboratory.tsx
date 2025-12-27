
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, ConfirmationDialog } from '../components/UI';
import { 
    FlaskConical, CheckCircle, Search, Clock, FileText, Activity, 
    History as HistoryIcon, Save, Calendar, Loader2, XCircle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, RotateCcw, Eye
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';
import { useAuth } from '../context/AuthContext';
import { hasPermission, Permissions } from '../utils/rbac';

export const Laboratory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const canAmend = hasPermission(user, Permissions.MANAGE_CONFIGURATION) || hasPermission(user, Permissions.MANAGE_HR);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => { setActiveTab('queue'); setCurrentPage(1); }} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <FlaskConical size={14}/> {t('lab_tab_queue')} 
        </button>
        <button 
            onClick={() => { setActiveTab('history'); setCurrentPage(1); }} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <HistoryIcon size={14}/> {t('lab_tab_history')}
        </button>
    </div>
  ), [activeTab, t]);

  useHeader(t('lab_title'), t('lab_subtitle'), HeaderTabs);

  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [resultValues, setResultValues] = useState<any>({});
  const [resultNotes, setResultNotes] = useState('');
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState<any>({ isOpen: false, title: '', message: '', action: () => {} });

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.getPendingLabRequests({ 
          page: currentPage, 
          limit: itemsPerPage, 
          search: searchTerm 
      }); 
      
      setRequests(response.requests || []);
      setTotalItems(response.total || 0);
      setTotalPages(response.totalPages || 0);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [activeTab, currentPage, itemsPerPage, searchTerm]);

  const getEvaluation = (value: string, range: string) => {
    if (!value || !range) return 'lab_eval_observed';
    const val = parseFloat(value);
    
    // Numeric range check
    const numericRangeMatch = range.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
    if (numericRangeMatch && !isNaN(val)) {
      const low = parseFloat(numericRangeMatch[1]);
      const high = parseFloat(numericRangeMatch[2]);
      if (val < low) return 'lab_eval_low';
      if (val > high) return 'lab_eval_high';
      return 'lab_eval_normal';
    }

    // Qualitative check
    const lowerVal = value.toLowerCase();
    const lowerRange = range.toLowerCase();
    if (lowerRange.includes('neg') || lowerRange.includes('non')) {
        if (lowerVal.includes('pos')) return 'lab_eval_high';
        if (lowerVal.includes('neg')) return 'lab_eval_normal';
    }
    
    return 'lab_eval_observed';
  };

  const openProcessModal = (req: any) => {
    setSelectedReq(req);
    setResultNotes(req.notes || '');
    
    const initialResults: any = {};
    req.testDetails.forEach((test: any) => {
        let components: any[] = [];
        // Resilient Range Parsing (#3)
        if (test.normal_range?.includes(';') || test.normal_range?.includes(':')) {
            components = test.normal_range.split(';').map((s: string) => {
                const parts = s.split(':');
                const name = parts[0]?.trim();
                const range = parts[1]?.trim() || '';
                // If there's only one part, use it as range and default name
                if (parts.length === 1) return { name: 'Result', range: parts[0]?.trim() || '' };
                return { name: name || 'Result', range };
            }).filter((c: any) => c.name);
        } else {
            components = [{ name: 'Result', range: test.normal_range || '' }];
        }

        initialResults[test.id] = components.map(c => {
            const existingValue = req.results?.[test.id]?.find((er: any) => er.name === c.name);
            return {
                name: c.name,
                range: c.range,
                value: existingValue?.value || '',
                evaluation: existingValue?.evaluation || '-'
            };
        });
    });
    
    setResultValues(initialResults);
    setIsProcessModalOpen(true);
  };

  const updateResultValue = (testId: number, componentIndex: number, value: string, range: string) => {
    setResultValues((prev: any) => {
        const testResults = [...prev[testId]];
        testResults[componentIndex] = {
            ...testResults[componentIndex],
            value,
            evaluation: getEvaluation(value, range)
        };
        return { ...prev, [testId]: testResults };
    });
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setProcessStatus('processing');
    try {
      await api.completeLabRequest(selectedReq.id, {
          results_json: resultValues,
          notes: resultNotes
      });
      setProcessStatus('success');
      await loadData();
      setTimeout(() => { setIsProcessModalOpen(false); setProcessStatus('idle'); }, 1000);
    } catch (error: any) { 
        setProcessStatus('error'); 
        setProcessMessage(error.response?.data?.error || t('lab_save_error')); 
    }
  };

  const handleAmend = (req: any) => {
    setConfirmState({
        isOpen: true,
        title: t('lab_amend_confirm_title'),
        message: t('lab_amend_confirm_msg'),
        action: async () => {
            setProcessStatus('processing');
            try {
                await api.amendLabRequest(req.id);
                setProcessStatus('success');
                setActiveTab('queue');
                loadData();
                setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) {
                setProcessStatus('error');
                setProcessMessage(e.response?.data?.error || "Amendment failed");
            }
        }
    });
  };

  const displayRequests = requests.filter(r => {
    const matchesTab = activeTab === 'queue' ? (r.status === 'pending' || r.status === 'confirmed') : (r.status === 'completed');
    return matchesTab;
  });

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

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
                type="text" 
                placeholder={t('lab_search_placeholder')} 
                className="pl-10 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all shadow-sm" 
                value={searchTerm} 
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
            <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
                {t('lab_loading')}
            </div>
        ) : displayRequests.length === 0 ? (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                <FlaskConical size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600 opacity-50" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">{t('lab_empty', {tab: activeTab === 'queue' ? t('lab_tab_queue') : t('lab_tab_history')})}</p>
            </div>
        ) : (
            displayRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col group h-full">
                    <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-black text-slate-800 dark:text-white truncate leading-tight">{req.patientName}</h3>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1">
                                <Calendar size={10} />
                                <span>{new Date(req.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 ml-2">
                            <Badge color={req.status === 'completed' ? 'green' : req.status === 'confirmed' ? 'blue' : 'yellow'} className="text-[8px] px-1.5 py-0 uppercase font-black">
                                {req.status === 'confirmed' ? t('lab_status_ready') : req.status}
                            </Badge>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 mb-3 flex-1">
                        <div className="flex flex-wrap gap-1">
                            {(req.testNames || t('billing_modal_create_items_label')).split(',').map((test: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-sm leading-tight truncate">
                                    {test.trim()}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="pt-2 space-y-2">
                        {req.status === 'confirmed' && (
                            <Button size="sm" onClick={() => openProcessModal(req)} icon={Activity} className="w-full justify-center text-xs py-2 shadow-sm">
                                {t('lab_card_enter_results')}
                            </Button>
                        )}
                        {req.status === 'pending' && (
                            <div className="grid grid-cols-2 gap-2">
                                <Button size="sm" variant="outline" onClick={() => openProcessModal(req)} icon={Eye} className="justify-center text-[10px] py-2">
                                    {t('lab_action_view_order')}
                                </Button>
                                <button onClick={() => navigate('/billing')} className="px-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-lg border border-amber-200 transition-colors flex items-center justify-center gap-1.5">
                                    <Clock size={10}/> {t('lab_card_awaiting_payment')}
                                </button>
                            </div>
                        )}
                        {req.status === 'completed' && (
                            <div className="space-y-2">
                                <Button size="sm" variant="secondary" icon={FileText} onClick={() => openProcessModal(req)} className="w-full justify-center text-xs py-2">
                                    {t('lab_view_results')}
                                </Button>
                                {canAmend && (
                                    <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => handleAmend(req)} className="w-full justify-center text-[10px] py-1 text-slate-400 hover:text-primary-600">
                                        {t('lab_action_amend')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                <span>{t('patients_pagination_showing')} {displayRequests.length} {t('patients_pagination_of')} {totalItems}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                    <select 
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                    >
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                        <option value={100}>100</option>
                    </select>
                </div>
            </div>
            <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
            </div>
        </div>
      )}

      {/* LAB RESULTS MODAL - STRUCTURED COMPONENTS */}
      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title={t('lab_modal_findings_title', { name: selectedReq?.patientName })}>
        <form onSubmit={handleComplete} className="space-y-6">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex justify-between items-center">
                <div>
                    <h4 className="font-black text-lg tracking-tight">{t('lab_modal_technical_analysis')}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('lab_modal_order_ref', { id: selectedReq?.id })}</p>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t('lab_modal_entry_date')}</span>
                    <span className="text-sm font-bold">{selectedReq && new Date(selectedReq.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                {selectedReq?.testDetails?.map((test: any) => (
                    <div key={test.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                        <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2.5 border-b border-slate-200 dark:border-slate-700">
                            <h5 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest flex items-center gap-2">
                                <FlaskConical size={14} className="text-primary-600" />
                                {language === 'ar' ? test.name_ar : test.name_en}
                            </h5>
                        </div>
                        <div className="p-4 space-y-4">
                            {resultValues[test.id]?.map((comp: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-12 gap-4 items-center group">
                                    <div className="col-span-12 sm:col-span-3">
                                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-tight">{comp.name}</p>
                                        <p className="text-[10px] font-mono text-slate-400 mt-1">Ref: {comp.range || 'N/A'}</p>
                                    </div>
                                    <div className="col-span-8 sm:col-span-6">
                                        <Input 
                                            placeholder={t('lab_modal_enter_value')}
                                            value={comp.value} 
                                            onChange={e => updateResultValue(test.id, idx, e.target.value, comp.range)}
                                            className="!py-2 font-mono font-bold"
                                            disabled={selectedReq?.status === 'completed' || selectedReq?.status === 'pending'}
                                        />
                                    </div>
                                    <div className="col-span-4 sm:col-span-3 text-right">
                                        <Badge color={
                                            comp.evaluation === 'lab_eval_normal' ? 'green' : 
                                            comp.evaluation === 'lab_eval_low' ? 'blue' : 
                                            comp.evaluation === 'lab_eval_high' ? 'red' : 'gray'
                                        } className="font-black text-[10px] w-full justify-center py-1">
                                            {t(comp.evaluation) || comp.evaluation}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('lab_modal_remarks_label')}</label>
                    <Textarea 
                        placeholder={t('lab_modal_remarks_placeholder')}
                        rows={3} 
                        value={resultNotes} 
                        onChange={e => setResultNotes(e.target.value)} 
                        disabled={selectedReq?.status === 'completed' || selectedReq?.status === 'pending'}
                        className="rounded-xl"
                    />
                </div>
            </div>
            
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
                <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t('close')}</Button>
                {selectedReq?.status === 'confirmed' && (
                    <Button type="submit" icon={Save} disabled={processStatus === 'processing'}>
                        {processStatus === 'processing' ? t('processing') : t('lab_modal_authorize_button')}
                    </Button>
                )}
            </div>
        </form>
      </Modal>

      <ConfirmationDialog 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({...confirmState, isOpen: false})} 
        onConfirm={() => { confirmState.action(); setConfirmState({...confirmState, isOpen: false}); }} 
        title={confirmState.title} 
        message={confirmState.message} 
      />
    </div>
  );
};
