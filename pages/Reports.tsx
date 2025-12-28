
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Badge } from '../components/UI';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, 
  Activity, ArrowUpRight, ArrowDownRight, Filter, 
  FilePlus, CreditCard, Printer, ChevronDown, 
  Landmark, Layers, 
  BarChart3, Stethoscope, Search, CalendarDays, Clock, CheckCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const Reports = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'financial' | 'operational' | 'demographics'>('financial');
  const [rangeType, setRangeType] = useState('30');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  const [bills, setBills] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);

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

  const filterByDate = (data: any[], dateField: string) => data.filter(item => {
    if (!item[dateField]) return false;
    const d = new Date(item[dateField]);
    return d >= dateRange.start && d <= dateRange.end;
  });

  const translateType = (type: string) => {
    const key = `patients_modal_action_${type.toLowerCase().replace('-up', 'Up')}`;
    const translation = t(key);
    return translation === key ? type : translation;
  };

  // --- ANALYTICS CALCULATIONS ---

  const financialStats = useMemo(() => {
    const fb = filterByDate(bills, 'date');
    const ft = filterByDate(transactions, 'date');
    
    const trMap = new Map();
    fb.forEach(b => {
      const key = new Date(b.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
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
  }, [bills, transactions, dateRange, language]);

  const operationalStats = useMemo(() => {
    const fa = filterByDate(appointments, 'datetime');
    const deptMap: Record<string, number> = {};
    const doctorMap: Record<string, number> = {};
    
    fa.forEach(a => {
      const translatedType = translateType(a.type);
      deptMap[translatedType] = (deptMap[translatedType] || 0) + 1;
      doctorMap[a.staffName] = (doctorMap[a.staffName] || 0) + 1;
    });

    const completionRate = fa.length ? Math.round((fa.filter(a => a.status === 'completed').length / fa.length) * 100) : 0;

    return {
      total: fa.length,
      completionRate,
      deptRank: Object.entries(deptMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5),
      doctorRank: Object.entries(doctorMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5)
    };
  }, [appointments, dateRange, language]);

  const patientStats = useMemo(() => {
    const fp = filterByDate(patients, 'createdAt');
    
    const growthMap = new Map();
    fp.forEach(p => {
        const key = new Date(p.createdAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' });
        growthMap.set(key, (growthMap.get(key) || 0) + 1);
    });

    const male = fp.filter(p => p.gender === 'male').length;
    const female = fp.filter(p => p.gender === 'female').length;

    const pediatric = fp.filter(p => p.age < 18).length;
    const adult = fp.filter(p => p.age >= 18 && p.age < 60).length;
    const senior = fp.filter(p => p.age >= 60).length;

    return {
      total: patients.length,
      newCount: fp.length,
      growthTrend: Array.from(growthMap).map(([name, count]) => ({ name, count })),
      genderSplit: [
        { name: t('patients_modal_form_gender_male'), value: male },
        { name: t('patients_modal_form_gender_female'), value: female }
      ],
      ageDist: [
        { name: t('reports_segment_pediatric'), value: pediatric },
        { name: t('reports_segment_adult'), value: adult },
        { name: t('reports_segment_senior'), value: senior }
      ]
    };
  }, [patients, dateRange, t, language]);

  const handleExportCSV = () => {
    const headers = [t('records_table_type'), t('billing_table_header_amount'), t('records_table_context')];
    let rows: any[][] = [];
    const dateStr = `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`;

    if (activeTab === 'financial') {
        rows = [
            [t('reports_stat_gross_revenue'), financialStats.totalRevenue, dateStr],
            [t('reports_stat_net_profit'), financialStats.netProfit, dateStr],
            [t('reports_stat_outstanding'), financialStats.outstanding, dateStr]
        ];
    } else if (activeTab === 'demographics') {
        rows = [
            [t('reports_stat_registry_size'), patientStats.total, t('records_filter_all')],
            [t('reports_stat_acquisition'), patientStats.newCount, dateStr]
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

  const HeaderActions = useMemo(() => (
    <div className="relative no-print" ref={exportMenuRef}>
      <Button variant="primary" icon={Download} onClick={() => setShowExportMenu(!showExportMenu)}>
        {t('reports_export_button')} <ChevronDown size={14} className={`ml-2 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
      </Button>
      {showExportMenu && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => { window.print(); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left">
            <Printer size={16} className="text-primary-500" />
            <div className="flex flex-col">
              <span className="font-bold">{t('records_export_pdf')}</span>
              <span className="text-[10px] text-slate-400">{t('reports_export_pdf_desc')}</span>
            </div>
          </button>
          <button onClick={handleExportCSV} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-slate-100 dark:border-slate-700 text-left">
            <Landmark size={16} className="text-emerald-600" />
            <div className="flex flex-col">
              <span className="font-bold">{t('records_export_csv')}</span>
              <span className="text-[10px] text-slate-400">{t('reports_export_csv_desc')}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  ), [showExportMenu, t]);

  useHeader(t('reports_title'), t('reports_subtitle'), HeaderActions);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [b, a, p, t_data] = await Promise.all([
            api.getBills(), 
            api.getAppointments(), 
            api.getPatients(), 
            api.getTransactions()
        ]);
        setBills(b || []); 
        setAppointments(a || []); 
        setPatients(p || []); 
        setTransactions(t_data || []); 
      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, trend }: any) => (
    <Card className="!p-5 bg-white dark:bg-slate-800 shadow-soft border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 group print:shadow-none print:border">
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${colorClass} text-white shadow-xl transition-transform group-hover:scale-110 print:shadow-none print:text-black print:bg-gray-100`}>
          <Icon size={24} />
        </div>
        {trend !== undefined && (
           <div className={`flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/30'} print:hidden`}>
              {trend > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>}
              {Math.abs(trend)}%
           </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{value}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-2 font-bold">{subtitle}</p>}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-2xl font-bold mb-2">AllCare HMS - {t(activeTab === 'financial' ? 'reports_tab_financial' : activeTab === 'operational' ? 'reports_tab_operational' : 'reports_tab_demographics')} Report</h1>
        <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-center bg-white dark:bg-slate-800 p-2 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm gap-3 no-print">
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl shrink-0 w-full lg:w-auto overflow-x-auto">
          {[
              { id: 'financial', label: t('reports_tab_financial'), icon: DollarSign },
              { id: 'operational', label: t('reports_tab_operational'), icon: Activity },
              { id: 'demographics', label: t('reports_tab_demographics'), icon: Users }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id as any)} 
              className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 shadow-sm text-primary-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              <tab.icon size={14}/> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-center w-full lg:w-auto px-2">
          <div className="relative group w-full sm:w-48">
            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 w-4 h-4" />
            <select 
              className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all cursor-pointer appearance-none" 
              value={rangeType} 
              onChange={e => setRangeType(e.target.value)}
            >
              <option value="7">{t('reports_time_week')}</option>
              <option value="30">{t('reports_time_month')}</option>
              <option value="90">{t('reports_filter_quarterly')}</option>
              <option value="custom">{t('reports_time_custom')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
          </div>
          {rangeType === 'custom' && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 w-full sm:w-auto">
              <Input type="date" value={customRange.start} onChange={e => setCustomRange({...customRange, start: e.target.value})} className="!py-2 !text-xs shadow-none w-full sm:w-36" />
              <span className="text-slate-400 font-bold">-</span>
              <Input type="date" value={customRange.end} onChange={e => setCustomRange({...customRange, end: e.target.value})} className="!py-2 !text-xs shadow-none w-full sm:w-36" />
            </div>
          )}
        </div>
      </div>

      <div className="print:block animate-in fade-in duration-500">
        {/* --- FINANCIAL VIEW --- */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-2">
              <StatCard title={t('reports_stat_net_profit')} value={`$${financialStats.netProfit.toLocaleString()}`} subtitle={t('reports_stat_net_subtitle')} icon={TrendingUp} colorClass={financialStats.netProfit >= 0 ? "bg-emerald-500" : "bg-rose-500"} trend={15} />
              <StatCard title={t('reports_stat_gross_revenue')} value={`$${financialStats.totalRevenue.toLocaleString()}`} subtitle={t('reports_stat_gross_subtitle')} icon={CreditCard} colorClass="bg-blue-600" trend={8} />
              <StatCard title={t('reports_stat_outstanding')} value={`$${financialStats.outstanding.toLocaleString()}`} subtitle={t('reports_stat_outstanding_subtitle')} icon={Clock} colorClass="bg-orange-500" trend={-2} />
              <StatCard title={t('reports_stat_avg_patient')} value={`$${financialStats.avgInvoice.toLocaleString()}`} subtitle={t('reports_stat_avg_subtitle')} icon={Layers} colorClass="bg-violet-600" trend={5} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
              <Card className="lg:col-span-2 !p-0 print:border print:shadow-none" title={t('reports_chart_revenue_trend')}>
                <div className="h-72 w-full p-4 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialStats.revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary-500)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--primary-500)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)', backgroundColor: '#fff', fontSize: '12px' }} />
                      <Area type="monotone" name={t('reports_stat_gross_revenue')} dataKey="value" stroke="var(--primary-500)" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="!p-0 print:border print:shadow-none" title={t('reports_chart_income_method')}>
                <div className="h-72 w-full p-4 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={financialStats.incomeByMethod} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                        {financialStats.incomeByMethod.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="lg:col-span-3 !p-0 print:border print:shadow-none" title={t('reports_chart_top_services')}>
                <div className="h-64 w-full p-6 print:h-auto">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialStats.topServices} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: '800', fill: '#64748b'}} width={150} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} cursor={{fill: 'rgba(0,0,0,0.02)'}} formatter={(val: number) => `$${val.toLocaleString()}`} />
                        <Bar dataKey="value" name={t('billing_table_header_amount')} fill="var(--primary-500)" radius={[0, 8, 8, 0]} barSize={24}>
                          {financialStats.topServices.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Bar>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
              <StatCard title={t('reports_stat_total_volume')} value={operationalStats.total} subtitle={t('reports_stat_volume_subtitle')} icon={Calendar} colorClass="bg-indigo-600" trend={12} />
              <StatCard title={t('reports_stat_fulfillment_rate')} value={`${operationalStats.completionRate}%`} subtitle={t('reports_stat_fulfillment_subtitle')} icon={CheckCircle} colorClass="bg-emerald-600" trend={3} />
              <StatCard title={t('reports_stat_busiest_service')} value={operationalStats.deptRank[0]?.name || '-'} subtitle={t('reports_stat_busiest_subtitle')} icon={BarChart3} colorClass="bg-amber-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:space-y-6">
              <Card title={t('reports_chart_dept_utilization')} className="print:border print:shadow-none">
                <div className="h-72 w-full p-4 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={operationalStats.deptRank} cx="50%" cy="50%" outerRadius={90} dataKey="value" labelLine={false} label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {operationalStats.deptRank.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title={t('reports_chart_staff_performance')} className="print:border print:shadow-none">
                <div className="h-72 w-full p-4 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalStats.doctorRank} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" name={t('nav_appointments')} fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={32}>
                         {operationalStats.doctorRank.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
              <StatCard title={t('reports_stat_registry_size')} value={patientStats.total} subtitle={t('reports_stat_registry_subtitle')} icon={Users} colorClass="bg-blue-600" trend={5} />
              <StatCard title={t('reports_stat_acquisition')} value={patientStats.newCount} subtitle={t('reports_stat_acquisition_subtitle')} icon={FilePlus} colorClass="bg-emerald-600" trend={18} />
              <StatCard title={t('reports_stat_primary_segment')} value={patientStats.ageDist.sort((a,b)=>b.value-a.value)[0]?.name || '-'} subtitle={t('reports_stat_segment_subtitle')} icon={Layers} colorClass="bg-violet-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:space-y-6">
              <Card className="lg:col-span-2 print:border print:shadow-none" title={t('reports_chart_growth_trend')}>
                 <div className="h-72 w-full p-4 print:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={patientStats.growthTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                          <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                          <YAxis tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.1)' }} />
                          <Area type="monotone" name={t('records_type_patient')} dataKey="count" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorGrowth)" />
                       </AreaChart>
                    </ResponsiveContainer>
                 </div>
              </Card>

              <Card className="!p-0 print:border print:shadow-none" title={t('reports_chart_age_groups')}>
                <div className="h-72 w-full p-4 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={patientStats.ageDist} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value">
                        {patientStats.ageDist.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} strokeWidth={0} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
