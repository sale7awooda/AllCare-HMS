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
import { getStatusColor } from '../utils/formatters';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

export const Reports = () => {
  const { t, language } = useTranslation();
  // ... [Component State] ...
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

  const filterByDate = (data: any[], dateField: string) => data.filter(item => {
    if (!item[dateField]) return false;
    const d = new Date(item[dateField]);
    return d >= dateRange.start && d <= dateRange.end;
  });

  // ... [Analytics Calculations logic] ...
  
  // Financial Stats
  const financialStats = useMemo(() => {
    const fb = filterByDate(bills, 'date');
    const ft = filterByDate(transactions, 'date');
    
    // ... [Calc logic] ...
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
    // ... [Calc logic] ...
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
    // ... [Calc logic] ...
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
      total: patients.length,
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
    // ... [Calc logic] ...
    const stream = [
      ...patients.map(p => ({ type: 'patient', name: p.fullName, date: p.createdAt, meta: 'New Registration', status: 'Registered', id: `p-${p.id}`, raw: p })),
      ...appointments.map(a => ({ type: 'appointment', name: a.patientName, sub: a.staffName, date: a.datetime, meta: a.status, status: a.status, id: `a-${a.id}`, raw: a })),
      ...bills.map(b => ({ type: 'bill', name: b.patientName, sub: `$${b.totalAmount.toLocaleString()}`, date: b.date, meta: b.status, status: b.status, id: `b-${b.id}`, raw: b }))
    ];
    return stream.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
  }, [patients, appointments, bills]);

  const handleExportCSV = () => {
    // ... [Export Logic] ...
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
        setBills(b || []); 
        setAppointments(a || []); 
        setPatients(p || []); 
        setTransactions(t_data || []); 
        setStaff(s || []);
      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  // ... [Stat Cards] ...
  const StatCard = ({ title, value, subtitle, icon: Icon, colorClass, trend }: any) => (
    <Card className="!p-4 bg-white dark:bg-slate-800 shadow-soft border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex justify-between items-start">
        <div className={`p-2.5 rounded-xl ${colorClass} text-white shadow-lg`}>
          <Icon size={20} />
        </div>
        {trend && (
           <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${trend > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
              {trend > 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
              {Math.abs(trend)}%
           </div>
        )}
      </div>
      <div className="mt-2.5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
        <h3 className="text-xl font-black text-slate-900 dark:text-white leading-none">{value}</h3>
        {subtitle && <p className="text-[10px] text-slate-500 mt-1.5 font-bold">{subtitle}</p>}
      </div>
    </Card>
  );

  const openEventDetails = (event: any) => {
    setSelectedEvent(event);
    setIsEventModalOpen(true);
  };

  const RecordDetailItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
      {Icon && <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400"><Icon size={16} /></div>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value || 'N/A'}</p>
      </div>
    </div>
  );

  // ... [Render Logic - mainly same] ...
  
  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* ... [Filters Bar] ... */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-soft gap-4 no-print">
        {/* ... */}
      </div>

      <div className="print-content animate-in fade-in duration-500">
        {/* ... [Tabs content] ... */}
        {activeTab === 'financial' && (
          <div className="space-y-6">
            {/* ... */}
          </div>
        )}
        
        {/* ... [Other tabs] ... */}

        {/* ... [Activity Stream Tab] ... */}
      </div>

      <Modal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
        title={`Audit Log: ${selectedEvent?.type.toUpperCase()}`}
      >
        {selectedEvent && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 print-content">
            <div className={`flex flex-wrap items-center gap-3 p-4 rounded-2xl border ${
              selectedEvent.type === 'patient' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20' : 
              selectedEvent.type === 'appointment' ? 'bg-violet-50 border-violet-100 dark:bg-violet-900/20' : 
              'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20'
            }`}>
              {/* ... */}
              <div className="flex-1">
                 <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">{selectedEvent.name}</h3>
                 <div className="flex items-center gap-2 mt-1">
                    <Badge color="blue" className="capitalize">{selectedEvent.type}</Badge>
                    <Badge color={getStatusColor(selectedEvent.status) as any}>{selectedEvent.status}</Badge>
                 </div>
              </div>
              {/* ... */}
            </div>

            {/* ... [Record details] ... */}
          </div>
        )}
      </Modal>

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

const HashIcon = ({ size, className }: any) => <span className={className}>#</span>;