
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Select, Textarea } from '../components/UI';
import { Activity, CheckCircle, Clock, User, Syringe, Plus, Trash2, Calculator, Save, ChevronRight, AlertTriangle, Stethoscope, Package, Zap } from 'lucide-react';
import { api } from '../services/api';

// Configuration Constants (In a real app, these would come from the API)
const FEE_RATIOS: Record<string, number> = {
  'anesthesiologist': 0.5, // 50% of surgeon fee
  'assistant': 0.5,        // 50% of surgeon fee
  'nurse': 0.33,           // 33% of surgeon fee
  'technician': 0.25       // 25% of surgeon fee
};

export const Operations = () => {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<any[]>([]);
  
  // Estimation Modal State
  const [isEstimateModalOpen, setIsEstimateModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<any>(null);
  
  // Revised Cost Form State
  interface Participant {
    id: number; // timestamp
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
    consumables: [] as ResourceItem[], // Drugs/Consumables
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
    // Reset Form
    setCostForm({
      surgeonFee: 0,
      theaterFee: 0,
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
      theaterFee: newFee, // Default: Theater fee matches Surgeon fee
      // Update all existing participants based on new base fee
      participants: prev.participants.map(p => ({
        ...p,
        fee: calculateParticipantFee(p.role, newFee)
      }))
    }));
  };

  // Participants Logic
  const addParticipant = () => {
    setCostForm(prev => ({
      ...prev,
      participants: [...prev.participants, { 
        id: Date.now(), 
        role: 'nurse', // Default
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
        // Recalculate fee when role changes
        item.fee = calculateParticipantFee(value, prev.surgeonFee);
        // Clear staff selection if role changes (optional, but safer)
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

  // Resources Logic (Consumables, Equipment, Others)
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

  // Totals
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
      
      // Map frontend structure to backend expectation (simplified for storage)
      const payload = {
        details: {
          ...costForm,
          // Extract specific roles for the main columns if needed, but store full list in JSON
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
      <Modal isOpen={isEstimateModalOpen} onClose={() => setIsEstimateModalOpen(false)} title="Operation Cost Estimation">
        <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center sticky top-0 z-10 shadow-sm backdrop-blur-md bg-blue-50/90">
            <div>
              <h4 className="font-bold text-blue-900 dark:text-blue-300">{selectedOp?.operation_name}</h4>
              <p className="text-sm text-blue-700 dark:text-blue-400">Patient: {selectedOp?.patientName} • Surgeon: Dr. {selectedOp?.doctorName}</p>
            </div>
            <div className="text-right">
              <span className="block text-xs uppercase text-blue-600 font-bold">Estimated Cost</span>
              <span className="text-2xl font-bold text-blue-800 dark:text-white">${calculateTotal().toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* LEFT COLUMN: PROFESSIONAL FEES */}
            <div className="space-y-6">
              
              {/* Base Fees */}
              <div className="bg-gray-50 dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-4">
                <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm border-b pb-2 dark:border-slate-700">
                  <User size={16} className="text-primary-600"/> Base Professional Fees
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Surgeon Fee ($)" 
                    type="number" 
                    value={costForm.surgeonFee} 
                    onChange={e => handleSurgeonFeeChange(e.target.value)} 
                    className="font-bold text-lg"
                  />
                  <Input 
                    label="Theater Fee ($)" 
                    type="number" 
                    value={costForm.theaterFee} 
                    onChange={e => setCostForm({...costForm, theaterFee: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              {/* Team Participants */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm">Medical Team</h4>
                  <Button size="sm" variant="secondary" onClick={addParticipant} icon={Plus} className="h-7 text-xs">Add Participant</Button>
                </div>
                
                {costForm.participants.length === 0 && (
                  <div className="text-center py-4 border-2 border-dashed border-gray-100 dark:border-slate-700 rounded-xl text-gray-400 text-sm">
                    No additional team members added.
                  </div>
                )}

                <div className="space-y-2">
                  {costForm.participants.map((p, idx) => (
                    <div key={p.id} className="flex gap-2 items-start bg-white dark:bg-slate-900 p-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-left-2">
                      <div className="w-1/3">
                        <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">Role</label>
                        <select 
                          className="w-full rounded-lg border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 text-sm py-1.5 px-2"
                          value={p.role}
                          onChange={e => updateParticipant(idx, 'role', e.target.value)}
                        >
                          <option value="anesthesiologist">Anesthesiologist</option>
                          <option value="assistant">Assistant</option>
                          <option value="nurse">Nurse</option>
                          <option value="technician">Technician</option>
                        </select>
                      </div>
                      
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">Staff Member</label>
                        <select 
                          className="w-full rounded-lg border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm py-1.5 px-2"
                          value={p.staffId}
                          onChange={e => updateParticipant(idx, 'staffId', e.target.value)}
                        >
                          <option value="">Select Staff...</option>
                          {staff.filter(s => p.role === 'nurse' ? s.type === 'nurse' : p.role === 'anesthesiologist' ? s.type === 'anesthesiologist' : ['doctor', 'technician', 'medical_assistant'].includes(s.type))
                               .map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                        </select>
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-gray-400 font-bold uppercase ml-1">Fee ($)</label>
                        <input 
                          type="number"
                          className="w-full rounded-lg border-gray-300 dark:border-slate-600 text-sm py-1.5 px-2 font-mono"
                          value={p.fee}
                          onChange={e => updateParticipant(idx, 'fee', e.target.value)}
                        />
                      </div>

                      <button onClick={() => removeParticipant(idx)} className="mt-6 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RESOURCES */}
            <div className="space-y-6">
              
              {/* Drugs & Consumables */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                    <Syringe size={16} className="text-pink-500"/> Drugs & Consumables
                  </h4>
                  <button type="button" onClick={() => addResource('consumables')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                
                {costForm.consumables.length === 0 && <p className="text-xs text-gray-400 italic">No items added.</p>}
                
                <div className="space-y-2">
                  {costForm.consumables.map((item, idx) => (
                    <div key={item.id} className="flex gap-2">
                      <input placeholder="Drug/Item Name" className="flex-1 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5" value={item.name} onChange={e => updateResource('consumables', idx, 'name', e.target.value)} />
                      <input placeholder="Cost" type="number" className="w-24 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5 font-mono" value={item.cost} onChange={e => updateResource('consumables', idx, 'cost', e.target.value)} />
                      <button onClick={() => removeResource('consumables', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div className="space-y-3 pt-4 border-t border-dashed dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                    <Zap size={16} className="text-orange-500"/> Equipment Usage
                  </h4>
                  <button type="button" onClick={() => addResource('equipment')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                
                {costForm.equipment.length === 0 && <p className="text-xs text-gray-400 italic">No equipment charges.</p>}

                <div className="space-y-2">
                  {costForm.equipment.map((item, idx) => (
                    <div key={item.id} className="flex gap-2">
                      <input placeholder="Equipment Name" className="flex-1 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5" value={item.name} onChange={e => updateResource('equipment', idx, 'name', e.target.value)} />
                      <input placeholder="Cost" type="number" className="w-24 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5 font-mono" value={item.cost} onChange={e => updateResource('equipment', idx, 'cost', e.target.value)} />
                      <button onClick={() => removeResource('equipment', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Other Fees */}
              <div className="space-y-3 pt-4 border-t border-dashed dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-gray-800 dark:text-white text-sm flex items-center gap-2">
                    <Package size={16} className="text-slate-500"/> Other Fees
                  </h4>
                  <button type="button" onClick={() => addResource('others')} className="text-primary-600 hover:text-primary-700 text-xs font-bold flex items-center gap-1"><Plus size={12}/> Add</button>
                </div>
                
                <div className="space-y-2">
                  {costForm.others.map((item, idx) => (
                    <div key={item.id} className="flex gap-2">
                      <input placeholder="Description" className="flex-1 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5" value={item.name} onChange={e => updateResource('others', idx, 'name', e.target.value)} />
                      <input placeholder="Cost" type="number" className="w-24 rounded-lg border-gray-300 dark:border-slate-700 dark:bg-slate-900 text-sm px-2 py-1.5 font-mono" value={item.cost} onChange={e => updateResource('others', idx, 'cost', e.target.value)} />
                      <button onClick={() => removeResource('others', idx)} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800 sticky bottom-0 z-10 py-2">
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
