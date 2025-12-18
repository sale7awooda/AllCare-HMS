
import React, { useEffect, useState, useMemo } from 'react';
import { Card, Button, Badge } from '../components/UI';
import { api } from '../services/api';
import { 
  Users, Calendar, Activity, Bed, Clock, TrendingUp, 
  Wallet, Plus, FlaskConical, AlertCircle, ArrowRight, CheckCircle
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
  const { t } = useTranslation();
  
  // Stats State
  const [stats, setStats] = useState({ 
    patients: 0, 
    todayAppointments: 0, 
    totalRevenue: 0,
    outstandingRevenue: 0,
    occupancyRate: 0,
    activeAdmissions: 0
  });
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [bedDetails, setBedDetails] = useState({ general: {total:0, free:0}, private: {total:0, free:0}, icu: {total:0, free:0} });
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);

  // Sync Header
  useHeader(
    t('dashboard_title'), 
    t('dashboard_subtitle'),
    <Button variant="secondary" size="sm" icon={Clock} className="cursor-default pointer-events-none">{new Date().toLocaleDateString()}</Button>
  );

  const loadDashboardData = async () => {
    try {
      const [pts, apts, bills, bedsData, labs, staffData] = await Promise.all([
        api.getPatients(),
        api.getAppointments(),
        api.getBills(),
        api.getBeds(),
        api.getPendingLabRequests(),
        api.getStaff()
      ]);

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
      console.error("Dashboard data load failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboardData(); }, [t]);

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-lg transition-all duration-300 h-[100px] animate-in fade-in slide-in-from-bottom-2">
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('dashboard_loading_text')}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard_stat_total_patients')} value={stats.patients.toLocaleString()} icon={Users} trend="+5.2%" colorClass="from-blue-500 to-blue-600" />
        <StatCard title={t('dashboard_stat_today_appts')} value={stats.todayAppointments} subtext={t('dashboard_stat_appts_subtext')} icon={Calendar} colorClass="from-violet-500 to-violet-600" />
        <StatCard title={t('dashboard_stat_revenue')} value={`$${stats.totalRevenue.toLocaleString()}`} subtext={t('dashboard_stat_revenue_subtext', { amount: `$${stats.outstandingRevenue.toLocaleString()}` })} icon={Wallet} colorClass="from-emerald-500 to-emerald-600" />
        <StatCard title={t('dashboard_stat_occupancy')} value={`${stats.occupancyRate}%`} subtext={t('dashboard_stat_occupancy_subtext', { count: stats.activeAdmissions })} icon={Bed} trend={stats.occupancyRate > 80 ? t('dashboard_stat_occupancy_high') : undefined} colorClass="from-rose-500 to-rose-600" />
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
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center animate-in zoom-in-95">
                        <CheckCircle size={48} className="mb-2 text-green-100 dark:text-green-900/30" />
                        <p>{t('dashboard_feed_empty')}</p>
                        <p className="text-xs">{t('dashboard_feed_empty_subtext')}</p>
                    </div>
                ) : (
                    pendingTasks.map((task, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-primary-200 transition-colors cursor-pointer animate-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${i * 100}ms` }} onClick={() => navigate(task.type === 'lab' ? '/laboratory' : '/billing')}>
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
                                <div className={`h-full transition-all duration-500 ${type.color === 'blue' ? 'bg-blue-500' : type.color === 'violet' ? 'bg-violet-500' : 'bg-rose-500'}`} style={{ width: `${type.stats.total ? ((type.stats.total - type.stats.free) / type.stats.total) * 100 : 0}%` }} />
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
    </div>
  );
};
