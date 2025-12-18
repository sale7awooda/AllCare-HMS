
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Package, Search, Plus, Trash2, Edit, Save, 
  ShoppingCart, History, AlertTriangle, CheckCircle, 
  User, Hash, DollarSign, Calendar, ChevronRight, X, Loader2, Info, ArrowRight, Zap
} from 'lucide-react';
import { api } from '../services/api';
import { Medicine, Patient, PharmacyTransaction } from '../types';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

export const Pharmacy = () => {
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'inventory' | 'log'>('inventory');
  const [inventory, setInventory] = useState<Medicine[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [logs, setLogs] = useState<PharmacyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal States
  const [isMedModalOpen, setIsMedModalOpen] = useState(false);
  const [isDispenseModalOpen, setIsDispenseModalOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Form States
  const [medForm, setMedForm] = useState({ name: '', category: 'Tablet', stock: '0', minStock: '10', unitPrice: '0', expiryDate: '', manufacturer: '', sku: '' });
  const [dispenseForm, setDispenseForm] = useState({ patientId: '', items: [] as { medicineId: number, quantity: number }[] });
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const patientSearchRef = useRef<HTMLDivElement>(null);

  useHeader(t('Pharmacy Management'), 'Medicine stock, dispensing, and billing integration.');

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [invRaw, ptsRaw, logsRaw] = await Promise.all([
        api.getPharmacyInventory(), api.getPatients(), api.getPharmacyTransactions()
      ]);
      
      // FIX: Added defensive Array.isArray checks
      setInventory(Array.isArray(invRaw) ? invRaw : []);
      setPatients(Array.isArray(ptsRaw) ? ptsRaw : []);
      setLogs(Array.isArray(logsRaw) ? logsRaw : []);
    } catch (e) { 
        console.error("Pharmacy loadData failed:", e); 
        setInventory([]); setPatients([]); setLogs([]);
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleMedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    const payload = { ...medForm, stock: parseInt(medForm.stock), minStock: parseInt(medForm.minStock), unitPrice: parseFloat(medForm.unitPrice) };
    try {
      if (selectedMed) await api.updateMedicine(selectedMed.id, payload);
      else await api.addMedicine(payload);
      setProcessStatus('success');
      loadData(true);
      setTimeout(() => { setIsMedModalOpen(false); setProcessStatus('idle'); }, 1000);
    } catch (e) { setProcessStatus('error'); setProcessMessage('Failed to save medicine.'); }
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispenseForm.patientId || dispenseForm.items.length === 0) return;
    setProcessStatus('processing');
    try {
      await api.dispenseMedicine({ ...dispenseForm, pharmacistId: currentUser?.id });
      setProcessStatus('success');
      loadData(true);
      setTimeout(() => { setIsDispenseModalOpen(false); setProcessStatus('idle'); }, 1500);
    } catch (err: any) { setProcessStatus('error'); setProcessMessage(err.response?.data?.error || 'Dispensing failed.'); }
  };

  const filteredInventory = inventory.filter(m => {
    if (!m) return false;
    return m.name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.sku && m.sku.toLowerCase().includes(searchTerm.toLowerCase()));
  });
  
  const filteredPatients = patients.filter(p => {
    if (!p) return false;
    return p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || p.patientId.toLowerCase().includes(patientSearch.toLowerCase());
  }).slice(0, 5);

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' ? <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /> : <CheckCircle size={48} className="text-green-600 mb-4" />}
            <h3 className="font-bold text-slate-900 dark:text-white">{processStatus === 'processing' ? 'Processing...' : 'Success!'}</h3>
            <p className="text-sm text-slate-500 mt-2">{processMessage}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-sm no-print">
        <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
           <button onClick={() => setActiveTab('inventory')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500'}`}>Inventory</button>
           <button onClick={() => setActiveTab('log')} className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'log' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500'}`}>Dispense Log</button>
        </div>
        <div className="flex gap-2">
           <Button variant="secondary" icon={Plus} onClick={() => { setSelectedMed(null); setMedForm({ name: '', category: 'Tablet', stock: '0', minStock: '10', unitPrice: '0', expiryDate: '', manufacturer: '', sku: '' }); setIsMedModalOpen(true); }}>Add Medicine</Button>
           <Button icon={ShoppingCart} onClick={() => { setDispenseForm({ patientId: '', items: [] }); setPatientSearch(''); setIsDispenseModalOpen(true); }}>Dispense</Button>
        </div>
      </div>

      {activeTab === 'inventory' && (
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 dark:bg-slate-900/50">
            <div className="relative w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><Input placeholder="Filter inventory..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10"/></div>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
               <tr>
                 <th className="px-6 py-3 uppercase text-[10px] font-black text-slate-500">Medicine / SKU</th>
                 <th className="px-6 py-3 uppercase text-[10px] font-black text-slate-500">Stock Status</th>
                 <th className="px-6 py-3 uppercase text-[10px] font-black text-slate-500">Price</th>
                 <th className="px-6 py-3 uppercase text-[10px] font-black text-slate-500">Expiry</th>
                 <th className="px-6 py-3 text-right uppercase text-[10px] font-black text-slate-500">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInventory.map(med => (
                <tr key={med.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-6 py-4"><p className="font-bold">{med.name}</p><p className="text-xs text-slate-400">{med.sku}</p></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <span className="font-black text-lg">{med.stock}</span>
                       {med.stock <= med.minStock && <Badge color="red"><AlertTriangle size={10} className="mr-1"/> LOW</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-primary-600">${med.unitPrice}</td>
                  <td className="px-6 py-4"><span className={new Date(med.expiryDate) < new Date() ? 'text-red-600 font-bold' : ''}>{med.expiryDate}</span></td>
                  <td className="px-6 py-4 text-right"><Button size="sm" variant="ghost" icon={Edit} onClick={() => { setSelectedMed(med); setMedForm({ ...med, stock: med.stock.toString(), minStock: med.minStock.toString(), unitPrice: med.unitPrice.toString() }); setIsMedModalOpen(true); }}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {activeTab === 'log' && (
        <Card className="!p-0 overflow-hidden">
           <table className="w-full text-left text-sm">
             <thead className="bg-slate-50"><tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Patient</th><th className="px-6 py-3">Medication</th><th className="px-6 py-3">Qty</th><th className="px-6 py-3">Amount</th></tr></thead>
             <tbody className="divide-y">{logs.map(log => (<tr key={log.id}><td className="px-6 py-4 text-xs text-slate-500">{new Date(log.dispensedAt).toLocaleString()}</td><td className="px-6 py-4 font-bold">{log.patientName}</td><td className="px-6 py-4">{log.medicineName}</td><td className="px-6 py-4">{log.quantity}</td><td className="px-6 py-4 font-bold">${log.totalPrice}</td></tr>))}</tbody>
           </table>
        </Card>
      )}

      {/* MODALS */}
      <Modal isOpen={isMedModalOpen} onClose={() => setIsMedModalOpen(false)} title={selectedMed ? 'Edit Medicine' : 'Add New Stock'}>
        <form onSubmit={handleMedSubmit} className="space-y-4">
          <Input label="Medicine Name" required value={medForm.name} onChange={e => setMedForm({...medForm, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-4"><Input label="SKU / Barcode" value={medForm.sku} onChange={e => setMedForm({...medForm, sku: e.target.value})} /><Select label="Category" value={medForm.category} onChange={e => setMedForm({...medForm, category: e.target.value})}><option>Tablet</option><option>Syrup</option><option>Injection</option><option>Ointment</option><option>Supplies</option></Select></div>
          <div className="grid grid-cols-3 gap-4"><Input label="Current Stock" type="number" value={medForm.stock} onChange={e => setMedForm({...medForm, stock: e.target.value})} /><Input label="Min Alert" type="number" value={medForm.minStock} onChange={e => setMedForm({...medForm, minStock: e.target.value})} /><Input label="Price ($)" type="number" step="0.01" value={medForm.unitPrice} onChange={e => setMedForm({...medForm, unitPrice: e.target.value})} /></div>
          <Input label="Expiry Date" type="date" value={medForm.expiryDate} onChange={e => setMedForm({...medForm, expiryDate: e.target.value})} />
          <Button type="submit" className="w-full">{selectedMed ? 'Update Item' : 'Add to Inventory'}</Button>
        </form>
      </Modal>

      <Modal isOpen={isDispenseModalOpen} onClose={() => setIsDispenseModalOpen(false)} title="Dispense Medications">
         <form onSubmit={handleDispenseSubmit} className="space-y-6">
            <div className="relative" ref={patientSearchRef}>
               <label className="block text-sm font-bold mb-1.5">Dispense To Patient</label>
               <Input placeholder="Search patient..." value={patientSearch} onChange={e => {setPatientSearch(e.target.value); setShowPatientResults(true);}} onFocus={() => setShowPatientResults(true)} prefix={<User size={14}/>} />
               {showPatientResults && filteredPatients.length > 0 && (
                 <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border rounded-xl shadow-xl overflow-hidden animate-in fade-in">
                    {filteredPatients.map(p => (<div key={p.id} className="p-3 hover:bg-slate-50 cursor-pointer border-b last:border-0" onClick={() => { setDispenseForm({...dispenseForm, patientId: p.id.toString()}); setPatientSearch(p.fullName); setShowPatientResults(false);}}>{p.fullName}</div>))}
                 </div>
               )}
            </div>

            <div className="space-y-3">
               <div className="flex justify-between items-center"><h4 className="text-xs font-black uppercase text-slate-400">Order Items</h4><Button size="sm" variant="ghost" onClick={() => setDispenseForm({...dispenseForm, items: [...dispenseForm.items, { medicineId: inventory[0]?.id, quantity: 1 }]})} icon={Plus}>Add Item</Button></div>
               {dispenseForm.items.map((item, idx) => (
                 <div key={idx} className="flex gap-2 items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border">
                    <select className="flex-1 rounded-md border-slate-300 text-sm py-2" value={item.medicineId} onChange={e => { const newItems = [...dispenseForm.items]; newItems[idx].medicineId = parseInt(e.target.value); setDispenseForm({...dispenseForm, items: newItems}); }}>{inventory.map(m => <option key={m.id} value={m.id}>{m.name} (${m.unitPrice})</option>)}</select>
                    <input type="number" className="w-20 rounded-md border-slate-300 py-2 px-2 text-sm font-bold" value={item.quantity} onChange={e => { const newItems = [...dispenseForm.items]; newItems[idx].quantity = parseInt(e.target.value); setDispenseForm({...dispenseForm, items: newItems}); }} />
                    <button type="button" onClick={() => setDispenseForm({...dispenseForm, items: dispenseForm.items.filter((_,i)=>i!==idx)})} className="text-red-500 p-2"><Trash2 size={16}/></button>
                 </div>
               ))}
            </div>
            <div className="pt-4 border-t flex justify-between items-center">
               <div className="text-lg font-black text-primary-600">Total: ${dispenseForm.items.reduce((sum, item) => { const med = inventory.find(m => m.id === item.medicineId); return sum + (med?.unitPrice || 0) * item.quantity; }, 0).toLocaleString()}</div>
               <Button type="submit" disabled={!dispenseForm.patientId || dispenseForm.items.length === 0}>Complete & Bill</Button>
            </div>
         </form>
      </Modal>
    </div>
  );
};
