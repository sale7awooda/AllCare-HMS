
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Select, Textarea } from '../components/UI';
import { 
  Activity, CheckCircle, Clock, User, Syringe, Plus, Trash2, 
  Calculator, Save, ChevronRight, AlertTriangle, Stethoscope, 
  Package, Zap, Calendar, DollarSign, ChevronDown, ChevronUp, FileText, Briefcase, Search, History, Filter
} from 'lucide-react';
import { api } from '../services/api';

// Configuration Constants
const FEE_RATIOS: Record<string, number> = {
  'anesthesiologist': 0.5,
  'assistant': 0.5,
  'nurse': 0.33,
  'technician': 0.25
};

export const Operations = () => {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'requests' | 'schedule' | 'history'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estimation Modal State
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  const [expandedSection, setExpandedSection] = useState<string>('team');
  
  // Revised Cost Form State
  interface Participant {
    id: number;
    role: string;
    staffId: string;
    name: string;
    fee: number;
  }

  interface ResourceItem {
    id: number;
    name: string;
    cost: number;
  }

  const [costForm, setCostForm] = useState({
    surgeonFee: 0,
    theaterFee: 0,
    participants: [] as Participant[],
    consumables: [] as ResourceItem[],
    equipment: [] as ResourceItem[],
    others: [] as ResourceItem[],
  });

  const [processStatus, setProcessStatus] = useState('idle');

  const loadData = async () => {
    setLoading(true);
    try {
      const [opsData, staffData] = await Promise.all([
        api.getScheduledOperations(),
        api.getStaff()
      ]);
      setOps(opsData);
      setStaff(staffData);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const openEstimateModal = (op: any) => {
    // Determine default fee from the assigned doctor if available
    let initialSurgeonFee = 0;
    if (op.doctor_id) {
        const doctor = staff.find(s => s.id === op.doctor_id);
        if (doctor) initialSurgeonFee = doctor.consultationFee * 5; // Simplified default multiplier
    }

    setCostForm({
      surgeonFee: initialSurgeonFee,
      theaterFee: initialSurgeonFee,
      participants: [],
      consumables: [],
      equipment: [],
      others: [],
    });
    
    setSelectedOp(op);
    setIsEstimateModalOpen(true);
  };

  // --- LOGIC HANDLERS ---

  const calculateParticipantFee = (role: string, baseSurgeonFee: number) => {
    const ratio = FEE_RATIOS[role] || 0;
    return Math.round(baseSurgeonFee * ratio);
  };

  const handleSurgeonFeeChange = (val: string) => {
    const newFee = parseFloat(val) || 0;
    setCostForm(prev => ({
      ...prev,
      surgeonFee: newFee,
      theaterFee: newFee, 
      participants: prev.participants.map(p => ({
        ...p,
        fee: calculateParticipantFee(p.role, newFee)
      }))
    }));
  };

  const addParticipant = () => {
    setCostForm(prev => ({
      ...prev,
      participants: [...prev.participants, { 
        id: Date.now(), 
        role: 'nurse', 
        staffId: '', 
        name: '', 
        fee: calculateParticipantFee('nurse', prev.surgeonFee) 
      }]
    }));
  };

  const updateParticipant = (index: number, field: keyof Participant, value: any) => {
    setCostForm(prev => {
      const updatedList = [...prev.participants];
      const item = { ...updatedList[index] };

      if (field === 'role') {
        item.role = value;
        item.fee = calculateParticipantFee(value, prev.surgeonFee);
        item.staffId = '';
        item.name = '';
      } else if (field === 'staffId') {
        item.staffId = value;
        const staffMember = staff.find(s => s.id.toString() === value);
        item.name = staffMember?.fullName || '';
      } else if (field === 'fee') {
        item.fee = parseFloat(value) || 0;
      }

      updatedList[index] = item;
      return { ...prev, participants: updatedList };
    });
  };

  const removeParticipant = (index: number) => {
    setCostForm(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== index)
    }));
  };

  const addResource = (type: 'consumables' | 'equipment' | 'others') => {
    setCostForm(prev => ({
      ...prev,
      [type]: [...prev[type], { id: Date.now(), name: '', cost: 0 }]
    }));
  };

  const updateResource = (type: 'consumables' | 'equipment' | 'others', index: number, field: 'name' | 'cost', value: any) => {
    setCostForm(prev => {
      const updatedList = [...prev[type]];
      updatedList[index] = { 
        ...updatedList[index], 
        [field]: field === 'cost' ? (parseFloat(value) || 0) : value 
      };
      return { ...prev, [type]: updatedList };
    });
  };

  const removeResource = (type: 'consumables' | 'equipment' | 'others', index: number) => {
    setCostForm(prev => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index)
    }));
  };

  const calculateTotal = () => {
    const participantsTotal = costForm.participants.reduce((sum, p) => sum + p.fee, 0);
    const consumablesTotal = costForm.consumables.reduce((sum, i) => sum + i.cost, 0);
    const equipmentTotal = costForm.equipment.reduce((sum, i) => sum + i.cost, 0);
    const othersTotal = costForm.others.reduce((sum, i) => sum + i.cost, 0);
    return costForm.surgeonFee + costForm.theaterFee + participantsTotal + consumablesTotal + equipmentTotal + othersTotal;
  };

  const handleProcessSubmit = async () => {
    if (!selectedOp) return;
    setProcessStatus('processing');
    try {
      const total = calculateTotal();
      const payload = {
        details: {
          ...costForm,
          anesthesiologist: costForm.participants.find(p => p.role === 'anesthesiologist'),
          assistant: costForm.participants.find(p => p.role === 'assistant'),
        },
        totalCost: total
      };
      
      await api.processOperationRequest(selectedOp.id, payload);
      setProcessStatus('success');
      setIsEstimateModalOpen(false);
      loadData();
    } catch (e) {
      console.error(e);
      alert("Failed to process request");
    } finally {
      setProcessStatus('idle');
    }
  };

  const handleCompleteOp = async (opId: number) => {
      if(!confirm("Mark this operation as completed?")) return;
      try {
          await api.completeOperation(opId);
          loadData();
      } catch (e) { 
          console.error(e);
          alert("Failed to update status");
      }
  };

  // Filter lists based on Search & Status
  const filteredOps = ops.filter(op => {
      const search = searchTerm.toLowerCase();
      return (
          op.patientName.toLowerCase().includes(search) ||
          op.operation_name.toLowerCase().includes(search) ||
          (op.doctorName && op.doctorName.toLowerCase().includes(search))
      );
  });

  const pendingRequests = filteredOps.filter(op => op.status === 'requested' || op.status === 'pending_payment');
  const scheduledOps = filteredOps.filter(op => op.status === 'confirmed');
  const completedOps = filteredOps.filter(op => op.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Theater Command Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage surgical requests, cost estimation, and theater schedules.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search operations..." 
                    className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg shrink-0 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('requests')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'requests' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <FileText size={16}/> Requests <span className="bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs px-2 py-0.5 rounded-full ml-1">{pendingRequests.length}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('schedule')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'schedule' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <Calendar size={16}/> Schedule <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-2 py-0.5 rounded-full ml-1">{scheduledOps.length}</span>
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    <History size={16}/> History
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
            {pendingRequests.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    <CheckCircle size={48} className="mx-auto mb-3 opacity-20"/>
                    <p>{searchTerm ? 'No requests match your search.' : 'No pending operation requests.'}</p>
                </div>
            ) : (
                pendingRequests.map(op => (
                    <Card key={op.id} className="relative group border-l-4 border-l-yellow-400">
                        <div className="flex justify-between items-start mb-3">
                            <Badge color={op.status === 'pending_payment' ? 'blue' : 'yellow'}>
                                {op.status === 'pending_payment' ? 'Awaiting Payment' : 'Needs Estimation'}
                            </Badge>
                            <span className="text-xs text-slate-400">{new Date(op.created_at).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">{op.operation_name}</h3>
                        <p className="text-sm text-slate-500 mb-4">{op.patientName} • Dr. {op.doctorName}</p>
                        
                        {op.status === 'pending_payment' ? (
                            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Est. Cost</span>
                                <span className="font-bold text-lg text-slate-900 dark:text-white">${op.projected_cost.toLocaleString()}</span>
                            </div>
                        ) : (
                            <Button className="w-full" onClick={() => openEstimateModal(op)} icon={Calculator}>
                                Process Cost & Team
                            </Button>
                        )}
                    </Card>
                ))
            )}
        </div>
      )}

      {activeTab === 'schedule' && (
          <Card className="!p-0 overflow-hidden animate-in fade-in">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procedure</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surgeon</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {scheduledOps.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-500">No scheduled operations found.</td></tr>
                  ) : (
                    scheduledOps.map(op => (
                      <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                            <Badge color="green">Confirmed</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(op.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{op.operation_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {op.patientName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          Dr. {op.doctorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <Button size="sm" variant="outline" icon={CheckCircle} onClick={() => handleCompleteOp(op.id)}>
                             Mark Complete
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
      )}

      {activeTab === 'history' && (
          <Card className="!p-0 overflow-hidden animate-in fade-in">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Completed Date</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procedure</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surgeon</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Final Cost</th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {completedOps.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-slate-500">No completed operations found in history.</td></tr>
                  ) : (
                    completedOps.map(op => (
                      <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors opacity-75 hover:opacity-100">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(op.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-gray-900 dark:text-white">{op.operation_name}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {op.patientName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          Dr. {op.doctorName}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-mono text-slate-600 dark:text-slate-300">
                          ${op.projected_cost.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                           <Badge color="gray">Completed</Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
      )}

      {/* Cost Estimation Modal */}
      <Modal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} title="Operation Cost Estimation">
        <div className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Patient Safety Context Banner */}
          <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/30 flex items-start gap-3">
             <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18}/>
             <div className="text-sm">
                <p className="font-bold text-red-800 dark:text-red-300">Clinical Safety Check</p>
                <div className="flex gap-4 mt-1 text-red-700 dark:text-red-400">
                    <span>Blood Group: <strong>Unknown</strong></span>
                    <span>Allergies: <strong>None Recorded</strong></span>
                </div>
                <p className="text-xs mt-1 opacity-80">Verify allergies before adding drugs.</p>
             </div>
          </div>

          {/* Sticky Total Banner */}
          <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center sticky top-0 z-10">
            <div>
              <h4 className="font-bold text-lg">{selectedOp?.operation_name}</h4>
              <p className="text-xs text-slate-400">Dr. {selectedOp?.doctorName}</p>
            </div>
            <div className="text-right">
              <span className="block text-xs uppercase text-slate-400 font-bold">Total Estimate</span>
              <span className="text-2xl font-bold text-green-400">${calculateTotal().toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            
            {/* SECTION 1: Professional Fees (Base) */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button 
                    onClick={() => setExpandedSection(expandedSection === 'team' ? '' : 'team')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="flex items-center gap-2"><User size={18}/> Professional Fees & Team</span>
                    {expandedSection === 'team' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                
                {expandedSection === 'team' && (
                    <div className="p-4 space-y-4 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                            <Input 
                                label="Surgeon Fee ($)" 
                                type="number" 
                                value={costForm.surgeonFee} 
                                onChange={e => handleSurgeonFeeChange(e.target.value)} 
                                className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                            />
                            <Input 
                                label="Theater Fee ($)" 
                                type="number" 
                                value={costForm.theaterFee} 
                                onChange={e => setCostForm({...costForm, theaterFee: parseFloat(e.target.value) || 0})}
                                className="font-bold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800"
                            />
                        </div>

                        <div className="space-y-3 pt-2">
                            <div className="flex justify-between items-center">
                                <h5 className="text-sm font-bold text-slate-500 uppercase">Additional Staff</h5>
                                <Button size="sm" variant="secondary" onClick={addParticipant} icon={Plus} className="h-7 text-xs">Add Staff</Button>
                            </div>
                            {costForm.participants.map((p, idx) => (
                                <div key={p.id} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <select 
                                        className="w-1/3 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs py-1.5 focus:border-primary-500"
                                        value={p.role}
                                        onChange={e => updateParticipant(idx, 'role', e.target.value)}
                                    >
                                        {Object.keys(FEE_RATIOS).map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                                    </select>
                                    <select 
                                        className="flex-1 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs py-1.5 focus:border-primary-500"
                                        value={p.staffId}
                                        onChange={e => updateParticipant(idx, 'staffId', e.target.value)}
                                    >
                                        <option value="">Select Staff...</option>
                                        {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                                    </select>
                                    <input 
                                        type="number"
                                        className="w-20 rounded-md border-slate-300 dark:border-slate-600 text-xs py-1.5 px-2 bg-white dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-300 focus:border-primary-500"
                                        value={p.fee}
                                        onChange={e => updateParticipant(idx, 'fee', e.target.value)}
                                    />
                                    <button onClick={() => removeParticipant(idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SECTION 2: Consumables & Drugs */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button 
                    onClick={() => setExpandedSection(expandedSection === 'supplies' ? '' : 'supplies')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="flex items-center gap-2"><Syringe size={18}/> Drugs & Consumables</span>
                    {expandedSection === 'supplies' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                
                {expandedSection === 'supplies' && (
                    <div className="p-4 space-y-3 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2">
                        <div className="flex justify-end">
                             <Button size="sm" variant="ghost" onClick={() => addResource('consumables')} icon={Plus} className="text-primary-600 h-6 text-xs">Add Item</Button>
                        </div>
                        {costForm.consumables.length === 0 && <p className="text-xs text-center text-slate-400 italic">No items added.</p>}
                        {costForm.consumables.map((item, idx) => (
                            <div key={item.id} className="flex gap-2">
                                <input placeholder="Item Name" className="flex-1 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-3 py-1.5 focus:bg-white focus:border-primary-500 transition-colors" value={item.name} onChange={e => updateResource('consumables', idx, 'name', e.target.value)} />
                                <input placeholder="$" type="number" className="w-24 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-2 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:bg-white focus:border-primary-500 transition-colors" value={item.cost} onChange={e => updateResource('consumables', idx, 'cost', e.target.value)} />
                                <button onClick={() => removeResource('consumables', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 3: Equipment */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button 
                    onClick={() => setExpandedSection(expandedSection === 'equipment' ? '' : 'equipment')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="flex items-center gap-2"><Zap size={18}/> Equipment Usage</span>
                    {expandedSection === 'equipment' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                
                {expandedSection === 'equipment' && (
                    <div className="p-4 space-y-3 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2">
                        <div className="flex justify-end">
                             <Button size="sm" variant="ghost" onClick={() => addResource('equipment')} icon={Plus} className="text-primary-600 h-6 text-xs">Add Equipment</Button>
                        </div>
                        {costForm.equipment.length === 0 && <p className="text-xs text-center text-slate-400 italic">No equipment charges.</p>}
                        {costForm.equipment.map((item, idx) => (
                            <div key={item.id} className="flex gap-2">
                                <input placeholder="Device Name" className="flex-1 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-3 py-1.5 focus:bg-white focus:border-primary-500 transition-colors" value={item.name} onChange={e => updateResource('equipment', idx, 'name', e.target.value)} />
                                <input placeholder="$" type="number" className="w-24 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-2 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:bg-white focus:border-primary-500 transition-colors" value={item.cost} onChange={e => updateResource('equipment', idx, 'cost', e.target.value)} />
                                <button onClick={() => removeResource('equipment', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SECTION 4: Other Fees */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button 
                    onClick={() => setExpandedSection(expandedSection === 'others' ? '' : 'others')}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                    <span className="flex items-center gap-2"><Briefcase size={18}/> Other Fees & Misc</span>
                    {expandedSection === 'others' ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                </button>
                
                {expandedSection === 'others' && (
                    <div className="p-4 space-y-3 bg-white dark:bg-slate-900 animate-in slide-in-from-top-2">
                        <div className="flex justify-end">
                             <Button size="sm" variant="ghost" onClick={() => addResource('others')} icon={Plus} className="text-primary-600 h-6 text-xs">Add Fee</Button>
                        </div>
                        {costForm.others.length === 0 && <p className="text-xs text-center text-slate-400 italic">No miscellaneous fees.</p>}
                        {costForm.others.map((item, idx) => (
                            <div key={item.id} className="flex gap-2">
                                <input placeholder="Description (e.g. Transport)" className="flex-1 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-3 py-1.5 focus:bg-white focus:border-primary-500 transition-colors" value={item.name} onChange={e => updateResource('others', idx, 'name', e.target.value)} />
                                <input placeholder="$" type="number" className="w-24 rounded-md border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm px-2 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:bg-white focus:border-primary-500 transition-colors" value={item.cost} onChange={e => updateResource('others', idx, 'cost', e.target.value)} />
                                <button onClick={() => removeResource('others', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-slate-800 py-2">
            <Button variant="secondary" onClick={() => setIsEstimateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleProcessSubmit} disabled={processStatus === 'processing'} icon={Save}>
              {processStatus === 'processing' ? 'Processing...' : 'Generate Invoice'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
