import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Modal, Badge, Input } from '../components/UI';
import { 
  Search, Calendar, Filter, Database, FileText, User, Users, 
  DollarSign, Bed, Activity, Download, Eye, ChevronLeft, ChevronRight,
  FileSpreadsheet, Printer, ChevronDown, Clock, ShieldCheck, Info, X, ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';
import { getStatusColor } from '../utils/formatters';

interface SystemRecord {
  id: string; 
  originalId: number; 
  type: 'Patient' | 'Appointment' | 'Bill' | 'Admission'; 
  reference: string; 
  date: string; 
  primaryEntity: string; 
  associateEntity?: string; 
  status: string; 
  value?: number; 
  details?: any;
}

export const Records = () => {
  const { t, language } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<SystemRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SystemRecord | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pts, apts, bills] = await Promise.all([
          api.getPatients(), 
          api.getAppointments(), 
          api.getBills()
        ]);
        
        const all: SystemRecord[] = [];
        
        (pts || []).forEach((p: any) => all.push({ 
          id: `p-${p.id}`, 
          originalId: p.id, 
          type: 'Patient', 
          reference: p.patientId, 
          date: p.createdAt, 
          primaryEntity: p.fullName, 
          status: p.type, 
          details: p 
        }));
        
        (apts || []).forEach((a: any) => all.push({ 
          id: `a-${a.id}`, 
          originalId: a.id, 
          type: 'Appointment', 
          reference: a.appointmentNumber || `#${a.id}`, 
          date: a.datetime, 
          primaryEntity: a.patientName, 
          associateEntity: a.staffName,
          status: a.status, 
          details: a 
        }));
        
        (bills || []).forEach((b: any) => all.push({ 
          id: `b-${b.id}`, 
          originalId: b.id, 
          type: 'Bill', 
          reference: b.billNumber, 
          date: b.date, 
          primaryEntity: b.patientName, 
          status: b.status, 
          value: b.totalAmount, 
          details: b 
        }));
        
        setRecords(all.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  // ... [Filtering and Exports logic remain the same] ...
  
  const filteredRecords = useMemo(() => records.filter(r => {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        r.reference.toLowerCase().includes(search) || 
        r.primaryEntity.toLowerCase().includes(search) ||
        (r.associateEntity && r.associateEntity.toLowerCase().includes(search));
        
      const matchesType = filterType === 'All' || r.type === filterType;
      const matchesStatus = statusFilter === 'All' || r.status.toLowerCase() === statusFilter.toLowerCase();
      
      return matchesSearch && matchesType && matchesStatus;
  }), [records, searchTerm, filterType, statusFilter]);

  const handleExportExcel = () => {
    // ... [Export logic] ...
    const headers = ["Type", "Date", "Reference", "Entity", "Associate", "Status", "Value"];
    const rows = filteredRecords.map(r => [
      r.type, 
      new Date(r.date).toLocaleString(), 
      r.reference, 
      r.primaryEntity, 
      r.associateEntity || "N/A", 
      r.status, 
      r.value || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(',')).join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `allcare_system_records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Sync Header
  useHeader(
    t('records_title'),
    t('records_subtitle'),
    <div className="relative" ref={exportMenuRef}>
      <Button variant="primary" icon={Download} onClick={() => setShowExportMenu(!showExportMenu)}>
        {t('records_export_button')} <ChevronDown size={14} className={`ml-2 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
      </Button>
      {showExportMenu && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Export Current View</p>
          </div>
          <button onClick={() => { window.print(); setShowExportMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"><Printer size={16} className="text-primary-500" /><span>Print as PDF Report</span></button>
          <button onClick={handleExportExcel} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-t border-slate-100 dark:border-slate-700"><FileSpreadsheet size={16} className="text-emerald-600" /><span>Download CSV (Excel)</span></button>
        </div>
      )}
    </div>
  );

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRecordIcon = (type: string) => {
    switch (type) {
      case 'Patient': return <Users className="text-blue-500" size={18} />;
      case 'Appointment': return <Calendar className="text-violet-500" size={18} />;
      case 'Bill': return <DollarSign className="text-emerald-500" size={18} />;
      default: return <FileText className="text-slate-400" size={18} />;
    }
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        {/* ... [Stats Cards JSX] ... */}
        <Card className="!py-2.5 !px-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Logs</p>
          <p className="text-xl font-black text-slate-800 dark:text-white leading-tight">{records.length.toLocaleString()}</p>
        </Card>
        <Card className="!py-2.5 !px-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Found</p>
          <p className="text-xl font-black text-primary-600 leading-tight">{filteredRecords.length.toLocaleString()}</p>
        </Card>
        <Card className="!py-2.5 !px-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Last 24h</p>
          <p className="text-xl font-black text-slate-800 dark:text-white leading-tight">
            {records.filter(r => new Date(r.date).getTime() > Date.now() - 86400000).length}
          </p>
        </Card>
        <Card className="!py-2.5 !px-4 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">System Health</p>
          <div className="flex items-center gap-1.5 text-emerald-500 font-bold text-sm leading-tight">
             <ShieldCheck size={14} /> Optimal
          </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden shadow-soft border-slate-200 dark:border-slate-700 print:shadow-none print:border-0">
        {/* ... [Search Bar] ... */}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/80">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Type / Ref</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Event Date</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Primary Entity</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-20 text-slate-400 font-medium">{t('records_table_loading')}</td></tr>
              ) : paginatedRecords.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-20 text-slate-400 font-medium">{t('records_table_empty')}</td></tr>
              ) : (
                paginatedRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group cursor-pointer" onClick={() => { setSelectedRecord(r); setIsModalOpen(true); }}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-500 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600">
                          {getRecordIcon(r.type)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-800 dark:text-white">{r.reference}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{r.type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{new Date(r.date).toLocaleDateString()}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{new Date(r.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                       </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-200">{r.primaryEntity}</div>
                      {r.associateEntity && <div className="text-[10px] text-slate-500 flex items-center gap-1"><User size={10}/> {r.associateEntity}</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={getStatusColor(r.status) as any}>{r.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* ... [Pagination] ... */}
      </Card>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Record Analysis: ${selectedRecord?.reference}`}
      >
        {/* ... [Modal Content - uses getStatusColor] ... */}
        {selectedRecord && (
          <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200 print-content">
            <div className="flex flex-wrap items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/20 rounded-2xl border border-primary-100 dark:border-primary-800/50">
              <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary-600">
                 {getRecordIcon(selectedRecord.type)}
              </div>
              <div className="flex-1">
                 <h3 className="font-black text-slate-900 dark:text-white text-lg leading-tight">{selectedRecord.primaryEntity}</h3>
                 <div className="flex items-center gap-2 mt-1">
                    <Badge color="blue">{selectedRecord.type}</Badge>
                    <Badge color={getStatusColor(selectedRecord.status) as any}>{selectedRecord.status}</Badge>
                 </div>
              </div>
              <div className="text-right hidden sm:block">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Entry Date</p>
                 <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(selectedRecord.date).toLocaleString()}</p>
              </div>
            </div>
            
            {/* ... rest of modal ... */}
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
            margin: 0 !important; 
            padding: 20px !important;
            background: white !important;
          }
          .no-print { display: none !important; }
          .badge, .Badge { border: 1px solid #ccc !important; }
        }
      `}</style>
    </div>
  );
};

const HashIcon = ({ size, className }: any) => <span className={className}>#</span>;