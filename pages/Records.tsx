import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { 
  Database, Search, Filter, ChevronLeft, ChevronRight, FileText, Download, Printer, X, Info, Clock, Hash, User, Users, Receipt, Calendar, Briefcase
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Records = () => {
  const { t } = useTranslation();
  
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
    <div className="relative" ref={exportMenuRef}>
      <Button variant="secondary" icon={Download} onClick={() => setShowExportMenu(!showExportMenu)}>
        {t('records_export_button')}
      </Button>
      {showExportMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => {}} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <Printer size={16} /> {t('records_export_pdf')}
          </button>
          <button onClick={() => {}} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
            <FileText size={16} /> {t('records_export_csv')}
          </button>
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

  useEffect(() => {
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
    loadAllData();
  }, []);

  const unifiedRecords = useMemo(() => {
    const patientRecords = allData.patients.map((p: any) => ({
      id: `p-${p.id}`, type: 'Patient', refId: p.patientId, date: p.createdAt,
      primaryEntity: p.fullName, value: null, context: `${t('records_context_new')} ${t(`patients_filter_type_${p.type}`)} ${t('records_context_registered')}`, rawData: p,
    }));
    const appointmentRecords = allData.appointments.map((a: any) => ({
      id: `a-${a.id}`, type: 'Appointment', refId: a.appointmentNumber, date: a.datetime,
      primaryEntity: a.patientName, secondaryEntity: a.staffName, value: a.totalAmount, context: `${t(`patients_modal_action_${a.type.toLowerCase().replace('-up', 'Up')}`)} - ${t(`appointments_status_${a.status}`)}`, rawData: a,
    }));
    const billRecords = allData.bills.map((b: any) => ({
      id: `b-${b.id}`, type: 'Invoice', refId: b.billNumber, date: b.date,
      primaryEntity: b.patientName, value: b.totalAmount, context: `${t('status')}: ${t(`billing_status_${b.status}`)} | ${t('records_context_paid')}: $${b.paidAmount}`, rawData: b,
    }));
    const staffRecords = allData.staff.map((s: any) => ({
      id: `s-${s.id}`, type: 'Staff', refId: s.employeeId, date: s.joinDate || s.createdAt,
      primaryEntity: s.fullName, value: s.baseSalary, context: `${t('records_context_new')} ${t(`staff_role_${s.type}`)} - ${s.department}`, rawData: s,
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
        r.refId.toLowerCase().includes(searchLower) ||
        (r.secondaryEntity && r.secondaryEntity.toLowerCase().includes(searchLower));
      const matchesType = filterType === 'all' || r.type.toLowerCase() === filterType;
      return matchesSearch && matchesType;
    });
  }, [unifiedRecords, searchTerm, filterType]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTypeIcon = (type: string) => {
    if (type.includes('Patient')) return <Users size={16} className="text-blue-500" />;
    if (type.includes('Appointment')) return <Calendar size={16} className="text-violet-500" />;
    if (type.includes('Invoice')) return <Receipt size={16} className="text-emerald-500" />;
    if (type.includes('Staff')) return <Briefcase size={16} className="text-orange-500" />;
    return <FileText size={16} className="text-slate-500" />;
  };

  const RecordDetailItem = ({ label, value, icon: Icon }: any) => (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
      {Icon && <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400"><Icon size={16} /></div>}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{value || t('patients_modal_view_na')}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 flex flex-col md:flex-row gap-4 items-center border-b border-slate-200 dark:border-slate-700">
            <div className="relative flex-1 w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input placeholder={t('records_search_placeholder')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 !py-2 w-full" />
            </div>
            <Select value={filterType} onChange={e => setFilterType(e.target.value)} className="!py-2 w-full md:w-48">
                <option value="all">{t('records_filter_all')}</option>
                <option value="patient">{t('nav_patients')}</option>
                <option value="appointment">{t('nav_appointments')}</option>
                <option value="invoice">{t('nav_billing')}</option>
                <option value="staff">{t('nav_hr')}</option>
            </Select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('records_table_type')}</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('records_table_date')}</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('records_table_primary')}</th>
                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('records_table_context')}</th>
                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('billing_table_header_amount')}</th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                    <tr><td colSpan={5} className="text-center py-20 text-slate-400">{t('loading')}</td></tr>
                ) : paginatedRecords.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-20 text-slate-400">{t('records_table_empty')}</td></tr>
                ) : (
                    paginatedRecords.map(r => (
                        <tr key={r.id} onClick={() => setSelectedRecord(r)} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group">
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-3"><div className="p-2 bg-slate-100 dark:bg-slate-900 rounded-lg">{getTypeIcon(r.type)}</div><div><p className="font-bold text-sm text-slate-800 dark:text-white">{t(`records_type_${r.type.toLowerCase()}`)}</p><p className="font-mono text-[10px] text-slate-400">{r.refId}</p></div></div></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">{new Date(r.date).toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-sm text-slate-800 dark:text-white">{r.primaryEntity}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 truncate max-w-xs">{r.context}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600">{r.value ? `$${r.value.toLocaleString()}` : '-'}</td>
                        </tr>
                    ))
                )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 flex flex-col sm:flex-row justify-between items-center border-t border-slate-200 dark:border-slate-700 gap-4">
            <p className="text-xs text-slate-500">{t('records_pagination_showing', { count: paginatedRecords.length, total: filteredRecords.length })}</p>
            <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
            </div>
        </div>
      </Card>
      
      <Modal isOpen={!!selectedRecord} onClose={() => setSelectedRecord(null)} title={t('records_modal_analysis_title', { ref: selectedRecord?.refId })}>
        {selectedRecord && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <RecordDetailItem label={t('records_modal_logged_time')} value={new Date(selectedRecord.date).toLocaleString()} icon={Clock} />
              <RecordDetailItem label={t('records_modal_ref_id')} value={selectedRecord.refId} icon={Hash} />
              <RecordDetailItem label={t('records_modal_db_id')} value={selectedRecord.id} icon={Database} />
            </div>
            <div className="space-y-3">
               <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('records_modal_context')}</h4>
               <pre className="text-xs font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto custom-scrollbar">
                  {JSON.stringify(selectedRecord.rawData, null, 2)}
               </pre>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700">
              <Button variant="ghost" icon={Printer}>{t('records_modal_print')}</Button>
              <Button variant="secondary" onClick={() => setSelectedRecord(null)}>{t('records_modal_dismiss')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};