
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea } from '../components/UI';
import { 
  FlaskConical, CheckCircle, Search, Clock, FileText, User, 
  ChevronRight, Activity, History as HistoryIcon, Save, 
  Microscope, TestTube2, AlertCircle, Calendar, DollarSign,
  TrendingUp, Timer, Plus, Trash2, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

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
  
  // Structured Result State
  const [resultRows, setResultRows] = useState<{name: string, value: string, range: string, flag: string}[]>([]);
  const [notes, setNotes] = useState('');
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
    setNotes('');
    
    // Parse test names to create initial rows
    const tests = req.testNames ? req.testNames.split(',') : ['Test Parameter'];
    const initialRows = tests.map((testName: string) => ({
      name: testName.trim(),
      value: '',
      range: '', // Could be pre-filled if we had a catalog lookup here
      flag: 'Normal'
    }));
    
    setResultRows(initialRows);
    setIsProcessModalOpen(true);
  };

  const addResultRow = () => {
    setResultRows([...resultRows, { name: '', value: '', range: '', flag: 'Normal' }]);
  };

  const removeResultRow = (index: number) => {
    const newRows = [...resultRows];
    newRows.splice(index, 1);
    setResultRows(newRows);
  };

  const updateResultRow = (index: number, field: string, val: string) => {
    const newRows = [...resultRows];
    (newRows[index] as any)[field] = val;
    setResultRows(newRows);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setProcessStatus('processing');

    // Serialize rows into a Markdown Table string for the backend
    // This maintains compatibility with the existing text-based schema while offering structured entry
    let serializedResults = `| Parameter | Result | Normal Range | Evaluation |\n|---|---|---|---|\n`;
    resultRows.forEach(row => {
      serializedResults += `| **${row.name}** | ${row.value} | ${row.range} | ${row.flag} |\n`;
    });

    try {
      await api.completeLabRequest(selectedReq.id, {
        results: serializedResults,
        notes: notes
      });
      setProcessStatus('success');
      await loadData();
      setTimeout(() => { setIsProcessModalOpen(false); setProcessStatus('idle'); }, 1000);
    } catch (error) { alert(t('lab_save_error')); setProcessStatus('idle'); }
  };

  const filteredRequests = useMemo(() => requests.filter(r => {
    const matchesSearch = r.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'queue' ? (r.status === 'pending' || r.status === 'confirmed') : (r.status === 'completed');
    return matchesSearch && matchesTab;
  }), [requests, searchTerm, activeTab]);

  // Statistics
  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'pending' || r.status === 'confirmed').length;
    const completedToday = requests.filter(r => r.status === 'completed' && new Date(r.created_at).toDateString() === new Date().toDateString()).length;
    const revenue = requests.filter(r => r.status === 'completed' || r.status === 'confirmed').reduce((acc, curr) => acc + (curr.projected_cost || 0), 0);
    return { pending, completedToday, revenue };
  }, [requests]);

  const StatBox = ({ label, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
      <div className={`p-3 rounded-xl ${color} text-white shadow-lg shadow-primary-500/10`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-white leading-none mt-1">{value}</p>
        {subtext && <p className="text-[10px] text-slate-500 font-medium mt-1">{subtext}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatBox 
          label="Pending Queue" 
          value={stats.pending} 
          icon={FlaskConical} 
          color="bg-gradient-to-br from-orange-400 to-orange-600" 
          subtext="Awaiting processing"
        />
        <StatBox 
          label="Completed Today" 
          value={stats.completedToday} 
          icon={CheckCircle} 
          color="bg-gradient-to-br from-emerald-400 to-emerald-600"
          subtext="Results released"
        />
        <StatBox 
          label="Lab Revenue" 
          value={`$${stats.revenue.toLocaleString()}`} 
          icon={DollarSign} 
          color="bg-gradient-to-br from-blue-400 to-blue-600"
          subtext="Total processed value"
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        
        {/* Modern Segmented Control */}
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('queue')} 
              className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'queue' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md transform scale-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              <TestTube2 size={16}/> {t('lab_tab_queue')} 
              {requests.filter(r => r.status === 'pending' || r.status === 'confirmed').length > 0 && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === 'queue' ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600'}`}>
                  {requests.filter(r => r.status === 'pending' || r.status === 'confirmed').length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`flex-1 md:flex-none px-6 py-2.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-md transform scale-100' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              <HistoryIcon size={16}/> {t('lab_tab_history')}
            </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder={t('lab_search_placeholder')} 
            className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all" 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
            <p className="text-slate-400 font-medium animate-pulse">{t('lab_loading')}</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400">
              <Microscope size={32} />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-lg">{t('lab_empty', {tab: activeTab === 'queue' ? t('lab_tab_queue') : t('lab_tab_history')})}</p>
            <p className="text-slate-400 text-sm mt-1">New requests will appear here instantly.</p>
          </div>
        ) : (
          filteredRequests.map((req, idx) => {
            const isConfirmed = req.status === 'confirmed';
            const isCompleted = req.status === 'completed';
            const tests = req.testNames ? req.testNames.split(',').map((t: string) => t.trim()) : ['General Lab Work'];
            
            return (
              <div 
                key={req.id} 
                className={`
                  bg-white dark:bg-slate-800 p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden
                  ${isConfirmed ? 'border-l-4 border-l-primary-500 border-y-slate-200 border-r-slate-200 dark:border-y-slate-700 dark:border-r-slate-700 shadow-md' : 
                    isCompleted ? 'border-l-4 border-l-emerald-500 border-y-slate-200 border-r-slate-200 dark:border-y-slate-700 dark:border-r-slate-700 opacity-90 hover:opacity-100' : 
                    'border-l-4 border-l-amber-400 border-y-slate-200 border-r-slate-200 dark:border-y-slate-700 dark:border-r-slate-700'}
                  hover:-translate-y-1 hover:shadow-xl
                `}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  {/* Status Icon */}
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner
                    ${isConfirmed ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 
                      isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 
                      'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}
                  `}>
                    {isCompleted ? <CheckCircle size={24} /> : <FlaskConical size={24} />}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white truncate">{req.patientName}</h3>
                      {!isCompleted && !isConfirmed && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-md text-[10px] font-bold uppercase tracking-wide">
                          <AlertCircle size={10} /> {t('lab_card_payment_pending')}
                        </div>
                      )}
                      {isConfirmed && (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-md text-[10px] font-bold uppercase tracking-wide">
                          <Timer size={10} className="animate-pulse" /> Ready for Processing
                        </div>
                      )}
                    </div>

                    {/* Test Chips */}
                    <div className="flex flex-wrap gap-2">
                      {tests.map((test: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                          {test}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions Column with Date/Time & Cost */}
                  <div className="flex flex-col items-end gap-3 w-full sm:w-auto mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-end text-right">
                       <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                          <Calendar size={12}/> {new Date(req.created_at).toLocaleDateString()}
                       </div>
                       <div className="flex items-center gap-1 text-xs font-mono font-medium text-slate-500">
                          <Clock size={12}/> {new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </div>
                    </div>

                    <div className="flex flex-col items-end">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('config_field_cost')}</span>
                       <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">${req.projected_cost.toLocaleString()}</span>
                    </div>
                    
                    {isConfirmed ? (
                      <Button onClick={() => openProcessModal(req)} icon={Microscope} className="w-full sm:w-auto shadow-lg shadow-primary-500/20">{t('lab_card_enter_results')}</Button>
                    ) : isCompleted ? (
                      <Button variant="secondary" onClick={() => openProcessModal(req)} icon={FileText} className="w-full sm:w-auto">{t('lab_view_results')}</Button>
                    ) : (
                      <Button disabled variant="outline" className="w-full sm:w-auto border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50 opacity-70 cursor-not-allowed">
                        <Clock size={16} className="mr-2"/> Payment Required
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* RESULT ENTRY MODAL */}
      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title={`${t('lab_modal_title')}`} className="max-w-4xl">
        <div className="space-y-6">
          {/* Patient Header Context */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-primary-600 shadow-sm border border-slate-100 dark:border-slate-700">
                   <User size={20} />
                </div>
                <div>
                   <h4 className="font-bold text-slate-900 dark:text-white">{selectedReq?.patientName}</h4>
                   <p className="text-xs text-slate-500">{new Date().toLocaleDateString()} • {selectedReq?.testNames}</p>
                </div>
             </div>
             <Badge color={selectedReq?.status === 'completed' ? 'green' : 'blue'}>{selectedReq?.status.toUpperCase()}</Badge>
          </div>

          <form onSubmit={handleComplete} className="space-y-6">
            <div>
                <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <Activity size={16} className="text-primary-500" />
                        {t('lab_modal_findings')}
                    </label>
                    {selectedReq?.status !== 'completed' && (
                        <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={addResultRow}>Add Parameter</Button>
                    )}
                </div>
                
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px]">
                            <tr>
                                <th className="px-4 py-3 tracking-wider w-1/3">Parameter Name</th>
                                <th className="px-4 py-3 tracking-wider w-1/4">Result</th>
                                <th className="px-4 py-3 tracking-wider w-1/4">Normal Range</th>
                                <th className="px-4 py-3 tracking-wider w-1/6">Evaluation</th>
                                {selectedReq?.status !== 'completed' && <th className="px-4 py-3 w-10"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                            {resultRows.map((row, idx) => (
                                <tr key={idx} className="group">
                                    <td className="p-2">
                                        <input 
                                            className="w-full bg-transparent border-none focus:ring-0 font-bold text-slate-700 dark:text-slate-200 placeholder-slate-300" 
                                            placeholder="e.g. Hemoglobin"
                                            value={row.name}
                                            onChange={e => updateResultRow(idx, 'name', e.target.value)}
                                            disabled={selectedReq?.status === 'completed'}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary-500 outline-none font-mono text-primary-600 font-bold" 
                                            placeholder="Value"
                                            value={row.value}
                                            onChange={e => updateResultRow(idx, 'value', e.target.value)}
                                            disabled={selectedReq?.status === 'completed'}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            className="w-full bg-transparent border-none focus:ring-0 text-slate-500 text-xs" 
                                            placeholder="e.g. 12.0 - 16.0"
                                            value={row.range}
                                            onChange={e => updateResultRow(idx, 'range', e.target.value)}
                                            disabled={selectedReq?.status === 'completed'}
                                        />
                                    </td>
                                    <td className="p-2">
                                        <select 
                                            className={`w-full px-2 py-1.5 rounded-lg border-none text-xs font-bold uppercase tracking-wide cursor-pointer outline-none ${
                                                row.flag === 'Normal' || row.flag === 'Negative' ? 'bg-emerald-100 text-emerald-700' : 
                                                row.flag === 'High' || row.flag === 'Positive' || row.flag === 'Critical' ? 'bg-red-100 text-red-700' : 
                                                'bg-amber-100 text-amber-700'
                                            }`}
                                            value={row.flag}
                                            onChange={e => updateResultRow(idx, 'flag', e.target.value)}
                                            disabled={selectedReq?.status === 'completed'}
                                        >
                                            <option value="Normal">Normal</option>
                                            <option value="High">High</option>
                                            <option value="Low">Low</option>
                                            <option value="Positive">Positive (+)</option>
                                            <option value="Negative">Negative (-)</option>
                                            <option value="Critical">Critical</option>
                                        </select>
                                    </td>
                                    {selectedReq?.status !== 'completed' && (
                                        <td className="p-2 text-center">
                                            <button type="button" onClick={() => removeResultRow(idx)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {resultRows.length === 0 && (
                        <div className="p-8 text-center text-slate-400 text-sm italic">
                            No parameters added. Click "Add Parameter" to start entering results.
                        </div>
                    )}
                </div>
            </div>
              
            <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-slate-400" />
                  {t('lab_modal_notes')} <span className="text-slate-400 font-normal text-xs">(Internal Use Only)</span>
                </label>
                <Textarea 
                  placeholder={t('lab_modal_notes_placeholder')} 
                  rows={2} 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)} 
                  disabled={selectedReq?.status === 'completed'} 
                />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t('close')}</Button>
              {selectedReq?.status !== 'completed' && (
                <Button type="submit" icon={Save} disabled={processStatus === 'processing'} className="px-8 shadow-lg shadow-primary-500/20">
                  {processStatus === 'processing' ? t('processing') : t('lab_modal_save_button')}
                </Button>
              )}
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
};
