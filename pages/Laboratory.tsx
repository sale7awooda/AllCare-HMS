
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge, Modal, Input, Textarea, Tooltip } from '../components/UI';
import { FlaskConical, CheckCircle, Search, Clock, FileText, Activity, History as HistoryIcon, Save, Calendar, Loader2, XCircle, ChevronDown, ChevronUp, RefreshCw, Eye, ClipboardCheck, Printer } from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { hasPermission, Permissions } from '../utils/rbac';

export const Laboratory = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const canManage = hasPermission(currentUser, Permissions.MANAGE_LABORATORY);
  const isRtl = language === 'ar';

  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
        <button 
            onClick={() => setActiveTab('queue')} 
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'queue' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
        >
            <FlaskConical size={14}/> {t('lab_tab_queue')} 
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}`}>
              {requests.filter(r => r.status === 'pending' || r.status === 'confirmed').length}
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

  useHeader(t('nav_laboratory'), '', HeaderTabs);

  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isViewResultsModalOpen, setIsViewResultsModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [resultValues, setResultValues] = useState<any>({});
  const [resultNotes, setResultNotes] = useState('');
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingLabRequests(); 
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const getEvaluation = (value: string, range: string) => {
    if (!value || !range) return 'lab_eval_observed';
    const val = parseFloat(value);
    
    const numericRangeMatch = range.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
    if (numericRangeMatch && !isNaN(val)) {
      const low = parseFloat(numericRangeMatch[1]);
      const high = parseFloat(numericRangeMatch[2]);
      if (val < low) return 'lab_eval_low';
      if (val > high) return 'lab_eval_high';
      return 'lab_eval_normal';
    }

    const lowerVal = value.toLowerCase();
    const lowerRange = range.toLowerCase();
    if (lowerRange.includes('neg') || lowerRange.includes('non')) {
        if (lowerVal.includes('pos')) return 'lab_eval_high';
        if (lowerVal.includes('neg')) return 'lab_eval_normal';
    }
    
    return 'lab_eval_observed';
  };

  const extractResults = (req: any) => {
    const resultsData = req.results;
    const isNested = resultsData && typeof resultsData === 'object' && 'results_json' in resultsData;
    const values = isNested ? resultsData.results_json : (resultsData || {});
    const notes = isNested ? resultsData.notes : '';
    return { values, notes };
  };

  const openProcessModal = (req: any) => {
    setSelectedReq(req);
    const { values, notes } = extractResults(req);
    setResultNotes(notes);
    
    const initialResults: any = {};
    req.testDetails.forEach((test: any) => {
        let components: any[] = [];
        if (test.normal_range?.includes(';')) {
            components = test.normal_range.split(';').map((s: string) => {
                const parts = s.split(':');
                return { name: parts[0]?.trim() || t('view'), range: parts[1]?.trim() || '' };
            });
        } else {
            components = [{ name: t('lab_modal_technical_analysis'), range: test.normal_range || '' }];
        }

        initialResults[test.id] = components.map(c => {
            const testEntries = values?.[test.id] || values?.[test.id.toString()] || [];
            const existingValue = testEntries.find((er: any) => er.name === c.name);
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

  const openViewResultsModal = (req: any) => {
    setSelectedReq(req);
    const { values, notes } = extractResults(req);
    setResultNotes(notes);
    setResultValues(values);
    setIsViewResultsModalOpen(true);
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

  const handleReopen = async (id: number) => {
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try {
        await api.reopenLabRequest(id);
        setProcessStatus('success');
        await loadData();
        setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e: any) {
        setProcessStatus('error');
        setProcessMessage(e.response?.data?.error || t('error'));
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'queue' ? (r.status === 'pending' || r.status === 'confirmed') : (r.status === 'completed');
    return matchesSearch && matchesTab;
  });

  const getStatusKey = (status: string) => {
      switch(status.toLowerCase()) {
          case 'pending': return 'lab_status_pending';
          case 'confirmed': return 'lab_status_ready';
          case 'completed': return 'lab_status_completed';
          default: return status;
      }
  };

  const handlePrint = () => {
    window.print();
  };

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

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
        <input 
            type="text" 
            placeholder={t('lab_search_placeholder')} 
            className="pl-10 pr-4 py-2.5 w-full sm:w-96 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all shadow-sm" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                                {t(getStatusKey(req.status))}
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
                    <div className="pt-2">
                        {req.status === 'confirmed' && (
                            <Button size="sm" onClick={() => openProcessModal(req)} icon={Activity} className="w-full justify-center text-xs py-2 shadow-sm">
                                {t('lab_card_enter_results')}
                            </Button>
                        )}
                        {req.status === 'pending' && (
                            <button onClick={() => navigate('/billing')} className="w-full px-2 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-lg border border-amber-200 transition-colors flex items-center justify-center gap-2">
                                <Clock size={12}/> {t('lab_card_awaiting_payment')}
                            </button>
                        )}
                        {req.status === 'completed' && (
                          <div className="flex flex-col gap-2">
                            <Button size="sm" variant="primary" icon={Eye} onClick={() => openViewResultsModal(req)} className="w-full justify-center text-xs py-2 shadow-sm">
                                {t('lab_view_results')}
                            </Button>
                            {canManage && (
                                <Button 
                                    size="sm"
                                    variant="secondary"
                                    icon={RefreshCw}
                                    onClick={() => handleReopen(req.id)} 
                                    className="w-full justify-center text-xs py-2 border border-slate-200 dark:border-slate-600"
                                >
                                    {isRtl ? 'إعادة فتح النتائج' : 'Re-open Findings'}
                                </Button>
                            )}
                          </div>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>

      <Modal 
        isOpen={isProcessModalOpen} 
        onClose={() => setIsProcessModalOpen(false)} 
        title={t('lab_modal_findings_title', { name: selectedReq?.patientName })}
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t('close')}</Button>
            {selectedReq?.status !== 'completed' && (
                <Button type="submit" form="lab-complete-form" icon={Save} disabled={processStatus === 'processing'}>
                    {processStatus === 'processing' ? t('processing') : t('lab_modal_authorize_button')}
                </Button>
            )}
          </div>
        }
      >
        <form id="lab-complete-form" onSubmit={handleComplete} className="space-y-6 -mt-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl flex justify-between items-center shrink-0">
                <div>
                    <h4 className="font-black text-lg tracking-tight">{t('lab_modal_technical_analysis')}</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t('lab_modal_order_ref', { id: selectedReq?.id })}</p>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-widest">{t('lab_modal_entry_date')}</span>
                    <span className="text-sm font-bold">{selectedReq && new Date(selectedReq.created_at).toLocaleDateString()}</span>
                </div>
            </div>
            
            <div className="space-y-6">
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
                        className="rounded-xl"
                    />
                </div>
            </div>
        </form>
      </Modal>

      {/* VIEW RESULTS MODAL (READ ONLY & PRINTABLE) */}
      <Modal
        isOpen={isViewResultsModalOpen}
        onClose={() => setIsViewResultsModalOpen(false)}
        title={t('lab_view_results')}
        footer={
            <div className="flex justify-between items-center no-print">
                <Button variant="ghost" icon={Printer} onClick={handlePrint}>{isRtl ? 'طباعة التقرير' : 'Print Report'}</Button>
                <Button variant="secondary" onClick={() => setIsViewResultsModalOpen(false)}>{t('close')}</Button>
            </div>
        }
      >
        <div className="space-y-8 -mt-4 print:mt-0 print:space-y-6" id="printable-lab-report">
            {/* Report Header for Print */}
            <div className="hidden print:flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">AllCare HMS</h1>
                    <p className="text-sm font-bold text-slate-600 mt-1">Laboratory Information System</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Automated Clinical Analysis Center</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold text-slate-800">Hospital Administration Center</p>
                    <p className="text-[10px] text-slate-500">Certified Diagnostic Facility</p>
                </div>
            </div>

            {/* Banner for UI */}
            <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-xl flex justify-between items-center shrink-0 print:bg-slate-100 print:text-slate-900 print:shadow-none print:border print:border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl print:bg-slate-200">
                        <ClipboardCheck size={24} />
                    </div>
                    <div>
                        <h4 className="font-black text-lg tracking-tight uppercase print:text-xl">{t('lab_status_completed')}</h4>
                        <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest mt-1 print:text-slate-500">{t('lab_modal_order_ref', { id: selectedReq?.id })}</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] uppercase text-emerald-100 font-bold tracking-widest print:text-slate-500">{t('lab_modal_entry_date')}</span>
                    <span className="text-sm font-bold">{selectedReq && new Date(selectedReq.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            {/* Patient Header Section */}
            <div className="grid grid-cols-2 gap-8 print:gap-12 bg-slate-50 p-5 rounded-2xl border border-slate-100 print:bg-white print:border-none print:px-0">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">{isRtl ? 'بيانات المريض' : 'Patient Information'}</p>
                    <h3 className="text-xl font-black text-slate-900 leading-tight">{selectedReq?.patientName}</h3>
                    <div className="flex gap-3 mt-2 text-xs font-bold text-slate-500">
                        <span>ID: #{selectedReq?.patient_id}</span>
                        <span>•</span>
                        <span>{selectedReq?.patientGender || '-'}</span>
                        <span>•</span>
                        <span>{selectedReq?.patientAge || '-'} yrs</span>
                    </div>
                </div>
                <div className="text-right flex flex-col justify-end">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1.5">{isRtl ? 'المختبر المحول' : 'Referring Laboratory'}</p>
                    <p className="text-sm font-bold text-slate-800">AllCare Diagnostic Unit</p>
                    <p className="text-xs text-slate-500 mt-1">{isRtl ? 'نتائج مخبرية معتمدة' : 'Verified Clinical Records'}</p>
                </div>
            </div>

            {/* Test Results Table */}
            <div className="space-y-6">
                {selectedReq?.testDetails?.map((test: any) => (
                    <div key={test.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:shadow-none print:border-slate-300">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center print:bg-slate-100">
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-[0.15em] flex items-center gap-2">
                                <FlaskConical size={14} className="text-emerald-600" />
                                {language === 'ar' ? test.name_ar : test.name_en}
                            </h5>
                            <Badge color="gray" className="text-[9px] uppercase font-black">{test.category_en}</Badge>
                        </div>
                        <div className="p-0">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-wider print:bg-white">
                                    <tr className="border-b border-slate-100">
                                        <th className="px-5 py-3 font-black">{isRtl ? 'العنصر' : 'Parameter'}</th>
                                        <th className="px-5 py-3 font-black text-center">{isRtl ? 'النتيجة' : 'Result'}</th>
                                        <th className="px-5 py-3 font-black text-center">{isRtl ? 'المجال المرجعي' : 'Ref. Range'}</th>
                                        <th className="px-5 py-3 font-black text-right">{isRtl ? 'التقييم' : 'Evaluation'}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(resultValues[test.id] || resultValues[test.id.toString()] || []).map((comp: any, idx: number) => (
                                        <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-bold text-slate-800 leading-tight">{comp.name}</p>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className={`font-mono font-black text-lg ${
                                                    comp.evaluation === 'lab_eval_normal' ? 'text-slate-900' : 
                                                    comp.evaluation === 'lab_eval_low' ? 'text-blue-600' : 
                                                    comp.evaluation === 'lab_eval_high' ? 'text-red-600' : 'text-slate-900'
                                                }`}>
                                                    {comp.value || '-'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-center">
                                                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                    {comp.range || 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <Badge color={
                                                    comp.evaluation === 'lab_eval_normal' ? 'green' : 
                                                    comp.evaluation === 'lab_eval_low' ? 'blue' : 
                                                    comp.evaluation === 'lab_eval_high' ? 'red' : 'gray'
                                                } className="font-black text-[9px] tracking-widest uppercase">
                                                    {t(comp.evaluation) || comp.evaluation}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}

                {resultNotes && (
                    <div className="space-y-2 pt-4 border-t border-slate-100 print:border-slate-300">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('lab_modal_remarks_label')}</label>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600 italic leading-relaxed print:bg-white print:border-slate-300">
                            "{resultNotes}"
                        </div>
                    </div>
                )}
            </div>

            {/* Report Footer for Print */}
            <div className="hidden print:grid grid-cols-2 gap-8 pt-16 border-t border-slate-200 mt-12">
                <div className="text-center border-t border-slate-900 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Technician Signature</p>
                    <p className="text-sm font-bold text-slate-900 italic">Medical Analysis Department</p>
                </div>
                <div className="text-center border-t border-slate-900 pt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pathologist Approval</p>
                    <p className="text-sm font-bold text-slate-900">Dr. Clinic Administrator</p>
                </div>
            </div>
            
            <div className="hidden print:block text-center mt-12 pt-8 text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em]">
                Verified Report • {new Date().toLocaleString()} • Page 1 of 1
            </div>
        </div>

        <style>{`
            @media print {
                body * { visibility: hidden !important; }
                #printable-lab-report, #printable-lab-report * { visibility: visible !important; }
                #printable-lab-report { 
                    position: fixed !important; 
                    left: 0 !important; 
                    top: 0 !important; 
                    width: 100% !important; 
                    padding: 0 !important;
                    margin: 0 !important;
                    background: white !important;
                    color: black !important;
                }
                .no-print { display: none !important; }
                .Modal { position: absolute !important; padding: 0 !important; box-shadow: none !important; }
                .Card { border: 1px solid #ccc !important; page-break-inside: avoid; }
                thead { display: table-header-group !important; }
            }
        `}</style>
      </Modal>
    </div>
  );
};
