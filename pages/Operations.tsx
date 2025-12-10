
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Select, Textarea } from '../components/UI';
import { Activity, CheckCircle, Clock, User, Syringe, Plus, Trash2, Calculator, Save, ChevronRight, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export const Operations = () => {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Estimation Modal State
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  
  // Cost Form State
  const [costForm, setCostForm] = useState({
    surgeonFee: 0,
    theaterFee: 0,
    anesthesiologist: { id: '', name: '', fee: 0 },
    assistant: { id: '', name: '', fee: 0 },
    nurses: [] as { name: string, fee: number }[],
    drugs: [] as { name: string, fee: number }[],
    equipment: [] as { name: string, fee: number }[],
    others: [] as { name: string, fee: number }[],
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
    const surgeon = staff.find(s => s.id === op.doctor_id);
    
    // Initialize defaults
    // Find matching catalog op to get base cost if possible (not loaded here currently, assuming op has projected_cost or 0)
    // If op was created via new flow, projected_cost is 0 initially.
    
    // We can try to look up the surgeon's consultation fee or a standard op fee if we had the catalog here. 
    // For now, default to 0 or existing if re-opening.
    
    setCostForm({
      surgeonFee: 0,
      theaterFee: 0, 
      anesthesiologist: { id: '', name: '', fee: 0 },
      assistant: { id: '', name: '', fee: 0 },
      nurses: [{ name: '', fee: 0 }], // Start with 1 empty slot
      drugs: [],
      equipment: [],
      others: [],
    });
    
    setSelectedOp(op);
    setIsEstimateModalOpen(true);
  };

  // Helper to add item to dynamic list
  const addItem = (field: 'nurses' | 'drugs' | 'equipment' | 'others') => {
    setCostForm(prev => ({
      ...prev,
      [field]: [...prev[field], { name: '', fee: 0 }]
    }));
  };

  // Helper to update dynamic list item
  const updateItem = (field: 'nurses' | 'drugs' | 'equipment' | 'others', index: number, key: 'name' | 'fee', value: any) => {
    const newList = [...costForm[field]];
    newList[index] = { ...newList[index], [key]: key === 'fee' ? parseFloat(value) || 0 : value };
    setCostForm(prev => ({ ...prev, [field]: newList }));
  };

  // Helper to remove item
  const removeItem = (field: 'nurses' | 'drugs' | 'equipment' | 'others', index: number) => {
    const newList = [...costForm[field]];
    newList.splice(index, 1);
    setCostForm(prev => ({ ...prev, [field]: newList }));
  };

  // Auto-update Theater Fee when Surgeon Fee changes (if not manually overridden logic - simplified here)
  useEffect(() => {
    // If theater fee is 0, maybe default it to surgeon fee? 
    // Let's just keep them independent but initialize similarly if needed.
  }, [costForm.surgeonFee]);

  const calculateTotal = () => {
    const nursesTotal = costForm.nurses.reduce((sum, item) => sum + item.fee, 0);
    const drugsTotal = costForm.drugs.reduce((sum, item) => sum + item.fee, 0);
    const equipTotal = costForm.equipment.reduce((sum, item) => sum + item.fee, 0);
    const othersTotal = costForm.others.reduce((sum, item) => sum + item.fee, 0);
    
    return costForm.surgeonFee + costForm.theaterFee + costForm.anesthesiologist.fee + costForm.assistant.fee + nursesTotal + drugsTotal + equipTotal + othersTotal;
  };

  const handleProcessSubmit = async () => {
    if (!selectedOp) return;
    setProcessStatus('processing');
    try {
      const total = calculateTotal();
      const payload = {
        details: {
          ...costForm,
          nursesTotal: costForm.nurses.reduce((sum, item) => sum + item.fee, 0),
          drugsTotal: costForm.drugs.reduce((sum, item) => sum + item.fee, 0)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Operations Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Schedule, cost estimation, and theater management.</p>
        </div>
        <Button variant="outline" onClick={loadData}>Refresh</Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Procedure</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Surgeon</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">Loading operations...</td></tr>
              ) : ops.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-500">No scheduled operations found.</td></tr>
              ) : (
                ops.map(op => (
                  <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(op.created_at).toLocaleDateString()} <span className="text-xs block text-gray-400">Request Date</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900 dark:text-white">{op.operation_name}</div>
                      {op.notes && <div className="text-xs text-gray-500 truncate max-w-[150px]">{op.notes}</div>}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      {op.patientName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      Dr. {op.doctorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge color={op.status === 'confirmed' ? 'green' : op.status === 'pending_payment' ? 'blue' : 'yellow'}>
                        {op.status === 'confirmed' ? 'Ready for Surgery' : op.status === 'pending_payment' ? 'Pending Payment' : 'Requested'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {op.status === 'requested' && (
                        <Button size="sm" onClick={() => openEstimateModal(op)} icon={Calculator}>
                          Process Request
                        </Button>
                      )}
                      {op.status === 'pending_payment' && (
                        <span className="text-xs text-blue-600 font-bold flex items-center justify-end gap-1">
                          <Clock size={14}/> Awaiting Payment
                        </span>
                      )}
                      {op.status === 'confirmed' && (
                        <Button size="sm" variant="outline" icon={CheckCircle}>Complete</Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Cost Estimation Modal */}
      <Modal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} title="Operation Cost Estimation & Billing">
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
            <div>
              <h4 className="font-bold text-blue-900 dark:text-blue-300">{selectedOp?.operation_name}</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">Patient: {selectedOp?.patientName} • Surgeon: Dr. {selectedOp?.doctorName}</p>
            </div>
            <div className="text-right">
              <span className="block text-xs uppercase text-blue-600 font-bold">Total Estimated Cost</span>
              <span className="text-2xl font-bold text-blue-800 dark:text-white">${calculateTotal().toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Column 1: Core Fees */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-white border-b pb-2">Professional Fees</h4>
              
              <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg space-y-3">
                <Input label="Surgeon Fee ($)" type="number" value={costForm.surgeonFee} onChange={e => {
                   const val = parseFloat(e.target.value) || 0;
                   setCostForm({...costForm, surgeonFee: val, theaterFee: costForm.theaterFee === 0 ? val : costForm.theaterFee }); // Auto-set theater fee if 0
                }} />
                
                <div className="grid grid-cols-2 gap-2">
                   <div className="col-span-2">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Anesthesiologist</label>
                     <select 
                       className="w-full rounded-lg border-gray-300 text-sm mb-2 p-2"
                       value={costForm.anesthesiologist.id}
                       onChange={e => {
                         const s = staff.find(st => st.id.toString() === e.target.value);
                         setCostForm({...costForm, anesthesiologist: { id: s?.id.toString() || '', name: s?.fullName || '', fee: costForm.anesthesiologist.fee }})
                       }}
                     >
                        <option value="">Select Staff...</option>
                        {staff.filter(s => s.type === 'anesthesiologist').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                     </select>
                     <Input placeholder="Fee ($)" type="number" value={costForm.anesthesiologist.fee} onChange={e => setCostForm({...costForm, anesthesiologist: {...costForm.anesthesiologist, fee: parseFloat(e.target.value) || 0}})} />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                   <div className="col-span-2">
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assistant Surgeon</label>
                     <select 
                       className="w-full rounded-lg border-gray-300 text-sm mb-2 p-2"
                       value={costForm.assistant.id}
                       onChange={e => {
                         const s = staff.find(st => st.id.toString() === e.target.value);
                         setCostForm({...costForm, assistant: { id: s?.id.toString() || '', name: s?.fullName || '', fee: costForm.assistant.fee }})
                       }}
                     >
                        <option value="">Select Staff...</option>
                        {staff.filter(s => ['doctor', 'medical_assistant'].includes(s.type)).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                     </select>
                     <Input placeholder="Fee ($)" type="number" value={costForm.assistant.fee} onChange={e => setCostForm({...costForm, assistant: {...costForm.assistant, fee: parseFloat(e.target.value) || 0}})} />
                   </div>
                </div>
              </div>

              <h4 className="font-bold text-gray-800 dark:text-white border-b pb-2 pt-2">Facility Fees</h4>
              <Input label="Theater Fee ($)" type="number" value={costForm.theaterFee} onChange={e => setCostForm({...costForm, theaterFee: parseFloat(e.target.value) || 0})} />
            </div>

            {/* Column 2: Breakdown Lists */}
            <div className="space-y-4">
              {/* Nurses */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm">Nurses</h4>
                  <button type="button" onClick={() => addItem('nurses')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="space-y-2">
                  {costForm.nurses.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input placeholder="Nurse Name" className="flex-1 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.name} onChange={e => updateItem('nurses', idx, 'name', e.target.value)} />
                      <input placeholder="$" type="number" className="w-20 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.fee} onChange={e => updateItem('nurses', idx, 'fee', e.target.value)} />
                      <button onClick={() => removeItem('nurses', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drugs */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm">Drugs & Consumables</h4>
                  <button type="button" onClick={() => addItem('drugs')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="space-y-2">
                  {costForm.drugs.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input placeholder="Drug Name/Item" className="flex-1 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.name} onChange={e => updateItem('drugs', idx, 'name', e.target.value)} />
                      <input placeholder="$" type="number" className="w-20 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.fee} onChange={e => updateItem('drugs', idx, 'fee', e.target.value)} />
                      <button onClick={() => removeItem('drugs', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm">Equipment Usage</h4>
                  <button type="button" onClick={() => addItem('equipment')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                <div className="space-y-2">
                  {costForm.equipment.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input placeholder="Equipment" className="flex-1 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.name} onChange={e => updateItem('equipment', idx, 'name', e.target.value)} />
                      <input placeholder="$" type="number" className="w-20 rounded-lg border-gray-300 text-sm px-2 py-1" value={item.fee} onChange={e => updateItem('equipment', idx, 'fee', e.target.value)} />
                      <button onClick={() => removeItem('equipment', idx)} className="text-red-400 hover:text-red-600"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsEstimateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleProcessSubmit} disabled={processStatus === 'processing'} icon={Save}>
              {processStatus === 'processing' ? 'Processing...' : 'Generate Bill'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
