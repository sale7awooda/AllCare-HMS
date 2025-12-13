
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Select, Input } from '../components/UI';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, 
  Activity, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Filter, CheckCircle,
  FilePlus, ClipboardList, Briefcase, Clock, CreditCard, Shield
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const Reports = () => {
  const [activeTab, setActiveTab] = useState<'financial' | 'operational' | 'demographics' | 'records'>('financial');
  
  // Date State
  const [rangeType, setRangeType] = useState('30'); // '7', '30', '90', '180', '365', 'custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  
  // Raw Data
  const [bills, setBills] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [b, a, p, t, s] = await Promise.all([
          api.getBills(),
          api.getAppointments(),
          api.getPatients(),
          api.getTransactions(),
          api.getStaff()
        ]);
        setBills(Array.isArray(b) ? b : []);
        setAppointments(Array.isArray(a) ? a : []);
        setPatients(Array.isArray(p) ? p : []);
        setTransactions(Array.isArray(t) ? t : []);
        setStaff(Array.isArray(s) ? s : []);
      } catch (e) {
        console.error("Failed to load report data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Date Logic ---
  const dateRange = useMemo(() => {
    if (rangeType === 'custom') {
        const startDate = customRange.start ? new Date(customRange.start + 'T00:00:00') : new Date(0); 
        const endDate = customRange.end ? new Date(customRange.end + 'T23:59:59.999') : new Date();
        return { start: startDate, end: endDate };
    }

    const end = new Date(); // Today
    const start = new Date();
    const days = parseInt(rangeType);
    start.setDate(end.getDate() - days);
    // Reset hours for accurate comparison
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);
    
    return { start, end };
  }, [rangeType, customRange]);

  const filterByDate = (data: any[], dateField: string) => {
    return data.filter(item => {
        if (!item[dateField]) return false;
        const d = new Date(item[dateField]);
        return d >= dateRange.start && d <= dateRange.end;
    });
  };

  // --- Aggregation Logic ---

  const financialStats = useMemo(() => {
    const filteredBills = filterByDate(bills, 'date');
    const filteredTrans = filterByDate(transactions, 'date');

    const totalRevenue = filteredBills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const totalBilled = filteredBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const pendingAmount = Math.max(0, totalBilled - totalRevenue);
    const totalInvoices = filteredBills.length;
    
    // Revenue Trend (Daily)
    const trendMap = new Map();
    // Fill in dates for the range (up to 30 points to avoid clutter, or aggregate if large range)
    const daySpan = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 3600 * 24));
    const isLargeRange = daySpan > 60;

    filteredBills.forEach(b => {
      const d = new Date(b.date);
      // Group by Month if range > 60 days, else Day
      const key = isLargeRange 
        ? d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      trendMap.set(key, (trendMap.get(key) || 0) + (b.paidAmount || 0));
    });
    
    // Convert map to array and sort by date would be ideal, but for now relies on map insertion order roughly or sort keys
    const revenueTrend = Array.from(trendMap).map(([name, value]) => ({ name, value }));

    // Status Distribution
    const statusCounts = filteredBills.reduce((acc: any, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    const statusDist = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

    // Payment Methods Breakdown (from Transactions)
    const methodCounts = filteredTrans.filter((t: any) => t.type === 'income').reduce((acc: any, t: any) => {
        const m = t.method || 'Unknown';
        acc[m] = (acc[m] || 0) + t.amount;
        return acc;
    }, {});
    const methodDist = Object.keys(methodCounts).map(key => ({ name: key, value: methodCounts[key] }));

    // Top Services (from Bill Items)
    // We need to parse bill items. Since bills state already has items attached from controller:
    const serviceCounts: Record<string, number> = {};
    filteredBills.forEach(b => {
        b.items?.forEach((item: any) => {
            // Simple grouping by first 2 words to aggregate similar services
            const name = item.description.split(':').pop()?.trim() || item.description;
            serviceCounts[name] = (serviceCounts[name] || 0) + item.amount;
        });
    });
    const topServices = Object.entries(serviceCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a,b) => b.value - a.value)
        .slice(0, 5);

    return { totalRevenue, pendingAmount, totalInvoices, revenueTrend, statusDist, methodDist, topServices };
  }, [bills, transactions, dateRange]);

  const operationalStats = useMemo(() => {
    const filteredAppts = filterByDate(appointments, 'datetime');
    const totalAppts = filteredAppts.length;
    const completedAppts = filteredAppts.filter(a => a && a.status === 'completed').length;
    
    // Appointments by Doctor
    const doctorCounts = filteredAppts.reduce((acc: any, a) => {
      if(a && a.staffName) {
        acc[a.staffName] = (acc[a.staffName] || 0) + 1;
      }
      return acc;
    }, {});
    const doctorPerformance = Object.keys(doctorCounts)
      .map(key => ({ name: key.split(' ')[1] || key, value: doctorCounts[key] })) 
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Department Workload
    const deptCounts: Record<string, number> = {};
    filteredAppts.forEach(a => {
        // Find staff to get dept
        const doc = staff.find(s => s.id === a.staffId);
        const dept = doc?.department || 'General';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
    });
    const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    // Peak Hours
    const hourCounts = Array(24).fill(0);
    filteredAppts.forEach(a => {
        const h = new Date(a.datetime).getHours();
        hourCounts[h]++;
    });
    // Filter to working hours (e.g., 7am to 8pm) to remove empty night slots
    const peakHoursData = hourCounts.map((count, hour) => ({
        name: `${hour}:00`,
        value: count
    })).filter((d, i) => i >= 7 && i <= 20);

    return { totalAppts, completedAppts, doctorPerformance, deptData, peakHoursData };
  }, [appointments, staff, dateRange]);

  const demographicStats = useMemo(() => {
    // Patients created in range (for registration stats)
    // BUT for demographics usually we look at ALL patients or Active patients in range.
    // Let's filter by creation date for "New Registrations" but use ALL for demographics snapshot?
    // User requested "enrich tabs", so usually Demographics reflects the current patient base or those active in period.
    // Let's use Patients Active in Period (Visits or Created)
    
    // Find patient IDs active in this period
    const activePatientIds = new Set([
        ...filterByDate(appointments, 'datetime').map(a => a.patientId),
        ...filterByDate(patients, 'createdAt').map(p => p.id)
    ]);

    const activePatients = patients.filter(p => activePatientIds.has(p.id));
    const totalPatients = activePatients.length;
    
    // Gender
    const genderCounts = activePatients.reduce((acc: any, p) => {
      const g = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'Unknown';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});
    const genderDist = Object.keys(genderCounts).map(key => ({ name: key, value: genderCounts[key] }));

    // Age Groups
    const ageGroups = { '0-12': 0, '13-18': 0, '19-35': 0, '36-60': 0, '60+': 0 };
    activePatients.forEach(p => {
      if (p.age <= 12) ageGroups['0-12']++;
      else if (p.age <= 18) ageGroups['13-18']++;
      else if (p.age <= 35) ageGroups['19-35']++;
      else if (p.age <= 60) ageGroups['36-60']++;
      else ageGroups['60+']++;
    });
    const ageDist = Object.keys(ageGroups).map(key => ({ name: key, value: ageGroups[key as keyof typeof ageGroups] }));

    // Insurance Distribution
    const insuranceCounts = activePatients.reduce((acc: any, p) => {
        if (p.hasInsurance && p.insuranceDetails?.provider) {
            acc[p.insuranceDetails.provider] = (acc[p.insuranceDetails.provider] || 0) + 1;
        } else {
            acc['Self Pay'] = (acc['Self Pay'] || 0) + 1;
        }
        return acc;
    }, {});
    const insuranceDist = Object.entries(insuranceCounts)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a,b) => b.value - a.value);

    return { totalPatients, genderDist, ageDist, insuranceDist };
  }, [patients, appointments, dateRange]);

  const recordsStats = useMemo(() => {
    const filteredPatients = filterByDate(patients, 'createdAt');
    const filteredAppts = filterByDate(appointments, 'datetime');
    const filteredBills = filterByDate(bills, 'date');

    // Recent Activity Feed
    const activity = [
        ...filteredPatients.map(p => ({ 
            type: 'Patient', 
            text: t('report_activity_patient_new', {name: p.fullName}), 
            subtext: `ID: ${p.patientId}`,
            date: p.createdAt, 
            id: `p-${p.id}`, 
            icon: Users, 
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' 
        })),
        ...filteredAppts.map(a => ({ 
            type: 'Appointment', 
            text: t('report_activity_appt_new', {patient: a.patientName}), 
            subtext: `Dr. ${a.staffName} (${a.type})`,
            date: a.datetime, 
            id: `a-${a.id}`, 
            icon: Calendar, 
            color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400' 
        })),
        ...filteredBills.map(b => ({ 
            type: 'Bill', 
            text: t('report_activity_bill_new', {number: b.billNumber}), 
            subtext: `$${b.totalAmount.toLocaleString()} (${b.status})`,
            date: b.date, 
            id: `b-${b.id}`, 
            icon: DollarSign, 
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' 
        }))
    ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);

    return {
        counts: {
            patients: filteredPatients.length,
            appointments: filteredAppts.length,
            bills: filteredBills.length
        },
        activity
    };
  }, [patients, appointments, bills, dateRange, t]);

  const handleExport = () => {
    const headers = ['Report', 'Start Date', 'End Date', 'Total Revenue', 'Total Patients'];
    const row = [activeTab, dateRange.start.toLocaleDateString(), dateRange.end.toLocaleDateString(), financialStats.totalRevenue, demographicStats.totalPatients];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `allcare_report_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex justify-center items-center h-96 text-slate-400">{t('loading')}</div>;

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between hover:shadow-md transition-shadow">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('reports_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports_subtitle')}</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
             <select 
               className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none appearance-none text-slate-700 dark:text-slate-200"
               value={rangeType}
               onChange={e => setRangeType(e.target.value)}
             >
               <option value="7">{t('reports_time_week')}</option>
               <option value="30">{t('reports_time_month')}</option>
               <option value="90">{t('reports_time_3months')}</option>
               <option value="180">{t('reports_time_6months')}</option>
               <option value="365">{t('reports_time_year')}</option>
               <option value="custom">{t('reports_time_custom')}</option>
             </select>
          </div>

          {rangeType === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                  <div className="relative">
                    <span className="absolute -top-2 left-2 bg-white dark:bg-slate-800 px-1 text-[10px] text-slate-400">Start</span>
                    <Input 
                      type="date" 
                      value={customRange.start} 
                      onChange={e => setCustomRange({...customRange, start: e.target.value})} 
                      className="!py-2 !text-sm w-36"
                    />
                  </div>
                  <span className="text-slate-400">-</span>
                  <div className="relative">
                    <span className="absolute -top-2 left-2 bg-white dark:bg-slate-800 px-1 text-[10px] text-slate-400">End</span>
                    <Input 
                      type="date" 
                      value={customRange.end} 
                      onChange={e => setCustomRange({...customRange, end: e.target.value})} 
                      className="!py-2 !text-sm w-36"
                    />
                  </div>
              </div>
          )}

          <Button variant="outline" icon={Download} onClick={handleExport}>{t('reports_export_button')}</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-4 pt-2 overflow-x-auto">
        {[
          { id: 'financial', label: t('reports_tab_financial'), icon: DollarSign },
          { id: 'operational', label: t('reports_tab_operational'), icon: Activity },
          { id: 'demographics', label: t('reports_tab_demographics'), icon: Users },
          { id: 'records', label: t('reports_tab_records'), icon: FilePlus },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap 
              ${activeTab === tab.id 
                ? 'border-primary-600 text-primary-600 bg-primary-50/50 dark:bg-primary-900/20' 
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 border-gray-200 dark:border-slate-700 p-6 min-h-[500px]">
        
        {/* FINANCIAL REPORT */}
        {activeTab === 'financial' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title={t('reports_card_revenue')} 
                value={`$${financialStats.totalRevenue.toLocaleString()}`} 
                icon={DollarSign} 
                color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                subtext={<span className="text-emerald-600 font-bold flex items-center gap-1"><ArrowUpRight size={12}/> Collected</span>}
              />
              <StatCard 
                title={t('reports_card_outstanding')} 
                value={`$${financialStats.pendingAmount.toLocaleString()}`} 
                icon={TrendingUp} 
                color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                subtext={<span className="text-slate-400">Across {financialStats.totalInvoices} invoices</span>}
              />
              <StatCard 
                title={t('reports_card_avg_invoice')}
                value={`$${Math.round(financialStats.totalRevenue / (financialStats.totalInvoices || 1)).toLocaleString()}`} 
                icon={PieChartIcon} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                subtext={<span className="text-slate-400">Per patient visit</span>}
              />
            </div>

            {/* Charts Row 1: Trend & Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Activity size={18} className="text-primary-500"/> {t('reports_chart_revenue_trend')}</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialStats.revenueTrend}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }} />
                      <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><CreditCard size={18} className="text-primary-500"/> Income by Method</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financialStats.methodDist}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {financialStats.methodDist.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => `$${val.toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Charts Row 2: Top Services */}
            <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Briefcase size={18} className="text-primary-500"/> Top Services by Revenue</h3>
                <div className="h-64 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={financialStats.topServices} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                            <YAxis dataKey="name" type="category" width={150} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} />
                            <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(val: number) => `$${val.toLocaleString()}`} />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>
        )}

        {/* OPERATIONAL REPORT */}
        {activeTab === 'operational' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard 
                title={t('reports_card_appointments')} 
                value={operationalStats.totalAppts} 
                icon={Calendar} 
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
              />
              <StatCard 
                title={t('reports_card_completion')}
                value={`${Math.round((operationalStats.completedAppts / (operationalStats.totalAppts || 1)) * 100)}%`} 
                icon={CheckCircle} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                subtext={<span className="text-slate-400">{operationalStats.completedAppts} completed visits</span>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Clock size={18} className="text-primary-500"/> Peak Appointment Hours</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalStats.peakHoursData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                      <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Briefcase size={18} className="text-primary-500"/> {t('reports_chart_doctor_workload')}</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalStats.deptData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DEMOGRAPHICS REPORT */}
        {activeTab === 'demographics' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <StatCard 
                  title="Active Patients (In Period)" 
                  value={demographicStats.totalPatients} 
                  icon={Users} 
                  color="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
               />
               <StatCard 
                  title={t('reports_card_new_this_month')} 
                  value={patients.filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth()).length} 
                  icon={ArrowUpRight} 
                  color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
               />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white">{t('reports_chart_age_dist')}</h3>
                  <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={demographicStats.ageDist}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                        <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} />
                        <YAxis tick={{fill: '#64748b', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Shield size={18} className="text-primary-500"/> Insurance Providers</h3>
                  <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographicStats.insuranceDist}
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={5}
                        >
                          {demographicStats.insuranceDist.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="middle" align="right" layout="vertical" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
               </div>
             </div>
          </div>
        )}

        {/* NEW RECORDS REPORT */}
        {activeTab === 'records' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title={t('reports_card_new_patients')} 
                value={recordsStats.counts.patients} 
                icon={Users} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                subtext={<span className="text-slate-400">Newly registered in period</span>}
              />
              <StatCard 
                title={t('reports_card_new_appointments')} 
                value={recordsStats.counts.appointments} 
                icon={Calendar} 
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                subtext={<span className="text-slate-400">Total bookings created</span>}
              />
              <StatCard 
                title={t('reports_card_new_invoices')} 
                value={recordsStats.counts.bills} 
                icon={DollarSign} 
                color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                subtext={<span className="text-slate-400">Bills generated</span>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">{t('reports_chart_growth_trend')}</h3>
                <div className="h-96 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recordsStats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} minTickGap={30} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }} />
                      <Legend verticalAlign="top" height={36}/>
                      <Line type="monotone" dataKey="patients" name="Patients" stroke="#3b82f6" strokeWidth={3} dot={{r: 3}} />
                      <Line type="monotone" dataKey="appointments" name="Appointments" stroke="#8b5cf6" strokeWidth={3} dot={{r: 3}} />
                      <Line type="monotone" dataKey="bills" name="Bills" stroke="#10b981" strokeWidth={3} dot={{r: 3}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">{t('reports_chart_stream')}</h3>
                <div className="h-96 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 custom-scrollbar">
                  {recordsStats.activity.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">No recent activity found.</div>
                  ) : (
                    <div className="space-y-3">
                      {recordsStats.activity.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700">
                          <div className={`p-2 rounded-full shrink-0 ${item.color}`}>
                            <item.icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{item.text}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtext}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{new Date(item.date).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
