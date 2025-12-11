
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Printer, Download, X, Lock, CreditCard, 
  Wallet, TrendingUp, AlertCircle, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter, Calendar,
  Landmark, ArrowUpRight, ArrowDownRight, RefreshCcw
} from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, Appointment, PaymentMethod, TaxRate, Transaction, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Billing = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'invoices' | 'treasury'>('invoices');
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [catalogItems, setCatalogItems] = useState<{label: string, cost: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidInvoices: 0
  });

  // Treasury Stats
  const [treasuryStats, setTreasuryStats] = useState({
    income: 0,
    expenses: 0,
    net: 0
  });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null); // For Invoice View
  const [payingBill, setPayingBill] = useState<Bill | null>(null); // For Payment Action

  // Create Invoice Form
  const [createForm, setCreateForm] = useState({
    patientId: '',
    items: [{ description: '', amount: '' }],
    selectedTaxId: ''
  });

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    // Insurance specific
    insuranceProvider: '',
    policyNumber: '',
    expiryDate: '',
    // Transaction specific
    transactionId: ''
  });

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    category: 'General',
    amount: '',
    method: 'Cash',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, p, pm, taxes, labs, services, trans, ins] = await Promise.all([
        api.getBills(), 
        api.getPatients(),
        api.getPaymentMethods(),
        api.getTaxRates(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getTransactions(),
        api.getInsuranceProviders()
      ]);
      setBills(Array.isArray(b) ? b : []);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setTaxRates(Array.isArray(taxes) ? taxes : []);
      setTransactions(Array.isArray(trans) ? trans : []);
      setInsuranceProviders(Array.isArray(ins) ? ins : []);

      // Build Catalog
      const catalog = [
        ...(Array.isArray(labs) ? labs.map((l: any) => ({ label: `Lab: ${l.name_en}`, cost: l.cost })) : []),
        ...(Array.isArray(services) ? services.map((s: any) => ({ label: `Service: ${s.name_en}`, cost: s.cost })) : [])
      ];
      setCatalogItems(catalog);

      // Calculate Invoice Stats
      const total = b.reduce((acc: number, curr: Bill) => acc + (curr.paidAmount || 0), 0);
      const pending = b.reduce((acc: number, curr: Bill) => acc + ((curr.totalAmount || 0) - (curr.paidAmount || 0)), 0);
      const paidCount = b.filter((x: Bill) => x.status === 'paid').length;

      setStats({
        totalRevenue: total,
        pendingAmount: pending,
        paidInvoices: paidCount
      });

      // Calculate Treasury Stats
      const income = trans.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);
      const expense = trans.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
      setTreasuryStats({ income, expenses: expense, net: income - expense });

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

  const handleCatalogSelect = (index: number, value: string) => {
    if (!value) return;
    const item = catalogItems.find(i => i.label === value);
    if (item) {
        const newItems = [...createForm.items];
        newItems[index] = { description: item.label, amount: item.cost.toString() };
        setCreateForm({ ...createForm, items: newItems });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === parseInt(createForm.patientId));
    
    // Filter out empty rows and format
    let formattedItems = createForm.items
      .filter(i => i.description && i.amount)
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) }));

    if (patient && formattedItems.length > 0) {
      let total = formattedItems.reduce((sum, i) => sum + i.amount, 0);
      
      // Apply Tax if selected
      if (createForm.selectedTaxId) {
          const tax = taxRates.find(t => t.id === parseInt(createForm.selectedTaxId));
          if (tax) {
              const taxAmount = (total * tax.rate) / 100;
              formattedItems.push({
                  description: `Tax: ${tax.name_en} (${tax.rate}%)`,
                  amount: parseFloat(taxAmount.toFixed(2))
              });
              total += taxAmount;
          }
      }

      await api.createBill({
        patientId: patient.id,
        patientName: patient.fullName,
        totalAmount: total,
        date: new Date().toISOString().split('T')[0],
        items: formattedItems
      });
      
      setIsCreateModalOpen(false);
      setCreateForm({ patientId: '', items: [{ description: '', amount: '' }], selectedTaxId: '' });
      loadData();
    }
  };

  const openPaymentModal = (bill: Bill) => {
    setPayingBill(bill);
    // Default to remaining balance
    const remaining = bill.totalAmount - (bill.paidAmount || 0);
    // Determine default payment method. If user has insurance, maybe default to insurance?
    // For now, simpler to default to Cash.
    setPaymentForm({ 
        amount: remaining.toString(), 
        method: 'Cash',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        transactionId: '',
        insuranceProvider: '',
        policyNumber: '',
        expiryDate: ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;

    // Construct Payment Payload
    const payload: any = {
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        date: paymentForm.date,
        details: { notes: paymentForm.notes }
    };

    if (paymentForm.method === 'Insurance') {
        payload.details = {
            ...payload.details,
            provider: paymentForm.insuranceProvider,
            policyNumber: paymentForm.policyNumber,
            expiryDate: paymentForm.expiryDate
        };
    } else if (paymentForm.method !== 'Cash') {
        payload.details = {
            ...payload.details,
            transactionId: paymentForm.transactionId
        };
    }

    try {
      await api.recordPayment(payingBill.id, payload);
      setIsPaymentModalOpen(false);
      setPayingBill(null);
      loadData();
    } catch (e) {
      alert('Payment failed');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.addExpense({
              ...expenseForm,
              amount: parseFloat(expenseForm.amount)
          });
          setIsExpenseModalOpen(false);
          setExpenseForm({ category: 'General', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], description: '' });
          loadData();
      } catch(e) {
          alert('Failed to add expense');
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

      let matchesDate = true;
      if (dateRange.start) {
        matchesDate = matchesDate && new Date(bill.date) >= new Date(dateRange.start);
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && new Date(bill.date) <= endDate;
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [bills, searchTerm, filterType, dateRange]);

  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // --- Render Helpers ---

  const InvoiceView = ({ bill }: { bill: Bill }) => {
    // Try to find Tax Item
    const taxItem = bill.items.find(i => i.description.toLowerCase().startsWith('tax'));
    const subtotal = bill.items.filter(i => !i.description.toLowerCase().startsWith('tax')).reduce((sum, i) => sum + i.amount, 0);
    const taxAmount = taxItem ? taxItem.amount : 0;

    return (
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
                <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {taxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                    <span>{t('billing_invoice_tax')}</span>
                    <span className="font-medium">${taxAmount.toFixed(2)}</span>
                </div>
            )}
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
  };

  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);
  const isAccountant = currentUser?.role === 'accountant' || currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('billing_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('billing_subtitle')}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'invoices' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
              Invoices
          </button>
          <button
            onClick={() => setActiveTab('treasury')}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'treasury' ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
          >
              Treasury
          </button>
      </div>

      {activeTab === 'invoices' && (
        <>
            <div className="flex justify-end">
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
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-64">
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
                            className="pl-9 pr-8 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none cursor-pointer"
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

                {/* Date Range Filter */}
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Calendar className="text-slate-400 w-4 h-4 shrink-0" />
                    <input 
                        type="date" 
                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-full md:w-auto"
                        value={dateRange.start}
                        onChange={e => setDateRange({...dateRange, start: e.target.value})}
                        placeholder="Start"
                    />
                    <span className="text-slate-400">-</span>
                    <input 
                        type="date" 
                        className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm w-full md:w-auto"
                        value={dateRange.end}
                        onChange={e => setDateRange({...dateRange, end: e.target.value})}
                        placeholder="End"
                    />
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
                            {/* Action Logic Updated */}
                            <Button size="sm" variant="secondary" icon={FileText} onClick={() => setSelectedBill(bill)}>{t('billing_action_view_invoice')}</Button>
                            
                            {canManageBilling && (
                                <>
                                    {(bill.status === 'pending' || bill.status === 'partial') && (
                                        <Button size="sm" onClick={() => openPaymentModal(bill)}>{t('billing_action_pay')}</Button>
                                    )}
                                    {bill.status === 'paid' && (
                                        <Button 
                                            size="sm" 
                                            variant="danger" 
                                            disabled={!isAccountant} 
                                            icon={RefreshCcw}
                                            title={!isAccountant ? "Refunds require Accountant role" : ""}
                                        >
                                            Refund
                                        </Button>
                                    )}
                                </>
                            )}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
            </Card>
        </>
      )}

      {activeTab === 'treasury' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-end">
                  <Button onClick={() => setIsExpenseModalOpen(true)} icon={Plus} variant="secondary">Record Expense</Button>
              </div>

              {/* Treasury Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Total Income</h4>
                    <p className="text-3xl font-bold text-green-600 mt-2 flex items-center gap-2"><ArrowUpRight size={24}/> ${treasuryStats.income.toLocaleString()}</p>
                  </Card>
                  <Card>
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Total Expenses</h4>
                    <p className="text-3xl font-bold text-red-500 mt-2 flex items-center gap-2"><ArrowDownRight size={24}/> ${treasuryStats.expenses.toLocaleString()}</p>
                  </Card>
                  <Card>
                    <h4 className="text-xs font-bold text-slate-500 uppercase">Net Cash Flow</h4>
                    <p className={`text-3xl font-bold mt-2 ${treasuryStats.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${treasuryStats.net.toLocaleString()}</p>
                  </Card>
              </div>

              <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Landmark size={18}/> Recent Transactions</h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                          <thead className="bg-white dark:bg-slate-900">
                              <tr>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Type</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Category</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Description</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Method</th>
                                  <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Amount</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
                              {transactions.map((t) => (
                                  <tr key={t.id}>
                                      <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(t.date).toLocaleDateString()}</td>
                                      <td className="px-6 py-3">
                                          <Badge color={t.type === 'income' ? 'green' : 'red'}>{t.type}</Badge>
                                      </td>
                                      <td className="px-6 py-3 text-sm font-medium">{t.category || '-'}</td>
                                      <td className="px-6 py-3 text-sm text-slate-500">{t.description}</td>
                                      <td className="px-6 py-3 text-sm">{t.method}</td>
                                      <td className={`px-6 py-3 text-sm font-bold text-right ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                          {t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString()}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </Card>
          </div>
      )}

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
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
              {createForm.items.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                  {/* Catalog Selector */}
                  <select 
                    className="w-full sm:w-1/3 text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                    onChange={(e) => handleCatalogSelect(index, e.target.value)}
                    defaultValue=""
                  >
                    <option value="" disabled>Quick Add...</option>
                    {catalogItems.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}
                  </select>

                  <Input 
                    placeholder={t('billing_modal_create_item_placeholder')}
                    value={item.description}
                    onChange={e => handleItemChange(index, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Input 
                        placeholder="0.00"
                        type="number"
                        value={item.amount}
                        onChange={e => handleItemChange(index, 'amount', e.target.value)}
                        className="w-24"
                    />
                    <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 p-2">
                        <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddItem} className="mt-2 w-full" icon={Plus}>{t('billing_modal_create_add_item_button')}</Button>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-4">
             <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Tax Rate</label>
                <select 
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 text-sm"
                    value={createForm.selectedTaxId}
                    onChange={e => setCreateForm({...createForm, selectedTaxId: e.target.value})}
                >
                    <option value="">None</option>
                    {taxRates.filter(t => t.isActive).map(t => (
                        <option key={t.id} value={t.id}>{language === 'ar' ? t.name_ar : t.name_en} ({t.rate}%)</option>
                    ))}
                </select>
             </div>
             <div className="text-right">
                <span className="block text-sm text-slate-500">{t('billing_modal_create_total_label')}</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    ${(() => {
                        const subtotal = createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
                        const taxRate = taxRates.find(t => t.id === parseInt(createForm.selectedTaxId));
                        const tax = taxRate ? (subtotal * taxRate.rate) / 100 : 0;
                        return (subtotal + tax).toFixed(2);
                    })()}
                </span>
             </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit">{t('billing_modal_create_generate_button')}</Button>
          </div>
        </form>
      </Modal>

      {/* Advanced Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={t('billing_modal_payment_title')}>
        {payingBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('billing_modal_payment_balance_due')}</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">${(payingBill.totalAmount - payingBill.paidAmount).toLocaleString()}</p>
            </div>
            
            <Select 
              label={t('billing_modal_payment_method')}
              value={paymentForm.method}
              onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}
              required
            >
              <option value="Cash">Cash</option>
              <option value="Insurance">Insurance</option>
              {paymentMethods.filter(p => p.isActive).map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
            </Select>

            {/* Dynamic Fields based on Method */}
            <div className="space-y-4 animate-in fade-in">
                {/* 1. Cash or Generic */}
                <Input 
                    label={t('billing_modal_payment_amount')}
                    type="number" 
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})}
                    required
                />

                {/* 2. Insurance Specifics */}
                {paymentForm.method === 'Insurance' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <div className="md:col-span-2">
                            <Select 
                                label={t('patients_modal_form_insurance_provider')} 
                                value={paymentForm.insuranceProvider} 
                                onChange={e => setPaymentForm({...paymentForm, insuranceProvider: e.target.value})}
                                required
                            >
                                <option value="">Select Provider...</option>
                                {insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
                            </Select>
                        </div>
                        <Input 
                            label={t('patients_modal_form_insurance_policy')} 
                            value={paymentForm.policyNumber} 
                            onChange={e => setPaymentForm({...paymentForm, policyNumber: e.target.value})} 
                            required 
                        />
                        <Input 
                            label={t('patients_modal_form_insurance_expiry')} 
                            type="date" 
                            value={paymentForm.expiryDate} 
                            onChange={e => setPaymentForm({...paymentForm, expiryDate: e.target.value})} 
                            required 
                        />
                        <div className="md:col-span-2">
                            <Textarea 
                                label="Coverage Notes" 
                                rows={2} 
                                value={paymentForm.notes} 
                                onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} 
                            />
                        </div>
                    </div>
                )}

                {/* 3. Bank/Card/Other Specifics */}
                {paymentForm.method !== 'Cash' && paymentForm.method !== 'Insurance' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <Input 
                            label="Transaction ID / Ref" 
                            value={paymentForm.transactionId} 
                            onChange={e => setPaymentForm({...paymentForm, transactionId: e.target.value})} 
                            required 
                        />
                        <Input 
                            label={t('date')} 
                            type="date" 
                            value={paymentForm.date} 
                            onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} 
                            required 
                        />
                        <div className="md:col-span-2">
                            <Textarea 
                                label={t('patients_modal_action_notes')} 
                                rows={2} 
                                value={paymentForm.notes} 
                                onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} 
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" icon={CheckCircle}>{t('billing_modal_payment_confirm_button')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Expense Modal */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Record Expense">
          <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <Select label="Category" value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                  <option value="General">General</option>
                  <option value="Supplies">Medical Supplies</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Salary">Salary / Wages</option>
                  <option value="Equipment">Equipment</option>
              </Select>
              <Input label="Amount ($)" type="number" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                  <Select label="Payment Method" value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value})}>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Check">Check</option>
                  </Select>
                  <Input label="Date" type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
              </div>
              <Textarea label="Description" required rows={3} value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
              <div className="flex justify-end pt-4 gap-3">
                  <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>Cancel</Button>
                  <Button type="submit">Save Expense</Button>
              </div>
          </form>
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
