
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { 
  Database, Search, Filter, ChevronLeft, ChevronRight, FileText, Download, Printer, X, Info, Clock, Hash, User, Users, Receipt, Calendar, Briefcase, RefreshCcw, ExternalLink, ArrowRight,
  ChevronDown, Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Records = () => {
  const { t, language } = useTranslation();
  const isRtl = language === 'ar';
  
  // States
  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState<any>({ patients: [], appointments: [], bills: [], staff: [] });
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
      const [patients, appointments, bills, staff] = await Promise.all([
        api.getPatients(), api.getAppointments(), api.getBills(), api.getStaff()
      ]);
      setAllData({ 
        patients: patients || [], 
        appointments: appointments || [], 
        bills: bills || [],
        staff: staff || []
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
      context: t('records_context_patient_registered', { type: t(`patients_filter_type_${p.type}`) }), 
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
      context: t('records_context_appointment_summary', { 
        type: t(`patients_modal_action_${a.type.toLowerCase().replace('-up', 'Up')}`),
        status: t(`appointments_status_${a.status}`)
      }), 
      rawData: a,
    }));

    const billRecords = allData.bills.map((b: any) => ({
      id: `b-${b.id}`, 
      type: 'Invoice', 
      refId: b.billNumber, 
      date: b.date,
      primaryEntity: b.patientName, 
      value: b.totalAmount, 
      context: t('records_context_invoice_summary', { 
        status: t(`billing_status_${b.status.toLowerCase()}`), 
        paid: (b.paidAmount || 0).toLocaleString() 
      }), 
      rawData: b,
    }));

    const staffRecords = allData.staff.map((s: any) => ({
      id: `s-${s.id}`, 
      type: 'Staff', 
      refId: s.employeeId, 
      date: s.joinDate || s.createdAt,
      primaryEntity: s.fullName, 
      value: s.baseSalary, 
      context: t('records_context_staff_joined', { 
        role: t(`staff_role_${s.type}`), 
        dept: s.department || t('patients_modal_view_na') 
      }), 
      rawData: s,
    }));

    return [...patientRecords, ...appointmentRecords, ...billRecords, ...staffRecords]
        .filter(r => r.date)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allData, t]);

  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        r.primaryEntity.toLowerCase().includes(searchLower) ||
        (r.refId && r.refId.toLowerCase().includes(searchLower)) ||
        (r.secondaryEntity && r.secondaryEntity.toLowerCase().includes(searchLower)) ||
        (r.context && r.context.toLowerCase().includes(searchLower)) ||
        (t(`records_type_${r.type.toLowerCase()}`).toLowerCase().includes(searchLower));
        
      const matchesType = filterType === 'all' || r.type.toLowerCase() === filterType;
      return matchesSearch && matchesType;
    });
  }, [unifiedRecords, searchTerm, filterType, t]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExportCSV = () => {
    const headers = ["Type", "ID", "Date", "Primary Entity", "Context", "Value"];
    const rows = filteredRecords.map(r => [
        r.type,
        r.refId,
        new Date(r.date).toLocaleString(),
        r.primaryEntity,
        r.context,
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
    const iconSize = 18;
    if (type.includes('Patient')) return <Users size={iconSize} className="text-blue-500" />;
    if (type.includes('Appointment')) return <Calendar size={iconSize} className="text-violet-500" />;
    if (type.includes('Invoice')) return <Receipt size={iconSize} className="text-emerald-500" />;
    if (type.includes('Staff')) return <Briefcase size={iconSize} className="text-orange-500" />;
    return <FileText size={iconSize} className="text-slate-500" />;
  };

  const RecordDetailItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm">
      {Icon && (
        <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-400 border border-slate-50 dark:border-slate-700">
            <Icon size={18} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">{label}</p>
        <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate">{value || t('patients_modal_view_na')}</p>
      </div>
    </div>
  );

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
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown size={16} />
              </div>
          </div>
          <Button variant="secondary" onClick={clearFilters} disabled={!searchTerm && filterType === 'all'} className="w-full md:w-auto px-6 h-[50px] shadow-sm" icon={RefreshCcw}>
             {isRtl ? 'إعادة تعيين' : 'Reset'}
          </Button>
      </div>

      {/* Main Records Table - Hidden if Modal is open during Print */}
      <Card className={`!p-0 border border-slate-200 dark:border-slate-700 shadow-card overflow-hidden ${selectedRecord ? 'print:hidden' : ''}`}>
        
        {/* Print Header for Table */}
        <div className="hidden print:block p-4 border-b">
            <h2 className="text-xl font-bold">System Records Log</h2>
            <p className="text-sm text-gray-500">Generated: {new Date().toLocaleString()}</p>
        </div>

        <div className="overflow-x-auto min-h-[500px] print:min-h-0 print:overflow-visible">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/80">
                <tr>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t('records_table_type')}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t('records_table_date')}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t('records_table_primary')}</th>
                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t('records_table_context')}</th>
                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">{t('billing_table_header_amount')}</th>
                    <th className="px-6 py-4 no-print w-10"></th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-32">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('loading')}</p>
                        </div>
                      </td>
                    </tr>
                ) : paginatedRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-32">
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
                        <tr key={r.id} onClick={() => setSelectedRecord(r)} className="hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all cursor-pointer group animate-in slide-in-from-bottom-1 duration-200">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm print:shadow-none print:border">
                                  {getTypeIcon(r.type)}
                                </div>
                                <div>
                                  <p className="font-black text-sm text-slate-800 dark:text-white leading-none">{t(`records_type_${r.type.toLowerCase()}`)}</p>
                                  <p className="font-mono text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{r.refId}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(r.date).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                                  <span className="text-[10px] font-medium text-slate-400">{new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <p className="font-black text-sm text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">{r.primaryEntity}</p>
                                {r.secondaryEntity && <p className="text-[10px] text-slate-400 font-bold mt-0.5">{r.secondaryEntity}</p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate font-medium">{r.context}</p>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                {r.value ? (
                                  <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg print:bg-white print:text-black">
                                    ${r.value.toLocaleString()}
                                  </span>
                                ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="px-6 py-4 no-print w-10">
                               <div className="opacity-0 group-hover:opacity-100 transition-all text-slate-300">
                                  <ArrowRight size={18} className={isRtl ? 'rotate-180' : ''} />
                               </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-t border-slate-200 dark:border-slate-700 gap-4 no-print">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {t('records_pagination_showing', { count: paginatedRecords.length, total: filteredRecords.length })}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('patients_pagination_rows')}</span>
                <select 
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary-500/20"
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
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="flex items-center px-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black text-primary-600">
                   {currentPage} / {totalPages || 1}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} 
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-600 dark:text-slate-400 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
            </div>
        </div>
      </Card>
      
      <Modal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title={t('records_modal_analysis_title', { ref: selectedRecord?.refId })}>
        {selectedRecord && (
          <div className="space-y-6">
            <div className={`flex flex-wrap items-center gap-4 p-5 rounded-3xl border shadow-xl relative overflow-hidden print:shadow-none print:border-slate-300 ${
              selectedRecord.type === 'Patient' ? 'bg-blue-50 border-blue-100 dark:bg-blue-900/20' : 
              selectedRecord.type === 'Appointment' ? 'bg-violet-50 border-violet-100 dark:bg-violet-900/20' : 
              selectedRecord.type === 'Invoice' ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20' :
              'bg-orange-50 border-orange-100 dark:bg-orange-900/20'
            }`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl print:hidden" />
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-lg text-primary-600 z-10 print:shadow-none print:border">
                 {getTypeIcon(selectedRecord.type)}
              </div>
              <div className="flex-1 min-w-[200px] z-10">
                 <h3 className="font-black text-slate-900 dark:text-white text-xl leading-tight mb-2">{selectedRecord.primaryEntity}</h3>
                 <div className="flex items-center gap-2">
                    <Badge color="blue" className="uppercase font-black text-[10px] tracking-widest">{t(`records_type_${selectedRecord.type.toLowerCase()}`)}</Badge>
                    {selectedRecord.rawData.status && (
                      <Badge color={getStatusColor(selectedRecord.rawData.status) as any} className="uppercase font-black text-[10px] tracking-widest">
                        {t(`billing_status_${selectedRecord.rawData.status.toLowerCase()}`) || selectedRecord.rawData.status}
                      </Badge>
                    )}
                 </div>
              </div>
              {selectedRecord.value && (
                <div className="text-right z-10 ml-auto">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('billing_table_header_amount')}</p>
                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tighter">${selectedRecord.value.toLocaleString()}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <RecordDetailItem label={t('records_modal_logged_time')} value={new Date(selectedRecord.date).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')} icon={Clock} />
              <RecordDetailItem label={t('records_modal_ref_id')} value={selectedRecord.refId} icon={Hash} />
              {selectedRecord.type === 'Patient' && (
                <>
                  <RecordDetailItem label={t('patients_modal_form_age')} value={`${selectedRecord.rawData.age} ${t('patients_table_age_unit')}`} icon={Users} />
                  <RecordDetailItem label={t('patients_modal_form_gender')} value={t(`patients_modal_form_gender_${selectedRecord.rawData.gender}`)} icon={Users} />
                </>
              )}
              {selectedRecord.type === 'Appointment' && (
                <>
                  <RecordDetailItem label={t('nav_hr')} value={selectedRecord.rawData.staffName} icon={User} />
                  <RecordDetailItem label={t('appointments_form_type')} value={selectedRecord.rawData.type} icon={Info} />
                </>
              )}
              {selectedRecord.type === 'Invoice' && (
                <RecordDetailItem label={t('billing_table_paid_amount')} value={`$${selectedRecord.rawData.paidAmount?.toLocaleString()}`} icon={DollarSign} />
              )}
            </div>

            <div className="space-y-3">
               <h4 className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">
                 <Database size={12}/> {t('records_modal_context')}
               </h4>
               <div className="relative group">
                 <pre className="text-[11px] font-mono bg-slate-900 text-emerald-400 p-5 rounded-2xl overflow-x-auto custom-scrollbar max-h-72 leading-relaxed shadow-inner print:bg-white print:text-black print:border print:border-slate-300 print:max-h-none print:overflow-visible">
                    {JSON.stringify(selectedRecord.rawData, null, 2)}
                 </pre>
                 <button 
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedRecord.rawData, null, 2))}
                  className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-[10px] font-black uppercase tracking-widest no-print"
                 >
                    {isRtl ? 'نسخ' : 'Copy'}
                 </button>
               </div>
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

const getStatusColor = (status: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('paid') || s.includes('complete') || s.includes('active') || s.includes('regis')) return 'green';
  if (s.includes('pending') || s.includes('waiting') || s.includes('reserved') || s.includes('confirmed')) return 'yellow';
  if (s.includes('cancelled') || s.includes('refunded') || s.includes('overdue')) return 'red';
  return 'blue';
};

const DollarSign = ({ size, className }: any) => <span className={`font-black ${className}`}>$</span>;
