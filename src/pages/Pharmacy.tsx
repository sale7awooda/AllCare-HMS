import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Pill, Search, Plus, Trash2, ShoppingCart, DollarSign, 
  AlertTriangle, Archive, RefreshCw, Filter, User, Calendar, CheckCircle, X
} from 'lucide-react';
import { api } from '../services/api';
import { useHeader } from '../context/HeaderContext';
import { Patient, PaymentMethod } from '../types';

export const Pharmacy = () => {
  const [activeTab, setActiveTab] = useState<'inventory' | 'dispense'>('inventory');
  const [inventory, setInventory] = useState<any[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Inventory State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [invForm, setInvForm] = useState({ name: '', genericName: '', category: '', stock: '', unitPrice: '', expiryDate: '', batch: '' });
  
  // Dispense State
  const [cart, setCart] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  
  // Status
  const [processStatus, setProcessStatus] = useState('idle');
  const patientSearchRef = useRef<HTMLDivElement>(null);

  useHeader('Pharmacy & Inventory', 'Drug stock management and point-of-sale dispensing.');

  const loadData = async () => {
    setLoading(true);
    try {
      const [invData, patData, pmData] = await Promise.all([
        api.getPharmacyInventory(),
        api.getPatients(),
        api.getPaymentMethods()
      ]);
      setInventory(invData || []);
      setPatients(patData || []);
      setPaymentMethods(pmData || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSearchRef.current && !patientSearchRef.current.contains(e.target as Node)) {
        setShowPatientResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const stats = useMemo(() => {
    const lowStock = inventory.filter(i => i.stock_level <= (i.reorder_level || 10)).length;
    const expired = inventory.filter(i => new Date(i.expiry_date) < new Date()).length;
    const totalVal = inventory.reduce((sum, i) => sum + (i.stock_level * i.unit_price), 0);
    return { lowStock, expired, totalVal };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(i => 
      i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      i.generic_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  // Inventory Handlers
  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    const payload = {
        ...invForm,
        stock: parseInt(invForm.stock.toString()),
        unitPrice: parseFloat(invForm.unitPrice.toString())
    };
    try {
        if (editingItem) await api.updatePharmacyInventory(editingItem.id, payload);
        else await api.addPharmacyInventory(payload);
        
        await loadData();
        setIsModalOpen(false);
    } catch (e) { alert('Operation failed'); } 
    finally { setProcessStatus('idle'); }
  };

  const openInvModal = (item?: any) => {
    if (item) {
        setEditingItem(item);
        setInvForm({
            name: item.name, genericName: item.generic_name, category: item.category,
            stock: item.stock_level, unitPrice: item.unit_price, expiryDate: item.expiry_date, batch: item.batch_number
        });
    } else {
        setEditingItem(null);
        setInvForm({ name: '', genericName: '', category: 'Medicine', stock: '', unitPrice: '', expiryDate: '', batch: '' });
    }
    setIsModalOpen(true);
  };

  // Dispense Handlers
  const addToCart = (item: any) => {
    if (item.stock_level <= 0) return;
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
        if (existing.quantity >= item.stock_level) return; // Cap at stock
        setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
        setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (id: number) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const handleCheckout = async () => {
    if (!selectedPatient) return;
    setProcessStatus('processing');
    try {
        const payload = {
            patientId: selectedPatient.id,
            items: cart.map(c => ({ id: c.id, quantity: c.quantity, price: c.unit_price })),
            paymentMethod: paymentMethod || null // null means 'pending' bill
        };
        await api.dispenseDrugs(payload);
        setCart([]);
        setSelectedPatient(null);
        setPatientSearch('');
        setIsCheckoutModalOpen(false);
        loadData(); // refresh stock
        alert("Dispensed successfully. Inventory updated.");
    } catch (e) { alert("Checkout failed."); }
    finally { setProcessStatus('idle'); }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-blue-500">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Inventory Value</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">${stats.totalVal.toLocaleString()}</p>
            </Card>
            <Card className="border-l-4 border-l-amber-500">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Low Stock Items</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{stats.lowStock}</p>
            </Card>
            <Card className="border-l-4 border-l-red-500">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Expired / Expiring</p>
                <p className="text-2xl font-black text-red-600 mt-1">{stats.expired}</p>
            </Card>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveTab('inventory')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'inventory' ? 'bg-white dark:bg-slate-700 shadow text-primary-600' : 'text-slate-500'}`}>Inventory Management</button>
            <button onClick={() => setActiveTab('dispense')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'dispense' ? 'bg-white dark:bg-slate-700 shadow text-primary-600' : 'text-slate-500'}`}>POS Dispensing</button>
        </div>

        {activeTab === 'inventory' && (
            <Card title="Drug Stock" action={<Button size="sm" icon={Plus} onClick={() => openInvModal()}>Add Item</Button>}>
                <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                    <input className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Search medicines..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-4 py-3 text-left">Item Name</th>
                                <th className="px-4 py-3 text-left">Category</th>
                                <th className="px-4 py-3 text-right">Stock</th>
                                <th className="px-4 py-3 text-right">Unit Price</th>
                                <th className="px-4 py-3 text-left">Expiry</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredInventory.map(item => {
                                const isLow = item.stock_level <= (item.reorder_level || 10);
                                const isExpired = new Date(item.expiry_date) < new Date();
                                return (
                                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        <td className="px-4 py-3">
                                            <p className="font-bold text-slate-800 dark:text-white">{item.name}</p>
                                            <p className="text-xs text-slate-400">{item.generic_name}</p>
                                        </td>
                                        <td className="px-4 py-3">{item.category}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Badge color={isLow ? 'red' : 'green'}>{item.stock_level}</Badge>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">${item.unit_price}</td>
                                        <td className={`px-4 py-3 ${isExpired ? 'text-red-500 font-bold' : ''}`}>{new Date(item.expiry_date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => openInvModal(item)}>Edit</Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        )}

        {activeTab === 'dispense' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
                <div className="lg:col-span-2 flex flex-col gap-4 h-full">
                    <Card className="flex-none">
                        <div className="relative" ref={patientSearchRef}>
                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Select Patient</label>
                            {selectedPatient ? (
                                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center text-blue-600 font-bold">{selectedPatient.fullName.charAt(0)}</div>
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">{selectedPatient.fullName}</p>
                                            <p className="text-xs text-slate-500">ID: {selectedPatient.patientId}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }} className="text-slate-400 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500" 
                                        placeholder="Search patient registry..." 
                                        value={patientSearch}
                                        onChange={e => { setPatientSearch(e.target.value); setShowPatientResults(true); }}
                                        onFocus={() => setShowPatientResults(true)}
                                    />
                                    {showPatientResults && patientSearch.length > 0 && (
                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 max-h-48 overflow-y-auto">
                                            {patients.filter(p => p.fullName.toLowerCase().includes(patientSearch.toLowerCase())).slice(0, 5).map(p => (
                                                <button key={p.id} onClick={() => { setSelectedPatient(p); setShowPatientResults(false); }} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 dark:border-slate-700">
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">{p.fullName}</p>
                                                    <p className="text-xs text-slate-500">{p.phone}</p>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                    
                    <Card className="flex-1 flex flex-col min-h-0 overflow-hidden" title="Available Medicines">
                        <div className="mb-4 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/>
                            <input className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Filter medicines..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
                            {filteredInventory.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => addToCart(item)}
                                    disabled={item.stock_level <= 0}
                                    className={`p-3 rounded-xl border text-left transition-all ${item.stock_level <= 0 ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'bg-white dark:bg-slate-800 hover:border-primary-500 hover:shadow-md'}`}
                                >
                                    <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                    <div className="flex justify-between items-center mt-1">
                                        <Badge color={item.stock_level > 10 ? 'green' : 'red'} className="text-[10px]">{item.stock_level} left</Badge>
                                        <span className="font-mono text-xs font-bold">${item.unit_price}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="flex flex-col h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                        <h3 className="font-black uppercase tracking-widest text-slate-500 text-xs flex items-center gap-2"><ShoppingCart size={14}/> Current Cart</h3>
                        <span className="bg-primary-100 text-primary-700 text-xs font-bold px-2 py-0.5 rounded-full">{cart.length} items</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                                <Archive size={32} className="mb-2 opacity-50"/>
                                <p className="text-sm">Cart is empty.</p>
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{item.name}</p>
                                        <p className="text-xs text-slate-500">${item.unit_price} x {item.quantity}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-sm">${(item.quantity * item.unit_price).toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-slate-500 font-bold text-sm">Total</span>
                            <span className="text-2xl font-black text-slate-900 dark:text-white">${cartTotal.toFixed(2)}</span>
                        </div>
                        <Button className="w-full py-3 text-md" disabled={cart.length === 0 || !selectedPatient} onClick={() => setIsCheckoutModalOpen(true)}>Proceed to Checkout</Button>
                    </div>
                </div>
            </div>
        )}

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Inventory Item" : "Add New Stock"}>
            <form onSubmit={handleSaveInventory} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Medicine Name" required value={invForm.name} onChange={e => setInvForm({...invForm, name: e.target.value})} />
                    <Input label="Generic Name" value={invForm.genericName} onChange={e => setInvForm({...invForm, genericName: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Select label="Category" value={invForm.category} onChange={e => setInvForm({...invForm, category: e.target.value})}>
                        <option>Medicine</option>
                        <option>Consumable</option>
                        <option>Equipment</option>
                        <option>Injection</option>
                    </Select>
                    <Input label="Batch Number" value={invForm.batch} onChange={e => setInvForm({...invForm, batch: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <Input label="Stock Qty" type="number" required value={invForm.stock} onChange={e => setInvForm({...invForm, stock: e.target.value})} />
                    <Input label="Unit Price ($)" type="number" step="0.01" required value={invForm.unitPrice} onChange={e => setInvForm({...invForm, unitPrice: e.target.value})} />
                    <Input label="Expiry Date" type="date" required value={invForm.expiryDate} onChange={e => setInvForm({...invForm, expiryDate: e.target.value})} />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                    <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={processStatus === 'processing'}>{processStatus === 'processing' ? 'Saving...' : 'Save Item'}</Button>
                </div>
            </form>
        </Modal>

        <Modal isOpen={isCheckoutModalOpen} onClose={() => setIsCheckoutModalOpen(false)} title="Confirm Dispense">
            <div className="space-y-6">
                <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total to Bill</p>
                    <p className="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">${cartTotal.toFixed(2)}</p>
                </div>
                <div>
                    <label className="block text-sm font-bold mb-2">Payment Method</label>
                    <select className="w-full p-3 rounded-xl border bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-primary-500" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                        <option value="">Bill to Patient Account (Pending)</option>
                        {paymentMethods.filter(p => p.isActive).map(pm => (
                            <option key={pm.id} value={pm.name_en}>Pay Now - {pm.name_en}</option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-2 italic">Selecting a method will mark the invoice as PAID immediately.</p>
                </div>
                <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
                    <Button type="button" variant="secondary" onClick={() => setIsCheckoutModalOpen(false)}>Back</Button>
                    <Button onClick={handleCheckout} disabled={processStatus === 'processing'} icon={CheckCircle}>{processStatus === 'processing' ? 'Processing...' : 'Dispense & Bill'}</Button>
                </div>
            </div>
        </Modal>
    </div>
  );
};