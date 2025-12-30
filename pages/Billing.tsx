
import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog, Tooltip, CancellationModal } from '../components/UI';
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
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  
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
  const [cancellingBill, setCancellingBill] = useState<Bill | null>(null);

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

  const handleCancelClick = (bill: Bill) => {
    setCancellingBill(bill);
    setIsCancelModalOpen(true);
  };

  const onConfirmCancellation = async (reason: string, note: string) => {
    if (!cancellingBill) return;
    setIsCancelModalOpen(false);
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try {
      await api.cancelService(cancellingBill.id, { reason, note });
      setProcessStatus('success');
      setProcessMessage(t('success'));
      await loadData();
      setTimeout(() => {
        setProcessStatus('idle');
        setCancellingBill(null);
      }, 1000);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || t('billing_cancel_service_failed'));
    }
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
    const hospitalAddress = localStorage.getItem('h_address') || 'Atbara, alsoug alkabeer';
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
                          {paginatedBills.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-20 text-slate-400 font-bold">{t('billing_table_empty')}</td></tr>
                          ) : (
                            paginatedBills.map(bill => {
                              const progress = bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0;
                              return (
                                <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                                  <td className="px-4 py-4">
                                    <div className="font-bold text-slate-900 dark:text-white">#{bill.billNumber}</div>
                                    <div className="text-xs text-slate-500">{new Date(bill.date).toLocaleDateString()} • {translateBillType(getBillType(bill))}</div>
                                  </td>
                                  <td className="px-4 py-4">
                                    <div className="font-bold text-slate-800 dark:text-white">{bill.patientName}</div>
                                    <div className="text-xs text-slate-500">{bill.patientPhone}</div>
                                  </td>
                                  <td className="px-4 py-4"><Badge color={bill.status === 'paid' ? 'green' : bill.status === 'cancelled' ? 'gray' : bill.status === 'partial' ? 'yellow' : 'red'}>{translateStatus(bill.status)}</Badge></td>
                                  <td className="px-4 py-4 w-48">
                                    <div className="flex justify-between text-xs mb-1 font-bold"><span className="text-emerald-600">${bill.paidAmount.toLocaleString()}</span><span className="text-slate-400">${bill.totalAmount.toLocaleString()}</span></div>
                                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                      <div className={`h-full ${bill.status === 'paid' ? 'bg-emerald-500' : 'bg-yellow-500'}`} style={{width: `${Math.min(progress, 100)}%`}}></div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-right font-mono font-black text-slate-700 dark:text-slate-300">${bill.totalAmount.toLocaleString()}</td>
                                  <td className="px-4 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Tooltip content={t('billing_action_view_invoice')}><Button size="sm" variant="ghost" icon={FileText} onClick={() => { setSelectedBill(bill); setIsPreviewModalOpen(true); }} /></Tooltip>
                                      {canManageBilling && bill.status !== 'paid' && bill.status !== 'cancelled' && <Tooltip content={t('billing_action_pay')}><Button size="sm" variant="primary" icon={CreditCard} onClick={() => openPaymentModal(bill)} /></Tooltip>}
                                      {canManageBilling && bill.paidAmount > 0 && bill.status !== 'refunded' && bill.status !== 'cancelled' && <Tooltip content={t('billing_action_refund')}><Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => openRefundModal(bill)} /></Tooltip>}
                                      {canManageBilling && bill.status !== 'cancelled' && <Tooltip content={t('billing_action_cancel_process')}><Button size="sm" variant="danger" icon={Ban} onClick={() => handleCancelClick(bill)} /></Tooltip>}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                    {!loading && filteredBills.length > 0 && (
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
                                      <option value={20}>20</option>
                                      <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                                <Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
          )}

          {activeTab === 'treasury' && (
            <div className="animate-in fade-in space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-emerald-500"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_income')}</h4><p className="text-3xl font-black text-emerald-600 mt-2">${treasuryStats.income.toLocaleString()}</p></Card>
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-rose-500"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_expenses')}</h4><p className="text-3xl font-black text-rose-600 mt-2">${treasuryStats.expenses.toLocaleString()}</p></Card>
                    <Card className="hover:shadow-lg transition-all border-l-4 border-l-blue-500"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_net')}</h4><p className={`text-3xl font-black mt-2 ${treasuryStats.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${treasuryStats.net.toLocaleString()}</p></Card>
                </div>

                <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="flex items-center gap-2"><h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2"><Landmark size={20} className="text-primary-600"/> {t('billing_treasury_transactions')}</h3></div>
                        <div className="flex gap-2">
                            <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"/><input type="text" placeholder={t('billing_search_placeholder')} className="pl-9 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={treasurySearch} onChange={e => setTreasurySearch(e.target.value)}/></div>
                            <select className="pl-3 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={treasuryFilter} onChange={e => setTreasuryFilter(e.target.value)}>
                                <option value="all">{t('billing_treasury_filter_all')}</option>
                                <option value="income">{t('billing_treasury_type_income')}</option>
                                <option value="expense">{t('billing_treasury_type_expense')}</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('date')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_category')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_description')}</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_method')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                                {paginatedTransactions.map((tx) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300 font-mono">{new Date(tx.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4"><Badge color={tx.type === 'income' ? 'green' : 'red'}>{tx.category}</Badge></td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-800 dark:text-white max-w-xs truncate" title={tx.description}>{tx.description}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{tx.method}</td>
                                        <td className={`px-6 py-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            {tx.type === 'expense' && canManageBilling && (
                                                <Button size="sm" variant="ghost" icon={Edit} onClick={() => openExpenseModal(tx)} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Treasury Pagination */}
                    {filteredTransactions.length > 0 && (
                        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700 gap-4">
                            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500">
                                <span>{t('patients_pagination_showing')} {paginatedTransactions.length} {t('patients_pagination_of')} {filteredTransactions.length}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs whitespace-nowrap">{t('patients_pagination_rows')}</span>
                                    <select 
                                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs outline-none cursor-pointer"
                                      value={itemsPerPage}
                                      onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setTreasuryPage(1); }}
                                    >
                                      <option value={10}>10</option>
                                      <option value={20}>20</option>
                                      <option value={50}>50</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={() => setTreasuryPage(p => Math.max(1, p-1))} disabled={treasuryPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button>
                                <Button size="sm" variant="secondary" onClick={() => setTreasuryPage(p => Math.min(totalTreasuryPages, p+1))} disabled={treasuryPage === totalTreasuryPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('billing_modal_create_title')}>
        <form onSubmit={handleCreateSubmit} className="space-y-6">
            <div className="relative space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{t('billing_modal_create_select_patient')}</label>
                {createForm.patientId ? (
                    <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                        <span className="font-bold text-primary-700 dark:text-primary-300">{createForm.patientName}</span>
                        <button type="button" onClick={() => setCreateForm({...createForm, patientId: '', patientName: ''})} className="p-1 text-primary-600 hover:bg-primary-100 rounded-full"><X size={16}/></button>
                    </div>
                ) : (
                    <>
                        <input 
                            type="text" 
                            placeholder={t('patients_search_placeholder')} 
                            className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                            value={patientSearch}
                            onChange={e => { setPatientSearch(e.target.value); setShowPatientResults(true); }}
                            onFocus={() => setShowPatientResults(true)}
                        />
                        {showPatientResults && filteredPatientsForInvoice.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                                {filteredPatientsForInvoice.map(p => (
                                    <div key={p.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0" onClick={() => {
                                        setCreateForm({...createForm, patientId: p.id.toString(), patientName: p.fullName});
                                        setPatientSearch('');
                                        setShowPatientResults(false);
                                    }}>
                                        <p className="font-bold text-sm">{p.fullName}</p>
                                        <p className="text-xs text-slate-500">{p.phone}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('billing_modal_create_items_label')}</label>
                    <Select className="!w-48 !py-1 !text-xs" onChange={(e) => handleCatalogSelect(createForm.items.length - 1, e.target.value)} value="">
                        <option value="">{t('billing_modal_create_quick_add')}</option>
                        {catalogItems.map((item, idx) => <option key={idx} value={item.label}>{item.label} (${item.cost})</option>)}
                    </Select>
                </div>
                {createForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                        <Input placeholder={t('billing_modal_create_item_placeholder')} value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} className="flex-1" />
                        <Input type="number" placeholder="0.00" value={item.amount} onChange={e => handleItemChange(idx, 'amount', e.target.value)} className="w-28 text-right font-mono" />
                        {createForm.items.length > 1 && <button type="button" onClick={() => handleRemoveItem(idx)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>}
                    </div>
                ))}
                <Button type="button" size="sm" variant="secondary" onClick={handleAddItem} icon={Plus} className="w-full dashed-border">{t('billing_modal_create_add_item_button')}</Button>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="w-1/2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('billing_modal_create_tax_rate')}</label>
                    <Select value={createForm.selectedTaxId} onChange={e => setCreateForm({...createForm, selectedTaxId: e.target.value})}>
                        <option value="">{t('billing_modal_create_none')}</option>
                        {taxRates.filter(t => t.isActive).map(tax => <option key={tax.id} value={tax.id}>{language === 'ar' ? tax.name_ar : tax.name_en} ({tax.rate}%)</option>)}
                    </Select>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">{t('billing_modal_create_total_label')}</span>
                    <span className="text-2xl font-black text-slate-800 dark:text-white">
                        ${createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0).toLocaleString()}
                    </span>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" disabled={!createForm.patientId} icon={CheckCircle}>{t('billing_modal_create_generate_button')}</Button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={t('billing_modal_payment_title')}>
        <form onSubmit={handlePaymentSubmit} className="space-y-5">
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('billing_modal_payment_balance_due')}</p>
                <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">${paymentForm.amount}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <Input label={t('billing_table_header_amount')} type="number" required value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} />
                <Select label={t('billing_modal_payment_method')} value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})}>
                    {getFilteredPaymentMethods().map(m => <option key={m.id} value={m.name_en}>{language === 'ar' ? m.name_ar : m.name_en}</option>)}
                </Select>
            </div>

            {paymentForm.method.toLowerCase() === 'insurance' ? (
                <div className="space-y-3 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
                    <Select label={t('patients_modal_form_insurance_provider')} value={paymentForm.insuranceProvider} onChange={e => setPaymentForm({...paymentForm, insuranceProvider: e.target.value})}>
                        <option value="">{t('patients_modal_form_insurance_provider_select')}</option>
                        {insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}
                    </Select>
                    <div className="grid grid-cols-2 gap-4">
                        <Input label={t('patients_modal_form_insurance_policy')} value={paymentForm.policyNumber} onChange={e => setPaymentForm({...paymentForm, policyNumber: e.target.value})} />
                        <Input label={t('patients_modal_form_insurance_expiry')} type="date" value={paymentForm.expiryDate} onChange={e => setPaymentForm({...paymentForm, expiryDate: e.target.value})} />
                    </div>
                </div>
            ) : paymentForm.method.toLowerCase() !== 'cash' && (
                <Input label={t('billing_modal_payment_ref')} required value={paymentForm.transactionId} onChange={e => setPaymentForm({...paymentForm, transactionId: e.target.value})} />
            )}

            <Textarea label={t('staff_form_reason_notes')} rows={2} value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} />

            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" icon={CheckCircle}>{t('billing_modal_payment_confirm_button')}</Button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isRefundModalOpen} onClose={() => setIsRefundModalOpen(false)} title={t('billing_modal_refund_title')}>
        <form onSubmit={handleRefundSubmit} className="space-y-5">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800 text-center">
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest">{t('billing_modal_refund_total_paid')}</p>
                <p className="text-3xl font-black text-red-700 dark:text-red-300 mt-1">${refundForm.amount}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Input label={t('billing_modal_refund_amount')} type="number" max={refundForm.amount} required value={refundForm.amount} onChange={e => setRefundForm({...refundForm, amount: e.target.value})} />
                <Select label={t('billing_modal_refund_method')} value={refundForm.method} onChange={e => setRefundForm({...refundForm, method: e.target.value})}>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                </Select>
            </div>
            <Select label={t('billing_modal_refund_reason')} value={refundForm.reason} onChange={e => setRefundForm({...refundForm, reason: e.target.value})}>
                <option value="">{t('billing_modal_refund_select_reason')}</option>
                <option value="Service Not Performed">{t('billing_modal_refund_reason_service')}</option>
                <option value="Incorrect Pricing">{t('billing_modal_refund_reason_overcharged')}</option>
                <option value="Duplicate Payment">{t('billing_modal_refund_reason_duplicate')}</option>
                <option value="Customer Satisfaction">{t('billing_modal_refund_reason_satisfaction')}</option>
                <option value="Other">{t('billing_modal_refund_reason_other')}</option>
            </Select>
            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsRefundModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" variant="danger" icon={RotateCcw}>{t('billing_modal_refund_confirm')}</Button>
            </div>
        </form>
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={t('billing_modal_expense_title')}>
        <form onSubmit={handleExpenseSubmit} className="space-y-5">
            <Select label={t('billing_modal_expense_category')} value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                <option value="General">{t('billing_modal_expense_cat_general')}</option>
                <option value="Pharmacy Inventory">{t('billing_modal_expense_cat_pharmacy')}</option>
                <option value="Lab Supplies">{t('billing_modal_expense_cat_lab')}</option>
                <option value="Medical Supplies">{t('billing_modal_expense_cat_supplies')}</option>
                <option value="Staff Salaries">{t('billing_modal_expense_cat_salaries')}</option>
                <option value="Rent">{t('billing_modal_expense_cat_rent')}</option>
                <option value="Utilities">{t('billing_modal_expense_cat_utilities')}</option>
                <option value="Maintenance">{t('billing_modal_expense_cat_maintenance')}</option>
                <option value="Equipment">{t('billing_modal_expense_cat_equipment')}</option>
            </Select>
            <div className="grid grid-cols-2 gap-4">
                <Input label={t('billing_modal_expense_amount')} type="number" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
                <Select label={t('billing_modal_expense_method')} value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value})}>
                    {getFilteredPaymentMethods().map(m => <option key={m.id} value={m.name_en}>{language === 'ar' ? m.name_ar : m.name_en}</option>)}
                </Select>
            </div>
            <Input label={t('date')} type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
            <Textarea label={t('billing_modal_expense_description')} rows={3} value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
            <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" icon={CheckCircle}>{t('billing_modal_expense_save')}</Button>
            </div>
        </form>
      </Modal>

      {/* INVOICE PREVIEW MODAL */}
      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title={t('billing_modal_preview_title')} footer={
          <div className="flex justify-between w-full">
              <Button variant="secondary" onClick={() => setIsPreviewModalOpen(false)}>{t('close')}</Button>
              <Button icon={Printer} onClick={() => window.print()}>{t('billing_modal_preview_print_button')}</Button>
          </div>
      }>
          {selectedBill && <InvoiceView bill={selectedBill} />}
      </Modal>

      {/* CANCELLATION MODAL */}
      <CancellationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        onSubmit={onConfirmCancellation}
        title={t('billing_action_cancel_process')}
        itemDescription={cancellingBill ? t('billing_action_cancel_confirm_msg') : ''}
      />

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({...confirmState, isOpen: false})} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};
