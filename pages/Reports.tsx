
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Badge, Modal } from '../components/UI';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, 
  Activity, ArrowUpRight, ArrowDownRight, Filter, CheckCircle,
  FilePlus, Clock, CreditCard, Shield, Printer, ChevronDown, ChevronRight,
  UserCheck, Stethoscope, Landmark, Layers, History, 
  TrendingDown, Zap, BarChart3, PieChart as PieIcon, Info, User, Hash, ExternalLink, X
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const Reports = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'financial' | 'operational' | 'demographics' | 'activity'>('financial');
  const [rangeType, setRangeType] = useState('30');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const [bills, setBills] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  // Event Detail State
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  // Date Range Logic
  const dateRange = useMemo(() => {
    if (rangeType === 'custom') {
        const start = customRange.start ? new Date(customRange.start + 'T00:00:00') : new Date(0); 
        const end = customRange.end ? new Date(customRange.end + 'T23:59:59.999') : new Date();
        return { start, end };
    }
    const end = new Date(); 
    const start = new Date();
    start.setDate(end.getDate() - parseInt(rangeType));
    start.setHours(0,0,0,0); 
    end.setHours(23,59,59,999);
    return { start, end };
  }, [rangeType, customRange]);

  // FIX: Added defensive Array.isArray check to prevent "data.filter is not a function"
  const filterByDate = (data: any[], dateField: string) => {
    if (!Array.isArray(data)) return [];
    return data.filter(item => {
      if (!item || !item[dateField]) return false;
      const d = new Date(item[dateField]);
      return d >= dateRange.start && d <= dateRange.end;
    });
  };

  // --- ANALYTICS CALCULATIONS ---

  const financialStats = useMemo(() => {
    const fb = filterByDate(bills, 'date');
    const ft = filterByDate(transactions, 'date');
    
    const trMap = new Map();
    fb.forEach(b => {
      const key = new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trMap.set(key, (trMap.get(key) || 0) + (b.paidAmount || 0));
    });

    const methodMap: Record<string, number> = {};
    ft.filter(tx => tx.type === 'income').forEach(tx => {
      const method = tx.method || 'Unknown';
      methodMap[method] = (methodMap[method] || 0) + tx.amount;
    });

    const serviceMap: Record<string, number> = {};
    fb.forEach(bill => {
      (bill.items || []).forEach((item: any) => {
        serviceMap[item.description] = (serviceMap[item.description] || 0) + item.amount;
      });
    });

    const totalIncome = ft.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const totalExpenses = ft.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalRevenue: totalIncome,
      totalExpenses: totalExpenses,
      netProfit: totalIncome - totalExpenses,
      outstanding: fb.reduce((sum, b) => sum + ((b.totalAmount || 0) - (b.paidAmount || 0)), 0),
      avgInvoice: fb.length ? Math.round(fb.reduce((sum, b) => sum + (b.totalAmount || 0), 0) / fb.length) : 0,
      revenueTrend: Array.from(trMap).map(([name, value]) => ({ name, value })),
      incomeByMethod: Object.entries(methodMap).map(([name, value]) => ({ name, value })),
      topServices: Object.entries(serviceMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5)
    };
  }, [bills, transactions, dateRange]);

  const operationalStats = useMemo(() => {
    const fa = filterByDate(appointments, 'datetime');
    const deptMap: Record<string, number> = {};
    const doctorMap: Record<string, number> = {};
    
    fa.forEach(a => {
      deptMap[a.type] = (deptMap[a.type] || 0) + 1;
      doctorMap[a.staffName] = (doctorMap[a.staffName] || 0) + 1;
    });

    const completionRate = fa.length ? Math.round((fa.filter(a => a.status === 'completed').length / fa.length) * 100) : 0;

    return {
      total: fa.length,
      completionRate,
      deptRank: Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
      doctorRank: Object.entries(doctorMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5)
    };
  }, [appointments, dateRange]);

  const patientStats = useMemo(() => {
    const fp = filterByDate(patients, 'createdAt');
    
    const growthMap = new Map();
    fp.forEach(p => {
        const key = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        growthMap.set(key, (growthMap.get(key) || 0) + 1);
    });

    const male = fp.filter(p => p.gender === 'male').length;
    const female = fp.filter(p => p.gender === 'female').length;

    const pediatric = fp.filter(p => p.age < 18).length;
    const adult = fp.filter(p => p.age >= 18 && p.age < 60).length;
    const senior = fp.filter(p => p.age >= 60).length;

    return {
      total: Array.isArray(patients) ? patients.length : 0,
      newCount: fp.length,
      growthTrend: Array.from(growthMap).map(([name, count]) => ({ name, count })),
      genderSplit: [
        { name: 'Male', value: male },
        { name: 'Female', value: female }
      ],
      ageDist: [
        { name: 'Pediatric', value: pediatric },
        { name: 'Adult', value: adult },
        { name: 'Senior', value: senior }
      ]
    };
  }, [patients, dateRange]);

  const activityStream = useMemo(() => {
    const pts = Array.isArray(patients) ? patients : [];
    const apts = Array.isArray(appointments) ? appointments : [];
    const bls = Array.isArray(bills) ? bills : [];

    const stream = [
      ...pts.map(p => ({ type: 'patient', name: p.fullName, date: p.createdAt, meta: 'New Registration', status: 'Registered', id: `p-${p.id}`, raw: p })),
      ...apts.map(a => ({ type: 'appointment', name: a.patientName, sub: a.staffName, date: a.datetime, meta: a.status, status: a.status, id: `a-${a.id}`, raw: a })),
      ...bls.map(b => ({ type: 'bill', name: b.patientName, sub: `$${b.totalAmount.toLocaleString()}`, date: b.date, meta: b.status, status: b.status, id: `b-${b.id}`, raw: b }))
    ];
    return stream.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [patients, appointments, bills]);

  const handleExportCSV = () => {
    const headers = ["Metric", "Value", "Context"];
    let rows = [];
    const dateStr = `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`;

    if (activeTab === 'financial') {
        rows = [
            ["Total Revenue", financialStats.totalRevenue, dateStr],
            ["Total Expenses", financialStats.totalExpenses, dateStr],
            ["Net Profit", financialStats.netProfit, dateStr],
            ["Outstanding Bills", financialStats.outstanding, dateStr]
        ];
    } else {
        rows = [
            ["Total Registered", patientStats.total, "All Time"],
            ["New in Period", patientStats.newCount, dateStr]
        ];
    }
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(',')).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `AllCare_HMS_Report_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Sync Header
  useHeader(
    t('reports_title'), 
    t('reports_subtitle'), 
    <div className="relative" ref={exportMenuRef}>
      <Button variant="primary" icon={Download} onClick={() => setShowExportMenu(!showExportMenu)}>
        {t('reports_export_button')} <ChevronDown size={14} className={`ml-2 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
      </Button>
      {showExportMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => { window.print(); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <Printer size={16} className="text-primary-500" />
            <span>Export as PDF Report</span>
          </button>
          <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-slate-100 dark:border-slate-700">
            <Landmark size={16} className="text-emerald-600" />
            <span>Download CSV (Excel)</span>
          </button>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [b, a, p, t_data, s] = await Promise.all([
            api.getBills(), 
            api.getAppointments(), 
            api.getPatients(), 
            api.getTransactions(), 
            api.getStaff()
        ]);
        setBills(Array.isArray(b) ? b : []); 
        setAppointments(Array.isArray(a) ? a : []); 
        setPatients(Array.isArray(p) ? p : []); 
        setTransactions(Array.isArray(t_data) ? t_data : []); 
        setStaff(Array.isArray(s) ? s : []);
      } catch (e) { 
        console.error("Reports data fetch failed:", e);
        setBills([]); setAppointments([]); setPatients([]); setTransactions([]); setStaff([]);
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const openEventDetails = (event: any) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, trend }: any) => (
    <Card className="relative !p-3 bg-white dark:bg-slate-800 shadow-soft border-slate-100 dark:border-slate-700 hover:shadow-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-3.5">
        <div className={`p-2.5 rounded-xl ${colorClass} text-white shadow-md shrink-0`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 truncate">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-none truncate">{value}</h3>
          </div>
          {subtitle && <p className="text-[9px] text-slate-500 mt-1 font-bold truncate">{subtitle}</p>}
        </div>
      </div>
      
      {trend && (
        <div className={`absolute top-2 right-2 flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {trend > 0 ? <ArrowUpRight size={8}/> : <ArrowDownRight size={8}/>}
          {Math.abs(trend)}%
        </div>
      )}
    </Card>
  );

  const RecordDetailItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
      {Icon && <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400"><Icon size={16} /></div>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value || 'N/A'}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-soft gap-4 no-print">
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 w-4 h-4 transition-colors" />
            <select 
              className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer" 
              value={rangeType} 
              onChange={e => setRangeType(e.target.value)}
            >
              <option value="7">{t('reports_time_week')}</option>
              <option value="30">{t('reports_time_month')}</option>
              <option value="90">Quarterly (90 Days)</option>
              <option value="custom">{t('reports_time_custom')}</option>
            </select>
          </div>
          {rangeType === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
              <Input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="!py-2 w-36 shadow-none" />
              <span className="text-slate-400 font-bold">-</span>
              <Input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="!py-2 w-36 shadow-none" />
            </div>
          )}
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl shrink-0 w-full md:w-auto overflow-x-auto">
          {[
              { id: 'financial', label: t('reports_tab_financial'), icon: DollarSign },
              { id: 'operational', label: t('reports_tab_operational'), icon: Activity },
              { id: 'demographics', label: t('reports_tab_demographics'), icon: Users },
              { id: 'activity', label: 'Activity Log', icon: History }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 shadow-soft text-primary-600' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="print-content animate-in fade-in duration-500">
        {/* --- FINANCIAL VIEW --- */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard title="Net Profit/Loss" value={`$${financialStats.netProfit.toLocaleString()}`} subtitle="Revenue vs Expenses" icon={TrendingUp} colorClass={financialStats.netProfit >= 0 ? "bg-emerald-500" : "bg-rose-500"} />
              <StatCard title="Gross Revenue" value={`$${financialStats.totalRevenue.toLocaleString()}`} subtitle="Payments collected" icon={CreditCard} colorClass="bg-blue-500" trend={12} />
              <StatCard title="Outstanding" value={`$${financialStats.outstanding.toLocaleString()}`} subtitle="Awaiting settlement" icon={Clock} colorClass="bg-orange-500" />
              <StatCard title="Avg per Patient" value={`$${financialStats.avgInvoice.toLocaleString()}`} subtitle="Invoice average" icon={Zap} colorClass="bg-violet-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 !p-0" title="Revenue Realization Trend">
                <div className="h-64 w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialStats.revenueTrend}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)' }} />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="!p-0" title="Income by Method">
                <div className="h-64 w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={financialStats.incomeByMethod} cx="50%" cy="50%" innerRadius={50} outerRadius={65} paddingAngle={5} dataKey="value">
                        {financialStats.incomeByMethod.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="lg:col-span-3 !p-0" title="Top Services by Generated Revenue">
                <div className="h-56 w-full p-6">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialStats.topServices} layout="vertical" margin={{ left: 40, right: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{fontSize: 11, fontWeight: 'bold'}} width={150} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
                      </BarChart>
                   </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* --- OPERATIONAL VIEW --- */}
        {activeTab === 'operational' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Total Volume" value={operationalStats.total} subtitle="Appointments scheduled" icon={Calendar} colorClass="bg-blue-500" />
              <StatCard title="Fulfillment Rate" value={`${operationalStats.completionRate}%`} subtitle="Completed consultations" icon={UserCheck} colorClass="bg-emerald-500" />
              <StatCard title="Busiest Service" value={operationalStats.deptRank[0]?.name || '-'} subtitle="Primary demand driver" icon={BarChart3} colorClass="bg-orange-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card title="Department Utilization Split">
                <div className="h-64 w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={operationalStats.deptRank} cx="50%" cy="50%" outerRadius={80} dataKey="value" label>
                        {operationalStats.deptRank.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="Medical Staff Performance (Consultations)">
                <div className="h-64 w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalStats.doctorRank}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* --- DEMOGRAPHICS VIEW --- */}
        {activeTab === 'demographics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard title="Registry Size" value={patientStats.total} subtitle="Total registered patients" icon={Users} colorClass="bg-blue-500" />
              <StatCard title="Acquisition" value={patientStats.newCount} subtitle="New registrations in period" icon={FilePlus} colorClass="bg-emerald-500" trend={8} />
              <StatCard title="Primary Segment" value={patientStats.ageDist.sort((a,b)=>b.value-a.value)[0]?.name || '-'} subtitle="Largest patient base" icon={Layers} colorClass="bg-violet-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2" title="Daily Growth Trend">
                 <div className="h-64 w-full p-4">
                    <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={patientStats.growthTrend}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                          <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
                       </LineChart>
                    </ResponsiveContainer>
                 </div>
              </Card>

              <Card className="!p-0" title="Patient Age Groups">
                <div className="h-64 w-full p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={patientStats.ageDist} cx="50%" cy="50%" innerRadius={50} outerRadius={65} paddingAngle={5} dataKey="value">
                        {patientStats.ageDist.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* --- ACTIVITY STREAM --- */}
        {activeTab === 'activity' && (
          <Card className="!p-0 overflow-hidden" title="Recent Hospital Events Log">
             <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {activityStream.length === 0 ? (
                  <div className="p-20 text-center text-slate-400 font-medium">No activity recorded for this period.</div>
                ) : (
                  activityStream.map((act, i) => (
                    <div 
                      key={act.id} 
                      onClick={() => openEventDetails(act)}
                      className="flex gap-4 p-5 items-start hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer group/item animate-in slide-in-from-bottom-2 duration-300"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                       <div className={`p-3 rounded-xl shrink-0 transition-transform group-hover/item:scale-110 ${
                         act.type === 'patient' ? 'bg-blue-100 text-blue-600' : 
                         act.type === 'appointment' ? 'bg-violet-100 text-violet-600' : 
                         'bg-emerald-100 text-emerald-600'
                       }`}>
                          {act.type === 'patient' ? <Users size={20}/> : act.type === 'appointment' ? <Calendar size={20}/> : <CreditCard size={20}/>}
                       </div>
                       <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start">
                             <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover/item:text-primary-600 transition-colors">{act.name}</h4>
                             <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap uppercase tracking-widest">{new Date(act.date).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                             {(act as any).sub && <span className="font-bold text-slate-700 dark:text-slate-300">{(act as any).sub} • </span>}
                             {act.meta}
                          </p>
                       </div>
                       <div className="self-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <ChevronRight className="text-slate-300" size={18} />
                       </div>
                    </div>
                  ))
                )}
             </div>
          </Card>
        )}
      </div>

      <style>{`
        @media print {
          body * { display: none !important; }
          .print-content, .print-content * { display: block !important; visibility: visible !important; }
          .print-content { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            background: white !important;
            padding: 40px !important;
            margin: 0 !important;
          }
          .no-print { display: none !important; }
          .Card { border: 1px solid #eee !important; box-shadow: none !important; margin-bottom: 20px; page-break-inside: avoid; }
          header, aside { display: none !important; }
        }
      `}</style>
    </div>
  );
};

const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('active') || s.includes('regis')) return 'green';
  if (s.includes('pending') || s.includes('waiting') || s.includes('reserved')) return 'yellow';
  if (s.includes('cancelled') || s.includes('refunded') || s.includes('overdue')) return 'red';
  return 'blue';
};
