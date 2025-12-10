
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { 
  Plus, Printer, Download, X, Lock, CreditCard, 
  Wallet, TrendingUp, AlertCircle, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search
} from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, Appointment, PaymentMethod } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

export const Billing = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidInvoices: 0
  });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null); // For Invoice View
  const [payingBill, setPayingBill] = useState<Bill | null>(null); // For Payment Action

  // Create Form State
  const [createForm, setCreateForm] = useState({
    patientId: '',
    items: [{ description: '', amount: '' }]
  });

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, p, pm, u] = await Promise.all([
        api.getBills(), 
        api.getPatients(),
        api.getPaymentMethods(),
        api.me()
      ]);
      setBills(Array.isArray(b) ? b : []);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setCurrentUser(u);

      // Calculate Stats
      const total = b.reduce((acc: number, curr: Bill) => acc + (curr.paidAmount || 0), 0);
      const pending = b.reduce((acc: number, curr: Bill) => acc + ((curr.totalAmount || 0) - (curr.paidAmount || 0)), 0);
      const paidCount = b.filter((x: Bill) => x.status === 'paid').length;

      setStats({
        totalRevenue: total,
        pendingAmount: pending,
        paidInvoices: paidCount
      });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- Handlers ---

  const handleAddItem = () => {
    setCreateForm({
      ...createForm,
      items: [...createForm.items, { description: '', amount: '' }]
    });
  };

  const handleRemoveItem = (index: number) => {
    const newItems = createForm.items.filter((_, i) => i !== index);
    setCreateForm({ ...createForm, items: newItems });
  };

  const handleItemChange = (index: number, field: 'description' | 'amount', value: string) => {
    const newItems = [...createForm.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setCreateForm({ ...createForm, items: newItems });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === parseInt(createForm.patientId));
    
    // Filter out empty rows and format
    const formattedItems = createForm.items
      .filter(i => i.description && i.amount)
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) }));

    if (patient && formattedItems.length > 0) {
      const total = formattedItems.reduce((sum, i) => sum + i.amount, 0);
      
      await api.createBill({
        patientId: patient.id,
        patientName: patient.fullName,
        totalAmount: total,
        date: new Date().toISOString().split('T')[0],
        items: formattedItems
      });
      
      setIsCreateModalOpen(false);
      setCreateForm({ patientId: '', items: [{ description: '', amount: '' }] });
      loadData();
    }
  };

  const openPaymentModal = (bill: Bill) => {
    setPayingBill(bill);
    // Default to remaining balance
    const remaining = bill.totalAmount - (bill.paidAmount || 0);
    setPaymentForm({ amount: remaining.toString(), method: 'Cash' });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    try {
      await api.recordPayment(payingBill.id, parseFloat(paymentForm.amount));
      setIsPaymentModalOpen(false);
      setPayingBill(null);
      loadData();
    } catch (e) {
      alert('Payment failed');
    }
  };

  // --- Filtering & Pagination Logic ---
  const filteredBills = useMemo(() => {
    return bills.filter(bill => 
      bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bills, searchTerm]);

  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // --- Render Helpers ---

  const InvoiceView = ({ bill }: { bill: Bill }) => (
    <div className="p-10 bg-white min-h-[600px] text-slate-800" id="invoice-print">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
             <div className="bg-primary-600 text-white p-2 rounded-lg"><Wallet size={24}/></div>
             <h1 className="text-2xl font-bold text-slate-900">INVOICE</h1>
          </div>
          <p className="text-slate-500 font-mono">#{bill.billNumber}</p>
          <div className="mt-4">
             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {bill.status}
             </span>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-primary-600">AllCare Hospital</h2>
          <p className="text-sm text-slate-500 mt-1">123 Health Ave, Med City</p>
          <p className="text-sm text-slate-500">contact@allcare.com</p>
          <p className="text-sm text-slate-500">+1 (555) 012-3456</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="flex justify-between mb-10">
        <div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Billed To</p>
          <p className="font-bold text-lg text-slate-900">{bill.patientName}</p>
          {/* Mock address since it's not on bill object directly */}
          <p className="text-slate-500 text-sm">Patient ID: #{bill.patientId}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Invoice Date</p>
          <p className="font-medium text-slate-900">{new Date(bill.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Line Items */}
      <table className="w-full mb-8">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-sm text-slate-600">Description</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-slate-600">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td className="py-4 px-4 text-slate-700">{item.description}</td>
              <td className="py-4 px-4 text-right font-mono text-slate-900">${item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64 space-y-3">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>${bill.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-3">
            <span>Tax (0%)</span>
            <span>$0.00</span>
          </div>
          <div className="flex justify-between font-bold text-xl text-slate-900">
            <span>Total</span>
            <span>${bill.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium pt-2">
             <span className="text-green-600">Paid to Date</span>
             <span className="text-green-600">-${(bill.paidAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t-2 border-slate-900 pt-3">
            <span>Balance Due</span>
            <span className="text-primary-600">${(bill.totalAmount - (bill.paidAmount || 0)).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-slate-100 text-center text-slate-400 text-sm">
        <p>Thank you for choosing AllCare Hospital. For billing inquiries, please contact finance.</p>
      </div>
    </div>
  );

  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing & Finance</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage invoices, payments, and revenue.</p>
        </div>
        {canManageBilling ? (
          <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus} className="shadow-lg shadow-primary-500/20">Create Invoice</Button>
        ) : (
          <Button disabled variant="secondary" icon={Lock}>Locked</Button>
        )}
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-emerald-500">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Revenue</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">${stats.totalRevenue.toLocaleString()}</h3>
                </div>
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
                    <TrendingUp size={24} />
                </div>
            </div>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Pending Collections</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">${stats.pendingAmount.toLocaleString()}</h3>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl">
                    <AlertCircle size={24} />
                </div>
            </div>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Paid Invoices</p>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.paidInvoices}</h3>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
                    <CheckCircle size={24} />
                </div>
            </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm">
        {/* Search Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-3">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search invoice # or patient name..." 
                className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
           </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-white dark:bg-slate-900">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice Info</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-500">Loading billing data...</td></tr>
              ) : paginatedBills.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-500">No invoices found matching criteria.</td></tr>
              ) : (
                  paginatedBills.map((bill) => (
                    <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="font-mono text-xs font-bold text-slate-500">#{bill.billNumber}</span>
                            <span className="text-xs text-slate-400">{new Date(bill.date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="font-bold text-sm text-slate-900 dark:text-white">{bill.patientName}</div>
                         <div className="text-xs text-slate-500">ID: {bill.patientId}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'orange' : 'red'}>
                          {bill.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="font-bold text-sm text-slate-900 dark:text-white">${bill.totalAmount.toLocaleString()}</div>
                         {(bill.paidAmount || 0) > 0 && (
                             <div className="text-xs text-green-600 font-medium">Paid: ${bill.paidAmount?.toLocaleString()}</div>
                         )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end gap-2">
                            <button 
                                onClick={() => setSelectedBill(bill)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="View Invoice"
                            >
                                <FileText size={18} />
                            </button>
                            {bill.status !== 'paid' && canManageBilling && (
                                <Button 
                                    size="sm" 
                                    variant="primary" 
                                    onClick={() => openPaymentModal(bill)}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                    icon={CreditCard}
                                >
                                    Pay
                                </Button>
                            )}
                         </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>

        {/* Enhanced Pagination Footer */}
        {!loading && filteredBills.length > 0 && (
           <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center bg-slate-50 dark:bg-slate-900 rounded-b-xl gap-4">
             <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span>
                  Showing <span className="font-medium text-slate-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> - <span className="font-medium text-slate-900 dark:text-white">{Math.min(currentPage * itemsPerPage, filteredBills.length)}</span> of <span className="font-medium text-slate-900 dark:text-white">{filteredBills.length}</span>
                </span>
                
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                  <span>Rows:</span>
                  <select 
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-primary-500"
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>
             </div>

             <div className="flex gap-1.5">
               <button 
                 onClick={() => setCurrentPage(1)}
                 disabled={currentPage === 1}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronsLeft size={16} />
               </button>
               <button 
                 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                 disabled={currentPage === 1}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronLeft size={16} />
               </button>
               
               {getPageNumbers().map((p, i) => (
                 <button
                   key={i}
                   onClick={() => typeof p === 'number' && setCurrentPage(p)}
                   disabled={typeof p !== 'number'}
                   className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                     p === currentPage 
                       ? 'bg-primary-600 text-white shadow-md shadow-primary-500/30' 
                       : typeof p === 'number' 
                         ? 'border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300' 
                         : 'text-slate-400 cursor-default'
                   }`}
                 >
                   {p}
                 </button>
               ))}

               <button 
                 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                 disabled={currentPage === totalPages}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronRight size={16} />
               </button>
               <button 
                 onClick={() => setCurrentPage(totalPages)}
                 disabled={currentPage === totalPages}
                 className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
               >
                 <ChevronsRight size={16} />
               </button>
             </div>
           </div>
        )}
      </Card>

      {/* CREATE INVOICE MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Invoice">
        <form onSubmit={handleCreateSubmit} className="space-y-6">
           <Select 
            label="Select Patient" 
            required
            value={createForm.patientId}
            onChange={e => setCreateForm({...createForm, patientId: e.target.value})}
          >
            <option value="">Choose a patient...</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName} ({p.patientId})</option>)}
          </Select>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Bill Items</label>
            {createForm.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start">
                    <Input 
                        placeholder="Description (e.g. Consultation)" 
                        className="flex-1"
                        value={item.description}
                        onChange={e => handleItemChange(index, 'description', e.target.value)}
                    />
                    <Input 
                        placeholder="Amount" 
                        type="number"
                        className="w-32"
                        value={item.amount}
                        onChange={e => handleItemChange(index, 'amount', e.target.value)}
                    />
                    {createForm.items.length > 1 && (
                        <button 
                            type="button" 
                            onClick={() => handleRemoveItem(index)}
                            className="p-2.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={handleAddItem} icon={Plus}>Add Item</Button>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex justify-between items-center border border-slate-100 dark:border-slate-800">
             <span className="font-bold text-slate-700 dark:text-slate-300">Total Amount</span>
             <span className="font-bold text-xl text-primary-600">
                ${createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toFixed(2)}
             </span>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
             <Button type="submit">Generate Invoice</Button>
          </div>
        </form>
      </Modal>

      {/* RECORD PAYMENT MODAL */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment">
        <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <p className="text-sm text-slate-500">Balance Due</p>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1">
                    ${payingBill ? (payingBill.totalAmount - (payingBill.paidAmount || 0)).toLocaleString() : '0.00'}
                </h3>
                <p className="text-xs text-slate-400 mt-2">Invoice #{payingBill?.billNumber}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <Input 
                    label="Payment Amount ($)" 
                    type="number" 
                    required
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                />
                <Select 
                    label="Payment Method" 
                    required
                    value={paymentForm.method}
                    onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
                >
                    <option value="">Select...</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    {paymentMethods.filter(m => m.isActive).map(m => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                </Select>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
                <Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" icon={CheckCircle}>Confirm Payment</Button>
            </div>
        </form>
      </Modal>

      {/* INVOICE PREVIEW OVERLAY */}
      {selectedBill && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden">
             <div className="flex justify-between items-center p-4 border-b bg-slate-50 sticky top-0 z-10">
               <h3 className="font-bold text-slate-700 flex items-center gap-2"><FileText size={18}/> Invoice Preview</h3>
               <div className="flex gap-2">
                 <Button size="sm" variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
                 <button onClick={() => setSelectedBill(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"><X size={20} /></button>
               </div>
             </div>
             <div className="overflow-y-auto custom-scrollbar">
                <InvoiceView bill={selectedBill} />
             </div>
          </div>
        </div>
      )}
    </div>
  );
};
