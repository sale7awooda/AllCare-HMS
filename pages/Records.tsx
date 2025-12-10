
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { 
  Search, Calendar, Filter, Database, FileText, User, Users, 
  DollarSign, Bed, Activity, Download, Eye, ArrowRight, ChevronDown
} from 'lucide-react';
import { api } from '../services/api';

// Unified Record Interface
interface SystemRecord {
  id: string; // Unique combination key
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
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<SystemRecord[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Modal
  const [selectedRecord, setSelectedRecord] = useState<SystemRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [pts, apts, bills, admissions] = await Promise.all([
          api.getPatients(),
          api.getAppointments(),
          api.getBills(),
          api.getActiveAdmissions() // Note: fetching active only for now, ideally backend has full history
        ]);

        const allRecords: SystemRecord[] = [];

        // Normalize Patients
        (Array.isArray(pts) ? pts : []).forEach((p: any) => {
          allRecords.push({
            id: `pat-${p.id}`,
            originalId: p.id,
            type: 'Patient',
            reference: p.patientId,
            date: p.createdAt || new Date().toISOString(), // Fallback
            primaryEntity: p.fullName,
            status: p.type,
            details: p
          });
        });

        // Normalize Appointments
        (Array.isArray(apts) ? apts : []).forEach((a: any) => {
          allRecords.push({
            id: `apt-${a.id}`,
            originalId: a.id,
            type: 'Appointment',
            reference: a.appointmentNumber,
            date: a.datetime,
            primaryEntity: a.patientName,
            associateEntity: a.staffName,
            status: a.status,
            details: a
          });
        });

        // Normalize Bills
        (Array.isArray(bills) ? bills : []).forEach((b: any) => {
          allRecords.push({
            id: `bill-${b.id}`,
            originalId: b.id,
            type: 'Bill',
            reference: b.billNumber,
            date: b.date,
            primaryEntity: b.patientName,
            status: b.status,
            value: b.totalAmount,
            details: b
          });
        });

        // Normalize Admissions
        (Array.isArray(admissions) ? admissions : []).forEach((ad: any) => {
          allRecords.push({
            id: `adm-${ad.id}`,
            originalId: ad.id,
            type: 'Admission',
            reference: `BED-${ad.roomNumber}`,
            date: ad.entry_date || ad.entryDate,
            primaryEntity: ad.patientName,
            associateEntity: ad.doctorName,
            status: ad.status,
            details: ad
          });
        });

        // Sort by date descending
        setRecords(allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

      } catch (e) {
        console.error("Failed to fetch records:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Filtering Logic ---
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Search (ID, Reference, Primary Entity)
      const matchesSearch = 
        r.reference.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.primaryEntity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.associateEntity && r.associateEntity.toLowerCase().includes(searchTerm.toLowerCase()));

      // 2. Type Filter
      const matchesType = filterType === 'All' || r.type === filterType;

      // 3. Date Range
      let matchesDate = true;
      if (dateRange.start) {
        matchesDate = matchesDate && new Date(r.date) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999); // End of day
        matchesDate = matchesDate && new Date(r.date) <= endDate;
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [records, searchTerm, filterType, dateRange]);

  // --- Pagination ---
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const handleViewDetails = (record: SystemRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleExport = () => {
    const headers = ['ID', 'Type', 'Date', 'Reference', 'Primary Entity', 'Associate', 'Status', 'Value'];
    const rows = filteredRecords.map(r => [
      r.id,
      r.type,
      new Date(r.date).toLocaleDateString(),
      r.reference,
      r.primaryEntity,
      r.associateEntity || '',
      r.status,
      r.value || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `system_records_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Patient': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Appointment': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
      case 'Bill': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Admission': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Patient': return Users;
      case 'Appointment': return Calendar;
      case 'Bill': return DollarSign;
      case 'Admission': return Bed;
      default: return FileText;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="text-primary-600" /> System Records
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Master registry of all hospital activities and data.</p>
        </div>
        <Button variant="outline" icon={Download} onClick={handleExport}>Export Data</Button>
      </div>

      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        
        {/* Filters Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-t-xl grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search ref, name..." 
              className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          
          <div className="relative">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
             <select 
               className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
               value={filterType}
               onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
             >
               <option value="All">All Types</option>
               <option value="Patient">Patients</option>
               <option value="Appointment">Appointments</option>
               <option value="Bill">Invoices</option>
               <option value="Admission">Admissions</option>
             </select>
          </div>

          <div className="grid grid-cols-2 gap-2 md:col-span-2">
             <input 
               type="date" 
               className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-600 dark:text-slate-300"
               value={dateRange.start}
               onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
               placeholder="Start Date"
             />
             <input 
               type="date" 
               className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-600 dark:text-slate-300"
               value={dateRange.end}
               onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
               placeholder="End Date"
             />
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-white dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Reference</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Primary Entity</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">Loading master records...</td></tr>
              ) : paginatedRecords.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-slate-500">No records found matching filters.</td></tr>
              ) : (
                paginatedRecords.map((r) => {
                  const Icon = getTypeIcon(r.type);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`p-2 rounded-lg mr-3 ${getTypeColor(r.type)}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 dark:text-white">{r.reference}</div>
                            <div className="text-xs text-slate-500">{r.type}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                        {new Date(r.date).toLocaleDateString()} <span className="text-slate-400 text-xs">{new Date(r.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{r.primaryEntity}</div>
                        {r.associateEntity && <div className="text-xs text-slate-500">w/ {r.associateEntity}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                        {r.value ? <span className="font-mono font-bold">${r.value.toLocaleString()}</span> : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Badge color={r.status === 'completed' || r.status === 'paid' || r.status === 'active' ? 'green' : 'yellow'}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => handleViewDetails(r)}
                          className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filteredRecords.length > 0 && (
           <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-xl">
             <span className="text-sm text-slate-500 dark:text-slate-400">
                Page {currentPage} of {totalPages} ({filteredRecords.length} records)
             </span>
             <div className="flex gap-2">
               <Button 
                 size="sm" 
                 variant="secondary" 
                 disabled={currentPage === 1}
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
               >
                 Previous
               </Button>
               <Button 
                 size="sm" 
                 variant="secondary" 
                 disabled={currentPage === totalPages}
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
               >
                 Next
               </Button>
             </div>
           </div>
        )}
      </Card>

      {/* Detail Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${selectedRecord?.type} Details`}>
        {selectedRecord && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
               <div className={`p-3 rounded-full ${getTypeColor(selectedRecord.type)}`}>
                 {React.createElement(getTypeIcon(selectedRecord.type), { size: 24 })}
               </div>
               <div>
                 <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedRecord.reference}</h3>
                 <p className="text-sm text-slate-500">{new Date(selectedRecord.date).toLocaleString()}</p>
               </div>
               <div className="ml-auto">
                 <Badge color="blue">{selectedRecord.status}</Badge>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
               <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                 <span className="block text-xs text-slate-400 uppercase font-bold mb-1">Primary Entity</span>
                 <span className="font-medium text-slate-900 dark:text-white">{selectedRecord.primaryEntity}</span>
               </div>
               {selectedRecord.associateEntity && (
                 <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                   <span className="block text-xs text-slate-400 uppercase font-bold mb-1">Associate</span>
                   <span className="font-medium text-slate-900 dark:text-white">{selectedRecord.associateEntity}</span>
                 </div>
               )}
               {selectedRecord.value !== undefined && (
                 <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                   <span className="block text-xs text-slate-400 uppercase font-bold mb-1">Value</span>
                   <span className="font-bold text-emerald-600">${selectedRecord.value.toLocaleString()}</span>
                 </div>
               )}
            </div>

            <div>
              <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">Raw Data</h4>
              <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono overflow-auto max-h-60 custom-scrollbar">
                <pre>{JSON.stringify(selectedRecord.details, null, 2)}</pre>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-slate-700">
              <Button onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
