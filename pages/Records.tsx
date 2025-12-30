
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Badge, Modal } from '../components/UI';
import { 
  Database, Search, Filter, ChevronLeft, ChevronRight, FileText, Download, Printer, X, Info, Clock, Hash, User, Users, Receipt, Calendar, Briefcase, RefreshCcw, ArrowRight,
  ChevronDown, Loader2, FlaskConical, Syringe, Activity, Bed, TrendingUp, TrendingDown
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Records = () => {
  const { t, language } = useTranslation();
  const isRtl = language === 'ar';
  
  // States
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<any>({ 
    patients: [], appointments: [], bills: [], staff: [],
    labs: [], nurse: [], ops: [], admissions: [], transactions: [] 
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const HeaderActions = useMemo(() => (
    <div className="relative no-print" ref={exportMenuRef}>
      <Button variant="outline" icon={Download} onClick={() => setShowExportMenu(!showExportMenu)} className="bg-white dark:bg-slate-800">
        {t('records_export_button')}
      </Button>
      {showExportMenu && (
        <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <div className="p-2">
            <button onClick={() => { window.print(); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors">
              <Printer size={16} className="text-primary-500" /> {t('records_export_pdf')}
            </button>
            <button onClick={() => handleExportCSV()} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-colors border-t border-slate-100 dark:border-slate-700 mt-1 pt-2">
              <FileText size={16} className="text-emerald-600" /> {t('records_export_csv')}
            </button>
          </div>
        </div>
      )}
    </div>
  ), [showExportMenu, t]);

  useHeader(t('records_title'), t('records_subtitle'), HeaderActions);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [patients, appointments, bills, staff, labs, nurse, ops, admissions, transactions] = await Promise.all([
        api.getPatients(), 
        api.getAppointments(), 
        api.getBills(), 
        api.getStaff(),
        api.getPendingLabRequests(),
        api.getNurseRequests(),
        api.getScheduledOperations(),
        api.getAdmissionsHistory(),
        api.getTransactions()
      ]);
      setAllData({ 
        patients: patients || [], 
        appointments: appointments || [], 
        bills: bills || [],
        staff: staff || [],
        labs: labs || [],
        nurse: nurse || [],
        ops: ops || [],
        admissions: admissions || [],
        transactions: transactions || []
      });
    } catch (error) {
      console.error("Failed to load records data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const unifiedRecords = useMemo(() => {
    const patientRecords = allData.patients.map((p: any) => ({
      id: `p-${p.id}`, 
      type: 'Patient', 
      refId: p.patientId, 
      date: p.createdAt,
      primaryEntity: p.fullName, 
      value: null, 
      status: p.type,
      context: `${t(`patients_filter_type_${p.type}`)}`, 
      rawData: p,
    }));

    const appointmentRecords = allData.appointments.map((a: any) => ({
      id: `a-${a.id}`, 
      type: 'Appointment', 
      refId: a.appointmentNumber, 
      date: a.datetime,
      primaryEntity: a.patientName, 
      secondaryEntity: a.staffName, 
      value: a.totalAmount, 
      status: a.status,
      context: `${t(`patients_modal_action_${a.type.toLowerCase().replace('-up', 'Up')}`) || a.type}`,
      rawData: a,
    }));

    const billRecords = allData.bills.map((b: any) => ({
      id: `b-${b.id}`, 
      type: 'Invoice', 
      refId: b.billNumber, 
      date: b.date,
      primaryEntity: b.patientName, 
      value: b.totalAmount,
      status: b.status,
      context: t('billing_invoice_total'), 
      rawData: b,
    }));

    const staffRecords = allData.staff.map((s: any) => ({
      id: `s-${s.id}`, 
      type: 'Staff', 
      refId: s.employeeId, 
      date: s.joinDate || s.createdAt || new Date().toISOString(),
      primaryEntity: s.fullName, 
      value: s.baseSalary, 
      status: s.status,
      context: `${t(`staff_role_${s.type}`) || s.type} • ${s.department || ''}`, 
      rawData: s,
    }));

    const labRecords = allData.labs.map((l: any) => ({
        id: `l-${l.id}`,
        type: 'Lab Request',
        refId: `LAB-${l.id}`,
        date: l.created_at,
        primaryEntity: l.patientName,
        value: l.projected_cost,
        status: l.status,
        context: l.testNames ? l.testNames.substring(0, 30) + (l.testNames.length > 30 ? '...' : '') : t('nav_laboratory'),
        rawData: l
    }));

    const nurseRecords = allData.nurse.map((n: any) => ({
        id: `n-${n.id}`,
        type: 'Nurse Service',
        refId: `NUR-${n.id}`,
        date: n.created_at,
        primaryEntity: n.patientName,
        secondaryEntity: n.nurseName,
        value: n.cost,
        status: n.status,
        context: n.service_name,
        rawData: n
    }));

    const opRecords = allData.ops.map((o: any) => ({
        id: `o-${o.id}`,
        type: 'Operation',
        refId: `OP-${o.id}`,
        date: o.created_at,
        primaryEntity: o.patientName,
        secondaryEntity: o.doctorName,
        value: o.projected_cost,
        status: o.status,
        context: o.operation_name,
        rawData: o
    }));

    const admRecords = allData.admissions.map((a: any) => ({
        id: `adm-${a.id}`,
        type: 'Admission',
        refId: `ADM-${a.id}`,
        date: a.entry_date,
        primaryEntity: a.patientName,
        secondaryEntity: a.doctorName,
        value: a.projected_cost,
        status: a.status,
        context: `${t('admissions_history_header_room')} ${a.roomNumber}`,
        rawData: a
    }));

    const txRecords = allData.transactions.map((t: any) => ({
        id: `tx-${t.id}`,
        type: t.type === 'income' ? 'Income' : 'Expense',
        refId: `TX-${t.id}`,
        date: t.date,
        primaryEntity: t.category || t.description,
        value: t.amount,
        status: 'Completed',
        context: t.method,
        rawData: t
    }));

    return [
        ...patientRecords, ...appointmentRecords, ...billRecords, ...staffRecords,
        ...labRecords, ...nurseRecords, ...opRecords, ...admRecords, ...txRecords
    ].filter(r => r.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allData, t]);

  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        r.primaryEntity.toLowerCase().includes(searchLower) ||
        (r.refId && r.refId.toLowerCase().includes(searchLower)) ||
        (r.secondaryEntity && r.secondaryEntity.toLowerCase().includes(searchLower)) ||
        (r.context && r.context.toLowerCase().includes(searchLower));
        
      const matchesType = filterType === 'all' || r.type.toLowerCase().replace(' ', '') === filterType.toLowerCase();
      return matchesSearch && matchesType;
    });
  }, [unifiedRecords, searchTerm, filterType]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ["Type", "ID", "Date", "Primary Entity", "Context", "Status", "Value"];
    const rows = filteredRecords.map(r => [
        r.type,
        r.refId,
        new Date(r.date).toLocaleString(),
        r.primaryEntity,
        r.context,
        r.status,
        r.value || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...rows].map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `allcare_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  const getTypeIcon = (type: string) => {
    const iconSize = 16;
    if (type === 'Patient') return <Users size={iconSize} className="text-blue-500" />;
    if (type === 'Appointment') return <Calendar size={iconSize} className="text-violet-500" />;
    if (type === 'Invoice') return <Receipt size={iconSize} className="text-emerald-500" />;
    if (type === 'Staff') return <Briefcase size={iconSize} className="text-orange-500" />;
    if (type === 'Lab Request') return <FlaskConical size={iconSize} className="text-cyan-500" />;
    if (type === 'Nurse Service') return <Syringe size={iconSize} className="text-pink-500" />;
    if (type === 'Operation') return <Activity size={iconSize} className="text-rose-500" />;
    if (type === 'Admission') return <Bed size={iconSize} className="text-indigo-500" />;
    if (type === 'Income') return <TrendingUp size={iconSize} className="text-green-600" />;
    if (type === 'Expense') return <TrendingDown size={iconSize} className="text-red-600" />;
    return <FileText size={iconSize} className="text-slate-500" />;
  };

  const getAmountLabel = (type: string) => {
    switch (type) {
      case 'Staff': return t('staff_payroll_base');
      case 'Invoice': return t('billing_invoice_total');
      case 'Expense': return t('billing_treasury_type_expense');
      case 'Income': return t('billing_treasury_type_income');
      case 'Appointment': return t('billing_table_header_amount');
      case 'Operation': return t('operations_card_est_cost');
      case 'Admission': return t('admissions_modal_reserve_payment_label');
      default: return t('billing_table_header_amount');
    }
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'gray';
    const s = status.toLowerCase();
    if (s === 'active' || s === 'paid' || s === 'completed' || s === 'confirmed' || s === 'recovered') return 'green';
    if (s === 'pending' || s === 'reserved' || s === 'in_progress' || s === 'draft') return 'yellow';
    if (s === 'cancelled' || s === 'rejected' || s === 'deceased' || s === 'overdue') return 'red';
    return 'blue';
  };

  const RecordDetailItem = ({ label, value, icon: Icon, fullWidth = false }: any) => (
    <div className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 transition-all ${fullWidth ? 'col-span-full' : ''}`}>
      {Icon && (
        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400 border border-slate-50 dark:border-slate-700 shrink-0">
            <Icon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{value || t('patients_modal_view_na')}</p>
      </div>
    </div>
  );

  const renderSpecificDetails = (record: any) => {
    const raw = record.rawData;
    switch(record.type) {
      case 'Patient':
        return (
          <>
            <RecordDetailItem label={t('patients_modal_form_phone')} value={raw.phone} icon={Hash} />
            <RecordDetailItem label={t('patients_modal_form_bloodGroup')} value={raw.bloodGroup} icon={Activity} />
            <RecordDetailItem label={t('patients_modal_form_address')} value={raw.address} icon={Info} fullWidth />
            {raw.emergencyContact && (
              <RecordDetailItem label={t('patients_modal_form_emergency_title')} value={`${raw.emergencyContact.name} (${raw.emergencyContact.phone})`} icon={Users} fullWidth />
            )}
          </>
        );
      case 'Staff':
        return (
          <>
            <RecordDetailItem label={t('staff_form_department')} value={raw.department} icon={Briefcase} />
            <RecordDetailItem label={t('staff_form_specialization')} value={raw.specialization} icon={Activity} />
            <RecordDetailItem label={t('settings_profile_email')} value={raw.email} icon={Info} />
            <RecordDetailItem label={t('patients_modal_form_phone')} value={raw.phone} icon={Hash} />
          </>
        );
      case 'Appointment':
        return (
          <>
            <RecordDetailItem label={t('nav_hr')} value={record.secondaryEntity} icon={User} />
            <RecordDetailItem label={t('appointments_form_reason')} value={raw.reason || '-'} icon={Info} fullWidth />
          </>
        );
      case 'Invoice':
        return (
          <div className="col-span-full space-y-3">
             <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                   <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase text-slate-500 font-bold">
                      <tr><th className="px-4 py-2">{t('billing_invoice_description')}</th><th className="px-4 py-2 text-right">{t('billing_table_header_amount')}</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {raw.items && raw.items.map((item: any, idx: number) => (
                        <tr key={idx}>
                           <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{item.description}</td>
                           <td className="px-4 py-2 text-right font-mono">${item.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                   </tbody>
                   <tfoot className="bg-slate-50 dark:bg-slate-900 font-bold">
                      <tr>
                         <td className="px-4 py-2">{t('billing_invoice_total')}</td>
                         <td className="px-4 py-2 text-right font-mono text-primary-600">${raw.totalAmount.toLocaleString()}</td>
                      </tr>
                   </tfoot>
                </table>
             </div>
             <div className="flex justify-between items-center text-xs px-2">
                <span className="text-slate-500">{t('billing_table_paid_amount')}: <span className="font-bold text-emerald-600">${(raw.paidAmount || 0).toLocaleString()}</span></span>
                <span className="text-slate-500">{t('billing_invoice_balance')}: <span className="font-bold text-red-500">${((raw.totalAmount || 0) - (raw.paidAmount || 0)).toLocaleString()}</span></span>
             </div>
          </div>
        );
      case 'Lab Request':
        return (
          <>
             <RecordDetailItem label="Tests Requested" value={record.context} icon={FlaskConical} fullWidth />
             <RecordDetailItem label="Clinical Notes" value={raw.notes || '-'} icon={Info} fullWidth />
          </>
        );
      case 'Operation':
        return (
          <>
             <RecordDetailItem label="Surgeon" value={record.secondaryEntity} icon={User} />
             <RecordDetailItem label="Notes" value={raw.notes} icon={Info} fullWidth />
          </>
        );
      case 'Admission':
        return (
          <>
             <RecordDetailItem label="Doctor" value={record.secondaryEntity} icon={User} />
             <RecordDetailItem label="Room" value={raw.roomNumber} icon={Bed} />
             <RecordDetailItem label="Discharge Date" value={raw.actual_discharge_date ? new Date(raw.actual_discharge_date).toLocaleDateString() : '-'} icon={Calendar} />
          </>
        );
      default:
        return (
          <RecordDetailItem label="Details" value={JSON.stringify(raw)} icon={Info} fullWidth />
        );
    }
  };

  const clearFilters = () => {
      setSearchTerm('');
      setFilterType('all');
      setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Search & Filters - Hidden on Print */}
      <div className={`grid grid-cols-1 md:grid-cols-4 gap-4 no-print ${selectedRecord ? 'print:hidden' : ''}`}>
          <div className="md:col-span-2 relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                <Search size={18} />
              </div>
              <input 
                type="text"
                placeholder={t('records_search_placeholder')} 
                value={searchTerm} 
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all shadow-sm"
              />
          </div>
          <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-primary-500 transition-colors">
                <Filter size={18} />
              </div>
              <select 
                value={filterType} 
                onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none appearance-none transition-all shadow-sm cursor-pointer"
              >
                  <option value="all">{t('records_filter_all')}</option>
                  <option value="patient">{t('records_type_patient')}</option>
                  <option value="appointment">{t('records_type_appointment')}</option>
                  <option value="invoice">{t('records_type_invoice')}</option>
                  <option value="staff">{t('records_type_staff')}</option>
                  <option value="labrequest">{t('nav_laboratory')}</option>
                  <option value="nurseservice">{t('patients_modal_action_nurse')}</option>
                  <option value="operation">{t('nav_operations')}</option>
                  <option value="admission">{t('nav_admissions')}</option>
                  <option value="income">{t('billing_treasury_type_income')}</option>
                  <option value="expense">{t('billing_treasury_type_expense')}</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={16} />
              </div>
          </div>
          <Button variant="secondary" onClick={clearFilters} disabled={!searchTerm && filterType === 'all'} className="w-full md:w-auto px-6 h-[50px] shadow-sm" icon={RefreshCcw}>
             {isRtl ? 'إعادة تعيين' : 'Reset'}
          </Button>
      </div>

      {/* Main Records Table */}
      <Card className={`!p-0 border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden ${selectedRecord ? 'print:hidden' : ''}`}>
        
        {/* Print Header for Table - Simplified Modern Table */}
        <div className="hidden print:block p-6 border-b border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">System Records Log</h2>
                <div className="text-right">
                    <p className="text-xs text-slate-500 font-bold uppercase">Report Date</p>
                    <p className="font-mono font-bold">{new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto min-h-[500px] print:min-h-0 print:overflow-visible">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700 print:divide-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/80 print:bg-white">
                <tr>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('records_table_type')} / {t('records_modal_ref_id')}</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('records_table_date')}</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('records_table_primary')}</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('records_table_context')}</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('status')}</th>
                    <th className="px-4 py-3 text-right text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('billing_table_header_amount')}</th>
                    <th className="px-4 py-3 no-print w-10"></th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700 print:divide-slate-200">
                {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-32">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('loading')}</p>
                        </div>
                      </td>
                    </tr>
                ) : paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-32">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                           <Database size={64} className="text-slate-300" />
                           <div>
                             <p className="text-lg font-black text-slate-800 dark:text-white">{t('records_table_empty')}</p>
                             <p className="text-sm text-slate-500">{isRtl ? 'جرب تغيير فلاتر البحث' : 'Try adjusting your search criteria'}</p>
                           </div>
                        </div>
                      </td>
                    </tr>
                ) : (
                    paginatedRecords.map(r => (
                        <tr key={r.id} onClick={() => setSelectedRecord(r)} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all cursor-pointer group print:hover:bg-transparent break-inside-avoid">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-center justify-center text-slate-500 shadow-sm print:hidden">
                                  {getTypeIcon(r.type)}
                                </div>
                                <div>
                                  <p className="font-bold text-xs text-slate-800 dark:text-white leading-none mb-0.5">{
                                    r.type === 'Lab Request' ? t('nav_laboratory') :
                                    r.type === 'Nurse Service' ? t('patients_modal_action_nurse') :
                                    r.type === 'Operation' ? t('nav_operations') :
                                    r.type === 'Admission' ? t('nav_admissions') :
                                    r.type === 'Income' ? t('billing_treasury_type_income') :
                                    r.type === 'Expense' ? t('billing_treasury_type_expense') :
                                    t(`records_type_${r.type.toLowerCase()}`) || r.type
                                  }</p>
                                  <p className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">{r.refId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{new Date(r.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                                  <span className="text-[9px] font-medium text-slate-400">{new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                                <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors print:text-black">{r.primaryEntity}</p>
                                {r.secondaryEntity && <p className="text-[9px] text-slate-400 font-bold mt-0.5">{r.secondaryEntity}</p>}
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap max-w-[150px]">
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{r.context}</p>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                                <Badge color={getStatusColor(r.status) as any} className="text-[9px] uppercase font-black px-1.5 py-0.5">
                                  {t(r.status?.toLowerCase()) || r.status || '-'}
                                </Badge>
                            </td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                {r.value ? (
                                  <div>
                                    <span className={`font-mono font-black text-xs block ${r.type === 'Expense' ? 'text-red-600' : 'text-emerald-600'} print:text-black`}>
                                        ${r.value.toLocaleString()}
                                    </span>
                                    <span className="text-[8px] text-slate-400 uppercase font-bold tracking-wider block mt-0.5">
                                        {getAmountLabel(r.type)}
                                    </span>
                                  </div>
                                ) : <span className="text-slate-300 text-xs">-</span>}
                            </td>
                            <td className="px-4 py-2.5 no-print w-8">
                               <div className="opacity-0 group-hover:opacity-100 transition-all text-slate-300">
                                  <ArrowRight size={14} className={isRtl ? 'rotate-180' : ''} />
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 flex flex-col sm:flex-row justify-between items-center border-t border-slate-200 dark:border-slate-700 gap-4 no-print bg-slate-50 dark:bg-slate-900/50">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-slate-500">
              <p className="font-bold uppercase tracking-widest">
                {t('records_pagination_showing', { count: paginatedRecords.length, total: filteredRecords.length })}
              </p>
              <div className="flex items-center gap-2">
                <span className="font-black uppercase tracking-widest text-slate-400 text-[9px]">{t('patients_pagination_rows')}</span>
                <select 
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary-500/20"
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p-1))} 
                  disabled={currentPage === 1}
                  className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center px-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-black text-primary-600">
                   {currentPage} / {totalPages || 1}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </Card>
      
      {/* Record Analysis Modal */}
      <Modal 
        isOpen={!!selectedRecord} 
        onClose={() => setSelectedRecord(null)} 
        title={t('records_modal_analysis_title', { ref: selectedRecord?.refId })}
      >
        {selectedRecord && (
          <div className="space-y-6 print:space-y-4">
            
            {/* Header / Top Card */}
            <div className={`flex flex-wrap items-center gap-4 p-5 rounded-3xl border shadow-xl relative overflow-hidden print:shadow-none print:border print:border-slate-300 print:bg-white print:p-0 print:mb-6 ${
              selectedRecord.type === 'Patient' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20' : 
              selectedRecord.type === 'Appointment' ? 'bg-violet-50 border-violet-100 dark:bg-violet-900/20' : 
              selectedRecord.type === 'Invoice' || selectedRecord.type === 'Income' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20' :
              selectedRecord.type === 'Expense' ? 'bg-red-50 border-red-100 dark:bg-red-900/20' :
              'bg-orange-50 border-orange-100 dark:bg-orange-900/20'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl print:hidden" />
              
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-primary-600 z-10 print:hidden">
                 {getTypeIcon(selectedRecord.type)}
              </div>
              
              <div className="flex-1 min-w-[200px] z-10">
                 <h3 className="font-black text-slate-900 dark:text-white text-xl leading-tight mb-2 print:text-2xl">{selectedRecord.primaryEntity}</h3>
                 <div className="flex items-center gap-2">
                    <Badge color="blue" className="uppercase font-black text-[10px] tracking-widest">{
                      selectedRecord.type === 'Lab Request' ? t('nav_laboratory') :
                      selectedRecord.type === 'Nurse Service' ? t('patients_modal_action_nurse') :
                      selectedRecord.type === 'Operation' ? t('nav_operations') :
                      selectedRecord.type === 'Admission' ? t('nav_admissions') :
                      selectedRecord.type === 'Income' ? t('billing_treasury_type_income') :
                      selectedRecord.type === 'Expense' ? t('billing_treasury_type_expense') :
                      t(`records_type_${selectedRecord.type.toLowerCase()}`) || selectedRecord.type
                    }</Badge>
                    {selectedRecord.rawData.status && (
                      <Badge color="gray" className="uppercase font-black text-[10px] tracking-widest">
                        {t(`billing_status_${selectedRecord.rawData.status.toLowerCase()}`) || selectedRecord.rawData.status}
                      </Badge>
                    )}
                 </div>
              </div>
              
              {selectedRecord.value && (
                <div className="text-right z-10 ml-auto">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('billing_table_header_amount')}</p>
                    <p className={`text-3xl font-black font-mono tracking-tighter ${selectedRecord.type === 'Expense' ? 'text-red-600' : 'text-emerald-600'} print:text-black`}>${selectedRecord.value.toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Standard Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-x-8 print:gap-y-4">
              <RecordDetailItem label={t('records_modal_logged_time')} value={new Date(selectedRecord.date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')} icon={Clock} />
              <RecordDetailItem label={t('records_modal_ref_id')} value={selectedRecord.refId} icon={Hash} />
              
              {/* Dynamic Content based on Type - No Raw JSON anymore */}
              {renderSpecificDetails(selectedRecord)}
            </div>

            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
              <Button variant="ghost" icon={Printer} onClick={() => window.print()} className="w-full sm:w-auto text-slate-500 hover:text-slate-800">
                {t('records_modal_print')}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="secondary" onClick={() => setSelectedRecord(null)} className="flex-1 sm:flex-none px-8">
                  {t('records_modal_dismiss')}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};