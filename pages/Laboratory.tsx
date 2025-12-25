
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea } from '../components/UI';
import { FlaskConical, CheckCircle, Search, Clock, FileText, User, ChevronRight, Activity, History as HistoryIcon, Save, Calendar, DollarSign } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Laboratory = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tabs moved to Header - Memoized to prevent loops
  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setActiveTab('queue')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <FlaskConical size={14}/> {t('lab_tab_queue')} 
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              {requests.filter(r => r.status !== 'completed').length}
            </span>
        </button>
        <button 
            onClick={() => setActiveTab('history')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <HistoryIcon size={14}/> {t('lab_tab_history')}
        </button>
    </div>
  ), [activeTab, requests, t]);

  // Sync Header
  useHeader(t('lab_title'), t('lab_subtitle'), HeaderTabs);

  // Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [resultForm, setResultForm] = useState({ notes: '', results: '' });
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
    setResultForm({ notes: '', results: '' });
    setIsProcessModalOpen(true);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setProcessStatus('processing');
    try {
      await api.completeLabRequest(selectedReq.id, resultForm);
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
      
      {/* Optimized Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
            type="text" 
            placeholder={t('lab_search_placeholder')} 
            className="pl-10 pr-4 py-3 w-full sm:w-96 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all shadow-sm" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
            <div className="col-span-full py-20 text-center text-slate-400 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-3"></div>
                {t('lab_loading')}
            </div>
        ) : filteredRequests.length === 0 ? (
            <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
                <FlaskConical size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600 opacity-50" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">{t('lab_empty', {tab: activeTab === 'queue' ? t('lab_tab_queue') : t('lab_tab_history')})}</p>
            </div>
        ) : (
            filteredRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group h-full">
                    
                    {/* Card Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-base font-black text-slate-800 dark:text-white line-clamp-1">{req.patientName}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <Calendar size={12} />
                                <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <Clock size={12} />
                                <span>{new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-black text-slate-900 dark:text-white flex items-center">
                                <span className="text-xs text-slate-400 mr-0.5">$</span>
                                {req.projected_cost.toLocaleString()}
                            </span>
                            {req.status === 'completed' ? 
                                <Badge color="green"><CheckCircle size={12} className="mr-1"/>{t('lab_card_results_ready')}</Badge> : 
                             req.status === 'confirmed' ? 
                                <Badge color="blue">{t('lab_card_paid')}</Badge> : 
                                <Badge color="yellow"><Clock size={12} className="mr-1"/>{t('lab_card_payment_pending')}</Badge>
                            }
                        </div>
                    </div>

                    {/* Card Body */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 mb-4 flex-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Lab Tests</p>
                        <div className="flex flex-wrap gap-1.5">
                            {(req.testNames || 'Comprehensive Panel').split(',').map((test: string, idx: number) => (
                                <span key={idx} className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 shadow-sm leading-none">
                                    {test.trim()}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                        <div className="w-full">
                            {req.status === 'confirmed' && (
                                <Button size="sm" onClick={() => openProcessModal(req)} icon={Activity} className="w-full justify-center">
                                    {t('lab_card_enter_results')}
                                </Button>
                            )}
                            {req.status === 'pending' && (
                                <div className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 text-xs font-bold rounded-lg border border-orange-100 dark:border-orange-900/30 text-center">
                                    {t('lab_card_awaiting_payment')}
                                </div>
                            )}
                            {req.status === 'completed' && (
                                <Button size="sm" variant="secondary" icon={FileText} onClick={() => openProcessModal(req)} className="w-full justify-center">
                                    {t('lab_view_results')}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title={`${t('lab_modal_title')} - ${selectedReq?.patientName}`}>
        <form onSubmit={handleComplete} className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-sm text-slate-800 dark:text-white mb-1">{selectedReq?.testNames}</h4>
                <p className="text-xs text-slate-500">Requested: {selectedReq && new Date(selectedReq.created_at).toLocaleString()}</p>
            </div>
            
            <Textarea 
                label={t('lab_modal_findings')} 
                placeholder={t('lab_modal_findings_placeholder')} 
                rows={6} 
                value={resultForm.results} 
                onChange={e => setResultForm({...resultForm, results: e.target.value})} 
                required={selectedReq?.status !== 'completed'} 
                disabled={selectedReq?.status === 'completed'} 
            />
            
            <Textarea 
                label={t('lab_modal_notes')} 
                placeholder={t('lab_modal_notes_placeholder')} 
                rows={2} 
                value={resultForm.notes} 
                onChange={e => setResultForm({...resultForm, notes: e.target.value})} 
                disabled={selectedReq?.status === 'completed'} 
            />
            
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-700">
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
