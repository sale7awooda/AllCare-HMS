
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { 
  Plus, Printer, Download, X, Lock, CreditCard, 
  Wallet, TrendingUp, AlertCircle, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter
} from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, Appointment, PaymentMethod } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Billing = () => {
  const { t, language } = useTranslation();
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

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
      const [b, p, pm] = await Promise.all([
        api.getBills(), 
        api.getPatients(),
        api.getPaymentMethods()
      ]);
      setBills(Array.isArray(b) ? b : []);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);

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

  // --- Helper to derive Bill Type ---
  const getBillType = (bill: Bill): string => {
    // Scan items to determine type based on descriptions generated by backend controllers
    const desc = bill.items?.map(i => i.description.toLowerCase()).join(' ') || '';
    
    if (desc.includes('admission') || desc.includes('accommodation') || desc.includes('deposit')) return 'Admission';
    if (desc.includes('surgery') || desc.includes('operation')) return 'Operation';
    if (desc.includes('lab') || desc.includes('test')) return 'Lab Test';
    if (desc.includes('appointment') || desc.includes('consultation') || desc.includes('follow-up')) return 'Appointment';
    if (desc.includes('service') || desc.includes('procedure') || desc.includes('dressing') || desc.includes('injection')) return 'Procedure';
    
    return 'General';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Admission': return 'orange';
      case 'Operation': return 'red';
      case 'Lab Test': return 'purple';
      case 'Appointment': return 'blue';
      case 'Procedure': return 'cyan';
      default: return 'gray';
    }
  };

  const translateBillType = (type: string) => {
      switch(type) {
          case 'Admission': return t('billing_type_admission');
          case 'Operation': return t('billing_type_operation');
          case 'Lab Test': return t('billing_type_lab');
          case 'Appointment': return t('billing_type_appointment');
          case 'Procedure': return t('billing_type_procedure');
          default: return t('billing_type_general');
      }
  };

  // --- Filtering & Pagination Logic ---
  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = 
        bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const billType = getBillType(bill);
      const matchesType = filterType === 'all' || billType === filterType;

      return matchesSearch && matchesType;
    });
  }, [bills, searchTerm, filterType]);

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
             <h1 className="text-2xl font-bold text-slate-900">{t('billing_invoice_title')}</h1>
          </div>
          <p className="text-slate-500 font-mono">#{bill.billNumber}</p>
          <div className="mt-4 flex gap-2">
             <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${bill.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {bill.status}
             </span>
             <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                {translateBillType(getBillType(bill))}
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
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t('billing_invoice_billed_to')}</p>
          <p className="font-bold text-lg text-slate-900">{bill.patientName}</p>
          {/* Mock address since it's not on bill object directly */}
          <p className="text-slate-500 text-sm">Patient ID: #{bill.patientId}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{t('billing_invoice_date')}</p>
          <p className="font-medium text-slate-900">{new Date(bill.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Line Items */}
      <table className="w-full mb-8">
        <thead>
          <tr className="bg-slate-50 border-y border-slate-200">
            <th className="text-left py-3 px-4 font-semibold text-sm text-slate-600">{t('billing_modal_create_item_placeholder')}</th>
            <th className="text-right py-3 px-4 font-semibold text-sm text-slate-600">{t('billing_table_header_amount')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {bill.items.map((item, i) => (
            <tr key={i}>
              <td className="py-3 px-4">{item.description}</td>
              <td className="py-3 px-4 text-right font-medium">${item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-3">
          <div className="flex justify-between text-slate-600">
            <span>{t('billing_invoice_subtotal')}</span>
            <span className="font-medium">${bill.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>{t('billing_invoice_tax')} (0%)</span>
            <span className="font-medium">$0.00</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold text-lg border-t-2 border-slate-200 pt-3 mt-2">
            <span>{t('billing_invoice_total')}</span>
            <span>${bill.totalAmount.toFixed(2)}</span>
          </div>
           <div className="flex justify-between text-green-600 font-bold text-sm pt-1">
            <span>{t('billing_invoice_paid')}</span>
            <span>-${(bill.paidAmount || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold text-xl bg-slate-100 p-3 rounded-lg">
            <span>{t('billing_invoice_balance')}</span>
            <span>${(bill.totalAmount - (bill.paidAmount || 0)).toFixed(2)}</span>
          </div>
        </div>
      </div>
      
    </div>
  );

  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('billing_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('billing_subtitle')}</p>
        </div>
        {canManageBilling ? (
            <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus}>{t('billing_create_invoice_button')}</Button>
        ) : (
            <Button disabled variant="secondary" icon={Lock}>{t('billing_create_invoice_button')}</Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_revenue')}</h4>
          <p className="text-3xl font-bold text-emerald-600 mt-2">${stats.totalRevenue.toLocaleString()}</p>
        </Card>
        <Card>
          <h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_pending')}</h4>
          <p className="text-3xl font-bold text-orange-500 mt-2">${stats.pendingAmount.toLocaleString()}</p>
        </Card>
        <Card>
          <h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_paid')}</h4>
          <p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.paidInvoices}</p>
        </Card>
      </div>

      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-4 items-center">
           <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder={t('billing_search_placeholder')}
                className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
           </div>
           
           <div className="relative w-full sm:w-auto">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
              <select 
                className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
                value={filterType}
                onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">{t('patients_filter_type_all')}</option>
                <option value="Appointment">{t('billing_type_appointment')}</option>
                <option value="Lab Test">{t('billing_type_lab')}</option>
                <option value="Admission">{t('billing_type_admission')}</option>
                <option value="Operation">{t('billing_type_operation')}</option>
                <option value="Procedure">{t('billing_type_procedure')}</option>
                <option value="General">{t('billing_type_general')}</option>
              </select>
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_info')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_patient')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('appointments_form_type')}</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_status')}</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_amount')}</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_actions')}</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? <tr><td colSpan={6} className="text-center py-10 text-slate-500">{t('billing_table_loading')}</td></tr> :
               paginatedBills.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-slate-500">{t('billing_table_empty')}</td></tr> :
               paginatedBills.map(bill => (
                 <tr key={bill.id}>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="font-mono text-sm font-medium text-slate-900 dark:text-white">{bill.billNumber}</div>
                     <div className="text-xs text-slate-500">{new Date(bill.date).toLocaleDateString()}</div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{bill.patientName}</td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <Badge color={getTypeColor(getBillType(bill)) as any}>{translateBillType(getBillType(bill))}</Badge>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : 'red'}>{bill.status}</Badge>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="font-bold text-lg text-slate-900 dark:text-white">${bill.totalAmount.toLocaleString()}</div>
                      <div className="text-xs text-green-600">{t('billing_table_paid_amount')}: ${bill.paidAmount.toLocaleString()}</div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                     <Button size="sm" variant="outline" onClick={() => setSelectedBill(bill)}>{t('billing_action_view_invoice')}</Button>
                     {canManageBilling && bill.status !== 'paid' && (
                       <Button size="sm" onClick={() => openPaymentModal(bill)}>{t('billing_action_pay')}</Button>
                     )}
                   </td>
                 </tr>
               ))}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredBills.length > itemsPerPage && (
           <div className="px-6 py-4 border-t flex justify-end">
             {/* Pagination controls can be added here */}
           </div>
        )}
      </Card>

      {/* MODALS */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('billing_modal_create_title')}>
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Select 
            label={t('billing_modal_create_select_patient')}
            value={createForm.patientId}
            onChange={e => setCreateForm({...createForm, patientId: e.target.value})}
            required
          >
            <option value="">{t('billing_modal_create_choose_patient')}</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('billing_modal_create_items_label')}</label>
            <div className="space-y-2">
              {createForm.items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input 
                    placeholder={t('billing_modal_create_item_placeholder')}
                    value={item.description}
                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Input 
                    placeholder={t('billing_modal_create_amount_placeholder')}
                    type="number"
                    value={item.amount}
                    onChange={e => handleItemChange(index, 'amount', e.target.value)}
                    className="w-28"
                  />
                  <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-2">
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddItem} className="mt-2">{t('billing_modal_create_add_item_button')}</Button>
          </div>
          <div className="pt-2 border-t text-right">
             <span className="text-sm text-slate-500">{t('billing_modal_create_total_label')}: </span>
             <span className="text-lg font-bold">${createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0)}</span>
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit">{t('billing_modal_create_generate_button')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={t('billing_modal_payment_title')}>
        {payingBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('billing_modal_payment_balance_due')}</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">${(payingBill.totalAmount - payingBill.paidAmount).toLocaleString()}</p>
            </div>
            <Input 
              label={t('billing_modal_payment_amount')}
              type="number" 
              value={paymentForm.amount}
              onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
              required
            />
            <Select 
              label={t('billing_modal_payment_method')}
              value={paymentForm.method}
              onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
              required
            >
              <option value="">{t('billing_modal_payment_method_select')}</option>
              {paymentMethods.filter(p => p.isActive).map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
            </Select>
            <div className="flex justify-end pt-4">
              <Button type="submit" icon={CheckCircle}>{t('billing_modal_payment_confirm_button')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} title={t('billing_modal_preview_title')}>
        {selectedBill && (
          <div>
            <InvoiceView bill={selectedBill} />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setSelectedBill(null)}>{t('close')}</Button>
              <Button icon={Printer}>{t('billing_modal_preview_print_button')}</Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
};
