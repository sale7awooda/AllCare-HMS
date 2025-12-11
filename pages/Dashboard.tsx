import React, { useEffect, useState } from 'react';
import { Card, Badge, Button } from '../components/UI';
import { api } from '../services/api';
import { 
  Users, Calendar, Activity, Bed, Clock, TrendingUp, 
  Wallet, Plus, Stethoscope, FlaskConical, AlertCircle, ArrowRight, CheckCircle
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/TranslationContext';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [stats, setStats] = useState({ 
    patients: 0, 
    todayAppointments: 0, 
    totalRevenue: 0,
    outstandingRevenue: 0,
    occupancyRate: 0,
    activeAdmissions: 0
  });
  
  const [departmentData, setDepartmentData] = useState<any[]>([]);
  const [bedDetails, setBedDetails] = useState({ general: {total:0, free:0}, private: {total:0, free:0}, icu: {total:0, free:0} });
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const safeFetch = async (promise: Promise<any>) => {
        try {
          const result = await promise;
          return Array.isArray(result) ? result : [];
        } catch (error) {
          return [];
        }
      };

      try {
        const [pts, apts, bills, beds, labs, staff] = await Promise.all([
          safeFetch(api.getPatients()),
          safeFetch(api.getAppointments()),
          safeFetch(api.getBills()),
          safeFetch(api.getBeds()),
          safeFetch(api.getPendingLabRequests()),
          safeFetch(api.getStaff())
        ]);

        // --- 1. Top Level Stats ---
        const totalRev = bills.reduce((sum: number, b: any) => sum + (b.paidAmount || 0), 0);
        const outstanding = bills.reduce((sum: number, b: any) => sum + ((b.totalAmount || 0) - (b.paidAmount || 0)), 0);
        
        const totalBeds = beds.length || 1;
        const occupiedBeds = beds.filter((b: any) => b.status === 'occupied').length;
        const occupancyRate = Math.round((occupiedBeds / totalBeds) * 100);

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

        // --- 2. Department Workload (Appointments per Dept) ---
        // We map appointments to doctor -> doctor to department
        const deptCounts: Record<string, number> = {};
        apts.forEach((apt: any) => {
           const doctor = staff.find((s: any) => s.id === apt.staffId);
           const dept = doctor?.department || 'General';
           deptCounts[dept] = (deptCounts[dept] || 0) + 1;
        });
        
        const deptChartData = Object.keys(deptCounts).map(dept => ({
          name: dept,
          count: deptCounts[dept]
        })).sort((a,b) => b.count - a.count).slice(0, 5); // Top 5
        setDepartmentData(deptChartData);

        // --- 3. Bed Availability Breakdown ---
        const bedStats = { 
            general: { total: 0, free: 0 }, 
            private: { total: 0, free: 0 }, 
            icu: { total: 0, free: 0 } 
        };
        beds.forEach((b: any) => {
            const type = b.type.toLowerCase() as keyof typeof bedStats;
            if (bedStats[type]) {
                bedStats[type].total++;
                if (b.status === 'available') bedStats[type].free++;
            }
        });
        setBedDetails(bedStats);

        // --- 4. Real Revenue Trend (Last 7 Days) ---
        const normalizeDate = (dateStr: string) => {
            try {
                return new Date(dateStr).toISOString().split('T')[0];
            } catch (e) {
                return '';
            }
        };

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return {
                label: d.toLocaleDateString('en-US', { weekday: 'short' }),
                key: d.toISOString().split('T')[0]
            };
        });

        const trendData = last7Days.map(day => {
            const dayIncome = bills
                .filter((b: any) => normalizeDate(b.date) === day.key)
                .reduce((sum: number, b: any) => sum + (b.paidAmount || 0), 0);
            
            return {
                name: day.label,
                income: dayIncome
            };
        });
        
        setRevenueTrend(trendData);

        // --- 5. "Needs Attention" Feed (Pending Labs + Unpaid Recent Bills) ---
        const recentPendingLabs = labs.filter((l: any) => l.status === 'pending').slice(0, 3).map((l: any) => ({
            type: 'lab',
            title: t('dashboard_feed_lab_title'),
            subtitle: `${l.patientName} - $${l.projected_cost}`,
            id: l.id,
            time: l.created_at
        }));

        const unpaidBills = bills.filter((b: any) => b.status === 'pending').slice(0, 3).map((b: any) => ({
            type: 'bill',
            title: t('dashboard_feed_bill_title'),
            subtitle: `${b.patientName} - $${b.totalAmount}`,
            id: b.id,
            time: b.date
        }));

        setPendingTasks([...recentPendingLabs, ...unpaidBills].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()));

      } catch (error) {
        console.error("Critical error loading dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [t]);

  const StatCard = ({ title, value, subtext, icon: Icon, colorClass, trend }: any) => (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-5 dark:opacity-10 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex flex-col h-full justify-between relative z-10">
        <div className="flex justify-between items-start">
            <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-md`}>
                <Icon className="w-6 h-6" />
            </div>
            {trend && (
                <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                    <TrendingUp size={12} />
                    {trend}
                </div>
            )}
        </div>
        <div className="mt-4">
          <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{value}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{title}</p>
          {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
        </div>
      </div>
    </div>
  );

  const ActionButton = ({ icon: Icon, label, color, onClick }: any) => (
    <button 
      onClick={onClick}
      className={`
        flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all duration-200
        bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-${color}-300 dark:hover:border-${color}-700 hover:bg-${color}-50 dark:hover:bg-${color}-900/20 group
      `}
    >
      <div className={`p-2 rounded-full bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 group-hover:scale-110 transition-transform`}>
        <Icon size={20} />
      </div>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{label}</span>
    </button>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('dashboard_loading_text')}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('dashboard_title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t('dashboard_subtitle')}</p>
        </div>
        <div className="flex gap-3">
             <Button variant="secondary" size="sm" icon={Clock}>{new Date().toLocaleDateString()}</Button>
        </div>
      </div>

      {/* Quick Actions Toolbar */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <ActionButton icon={Plus} label={t('dashboard_action_admission')} color="blue" onClick={() => navigate('/admissions')} />
        <ActionButton icon={Calendar} label={t('dashboard_action_visit')} color="violet" onClick={() => navigate('/appointments')} />
        <ActionButton icon={Users} label={t('dashboard_action_register')} color="emerald" onClick={() => navigate('/patients')} />
        <ActionButton icon={FlaskConical} label={t('dashboard_action_lab')} color="orange" onClick={() => navigate('/patients')} />
        <ActionButton icon={Wallet} label={t('dashboard_action_invoice')} color="pink" onClick={() => navigate('/billing')} />
        <ActionButton icon={Stethoscope} label={t('dashboard_action_schedule')} color="cyan" onClick={() => navigate('/hr')} />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

      {/* Analytics & Operational Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Department Workload (Bar Chart) */}
        <div className="lg:col-span-2">
          <Card title={t('dashboard_chart_workload')} action={<Button size="sm" variant="ghost" onClick={() => navigate('/appointments')}>{t('dashboard_chart_workload_action')}</Button>}>
            <div className="h-80 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }}
                  />
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

        {/* Needs Attention Feed */}
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
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</h4>
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

      {/* Bottom Section: Bed Availability & Financial Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bed Availability Widget */}
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
                                <div 
                                    className={`h-full bg-${type.color}-500 transition-all duration-500`} 
                                    style={{ width: `${type.stats.total ? ((type.stats.total - type.stats.free) / type.stats.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
             </Card>
          </div>

          {/* Financial Trend */}
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