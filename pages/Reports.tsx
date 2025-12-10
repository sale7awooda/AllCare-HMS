
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Select } from '../components/UI';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, Users, Calendar, DollarSign, Download, 
  Activity, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight, Filter, CheckCircle,
  FilePlus, ClipboardList
} from 'lucide-react';
import { api } from '../services/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export const Reports = () => {
  const [activeTab, setActiveTab] = useState<'financial' | 'operational' | 'demographics' | 'records'>('financial');
  const [timeRange, setTimeRange] = useState('30');
  const [loading, setLoading] = useState(true);
  
  // Raw Data
  const [bills, setBills] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [b, a, p] = await Promise.all([
          api.getBills(),
          api.getAppointments(),
          api.getPatients()
        ]);
        setBills(Array.isArray(b) ? b : []);
        setAppointments(Array.isArray(a) ? a : []);
        setPatients(Array.isArray(p) ? p : []);
      } catch (e) {
        console.error("Failed to load report data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Aggregation Logic ---

  const financialStats = useMemo(() => {
    const totalRevenue = bills.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
    const pendingAmount = bills.reduce((sum, b) => sum + ((b.totalAmount || 0) - (b.paidAmount || 0)), 0);
    const totalInvoices = bills.length;
    
    // Revenue Trend (Daily)
    const trendMap = new Map();
    bills.forEach(b => {
      const date = new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap.set(date, (trendMap.get(date) || 0) + (b.paidAmount || 0));
    });
    const revenueTrend = Array.from(trendMap).map(([name, value]) => ({ name, value })).slice(-parseInt(timeRange));

    // Status Distribution
    const statusCounts = bills.reduce((acc: any, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    const statusDist = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

    return { totalRevenue, pendingAmount, totalInvoices, revenueTrend, statusDist };
  }, [bills, timeRange]);

  const operationalStats = useMemo(() => {
    const totalAppts = appointments.length;
    const completedAppts = appointments.filter(a => a.status === 'completed').length;
    
    // Appointments by Doctor
    const doctorCounts = appointments.reduce((acc: any, a) => {
      acc[a.staffName] = (acc[a.staffName] || 0) + 1;
      return acc;
    }, {});
    const doctorPerformance = Object.keys(doctorCounts)
      .map(key => ({ name: key.split(' ')[1] || key, value: doctorCounts[key] })) // Last name only for chart
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Appointments by Status
    const statusCounts = appointments.reduce((acc: any, a) => {
      const status = a.status === 'in_progress' ? 'active' : a.status;
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
    const statusDist = Object.keys(statusCounts).map(key => ({ name: key, value: statusCounts[key] }));

    return { totalAppts, completedAppts, doctorPerformance, statusDist };
  }, [appointments]);

  const demographicStats = useMemo(() => {
    const totalPatients = patients.length;
    
    // Gender
    const genderCounts = patients.reduce((acc: any, p) => {
      const g = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : 'Unknown';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});
    const genderDist = Object.keys(genderCounts).map(key => ({ name: key, value: genderCounts[key] }));

    // Age Groups
    const ageGroups = { '0-12': 0, '13-18': 0, '19-35': 0, '36-60': 0, '60+': 0 };
    patients.forEach(p => {
      if (p.age <= 12) ageGroups['0-12']++;
      else if (p.age <= 18) ageGroups['13-18']++;
      else if (p.age <= 35) ageGroups['19-35']++;
      else if (p.age <= 60) ageGroups['36-60']++;
      else ageGroups['60+']++;
    });
    const ageDist = Object.keys(ageGroups).map(key => ({ name: key, value: ageGroups[key as keyof typeof ageGroups] }));

    return { totalPatients, genderDist, ageDist };
  }, [patients]);

  const recordsStats = useMemo(() => {
    const now = new Date();
    const days = parseInt(timeRange);
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - days);

    // Filter data by date range
    const filteredPatients = patients.filter(p => new Date(p.createdAt || new Date()) >= startDate);
    const filteredAppts = appointments.filter(a => new Date(a.datetime) >= startDate);
    const filteredBills = bills.filter(b => new Date(b.date) >= startDate);

    // Daily Trend Compilation
    const dailyData: Record<string, any> = {};
    
    // Initialize days to ensure continuous chart
    for(let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dailyData[key] = { name: key, patients: 0, appointments: 0, bills: 0, dateObj: d };
    }

    filteredPatients.forEach(p => {
        const key = new Date(p.createdAt || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if(dailyData[key]) dailyData[key].patients++;
    });
    filteredAppts.forEach(a => {
        const key = new Date(a.datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if(dailyData[key]) dailyData[key].appointments++;
    });
    filteredBills.forEach(b => {
        const key = new Date(b.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if(dailyData[key]) dailyData[key].bills++;
    });

    const chartData = Object.values(dailyData).sort((a: any, b: any) => a.dateObj.getTime() - b.dateObj.getTime());

    // Recent Activity Feed
    const activity = [
        ...filteredPatients.map(p => ({ 
            type: 'Patient', 
            text: `New Patient: ${p.fullName}`, 
            subtext: `ID: ${p.patientId}`,
            date: p.createdAt || new Date(), 
            id: `p-${p.id}`, 
            icon: Users, 
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' 
        })),
        ...filteredAppts.map(a => ({ 
            type: 'Appointment', 
            text: `Appointment: ${a.patientName}`, 
            subtext: `Dr. ${a.staffName} (${a.type})`,
            date: a.datetime, 
            id: `a-${a.id}`, 
            icon: Calendar, 
            color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400' 
        })),
        ...filteredBills.map(b => ({ 
            type: 'Bill', 
            text: `Invoice #${b.billNumber}`, 
            subtext: `$${b.totalAmount.toLocaleString()} (${b.status})`,
            date: b.date, 
            id: `b-${b.id}`, 
            icon: DollarSign, 
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400' 
        }))
    ].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);

    return {
        counts: {
            patients: filteredPatients.length,
            appointments: filteredAppts.length,
            bills: filteredBills.length
        },
        chartData,
        activity
    };
  }, [patients, appointments, bills, timeRange]);

  const handleExport = () => {
    // Simple CSV Export Mock
    const headers = ['Report', 'Date', 'Total Revenue', 'Total Patients'];
    const row = [activeTab, new Date().toLocaleDateString(), financialStats.totalRevenue, demographicStats.totalPatients];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), row.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `allcare_report_${activeTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return <div className="flex justify-center items-center h-96 text-slate-400">Generating analytics...</div>;

  const StatCard = ({ title, value, icon: Icon, color, subtext }: any) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-start justify-between">
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics & Reports</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Comprehensive insights into hospital performance.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
             <select 
               className="pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary-500 outline-none appearance-none text-slate-700 dark:text-slate-200"
               value={timeRange}
               onChange={e => setTimeRange(e.target.value)}
             >
               <option value="7">Last 7 Days</option>
               <option value="30">Last 30 Days</option>
               <option value="90">Last 3 Months</option>
             </select>
          </div>
          <Button variant="outline" icon={Download} onClick={handleExport}>Export</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-4 pt-2 overflow-x-auto">
        {[
          { id: 'financial', label: 'Financial', icon: DollarSign },
          { id: 'operational', label: 'Operational', icon: Activity },
          { id: 'demographics', label: 'Demographics', icon: Users },
          { id: 'records', label: 'New Records', icon: FilePlus },
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
                title="Total Revenue" 
                value={`$${financialStats.totalRevenue.toLocaleString()}`} 
                icon={DollarSign} 
                color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                subtext={<span className="text-emerald-600 font-bold flex items-center gap-1"><ArrowUpRight size={12}/> +12.5% vs last period</span>}
              />
              <StatCard 
                title="Outstanding" 
                value={`$${financialStats.pendingAmount.toLocaleString()}`} 
                icon={TrendingUp} 
                color="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                subtext={<span className="text-slate-400">Across {financialStats.totalInvoices} invoices</span>}
              />
              <StatCard 
                title="Avg. Invoice" 
                value={`$${Math.round(financialStats.totalRevenue / (financialStats.totalInvoices || 1)).toLocaleString()}`} 
                icon={PieChartIcon} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">Revenue Trend</h3>
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
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: '#fff', color: '#1e293b' }} />
                      <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">Invoice Status</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financialStats.statusDist}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {financialStats.statusDist.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OPERATIONAL REPORT */}
        {activeTab === 'operational' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard 
                title="Total Appointments" 
                value={operationalStats.totalAppts} 
                icon={Calendar} 
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
              />
              <StatCard 
                title="Completion Rate" 
                value={`${Math.round((operationalStats.completedAppts / (operationalStats.totalAppts || 1)) * 100)}%`} 
                icon={CheckCircle} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                subtext={<span className="text-slate-400">{operationalStats.completedAppts} completed visits</span>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">Doctor Workload</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={operationalStats.doctorPerformance} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{fill: '#64748b', fontSize: 12}} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">Appointment Status</h3>
                <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                   <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={operationalStats.statusDist}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {operationalStats.statusDist.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
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
                  title="Registered Patients" 
                  value={demographicStats.totalPatients} 
                  icon={Users} 
                  color="bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
               />
               <StatCard 
                  title="New This Month" 
                  value={patients.filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth()).length} 
                  icon={ArrowUpRight} 
                  color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
               />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               <div className="space-y-4">
                  <h3 className="font-bold text-slate-800 dark:text-white">Age Distribution</h3>
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
                  <h3 className="font-bold text-slate-800 dark:text-white">Gender Split</h3>
                  <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={demographicStats.genderDist}
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="value"
                          paddingAngle={5}
                        >
                          {demographicStats.genderDist.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#ec4899'} />
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
                title="New Patients" 
                value={recordsStats.counts.patients} 
                icon={Users} 
                color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                subtext={<span className="text-slate-400">Newly registered in period</span>}
              />
              <StatCard 
                title="New Appointments" 
                value={recordsStats.counts.appointments} 
                icon={Calendar} 
                color="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
                subtext={<span className="text-slate-400">Total bookings created</span>}
              />
              <StatCard 
                title="New Invoices" 
                value={recordsStats.counts.bills} 
                icon={DollarSign} 
                color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                subtext={<span className="text-slate-400">Bills generated</span>}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-bold text-slate-800 dark:text-white">Growth Trend</h3>
                <div className="h-96 w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={recordsStats.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" className="dark:stroke-slate-700" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
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
                <h3 className="font-bold text-slate-800 dark:text-white">Recent Records Stream</h3>
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
