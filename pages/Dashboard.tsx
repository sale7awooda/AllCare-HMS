
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, Badge, Button, Modal, Input, Select, Textarea } from '../components/UI';
import { api } from '../services/api';
import { 
  Users, Calendar, Activity, Bed, Clock, TrendingUp, 
  Wallet, Plus, Stethoscope, FlaskConical, AlertCircle, ArrowRight, CheckCircle,
  Search, Loader2, XCircle, ChevronRight, ShoppingCart, Layers, Syringe, Briefcase, Info, Save, X,
  // FIX: Added DollarSign and Trash2 to imports to resolve compilation errors on lines 572 and 584.
  DollarSign, Trash2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  
  // Stats State
  const [stats, setStats] = useState({ 
    patients: 0, 
    todayAppointments: 0, 
    totalRevenue: 0,
    outstandingRevenue: 0,
    occupancyRate: 0,
    activeAdmissions: 0
  });
  
  // Data for Charts & Modals
  const [patients, setPatients] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<any[]>([]);
  const [nurseServices, setNurseServices] = useState<any[]>([]);
  const [beds, setBeds] = useState<any[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<any[]>([]);

  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [bedDetails, setBedDetails] = useState({ general: {total:0, free:0}, private: {total:0, free:0}, icu: {total:0, free:0} });
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Action Modal States
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<'appointment' | 'lab' | 'admission' | 'operation' | 'bill' | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  // Form States (Reusing logic from Patients page)
  const [actionFormData, setActionFormData] = useState({
    staffId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), 
    notes: '', subtype: 'Consultation', deposit: 0 
  });
  const [selectedTests, setSelectedTests] = useState<any[]>([]);
  const [testSearch, setTestSearch] = useState('');
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [billItems, setBillItems] = useState([{ description: '', amount: '' }]);

  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Sync Header
  useHeader(
    t('dashboard_title'), 
    t('dashboard_subtitle'),
    <Button variant="secondary" size="sm" icon={Clock} className="cursor-default pointer-events-none">{new Date().toLocaleDateString()}</Button>
  );

  const loadDashboardData = async () => {
    const safeFetch = async (promise: Promise<any>) => {
      try {
        const result = await promise;
        return Array.isArray(result) ? result : [];
      } catch (error) { return []; }
    };

    try {
      const [pts, apts, bills, bedsData, labs, staffData, nurseData, opsData, insData] = await Promise.all([
        safeFetch(api.getPatients()),
        safeFetch(api.getAppointments()),
        safeFetch(api.getBills()),
        safeFetch(api.getBeds()),
        safeFetch(api.getPendingLabRequests()),
        safeFetch(api.getStaff()),
        safeFetch(api.getNurseServices()),
        safeFetch(api.getOperations()),
        safeFetch(api.getInsuranceProviders())
      ]);

      setPatients(pts);
      setStaff(staffData);
      setLabTests(pts); // Using pts for patient selection search, actual lab tests catalog below
      setNurseServices(nurseData);
      setBeds(bedsData);
      setOperations(opsData);
      setInsuranceProviders(insData);

      // Re-fetch catalogs for forms specifically
      const labCatalog = await api.getLabTests();
      setLabTests(labCatalog);

      const totalRev = bills.reduce((sum: number, b: any) => sum + (b.paidAmount || 0), 0);
      const outstanding = bills.reduce((sum: number, b: any) => sum + ((b.totalAmount || 0) - (b.paidAmount || 0)), 0);
      
      const totalBedsCount = bedsData.length || 1;
      const occupiedBeds = bedsData.filter((b: any) => b.status === 'occupied').length;
      const occupancyRate = Math.round((occupiedBeds / totalBedsCount) * 100);

      const todayStr = new Date().toISOString().split('T')[0];
      const todayAppts = apts.filter((a: any) => a && a.datetime && a.datetime.startsWith(todayStr)).length;

      setStats({
        patients: pts.length,
        todayAppointments: todayAppts,
        totalRevenue: totalRev,
        outstandingRevenue: outstanding,
        occupancyRate,
        activeAdmissions: occupiedBeds
      });

      const deptCounts: Record<string, number> = {};
      apts.forEach((apt: any) => {
         const doctor = staffData.find((s: any) => s.id === apt.staffId);
         const dept = doctor?.department || 'General';
         deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });
      
      const deptChartData = Object.keys(deptCounts).map(dept => ({
        name: dept,
        count: deptCounts[dept]
      })).sort((a,b) => b.count - a.count).slice(0, 5);
      setDepartmentData(deptChartData);

      const bedStats = { general: { total: 0, free: 0 }, private: { total: 0, free: 0 }, icu: { total: 0, free: 0 } };
      bedsData.forEach((b: any) => {
          const type = b.type.toLowerCase() as keyof typeof bedStats;
          if (bedStats[type]) {
              bedStats[type].total++;
              if (b.status === 'available') bedStats[type].free++;
          }
      });
      setBedDetails(bedStats);

      const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), key: d.toISOString().split('T')[0] };
      });

      const trendData = last7Days.map(day => {
          const dayIncome = bills
              .filter((b: any) => b.date && b.date.startsWith(day.key))
              .reduce((sum: number, b: any) => sum + (b.paidAmount || 0), 0);
          return { name: day.label, income: dayIncome };
      });
      setRevenueTrend(trendData);

      const recentPendingLabs = labs.filter((l: any) => l.status === 'pending').slice(0, 3).map((l: any) => ({
          type: 'lab', title: t('dashboard_feed_lab_title'), subtitle: `${l.patientName} - $${l.projected_cost}`, id: l.id, time: l.created_at
      }));

      const unpaidBills = bills.filter((b: any) => b.status === 'pending').slice(0, 3).map((b: any) => ({
          type: 'bill', title: t('dashboard_feed_bill_title'), subtitle: `${b.patientName} - $${b.totalAmount}`, id: b.id, time: b.date
      }));

      setPendingTasks([...recentPendingLabs, ...unpaidBills].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()));

    } catch (error) {
      console.error("Critical error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, [t]);

  // Handle outside click for patient search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openActionModal = (action: typeof currentAction) => {
    setCurrentAction(action);
    setSelectedPatient(null);
    setPatientSearch('');
    setActionFormData({
      staffId: '', date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5), 
      notes: '', subtype: 'Consultation', deposit: 0 
    });
    setSelectedTests([]);
    setSelectedBed(null);
    setBillItems([{ description: '', amount: '' }]);
    setIsActionModalOpen(true);
  };

  const submitQuickAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !currentAction) return;

    setProcessStatus('processing');
    setProcessMessage(t('processing'));

    try {
      const staffId = actionFormData.staffId ? parseInt(actionFormData.staffId) : undefined;

      if (currentAction === 'lab') {
        await api.createLabRequest({
          patientId: selectedPatient.id,
          testIds: selectedTests.map(t => t.id),
          totalCost: selectedTests.reduce((a,b) => a + b.cost, 0)
        });
      } else if (currentAction === 'appointment') {
        await api.createAppointment({
          patientId: selectedPatient.id,
          staffId,
          datetime: `${actionFormData.date}T${actionFormData.time}`,
          type: actionFormData.subtype,
          reason: actionFormData.notes
        });
      } else if (currentAction === 'admission') {
        await api.createAdmission({
          patientId: selectedPatient.id,
          bedId: selectedBed.id,
          doctorId: staffId,
          entryDate: actionFormData.date,
          deposit: actionFormData.deposit,
          notes: actionFormData.notes
        });
      } else if (currentAction === 'operation') {
        await api.createOperation({
          patientId: selectedPatient.id,
          operationName: actionFormData.subtype,
          doctorId: staffId,
          notes: actionFormData.notes
        });
      } else if (currentAction === 'bill') {
        await api.createBill({
          patientId: selectedPatient.id,
          patientName: selectedPatient.fullName,
          totalAmount: billItems.reduce((a,b) => a + (parseFloat(b.amount) || 0), 0),
          items: billItems.map(i => ({ description: i.description, amount: parseFloat(i.amount) }))
        });
      }

      setProcessStatus('success');
      setProcessMessage(t('success'));
      loadDashboardData();
      setTimeout(() => {
        setIsActionModalOpen(false);
        setProcessStatus('idle');
      }, 1500);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || t('error'));
    }
  };

  const filteredPatients = useMemo(() => {
    if (!patientSearch) return patients.slice(0, 5);
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || 
      p.patientId.toLowerCase().includes(patientSearch.toLowerCase())
    ).slice(0, 5);
  }, [patients, patientSearch]);

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-lg transition-all duration-300 h-[100px]">
      <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${colorClass} opacity-5 dark:opacity-10 rounded-bl-full -mr-2 -mt-2 transition-transform group-hover:scale-110`}></div>
      <div className="flex items-center gap-4 relative z-10 h-full">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-md shrink-0`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{title}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h3 className="text-xl font-black text-slate-800 dark:text-white truncate tracking-tight">{value}</h3>
            {trend && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-md">
                <TrendingUp size={10} />
                {trend}
              </span>
            )}
          </div>
          {subtext && <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-medium">{subtext}</p>}
        </div>
      </div>
    </div>
  );

  const ActionButton = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-2.5 p-3.5 rounded-2xl border transition-all duration-300
        bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-${color}-400 dark:hover:border-${color}-500 hover:-translate-y-1 group
      `}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center bg-${color}-50 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 group-hover:bg-${color}-600 group-hover:text-white transition-all duration-300 shadow-sm`}>
        <Icon size={22} />
      </div>
      <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider group-hover:text-slate-900 dark:group-hover:text-white text-center">{label}</span>
    </button>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('dashboard_loading_text')}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* STANDARD SIZE PROCESS HUD */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('error')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      {/* Refined Quick Actions Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <ActionButton icon={Plus} label={t('dashboard_action_admission')} color="blue" onClick={() => openActionModal('admission')} />
        <ActionButton icon={Calendar} label={t('dashboard_action_visit')} color="violet" onClick={() => openActionModal('appointment')} />
        <ActionButton icon={Users} label={t('dashboard_action_register')} color="emerald" onClick={() => navigate('/patients')} />
        <ActionButton icon={FlaskConical} label={t('dashboard_action_lab')} color="orange" onClick={() => openActionModal('lab')} />
        <ActionButton icon={Wallet} label={t('dashboard_action_invoice')} color="pink" onClick={() => openActionModal('bill')} />
        <ActionButton icon={Activity} label={t('dashboard_action_schedule')} color="cyan" onClick={() => openActionModal('operation')} />
      </div>

      {/* Compact Stat Cards - REDUCED HEIGHT */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={t('dashboard_stat_total_patients')} 
          value={stats.patients.toLocaleString()} 
          icon={Users} 
          trend="+5.2%"
          colorClass="from-blue-500 to-blue-600" 
        />
        <StatCard 
          title={t('dashboard_stat_today_appts')}
          value={stats.todayAppointments} 
          subtext={t('dashboard_stat_appts_subtext')}
          icon={Calendar} 
          colorClass="from-violet-500 to-violet-600" 
        />
        <StatCard 
          title={t('dashboard_stat_revenue')}
          value={`$${stats.totalRevenue.toLocaleString()}`} 
          subtext={t('dashboard_stat_revenue_subtext', { amount: `$${stats.outstandingRevenue.toLocaleString()}` })}
          icon={Wallet} 
          colorClass="from-emerald-500 to-emerald-600" 
        />
        <StatCard 
          title={t('dashboard_stat_occupancy')}
          value={`${stats.occupancyRate}%`} 
          subtext={t('dashboard_stat_occupancy_subtext', { count: stats.activeAdmissions })}
          icon={Bed} 
          trend={stats.occupancyRate > 80 ? t('dashboard_stat_occupancy_high') : undefined}
          colorClass="from-rose-500 to-rose-600" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title={t('dashboard_chart_workload')} action={<Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>{t('dashboard_chart_workload_action')}</Button>}>
            <div className="h-80 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40}>
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'][index % 5]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title={t('dashboard_feed_title')}>
            <div className="h-80 overflow-y-auto custom-scrollbar pr-2 space-y-3 mt-2">
                {pendingTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                        <CheckCircle size={48} className="mb-2 text-green-100 dark:text-green-900/30" />
                        <p>{t('dashboard_feed_empty')}</p>
                        <p className="text-xs">{t('dashboard_feed_empty_subtext')}</p>
                    </div>
                ) : (
                    pendingTasks.map((task, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-primary-200 transition-colors cursor-pointer" onClick={() => navigate(task.type === 'lab' ? '/laboratory' : '/billing')}>
                            <div className={`p-2 rounded-lg shrink-0 ${task.type === 'lab' ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600'}`}>
                                {task.type === 'lab' ? <FlaskConical size={16} /> : <AlertCircle size={16} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{task.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{task.subtitle}</p>
                            </div>
                            <ArrowRight size={14} className="text-slate-300 self-center" />
                        </div>
                    ))
                )}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
             <Card title={t('dashboard_widget_beds')} action={<Button size="sm" variant="ghost" onClick={() => navigate('/admissions')}>{t('dashboard_widget_beds_action')}</Button>}>
                <div className="space-y-4 mt-2">
                    {[
                        { label: t('dashboard_widget_beds_general'), stats: bedDetails.general, color: 'blue' },
                        { label: t('dashboard_widget_beds_private'), stats: bedDetails.private, color: 'violet' },
                        { label: t('dashboard_widget_beds_icu'), stats: bedDetails.icu, color: 'rose' },
                    ].map(type => (
                        <div key={type.label}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600 dark:text-slate-400">{type.label}</span>
                                <span className="font-bold text-slate-900 dark:text-white">{type.stats.free} <span className="text-slate-400 font-normal">/ {type.stats.total} {t('dashboard_widget_beds_free')}</span></span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full bg-${type.color}-500 transition-all duration-500`} style={{ width: `${type.stats.total ? ((type.stats.total - type.stats.free) / type.stats.total) * 100 : 0}%` }} />
                            </div>
                        </div>
                    ))}
                </div>
             </Card>
          </div>

          <div className="lg:col-span-2">
            <Card title={t('dashboard_chart_revenue')}>
                <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRevenue2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }} />
                            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue2)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
          </div>
      </div>

      {/* QUICK ACTION MODAL */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={`Quick Action: ${currentAction?.toUpperCase()}`}>
        <form onSubmit={submitQuickAction} className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* STEP 1: PATIENT SEARCH (For all actions) */}
          <div className="space-y-1.5" ref={patientSearchRef}>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{t('patients_table_header_patient')}</label>
            {selectedPatient ? (
              <div className="flex items-center justify-between p-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-primary-600 font-bold text-sm">{selectedPatient.fullName.charAt(0)}</div>
                   <div className="flex flex-col">
                     <span className="font-black text-primary-900 dark:text-primary-100 leading-none mb-1">{selectedPatient.fullName}</span>
                     <span className="text-[10px] text-primary-600 dark:text-primary-400 font-black tracking-widest uppercase">ID: {selectedPatient.patientId}</span>
                   </div>
                 </div>
                 <button type="button" onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="p-1.5 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full transition-colors"><X size={16} className="text-primary-600" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" placeholder={t('patients_search_placeholder')}
                  className="pl-9 pr-4 py-3 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                  value={patientSearch} onChange={(e) => { setPatientSearch(e.target.value); setShowPatientResults(true); }} onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && filteredPatients.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in duration-200 max-h-56 overflow-y-auto">
                    {filteredPatients.map(p => (
                      <button key={p.id} type="button" className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors" onClick={() => { setSelectedPatient(p); setShowPatientResults(false); }}>
                        <div className="flex flex-col"><span className="font-bold text-slate-900 dark:text-white text-sm">{p.fullName}</span><span className="text-[10px] text-slate-500 font-mono">ID: {p.patientId}</span></div>
                        <ChevronRight size={14} className="text-slate-300" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: ACTION SPECIFIC FORMS */}
          {selectedPatient && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
              
              {/* APPOINTMENT FORM */}
              {currentAction === 'appointment' && (
                <>
                  <Select label={t('appointments_form_select_staff')} required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                    <option value="">{t('appointments_form_select_staff')}</option>
                    {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName} ({doc.specialization})</option>)}
                  </Select>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label={t('date')} type="date" value={actionFormData.date} onChange={e => setActionFormData({...actionFormData, date: e.target.value})} />
                    <Input label={t('time')} type="time" value={actionFormData.time} onChange={e => setActionFormData({...actionFormData, time: e.target.value})} />
                  </div>
                  <Textarea label={t('reason')} rows={3} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
                </>
              )}

              {/* LAB FORM */}
              {currentAction === 'lab' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                     <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Catalog</label>
                     <div className="max-h-64 overflow-y-auto border rounded-xl divide-y dark:border-slate-700">
                        {labTests.map(test => {
                          const inCart = selectedTests.some(t => t.id === test.id);
                          return (
                            <div key={test.id} className="p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-900">
                               <div className="flex-1"><p className="text-sm font-bold">{language === 'ar' ? test.name_ar : test.name_en}</p><p className="text-[10px] text-slate-400 font-bold uppercase">{test.category_en}</p></div>
                               <button type="button" onClick={() => inCart ? setSelectedTests(prev => prev.filter(t => t.id !== test.id)) : setSelectedTests(prev => [...prev, test])} className={`p-1.5 rounded-lg ${inCart ? 'bg-red-50 text-red-500' : 'bg-primary-50 text-primary-600'}`}>{inCart ? <X size={16}/> : <Plus size={16}/>}</button>
                            </div>
                          );
                        })}
                     </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-700">
                     <h4 className="font-bold flex items-center gap-2 mb-4"><ShoppingCart size={18}/> Basket</h4>
                     <div className="space-y-2 mb-4">
                        {selectedTests.length === 0 ? <p className="text-xs text-slate-400 italic">No tests selected.</p> : selectedTests.map(t => <div key={t.id} className="flex justify-between text-xs bg-white p-2 rounded shadow-sm"><span>{language === 'ar' ? t.name_ar : t.name_en}</span><span className="font-bold">${t.cost}</span></div>)}
                     </div>
                     <div className="border-t pt-2 flex justify-between font-black"><span>Total</span><span className="text-primary-600">${selectedTests.reduce((a,b)=>a+b.cost, 0)}</span></div>
                  </div>
                </div>
              )}

              {/* ADMISSION FORM */}
              {currentAction === 'admission' && (
                <>
                  <Select label="Select Ward/Bed" required value={selectedBed?.id} onChange={e => setSelectedBed(beds.find(b => b.id === parseInt(e.target.value)))}>
                    <option value="">Choose available bed...</option>
                    {beds.filter(b => b.status === 'available').map(b => <option key={b.id} value={b.id}>Room {b.roomNumber} ({b.type}) - ${b.costPerDay}/day</option>)}
                  </Select>
                  <Select label="Assign Doctor" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                    <option value="">Treating Physician...</option>
                    {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
                  </Select>
                  <Input label="Admission Deposit" type="number" value={actionFormData.deposit} onChange={e => setActionFormData({...actionFormData, deposit: parseFloat(e.target.value) || 0})} prefix={<DollarSign size={14}/>} />
                </>
              )}

              {/* BILLING FORM */}
              {currentAction === 'bill' && (
                <div className="space-y-4">
                  <label className="block text-sm font-bold">Invoice Items</label>
                  {billItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                       <Input placeholder="Description" value={item.description} onChange={e => { const n = [...billItems]; n[idx].description = e.target.value; setBillItems(n); }} />
                       <Input placeholder="0.00" type="number" value={item.amount} className="w-32" onChange={e => { const n = [...billItems]; n[idx].amount = e.target.value; setBillItems(n); }} />
                       <button type="button" onClick={() => setBillItems(billItems.filter((_,i) => i !== idx))} className="text-red-500 p-2"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setBillItems([...billItems, { description: '', amount: '' }])}>Add Item</Button>
                </div>
              )}

              {/* OPERATION FORM */}
              {currentAction === 'operation' && (
                <>
                  <Select label="Operation Name" value={actionFormData.subtype} onChange={e => setActionFormData({...actionFormData, subtype: e.target.value})}>
                    <option value="">Select Procedure...</option>
                    {operations.map(o => <option key={o.id} value={o.name_en}>{language === 'ar' ? o.name_ar : o.name_en}</option>)}
                  </Select>
                  <Select label="Surgeon" required value={actionFormData.staffId} onChange={e => setActionFormData({...actionFormData, staffId: e.target.value})}>
                    <option value="">Assign Surgeon...</option>
                    {staff.filter(s => s.type === 'doctor').map(doc => <option key={doc.id} value={doc.id}>{doc.fullName}</option>)}
                  </Select>
                  <Textarea label="Notes" rows={2} value={actionFormData.notes} onChange={e => setActionFormData({...actionFormData, notes: e.target.value})} />
                </>
              )}

              <div className="pt-4 border-t flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800 py-2">
                <Button type="button" variant="secondary" onClick={() => setIsActionModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" icon={Save}>{t('submit')}</Button>
              </div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
};
