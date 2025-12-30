
import React, { useState, useEffect, useMemo } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog, Tooltip } from '../components/UI';
import { 
  Plus, Printer, CreditCard, 
  Wallet, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, Search, Filter,
  Landmark, ArrowUpRight, ArrowDownRight, Coins, X, Edit, TrendingUp,
  Banknote, ShieldCheck, RotateCcw, Ban, Loader2, Phone, XCircle, MapPin
} from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, PaymentMethod, TaxRate, Transaction, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

const { useLocation, useNavigate } = ReactRouterDOM as any;

export const Billing = () => {
  const { t, language } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'invoices' | 'treasury'>('invoices');
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [catalogItems, setCatalogItems] = useState<{label: string, cost: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  
  const { user: currentUser } = useAuth();

  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);

  // Memoized Header Tabs
  const HeaderTabs = useMemo(() => (
    <div className="flex items-center gap-3">
      {activeTab === 'invoices' ? (
        canManageBilling && <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus}>{t('billing_create_invoice_button')}</Button>
      ) : (
        <Button onClick={() => openExpenseModal()} icon={Plus} variant="secondary">{t('billing_record_expense_button')}</Button>
      )}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
          <button 
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'invoices' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              <FileText size={14} />
              <span className="hidden sm:inline">{t('billing_tab_invoices')}</span>
          </button>
          <button 
              onClick={() => setActiveTab('treasury')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'treasury' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
          >
              <Landmark size={14} />
              <span className="hidden sm:inline">{t('billing_tab_treasury')}</span>
          </button>
      </div>
    </div>
  ), [activeTab, t, canManageBilling]);

  // Sync Header
  useHeader(t('billing_title'), t('billing_subtitle'), HeaderTabs);

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Search Patient in Create Modal
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);

  // Separate Treasury Filters
  const [treasurySearch, setTreasurySearch] = useState('');
  const [treasuryFilter, setTreasuryFilter] = useState('all');
  const [treasuryPage, setTreasuryPage] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidInvoices: 0,
    totalPendingInvoices: 0,
    revenueByType: [] as {name: string, value: number}[]
  });

  // Treasury Stats
  const [treasuryStats, setTreasuryStats] = useState({
    income: 0,
    expenses: 0,
    net: 0,
    incomeByMethod: [] as {name: string, value: number}[]
  });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  
  // Confirmation Dialog
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);

  // Create Invoice Form
  const [createForm, setCreateForm] = useState({
    patientId: '',
    patientName: '',
    items: [{ description: '', amount: '' }],
    selectedTaxId: ''
  });

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    insuranceProvider: '',
    policyNumber: '',
    expiryDate: '',
    transactionId: ''
  });

  // Refund Form State
  const [refundForm, setRefundForm] = useState({
    amount: '',
    reason: '',
    method: 'Cash',
    date: new Date().toISOString().split('T')[0]
  });

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    category: 'General',
    amount: '',
    method: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const getBillType = (bill: Bill): string => {
    const desc = bill.items?.map(i => i.description.toLowerCase()).join(' ') || '';
    if (desc.includes('admission') || desc.includes('accommodation') || desc.includes('deposit')) return 'Admission';
    if (desc.includes('surgery') || desc.includes('operation')) return 'Operation';
    if (desc.includes('lab') || desc.includes('test')) return 'Lab Test';
    if (desc.includes('appointment') || desc.includes('consultation') || desc.includes('follow-up')) return 'Appointment';
    if (desc.includes('service') || desc.includes('procedure') || desc.includes('dressing') || desc.includes('injection')) return 'Procedure';
    return 'General';
  };

  const translateBillType = (type: string) => {
    switch(type) {
        case 'Admission': return t('nav_admissions');
        case 'Operation': return t('nav_operations');
        case 'Lab Test': return t('nav_laboratory');
        case 'Appointment': return t('nav_appointments');
        case 'Procedure': return t('billing_type_procedure');
        default: return t('billing_type_general');
    }
  };

  const translateStatus = (status: string) => {
    switch(status.toLowerCase()) {
        case 'paid': return t('billing_status_paid');
        case 'pending': return t('billing_status_pending');
        case 'partial': return t('billing_status_partial');
        case 'refunded': return t('billing_status_refunded');
        case 'overdue': return t('billing_status_overdue');
        case 'cancelled': return t('billing_status_cancelled');
        default: return status;
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, p, pm, taxes, labs, services, trans, ins, ops, beds] = await Promise.all([
        api.getBills(), 
        api.getPatients(),
        api.getPaymentMethods(),
        api.getTaxRates(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getTransactions(),
        api.getInsuranceProviders(),
        api.getOperations(),
        api.getBeds()
      ]);
      
      const billsArr = Array.isArray(b) ? b : [];
      setBills(billsArr);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setTaxRates(Array.isArray(taxes) ? taxes : []);
      const transactionsArr = Array.isArray(trans) ? trans : [];
      setTransactions(transactionsArr);
      setInsuranceProviders(Array.isArray(ins) ? ins : []);

      const catalog = [
        ...(Array.isArray(labs) ? labs.map((l: any) => ({ label: `${t('nav_laboratory')}: ${language === 'ar' ? l.name_ar : l.name_en}`, cost: l.cost })) : []),
        ...(Array.isArray(services) ? services.map((s: any) => ({ label: `${t('billing_type_procedure')}: ${language === 'ar' ? s.name_ar : s.name_en}`, cost: s.cost })) : []),
        ...(Array.isArray(ops) ? ops.map((o: any) => ({ label: `${t('nav_operations')}: ${language === 'ar' ? o.name_ar : o.name_en}`, cost: o.base_cost })) : []),
        ...(Array.isArray(beds) ? beds.map((bd: any) => ({ label: `${t('admissions_care_daily_rate')}: ${bd.roomNumber} (${bd.type})`, cost: bd.costPerDay })) : [])
      ];
      setCatalogItems(catalog);

      const pendingBills = billsArr.filter(b => b.status === 'pending' || b.status === 'partial');
      const pendingTotal = pendingBills.reduce((acc, curr) => acc + (curr.totalAmount - curr.paidAmount), 0);

      const activeBills = billsArr.filter(x => x.status !== 'cancelled'); 
      const totalRev = activeBills.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
      
      const paidInvoicesCount = billsArr.filter(x => x.status === 'paid').length;
      const pendingInvoicesCount = pendingBills.length;

      const revenueByTypeMap: Record<string, number> = {};
      activeBills.forEach(bill => {
        const type = getBillType(bill);
        revenueByTypeMap[type] = (revenueByTypeMap[type] || 0) + (bill.paidAmount || 0);
      });
      const revenueByType = Object.entries(revenueByTypeMap).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value);

      setStats({ 
        totalRevenue: totalRev, 
        pendingAmount: pendingTotal, 
        paidInvoices: paidInvoicesCount, 
        totalPendingInvoices: pendingInvoicesCount, 
        revenueByType 
      });

      const income = transactionsArr.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
      const expense = transactionsArr.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
      
      const incomeMethodsMap: Record<string, number> = {};
      transactionsArr.filter(tx => tx.type === 'income').forEach(tx => {
          const method = tx.method || 'Unspecified';
          incomeMethodsMap[method] = (incomeMethodsMap[method] || 0) + tx.amount;
      });
      const incomeByMethod = Object.entries(incomeMethodsMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      setTreasuryStats({ income, expenses: expense, net: income - expense, incomeByMethod });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [language]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.trigger === 'new' && canManageBilling) {
      setIsCreateModalOpen(true);
    }
  }, [location.state, canManageBilling]);

  const getFilteredPaymentMethods = () => {
      return paymentMethods.filter(p => p.isActive);
  };

  const handleAddItem = () => {
    setCreateForm({ ...createForm, items: [...createForm.items, { description: '', amount: '' }] });
  };

  const handleRemoveItem = (index: number) => {
    setCreateForm({ ...createForm, items: createForm.items.filter((_, i) => i !== index) });
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
    if (!createForm.patientId) return;

    let formattedItems = createForm.items
      .filter(i => i.description && i.amount)
      .map(i => ({ description: i.description, amount: parseFloat(i.amount) }));

    if (formattedItems.length > 0) {
      setProcessStatus('processing');
      setProcessMessage(t('processing'));
      let total = formattedItems.reduce((sum, i) => sum + i.amount, 0);
      if (createForm.selectedTaxId) {
          const tax = taxRates.find(t => t.id === parseInt(createForm.selectedTaxId));
          if (tax) {
              const taxAmount = (total * tax.rate) / 100;
              formattedItems.push({ description: `${t('billing_invoice_tax')}: ${language === 'ar' ? tax.name_ar : tax.name_en} (${tax.rate}%)`, amount: parseFloat(taxAmount.toFixed(2)) });
              total += taxAmount;
          }
      }

      try {
        await api.createBill({ 
          patientId: parseInt(createForm.patientId), 
          patientName: createForm.patientName, 
          totalAmount: total, 
          items: formattedItems 
        });
        setProcessStatus('success');
        setProcessMessage(t('success'));
        await loadData();
        setTimeout(() => {
            setIsCreateModalOpen(false);
            setCreateForm({ patientId: '', patientName: '', items: [{ description: '', amount: '' }], selectedTaxId: '' });
            setPatientSearch('');
            setProcessStatus('idle');
        }, 1000);
      } catch(e: any) { 
          console.error(e); 
          setProcessStatus('error');
          setProcessMessage(e.response?.data?.error || t('error'));
      }
    }
  };

  const openPaymentModal = (bill: Bill) => {
    setPayingBill(bill);
    const patient = patients.find(p => p.id === bill.patientId);
    const remaining = bill.totalAmount - (bill.paidAmount || 0);
    
    let defaultMethod = '';
    const activePMs = getFilteredPaymentMethods();
    if (activePMs.length > 0) {
        const cashMethod = activePMs.find(p => p.name_en.toLowerCase() === 'cash');
        const insuranceMethod = activePMs.find(p => p.name_en.toLowerCase() === 'insurance');
        
        if (patient?.hasInsurance && insuranceMethod) defaultMethod = insuranceMethod.name_en;
        else if (cashMethod) defaultMethod = cashMethod.name_en;
        else defaultMethod = activePMs[0].name_en;
    }

    setPaymentForm({ 
        amount: remaining.toString(), 
        method: defaultMethod,
        date: new Date().toISOString().split('T')[0],
        notes: '',
        transactionId: '',
        insuranceProvider: patient?.hasInsurance ? patient?.insuranceDetails?.provider || '' : '',
        policyNumber: patient?.hasInsurance ? patient?.insuranceDetails?.policyNumber || '' : '',
        expiryDate: patient?.hasInsurance ? patient?.insuranceDetails?.expiryDate || '' : ''
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    const payload: any = { amount: parseFloat(paymentForm.amount), method: paymentForm.method, date: paymentForm.date, details: { notes: paymentForm.notes } };
    if (paymentForm.method.toLowerCase() === 'insurance') {
        payload.details = { ...payload.details, provider: paymentForm.insuranceProvider, policyNumber: paymentForm.policyNumber, expiryDate: paymentForm.expiryDate };
    } else if (paymentForm.method.toLowerCase() !== 'cash') {
        payload.details = { ...payload.details, transactionId: paymentForm.transactionId };
    }

    try {
      await api.recordPayment(payingBill.id, payload);
      setProcessStatus('success');
      setProcessMessage(t('success'));
      await loadData();
      setTimeout(() => {
          setIsPaymentModalOpen(false);
          setPayingBill(null);
          setProcessStatus('idle');
      }, 1000);
    } catch (err: any) { 
        setProcessStatus('error');
        setProcessMessage(err.response?.data?.error || t('billing_payment_failed'));
    }
  };

  const openRefundModal = (bill: Bill) => {
    setPayingBill(bill);
    setRefundForm({
      amount: (bill.paidAmount || 0).toString(),
      reason: '',
      method: 'Cash',
      date: new Date().toISOString().split('T')[0]
    });
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try {
      await api.processRefund(payingBill.id, {
        amount: parseFloat(refundForm.amount),
        reason: refundForm.reason,
        date: refundForm.date,
        method: refundForm.method
      });
      setProcessStatus('success');
      setProcessMessage(t('success'));
      await loadData();
      setTimeout(() => {
          setIsRefundModalOpen(false);
          setPayingBill(null);
          setProcessStatus('idle');
      }, 1000);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || t('billing_refund_failed'));
    }
  };

  const handleCancelService = (bill: Bill) => {
    setConfirmState({
      isOpen: true,
      title: t('billing_action_cancel_process'),
      message: t('billing_action_cancel_confirm_msg'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage(t('processing'));
        try {
          await api.cancelService(bill.id);
          setProcessStatus('success');
          setProcessMessage(t('success'));
          await loadData();
          setTimeout(() => setProcessStatus('idle'), 1000);
        } catch (e: any) {
          setProcessStatus('error');
          setProcessMessage(e.response?.data?.error || t('billing_cancel_service_failed'));
        }
      }
    });
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setProcessStatus('processing');
      setProcessMessage(t('processing'));
      try {
          const payload = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
          if (editingExpenseId) {
            await api.updateExpense(editingExpenseId, payload);
          } else {
            await api.addExpense(payload);
          }
          setProcessStatus('success');
          setProcessMessage(t('success'));
          await loadData();
          setTimeout(() => {
              setIsExpenseModalOpen(false);
              setEditingExpenseId(null);
              setProcessStatus('idle');
          }, 1000);
      } catch(err: any) { 
          setProcessStatus('error');
          setProcessMessage(err.response?.data?.error || (editingExpenseId ? "Failed to update expense." : t('billing_expense_failed')));
      }
  };

  const openExpenseModal = (tx?: Transaction) => {
      const activePMs = getFilteredPaymentMethods();
      const cashMethod = activePMs.find(p => p.name_en.toLowerCase() === 'cash')?.name_en || (activePMs[0]?.name_en || 'Cash');

      if (tx) {
        setEditingExpenseId(tx.id);
        setExpenseForm({
            category: tx.category || 'General',
            amount: tx.amount.toString(),
            method: tx.method || cashMethod,
            date: tx.date ? (tx.date.includes('T') ? tx.date.split('T')[0] : tx.date.split(' ')[0]) : new Date().toISOString().split('T')[0],
            description: tx.description || ''
        });
      } else {
        setEditingExpenseId(null);
        setExpenseForm({ 
            category: 'General', 
            amount: '', 
            method: cashMethod, 
            date: new Date().toISOString().split('T')[0], 
            description: '' 
        });
      }
      setIsExpenseModalOpen(true);
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = bill.patientName.toLowerCase().includes(searchLower) || 
                            bill.billNumber.toLowerCase().includes(searchLower) ||
                            (bill.patientPhone && bill.patientPhone.includes(searchLower));
      
      const matchesType = filterType === 'all' || getBillType(bill) === filterType;
      return matchesSearch && matchesType;
    });
  }, [bills, searchTerm, filterType]);

  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
        const matchesSearch = (t.description && t.description.toLowerCase().includes(treasurySearch.toLowerCase())) || (t.category && t.category.toLowerCase().includes(treasurySearch.toLowerCase()));
        const matchesType = treasuryFilter === 'all' || t.type === treasuryFilter;
        return matchesSearch && matchesType;
    });
  }, [transactions, treasurySearch, treasuryFilter]);

  const paginatedTransactions = filteredTransactions.slice((treasuryPage - 1) * itemsPerPage, treasuryPage * itemsPerPage);
  const totalTreasuryPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const filteredPatientsForInvoice = useMemo(() => {
    if (!patientSearch) return [];
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || 
      p.patientId.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.phone.includes(patientSearch)
    ).slice(0, 5);
  }, [patients, patientSearch]);

  const InvoiceView = ({ bill }: { bill: Bill }) => {
    const taxItem = bill.items.find(i => i.description.toLowerCase().includes('tax'));
    const subtotal = bill.items.filter(i => !i.description.toLowerCase().includes('tax')).reduce((sum, i) => sum + i.amount, 0);
    const taxAmount = taxItem ? taxItem.amount : 0;
    const hospitalName = localStorage.getItem('h_name') || 'AllCare Hospital';
    const hospitalAddress = localStorage.getItem('h_address') || 'Atbara ,alsoug alkabeer';
    const hospitalPhone = localStorage.getItem('h_phone') || '+249 123 456 789';

    return (
        <div className="p-8 bg-white min-h-[800px] text-slate-800 font-sans relative" id="invoice-print">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-lg shadow-sm">
                        <Wallet size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{hospitalName}</h1>
                        <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2"><MapPin size={12} /> {hospitalAddress}</p>
                        <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><Phone size={12} /> {hospitalPhone}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-3xl font-black text-slate-200 uppercase tracking-widest">{t('billing_invoice_title')}</h2>
                    <p className="font-mono text-lg font-bold text-slate-900 mt-1">#{bill.billNumber}</p>
                    <div className="mt-2">
                       <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'cancelled' ? 'gray' : 'red'} className="text-xs uppercase px-2 py-1">{translateStatus(bill.status)}</Badge>
                    </div>
                </div>
            </div>

            {/* Bill To / Details Grid */}
            <div className="grid grid-cols-2 gap-12 mb-10">
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t('billing_invoice_billed_to')}</p>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="font-bold text-lg text-slate-900">{bill.patientName}</p>
                        <p className="text-sm text-slate-600 mt-1">{t('patients_table_header_patient')} ID: <span className="font-mono font-bold">#{bill.patientId}</span></p>
                        {bill.patientPhone && <p className="text-sm text-slate-600 mt-1">{bill.patientPhone}</p>}
                    </div>
                </div>
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">{t('billing_table_header_info')}</p>
                    <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-sm text-slate-500 font-medium">{t('billing_invoice_date')}</span>
                            <span className="text-sm font-bold text-slate-900">{new Date(bill.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-sm text-slate-500 font-medium">{t('appointments_form_type')}</span>
                            <span className="text-sm font-bold text-slate-900">{translateBillType(getBillType(bill))}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Line Items */}
            <table className="w-full mb-8">
                <thead className="bg-slate-900 text-white">
                    <tr>
                        <th className="py-3 px-4 text-left text-xs font-bold uppercase tracking-wider rounded-l-lg">{t('billing_invoice_description')}</th>
                        <th className="py-3 px-4 text-right text-xs font-bold uppercase tracking-wider rounded-r-lg w-32">{t('billing_table_header_amount')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {bill.items.map((item, i) => (
                        <tr key={i}>
                            <td className="py-4 px-4 text-sm font-medium text-slate-700">{item.description}</td>
                            <td className="py-4 px-4 text-right text-sm font-bold font-mono text-slate-900">${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Summary */}
            <div className="flex justify-end mb-12">
                <div className="w-64 space-y-3">
                    <div className="flex justify-between text-sm text-slate-600">
                        <span>{t('billing_invoice_subtotal')}</span>
                        <span className="font-mono font-bold">${subtotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    {taxAmount > 0 && (
                        <div className="flex justify-between text-sm text-slate-600">
                            <span>{t('billing_invoice_tax')}</span>
                            <span className="font-mono font-bold">${taxAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                        </div>
                    )}
                    <div className="h-px bg-slate-900 my-2"></div>
                    <div className="flex justify-between text-lg font-black text-slate-900">
                        <span>{t('billing_invoice_total')}</span>
                        <span className="font-mono">${bill.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-emerald-600">
                        <span>{t('billing_invoice_paid')}</span>
                        <span className="font-mono">-${(bill.paidAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-rose-600 pt-2 border-t border-slate-200">
                        <span>{t('billing_invoice_balance')}</span>
                        <span className="font-mono">${(bill.totalAmount - (bill.paidAmount || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>

            {/* Footer / Signature */}
            <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end border-t border-slate-200 pt-6">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                    <div className="h-12 w-48 border-b border-slate-900 mt-2"></div>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    <p>Thank you for choosing {hospitalName}</p>
                    <p className="mt-1">System Generated Invoice</p>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* STATUS DIALOG (Loading, Success, Error) */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {processStatus === 'processing' ? t('processing') : processStatus === 'success' ? t('success') : t('patients_process_title_failed')}
            </h3>
            
            {processMessage && <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>}
            
            {processStatus === 'error' && (
              <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-slate-500 font-medium">{t('loading')}</p>
        </div>
      ) : (
        <>
          {activeTab === 'invoices' && (
            <div className="animate-in fade-in space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="hover:shadow-lg transition-all"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_revenue')}</h4><p className="text-3xl font-black text-emerald-600 mt-2">${stats.totalRevenue.toLocaleString()}</p></Card>
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-orange-400"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_pending')}</h4><p className="text-3xl font-black text-orange-500 mt-2">${stats.pendingAmount.toLocaleString()}</p></Card>
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary-400"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_paid')}</h4><div className="flex items-baseline gap-2 mt-2"><p className="text-3xl font-black text-slate-800 dark:text-white">{stats.paidInvoices}</p><span className="text-sm font-bold text-slate-400">/ {stats.totalPendingInvoices} {t('billing_status_pending')}</span></div></Card>
                </div>
                
                <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder={t('billing_search_placeholder')} className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}/></div>
                        <div className="relative w-full sm:w-auto"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" /><select className="pl-9 pr-8 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm appearance-none cursor-pointer text-slate-900 dark:text-white" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}><option value="all">{t('patients_filter_type_all')}</option><option value="Appointment">{t('nav_appointments')}</option><option value="Lab Test">{t('nav_laboratory')}</option><option value="Admission">{t('nav_admissions')}</option><option value="Operation">{t('nav_operations')}</option><option value="Procedure">{t('billing_type_procedure')}</option><option value="General">{t('billing_type_general')}</option></select></div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_info')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('patients_table_header_patient')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_status')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_paid_progress')}</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                          {paginatedBills.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-slate-400">{t('billing_table_empty')}</td></tr> : 
                           paginatedBills.map(bill => {
                            const paidPercent = bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0;
                            const isCancelled = bill.status === 'cancelled' || bill.serviceStatus === 'cancelled';
                            const isPaid = (bill.paidAmount || 0) > 0;
                            const isCompleted = bill.serviceStatus === 'completed';
                            
                            const canRefund = isPaid && isCancelled && !isCompleted;
                            const canCancelService = !isCancelled && !isCompleted;

                            return (
                              <tr key={bill.id} className={isCancelled ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}>
                                <td className="px-4 py-4 whitespace-nowrap"><div className="font-bold text-sm">{bill.billNumber}</div><div className="text-xs text-slate-500">{new Date(bill.date).toLocaleDateString()}</div></td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium">{bill.patientName}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                      {bill.patientPhone ? <><Phone size={10}/> {bill.patientPhone}</> : `ID: ${bill.patientId}`}
                                    </div>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap"><div className="flex flex-col gap-1"><Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : isCancelled ? 'red' : 'orange'}>{translateStatus(bill.status)}</Badge><Badge color="gray">{translateBillType(getBillType(bill))}</Badge></div></td>
                                <td className="px-4 py-4 whitespace-nowrap min-w-[120px]"><div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2"><div className={`h-2 rounded-full transition-all duration-500 ${isCancelled ? 'bg-red-400' : 'bg-primary-500'}`} style={{ width: `${paidPercent}%` }}></div></div><p className="text-right text-[10px] mt-1 text-slate-500 font-bold font-mono">${(bill.paidAmount || 0).toLocaleString()} / ${(bill.totalAmount || 0).toLocaleString()}</p></td>
                                <td className="px-4 py-4 whitespace-nowrap text-right font-mono font-bold text-sm">${bill.totalAmount.toLocaleString()}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-1">
                                        <Tooltip content={t('billing_action_view_invoice')} side="top">
                                            <button onClick={() => setSelectedBill(bill)} className="p-2 text-slate-500 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                                <FileText size={20} />
                                            </button>
                                        </Tooltip>
                                        {canManageBilling && (
                                          <>
                                            {!isCancelled && (bill.status === 'pending' || bill.status === 'partial') && (
                                              <Tooltip content={t('billing_action_pay')} side="top">
                                                  <button onClick={() => openPaymentModal(bill)} className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
                                                      <CreditCard size={20} />
                                                  </button>
                                              </Tooltip>
                                            )}
                                            {canCancelService && (
                                              <Tooltip content={t('cancel')} side="top">
                                                  <button onClick={() => handleCancelService(bill)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                                                      <Ban size={20} />
                                                  </button>
                                              </Tooltip>
                                            )}
                                            {canRefund && (
                                              <Tooltip content={t('billing_action_refund')} side="top">
                                                  <button onClick={() => openRefundModal(bill)} className="p-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors">
                                                      <RotateCcw size={20} />
                                                  </button>
                                              </Tooltip>
                                            )}
                                          </>
                                        )}
                                    </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 gap-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                          <span>{t('patients_pagination_showing')} {paginatedBills.length} {t('patients_pagination_of')} {filteredBills.length}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                            <select 
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                              value={itemsPerPage}
                              onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
                            >
                              <option value={10}>10</option>
                              <option value={15}>15</option>
                              <option value={20}>20</option>
                              <option value={50}>50</option>
                              <option value={100}>100</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                          <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                        </div>
                      </div>
                </Card>
            </div>
          )}

          {activeTab === 'treasury' && (
              <div className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="border-l-4 border-l-emerald-500 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-2xl">
                           <ArrowUpRight size={24}/>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_income')}</h4>
                          <p className="text-3xl font-black text-emerald-600 mt-1">${treasuryStats.income.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className="border-l-4 border-l-rose-500 hover:shadow-lg transition-all">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl">
                           <ArrowDownRight size={24}/>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_expenses')}</h4>
                          <p className="text-3xl font-black text-rose-600 mt-1">${treasuryStats.expenses.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                    <Card className={`border-l-4 ${treasuryStats.net >= 0 ? 'border-l-primary-500' : 'border-l-rose-600'} hover:shadow-lg transition-all bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900`}>
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${treasuryStats.net >= 0 ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600' : 'bg-rose-100 text-rose-700'}`}>
                           <TrendingUp size={24}/>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_net')}</h4>
                          <p className={`text-3xl font-black mt-1 ${treasuryStats.net >= 0 ? 'text-primary-600' : 'text-rose-600'}`}>${treasuryStats.net.toLocaleString()}</p>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
                          <div className="flex items-center gap-2 flex-1"><Landmark size={18} className="text-slate-500"/> <h3 className="font-bold text-slate-800 dark:text-white">{t('billing_treasury_transactions')}</h3></div>
                          <div className="flex gap-2 items-center"><select className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white" value={treasuryFilter} onChange={(e) => setTreasuryFilter(e.target.value)}><option value="all">{t('billing_treasury_filter_all')}</option><option value="income">{t('billing_treasury_type_income')}</option><option value="expense">{t('billing_treasury_type_expense')}</option></select></div>
                      </div>
                      <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-white dark:bg-slate-900"><tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('date')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('appointments_form_type')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_category')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_description')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_method')}</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-800">{paginatedTransactions.map((tx) => (<tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"><td className="px-6 py-3 text