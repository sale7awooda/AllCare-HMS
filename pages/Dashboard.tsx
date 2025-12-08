import React, { useEffect, useState } from 'react';
import { Card, Badge, Button } from '../components/UI';
import { api } from '../services/api';
import { Users, CreditCard, Calendar, Activity, TrendingUp, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

export const Dashboard = () => {
  const [stats, setStats] = useState({ patients: 0, appointments: 0, revenue: 0 });
  const [appointments, setAppointments] = useState<any[]>([]); // Keep as any[] to match backend flexibility
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      const [pts, apts, bills] = await Promise.all([
        api.getPatients().catch(err => { console.error("API Error - getPatients (Dashboard):", err); return []; }),
        api.getAppointments().catch(err => { console.error("API Error - getAppointments (Dashboard):", err); return []; }),
        api.getBills().catch(err => { console.error("API Error - getBills (Dashboard):", err); return []; })
      ]);

      const totalRevenue = (Array.isArray(bills) ? bills : []).reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      
      setStats({
        patients: (Array.isArray(pts) ? pts : []).length,
        appointments: (Array.isArray(apts) ? apts : []).length,
        revenue: totalRevenue
      });
      setAppointments(Array.isArray(apts) ? apts.slice(0, 5) : []); // Recent 5
      setLoading(false);
    };
    loadData();
  }, []);

  const data = [
    { name: 'Mon', revenue: 4000 },
    { name: 'Tue', revenue: 3000 },
    { name: 'Wed', revenue: 2000 },
    { name: 'Thu', revenue: 2780 },
    { name: 'Fri', revenue: 1890 },
    { name: 'Sat', revenue: 2390 },
    { name: 'Sun', revenue: 3490 },
  ];

  const pieData = [
    { name: 'Consultation', value: 400 },
    { name: 'Emergency', value: 300 },
    { name: 'Operation', value: 300 },
    { name: 'Checkup', value: 200 },
  ];

  const COLORS = ['#0891b2', '#10b981', '#f59e0b', '#ef4444'];

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, colorClass }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-card border border-slate-100 relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold mt-2 text-slate-800">{value}</h3>
          <div className="flex items-center mt-2 gap-2">
            <span className={`flex items-center text-xs font-bold ${trend === 'up' ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'} px-2 py-0.5 rounded-full`}>
              {trend === 'up' ? <ArrowUpRight size={14} className="mr-1"/> : <ArrowDownRight size={14} className="mr-1"/>}
              {trendValue}
            </span>
            <span className="text-xs text-slate-400">vs last month</span>
          </div>
        </div>
        <div className={`p-3.5 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-md`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>
        <p className="text-slate-500 mt-1">Welcome back, here is what's happening at your hospital today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Patients" 
          value={stats.patients} 
          icon={Users} 
          trend="up" 
          trendValue="+12.5%" 
          colorClass="from-blue-500 to-blue-600" 
        />
        <StatCard 
          title="Appointments" 
          value={stats.appointments} 
          icon={Calendar} 
          trend="up" 
          trendValue="+4.2%" 
          colorClass="from-violet-500 to-violet-600" 
        />
        <StatCard 
          title="Revenue" 
          value={`$${stats.revenue.toLocaleString()}`} 
          icon={CreditCard} 
          trend="down" 
          trendValue="-2.4%" 
          colorClass="from-emerald-500 to-emerald-600" 
        />
        <StatCard 
          title="Critical Tasks" 
          value="12" 
          icon={Activity} 
          trend="up" 
          trendValue="+5" 
          colorClass="from-amber-500 to-amber-600" 
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Revenue Analytics" action={<Button size="sm" variant="outline">View Report</Button>}>
            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0891b2" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card title="Patient Demographics">
            <div className="h-80 w-full mt-4 relative">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                </PieChart>
              </ResponsiveContainer>
              {/* Center Text Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                <span className="text-3xl font-bold text-slate-800">1.2k</span>
                <span className="text-xs text-slate-400 font-medium uppercase">Patients</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity Table */}
      <Card title="Recent Appointments" action={<Button variant="ghost" size="sm">View All</Button>}>
        <div className="overflow-x-auto -mx-6">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Patient Info</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Doctor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Date & Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {/* Guard with Array.isArray(appointments) */}
              {Array.isArray(appointments) && appointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 align-top">
                    <div className="flex items-start">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs mr-3 mt-0.5 shrink-0">
                        {apt.patientName.charAt(0)}
                      </div>
                      <div className="text-sm font-semibold text-slate-800 break-words leading-snug">{apt.patientName}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-slate-600 break-words leading-snug">{apt.staffName}</td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <div className="flex items-center text-sm text-slate-500">
                      <Clock size={14} className="mr-1.5 text-slate-400"/>
                      {new Date(apt.datetime).toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <Badge color={apt.status === 'confirmed' ? 'green' : 'yellow'}>{apt.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};