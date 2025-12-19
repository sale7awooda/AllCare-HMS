
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea } from '../components/UI';
import { 
  FlaskConical, CheckCircle, Search, Clock, FileText, User, 
  ChevronRight, Activity, History as HistoryIcon, Save, 
  Microscope, TestTube2, AlertCircle, Calendar, DollarSign,
  TrendingUp, Timer, Plus, Trash2, AlertTriangle, Printer
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';
import { LabTestCatalog } from '../types';

// Predefined sub-parameters for complex lab tests
const COMPOSITE_TESTS: Record<string, {name: string, range: string}[]> = {
  'Urine Analysis (General)': [
    { name: 'Color', range: 'Yellow' },
    { name: 'Appearance', range: 'Clear' },
    { name: 'pH', range: '5.0 - 8.0' },
    { name: 'Specific Gravity', range: '1.005 - 1.030' },
    { name: 'Protein', range: 'Negative' },
    { name: 'Glucose', range: 'Negative' },
    { name: 'Ketones', range: 'Negative' },
    { name: 'Bilirubin', range: 'Negative' },
    { name: 'Urobilinogen', range: 'Normal' },
    { name: 'Nitrite', range: 'Negative' },
    { name: 'Leukocytes', range: 'Negative' },
    { name: 'RBCs', range: '0 - 2 /HPF' },
    { name: 'Pus Cells', range: '0 - 5 /HPF' },
    { name: 'Epithelial Cells', range: 'Few' },
    { name: 'Crystals', range: 'Nil' },
    { name: 'Casts', range: 'Nil' },
    { name: 'Bacteria', range: 'Nil' },
  ],
  'Stool Analysis (General)': [
    { name: 'Consistency', range: 'Formed' },
    { name: 'Color', range: 'Brown' },
    { name: 'Mucus', range: 'Negative' },
    { name: 'Blood', range: 'Negative' },
    { name: 'Pus Cells', range: '0 - 5 /HPF' },
    { name: 'RBCs', range: 'Nil' },
    { name: 'Ova', range: 'Nil' },
    { name: 'Cysts', range: 'Nil' },
    { name: 'Undigested Food', range: 'Nil' },
  ],
  'Widal Test': [
    { name: 'Salmonella Typhi O', range: '< 1:80' },
    { name: 'Salmonella Typhi H', range: '< 1:80' },
    { name: 'Salmonella Paratyphi A', range: '< 1:80' },
    { name: 'Salmonella Paratyphi B', range: '< 1:80' },
  ],
  'Semen Analysis': [
    { name: 'Volume', range: '1.5 - 5.0 ml' },
    { name: 'Liquefaction', range: '< 30 min' },
    { name: 'Viscosity', range: 'Normal' },
    { name: 'pH', range: '7.2 - 8.0' },
    { name: 'Count', range: '> 15 million/ml' },
    { name: 'Motility (Total)', range: '> 40%' },
    { name: 'Progressive', range: '> 32%' },
    { name: 'Morphology', range: '> 4% Normal' },
    { name: 'WBC', range: '< 1 million/ml' },
  ],
  'Complete Blood Count (CBC)': [
    { name: 'Hemoglobin (Hb)', range: '13.5-17.5 g/dL' },
    { name: 'RBC Count', range: '4.5-5.5 M/uL' },
    { name: 'WBC Count', range: '4,500-11,000 /uL' },
    { name: 'Platelets', range: '150k-450k /uL' },
    { name: 'Hematocrit (PCV)', range: '38-50 %' },
    { name: 'MCV', range: '80-100 fL' },
    { name: 'MCH', range: '27-31 pg' },
    { name: 'MCHC', range: '32-36 g/dL' },
    { name: 'Neutrophils', range: '40-70 %' },
    { name: 'Lymphocytes', range: '20-40 %' },
    { name: 'Monocytes', range: '2-8 %' },
    { name: 'Eosinophils', range: '1-4 %' },
    { name: 'Basophils', range: '0-1 %' },
  ]
};

export const Laboratory = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
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
      const [data, tests] = await Promise.all([
        api.getPendingLabRequests(),
        api.getLabTests()
      ]);
      setRequests(Array.isArray(data) ? data : []);
      setLabTests(Array.isArray(tests) ? tests : []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const evaluateResult = (value: string, range: string): string => {
    if (!value || !range || range === 'N/A') return 'Normal';
    const val = parseFloat(value);
    const cleanRange = range.toLowerCase();

    // Text based comparison (Negative/Positive)
    if (cleanRange.includes('negative')) {
        return value.toLowerCase().includes('positive') ? 'Positive' : 'Negative';
    }
    if (cleanRange.includes('nil') || cleanRange.includes('absent')) {
        return (value.toLowerCase() === 'nil' || value.toLowerCase() === 'absent' || value === '0' || value === '-') ? 'Normal' : 'Abnormal';
    }

    if (isNaN(val)) return 'Normal';

    // Format: "10 - 20"
    if (range.includes('-')) {
        const parts = range.split('-').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
        if (parts.length >= 2) {
            if (val < parts[0]) return 'Low';
            if (val > parts[1]) return 'High';
            return 'Normal';
        }
    }
    // Format: "< 5.0"
    if (range.includes('<')) {
        const limit = parseFloat(range.replace(/[^0-9.]/g, ''));
        return val >= limit ? 'High' : 'Normal';
    }
    // Format: "> 50"
    if (range.includes('>')) {
        const limit = parseFloat(range.replace(/[^0-9.]/g, ''));
        return val <= limit ? 'Low' : 'Normal';
    }

    return 'Normal';
  };

  const openProcessModal = (req: any) => {
    setSelectedReq(req);
    setNotes('');
    
    if (req.status === 'completed' && req.results) {
        // Parse existing results from the stored string (Markdown table format)
        const lines = req.results.split('\n').filter((l: string) => l.trim().startsWith('|') && !l.includes('Parameter') && !l.includes('---'));
        const rows = lines.map((l: string) => {
            const cols = l.split('|').map(c => c.trim()).filter(c => c !== '');
            return {
                name: cols[0]?.replace(/\*\*/g, '') || '',
                value: cols[1] || '',
                range: cols[2] || '',
                flag: cols[3] || 'Normal'
            };
        });
        setResultRows(rows.length > 0 ? rows : []);
        setNotes(req.notes || '');
    } else {
        // Parse test ids to create initial rows
        let initialRows: any[] = [];
        
        const reqTestIds = req.test_ids ? JSON.parse(req.test_ids) : [];
        
        if (reqTestIds.length > 0) {
            reqTestIds.forEach((id: number) => {
                const catalogItem = labTests.find(t => t.id === id);
                if (catalogItem) {
                    // CHECK FOR COMPOSITE DEFINITION (Expand single test into multiple rows)
                    const composite = COMPOSITE_TESTS[catalogItem.name_en];
                    if (composite) {
                        composite.forEach(sub => {
                            initialRows.push({
                                name: sub.name,
                                value: '',
                                range: sub.range,
                                flag: 'Normal'
                            });
                        });
                    } else {
                        // Standard Single Item
                        initialRows.push({
                            name: language === 'ar' ? catalogItem.name_ar : catalogItem.name_en,
                            value: '',
                            range: catalogItem.normal_range || '',
                            flag: 'Normal'
                        });
                    }
                } else {
                     initialRows.push({
                        name: `Unknown Test (ID: ${id})`,
                        value: '',
                        range: '',
                        flag: 'Normal'
                    });
                }
            });
        } else {
            // Fallback for legacy string-based requests
            const tests = req.testNames ? req.testNames.split(',') : ['Test Parameter'];
            tests.forEach((testName: string) => {
                const cleanName = testName.trim();
                const catalogItem = labTests.find(t => t.name_en === cleanName || t.name_ar === cleanName);
                
                const composite = COMPOSITE_TESTS[cleanName] || (catalogItem ? COMPOSITE_TESTS[catalogItem.name_en] : undefined);
                
                if (composite) {
                     composite.forEach(sub => {
                        initialRows.push({
                            name: sub.name,
                            value: '',
                            range: sub.range,
                            flag: 'Normal'
                        });
                    });
                } else {
                    initialRows.push({
                        name: cleanName,
                        value: '',
                        range: catalogItem?.normal_range || '',
                        flag: 'Normal'
                    });
                }
            });
        }
        setResultRows(initialRows);
    }
    
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
    const row = newRows[index];
    (row as any)[field] = val;
    
    // Auto-evaluate if value changes
    if (field === 'value') {
        row.flag = evaluateResult(val, row.range);
    }
    
    setResultRows(newRows);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    setProcessStatus('processing');

    // Serialize rows into a Markdown Table string for the backend
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

  const handlePrint = () => {
      window.print();
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
                  bg-white dark:bg-slate-800 rounded-2xl border transition-all duration-300 relative group overflow-hidden
                  ${isConfirmed ? 'border-primary-200 dark:border-primary-900/50 shadow-md ring-1 ring-primary-100 dark:ring-primary-900/30' : 
                    isCompleted ? 'border-emerald-200 dark:border-emerald-900/50 opacity-95 hover:opacity-100' : 
                    'border-slate-200 dark:border-slate-700'}
                  hover:-translate-y-1 hover:shadow-xl
                `}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex flex-col md:flex-row h-full">
                  {/* Left: Main Content */}
                  <div className="p-5 flex-1 flex gap-4 min-w-0">
                     <div className={`
                       shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner
                       ${isConfirmed ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600' : 
                         isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600' : 
                         'bg-amber-50 dark:bg-amber-900/30 text-amber-600'}
                     `}>
                       {isCompleted ? <CheckCircle size={24} /> : <FlaskConical size={24} />}
                     </div>
                     <div className="min-w-0 flex-1 space-y-3">
                        <div>
                           <div className="flex items-center justify-between md:justify-start gap-2 mb-1">
                              <h3 className="font-bold text-lg text-slate-900 dark:text-white truncate">{req.patientName}</h3>
                              {!isCompleted && !isConfirmed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap">
                                  <AlertCircle size={10} /> {t('lab_card_payment_pending')}
                                </span>
                              )}
                              {isConfirmed && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap animate-pulse">
                                  <Timer size={10} /> Ready
                                </span>
                              )}
                           </div>
                           <p className="text-xs text-slate-400 font-mono tracking-tight">REF: #{req.id.toString().padStart(6, '0')}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {tests.map((test: string, i: number) => (
                             <span key={i} className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                               {test}
                             </span>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Ticket Separator */}
                  <div className="relative flex-none">
                     <div className="hidden md:block absolute top-0 bottom-0 left-0 w-px border-l-2 border-dashed border-slate-200 dark:border-slate-700 my-3"></div>
                     <div className="hidden md:block absolute -top-1.5 -left-1.5 w-3 h-3 bg-slate-50 dark:bg-slate-950 rounded-full border-b border-slate-200 dark:border-slate-700"></div>
                     <div className="hidden md:block absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-slate-50 dark:bg-slate-950 rounded-full border-t border-slate-200 dark:border-slate-700"></div>
                     <div className="md:hidden h-px w-full border-t-2 border-dashed border-slate-200 dark:border-slate-700 mx-3"></div>
                     <div className="md:hidden absolute -left-1.5 -top-1.5 w-3 h-3 bg-slate-50 dark:bg-slate-950 rounded-full border-r border-slate-200 dark:border-slate-700"></div>
                     <div className="md:hidden absolute -right-1.5 -top-1.5 w-3 h-3 bg-slate-50 dark:bg-slate-950 rounded-full border-l border-slate-200 dark:border-slate-700"></div>
                  </div>

                  {/* Right: Meta & Actions */}
                  <div className="p-5 md:w-64 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between gap-4">
                     <div className="flex flex-row md:flex-col justify-between items-center md:items-end gap-2">
                        <div className="flex flex-col items-start md:items-end">
                           <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Requested</span>
                           <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                              <Calendar size={12} className="text-slate-400"/>
                              {new Date(req.created_at).toLocaleDateString()}
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
                              <Clock size={10}/>
                              {new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">{t('config_field_cost')}</span>
                           <span className="text-xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                              ${req.projected_cost.toLocaleString()}
                           </span>
                        </div>
                     </div>

                     <div className="w-full">
                        {isConfirmed ? (
                          <Button onClick={() => openProcessModal(req)} icon={Microscope} className="w-full shadow-lg shadow-primary-500/20">{t('lab_card_enter_results')}</Button>
                        ) : isCompleted ? (
                          <Button variant="secondary" onClick={() => openProcessModal(req)} icon={FileText} className="w-full">{t('lab_view_results')}</Button>
                        ) : (
                          <Button disabled variant="outline" className="w-full border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/50 opacity-70 cursor-not-allowed">
                            <Clock size={16} className="mr-2"/> Payment Required
                          </Button>
                        )}
                     </div>
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
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-100 dark:border-slate-800 flex items-center justify-between no-print">
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

          <form onSubmit={handleComplete} className="space-y-6 no-print">
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
                                            <option value="Abnormal">Abnormal</option>
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

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
              <div>
                 {selectedReq?.status === 'completed' && (
                    <Button type="button" variant="outline" onClick={handlePrint} icon={Printer}>Print Report</Button>
                 )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>{t('close')}</Button>
                {selectedReq?.status !== 'completed' && (
                    <Button type="submit" icon={Save} disabled={processStatus === 'processing'} className="px-8 shadow-lg shadow-primary-500/20">
                    {processStatus === 'processing' ? t('processing') : t('lab_modal_save_button')}
                    </Button>
                )}
              </div>
            </div>
          </form>

          {/* PRINT ONLY SECTION */}
          <div className="hidden print:block font-sans p-8">
             <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight">Medical Laboratory Report</h1>
                    <p className="text-sm font-bold text-slate-600 mt-1">AllCare Hospital</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-bold">Report Date: {new Date().toLocaleDateString()}</p>
                    <p className="text-xs font-bold">Ref ID: #{selectedReq?.id}</p>
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <p className="text-xs font-black uppercase text-slate-400">Patient Details</p>
                    <p className="font-bold text-lg">{selectedReq?.patientName}</p>
                    <p className="text-sm">Patient ID: P-{selectedReq?.patient_id}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black uppercase text-slate-400">Request Details</p>
                    <p className="font-bold">{selectedReq?.testNames}</p>
                    <p className="text-sm">Requested: {new Date(selectedReq?.created_at).toLocaleDateString()}</p>
                </div>
             </div>

             <table className="w-full mb-8">
                <thead>
                    <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-2 font-black uppercase text-xs">Test Parameter</th>
                        <th className="text-center py-2 font-black uppercase text-xs">Result</th>
                        <th className="text-center py-2 font-black uppercase text-xs">Reference Range</th>
                        <th className="text-right py-2 font-black uppercase text-xs">Flag</th>
                    </tr>
                </thead>
                <tbody>
                    {resultRows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-100">
                            <td className="py-2 text-sm font-bold">{row.name}</td>
                            <td className="py-2 text-center font-mono font-bold text-base">{row.value}</td>
                            <td className="py-2 text-center text-xs text-slate-500">{row.range}</td>
                            <td className="py-2 text-right">
                                {row.flag !== 'Normal' && row.flag !== 'Negative' && (
                                    <span className="font-black text-xs uppercase px-2 py-0.5 bg-slate-200 rounded">{row.flag}</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>

             <div className="mt-12 pt-8 border-t border-slate-200 flex justify-between items-end">
                <div className="text-xs text-slate-400">
                    <p>Generated by AllCare HMS</p>
                    <p>{new Date().toLocaleString()}</p>
                </div>
                <div className="text-center">
                    <div className="h-12 border-b border-slate-300 w-48 mb-2"></div>
                    <p className="text-xs font-black uppercase">Lab Technician Signature</p>
                </div>
             </div>
          </div>
        </div>
      </Modal>
      
      {/* Global Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-4xl { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
          .fixed { position: static !important; }
          .modal-content, .modal-content * { visibility: visible; }
          .no-print { display: none !important; }
          .print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
};
