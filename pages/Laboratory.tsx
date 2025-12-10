
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea } from '../components/UI';
import { FlaskConical, CheckCircle, Search, Clock, FileText, User, ChevronRight, Activity, History as HistoryIcon, Save } from 'lucide-react';
import { api } from '../services/api';

export const Laboratory = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [resultForm, setResultForm] = useState({ notes: '', results: '' });
  const [processStatus, setProcessStatus] = useState('idle');

  const loadData = async () => {
    setLoading(true);
    try {
      // In a real app, you might have separate endpoints. 
      // For now, we fetch all and filter client-side or assume the endpoint returns relevant data.
      const data = await api.getPendingLabRequests(); 
      // Note: The backend update below will ensure this endpoint or a new one returns both pending and history based on query, 
      // or we just fetch all and filter here if the dataset is small.
      // Let's assume the API returns a unified list we can filter.
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openProcessModal = (req: any) => {
    setSelectedReq(req);
    setResultForm({ notes: '', results: '' });
    setIsProcessModalOpen(true);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq) return;
    
    setProcessStatus('processing');
    try {
      await api.completeLabRequest(selectedReq.id, resultForm);
      setProcessStatus('success');
      await loadData();
      setTimeout(() => {
        setIsProcessModalOpen(false);
        setProcessStatus('idle');
      }, 1000);
    } catch (error) {
      console.error(error);
      alert('Failed to save results.');
      setProcessStatus('idle');
    }
  };

  // Parsing test names from IDs or string (Backend logic dependency)
  // Assuming the backend returns a 'tests' array or string description now.
  // If not, we fall back to generic display.

  const filteredRequests = requests.filter(r => {
    const matchesSearch = r.patientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === 'queue' 
      ? (r.status === 'pending' || r.status === 'confirmed') 
      : (r.status === 'completed');
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laboratory Workbench</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage sample collection, processing, and result entry.</p>
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('queue')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'queue' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <FlaskConical size={16}/> Work Queue <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs px-2 py-0.5 rounded-full ml-1">{requests.filter(r => r.status !== 'completed').length}</span>
            </button>
            <button 
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <HistoryIcon size={16}/> History
            </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <Card className="!p-4">
        <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
                type="text" 
                placeholder="Search by patient name..." 
                className="pl-10 w-full sm:w-96 rounded-lg border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
        </div>
      </Card>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
            <div className="text-center py-20 text-slate-400">Loading requests...</div>
        ) : filteredRequests.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <FlaskConical size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">No requests found in {activeTab}.</p>
            </div>
        ) : (
            filteredRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-6 items-start sm:items-center group">
                    
                    {/* Date/Time Box */}
                    <div className="flex flex-col items-center justify-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg min-w-[80px] border border-slate-100 dark:border-slate-700">
                        <span className="text-xs font-bold text-slate-400 uppercase">{new Date(req.created_at).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-slate-200">{new Date(req.created_at).getDate()}</span>
                        <span className="text-xs text-slate-400">{new Date(req.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>

                    {/* Patient & Test Info */}
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{req.patientName}</h3>
                            <Badge color={req.status === 'confirmed' ? 'green' : req.status === 'completed' ? 'gray' : 'yellow'}>
                                {req.status === 'confirmed' ? 'Paid & Ready' : req.status === 'completed' ? 'Results Ready' : 'Payment Pending'}
                            </Badge>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mt-2">
                            {/* If test names are available, map them. Otherwise show placeholder */}
                            {req.testNames ? (
                                req.testNames.split(',').map((t: string, i: number) => (
                                    <span key={i} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-md font-medium border border-blue-100 dark:border-blue-800">
                                        {t.trim()}
                                    </span>
                                ))
                            ) : (
                                <span className="text-sm text-slate-500 italic">Laboratory Investigation Request</span>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                        {req.status === 'completed' ? (
                            <Button variant="outline" size="sm" icon={FileText}>View Report</Button>
                        ) : (
                            <Button 
                                onClick={() => openProcessModal(req)} 
                                disabled={req.status === 'pending'} // Disable if not paid (pending usually means unpaid in this system context)
                                className={req.status === 'pending' ? 'opacity-50' : ''}
                                icon={req.status === 'pending' ? Clock : Activity}
                            >
                                {req.status === 'pending' ? 'Awaiting Payment' : 'Enter Results'}
                            </Button>
                        )}
                    </div>
                </div>
            ))
        )}
      </div>

      {/* Result Entry Modal */}
      <Modal isOpen={isProcessModalOpen} onClose={() => setIsProcessModalOpen(false)} title="Enter Test Results">
        <form onSubmit={handleComplete} className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex justify-between mb-2">
                    <span className="text-sm text-slate-500">Patient</span>
                    <span className="font-bold text-slate-800 dark:text-white">{selectedReq?.patientName}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Tests</span>
                    <span className="font-medium text-slate-800 dark:text-white text-right max-w-[200px]">{selectedReq?.testNames || 'Lab Request'}</span>
                </div>
            </div>

            <div className="space-y-4">
                <Textarea 
                    label="Clinical Findings / Values" 
                    placeholder="Enter detailed results, values, and reference ranges..."
                    rows={6}
                    required
                    value={resultForm.results}
                    onChange={e => setResultForm({...resultForm, results: e.target.value})}
                />
                <Input 
                    label="Technician Notes (Internal)" 
                    placeholder="Comments on sample quality, etc."
                    value={resultForm.notes}
                    onChange={e => setResultForm({...resultForm, notes: e.target.value})}
                />
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsProcessModalOpen(false)}>Cancel</Button>
                <Button type="submit" icon={Save} disabled={processStatus === 'processing'}>
                    {processStatus === 'processing' ? 'Saving...' : 'Finalize & Publish'}
                </Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};
