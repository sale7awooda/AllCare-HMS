import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Printer, Lock, CreditCard, 
  Wallet, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, Search, Filter, Calendar,
  Landmark, ArrowUpRight, ArrowDownRight, RefreshCcw, Coins, PieChart as PieChartIcon, X
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { api } from '../services/api';
import { Bill, Patient, Appointment, PaymentMethod, TaxRate, Transaction, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

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
  const [isProcessing, setIsProcessing] = useState(false);
  const { user: currentUser } = useAuth();

  // Pagination & Filtering State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Search Patient in Create Modal
  const [patientSearch, setPatientSearch] = useState('');
  const [showPatientResults, setShowPatientResults] = useState(false);

  // Separate Treasury Filters
  const [treasurySearch, setTreasurySearch] = useState('');
  const [treasuryFilter, setTreasuryFilter] = useState('all');
  const [treasuryDate, setTreasuryDate] = useState({ start: '', end: '' });
  const [treasuryPage, setTreasuryPage] = useState(1);

  // Stats
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    paidInvoices: 0,
    revenueByType: [] as {name: string, value: number}[]
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
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  
  // Confirmation Dialog
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [payingBill, setPayingBill] = useState<Bill | null>(null);
  const [refundingBill, setRefundingBill] = useState<Bill | null>(null);

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
    method: 'Cash',
    reason: 'Service Cancelled',
    date: new Date().toISOString().split('T')[0],
    customReason: ''
  });

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState({
    category: 'General',
    amount: '',
    method: 'Cash',
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
        default: return status;
    }
  };

  const loadData = async () => {
    setLoading(true);
    const safeFetch = async (promise: Promise<any>, fallback: any) => {
        try { return await promise; } catch (e) { return fallback; }
    };

    try {
      const [b, p, pm, taxes, labs, services, trans, ins] = await Promise.all([
        safeFetch(api.getBills(), []), 
        safeFetch(api.getPatients(), []),
        safeFetch(api.getPaymentMethods(), []),
        safeFetch(api.getTaxRates(), []),
        safeFetch(api.getLabTests(), []),
        safeFetch(api.getNurseServices(), []),
        safeFetch(api.getTransactions(), []),
        safeFetch(api.getInsuranceProviders(), [])
      ]);
      
      const billList: Bill[] = Array.isArray(b) ? b : [];
      const transactionList: Transaction[] = Array.isArray(trans) ? trans : [];

      setBills(billList);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setTaxRates(Array.isArray(taxes) ? taxes : []);
      setTransactions(transactionList);
      setInsuranceProviders(Array.isArray(ins) ? ins : []);

      const catalog = [
        ...(Array.isArray(labs) ? labs.map((l: any) => ({ label: `${t('nav_laboratory')}: ${language === 'ar' ? l.name_ar : l.name_en}`, cost: l.cost })) : []),
        ...(Array.isArray(services) ? services.map((s: any) => ({ label: `${t('billing_type_procedure')}: ${language === 'ar' ? s.name_ar : s.name_en}`, cost: s.cost })) : [])
      ];
      setCatalogItems(catalog);

      const total = billList.reduce((acc, curr) => acc + (curr.paidAmount || 0), 0);
      const pending = billList.reduce((acc, curr) => acc + ((curr.totalAmount || 0) - (curr.paidAmount || 0)), 0);
      const paidCount = billList.filter(x => x.status === 'paid').length;

      const revenueByTypeMap: Record<string, number> = {};
      billList.forEach(bill => {
        const type = getBillType(bill);
        revenueByTypeMap[type] = (revenueByTypeMap[type] || 0) + (bill.paidAmount || 0);
      });
      const revenueByType = Object.entries(revenueByTypeMap).map(([name, value]) => ({name, value})).sort((a,b) => b.value - a.value);

      setStats({ totalRevenue: total, pendingAmount: pending, paidInvoices: paidCount, revenueByType });

      const income = transactionList.filter(tx => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
      const expense = transactionList.filter(tx => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
      setTreasuryStats({ income, expenses: expense, net: income - expense });

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [language]);

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
      setIsProcessing(true);
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
          date: new Date().toISOString().split('T')[0], 
          items: formattedItems 
        });
        setIsCreateModalOpen(false);
        setCreateForm({ patientId: '', patientName: '', items: [{ description: '', amount: '' }], selectedTaxId: '' });
        setPatientSearch('');
        loadData();
      } catch(e) { console.error(e); } finally { setIsProcessing(false); }
    }
  };

  const openPaymentModal = (bill: Bill) => {
    setPayingBill(bill);
    const patient = patients.find(p => p.id === bill.patientId);
    const remaining = bill.totalAmount - (bill.paidAmount || 0);
    let defaultMethod = 'Cash';
    if (paymentMethods.length > 0) {
        const found = patient?.hasInsurance ? paymentMethods.find(p => p.name_en === 'Insurance') : paymentMethods.find(p => p.name_en === 'Cash');
        defaultMethod = found ? found.name_en : paymentMethods[0].name_en;
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
    setIsProcessing(true);
    const payload: any = { amount: parseFloat(paymentForm.amount), method: paymentForm.method, date: paymentForm.date, details: { notes: paymentForm.notes } };
    if (paymentForm.method === 'Insurance') {
        payload.details = { ...payload.details, provider: paymentForm.insuranceProvider, policyNumber: paymentForm.policyNumber, expiryDate: paymentForm.expiryDate };
    } else if (paymentForm.method !== 'Cash') {
        payload.details = { ...payload.details, transactionId: paymentForm.transactionId };
    }

    try {
      await api.recordPayment(payingBill.id, payload);
      setIsPaymentModalOpen(false);
      setPayingBill(null);
      loadData();
    } catch (e) { alert(t('billing_payment_failed')); } finally { setIsProcessing(false); }
  };

  const openRefundModal = (bill: Bill) => {
    setRefundingBill(bill);
    setRefundForm({ amount: bill.paidAmount.toString(), method: 'Cash', reason: 'Service Cancelled', date: new Date().toISOString().split('T')[0], customReason: '' });
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingBill) return;
    setIsProcessing(true);
    try {
        const finalReason = refundForm.reason === 'Other' ? refundForm.customReason : refundForm.reason;
        await api.processRefund(refundingBill.id, { amount: parseFloat(refundForm.amount), method: refundForm.method, reason: finalReason, date: refundForm.date });
        setIsRefundModalOpen(false);
        setRefundingBill(null);
        loadData();
    } catch (e) { alert(t('billing_refund_failed')); } finally { setIsProcessing(false); }
  };

  const handleCancelService = (bill: Bill) => {
    setConfirmState({
      isOpen: true,
      title: t('appointments_cancel_dialog_title'),
      message: t('appointments_cancel_dialog_message'),
      action: async () => {
        setIsProcessing(true);
        try { await api.cancelService(bill.id); loadData(); } catch (e) { alert(t('billing_cancel_service_failed')); } finally { setIsProcessing(false); }
      }
    });
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          await api.addExpense({ ...expenseForm, amount: parseFloat(expenseForm.amount) });
          setIsExpenseModalOpen(false);
          setExpenseForm({ category: 'General', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], description: '' });
          loadData();
      } catch(e) { alert(t('billing_expense_failed')); } finally { setIsProcessing(false); }
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

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || getBillType(bill) === filterType;
      let matchesDate = true;
      if (dateRange.start) matchesDate = matchesDate && new Date(bill.date) >= new Date(dateRange.start);
      if (dateRange.end) { const endDate = new Date(dateRange.end); endDate.setHours(23, 59, 59, 999); matchesDate = matchesDate && new Date(bill.date) <= endDate; }
      return matchesSearch && matchesType && matchesDate;
    });
  }, [bills, searchTerm, filterType, dateRange]);

  const totalPages = Math.ceil(filteredBills.length / itemsPerPage);
  const paginatedBills = filteredBills.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
        const matchesSearch = (t.description && t.description.toLowerCase().includes(treasurySearch.toLowerCase())) || (t.category && t.category.toLowerCase().includes(treasurySearch.toLowerCase()));
        const matchesType = treasuryFilter === 'all' || t.type === treasuryFilter;
        let matchesDate = true;
        if (treasuryDate.start) matchesDate = matchesDate && new Date(t.date) >= new Date(treasuryDate.start);
        if (treasuryDate.end) { const endDate = new Date(treasuryDate.end); endDate.setHours(23, 59, 59, 999); matchesDate = matchesDate && new Date(t.date) <= endDate; }
        return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, treasurySearch, treasuryFilter, treasuryDate]);

  const treasuryChartData = useMemo(() => {
    const dailyMap = new Map<string, {name: string, income: number, expense: number}>();
    const sortedTrans = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedTrans.forEach(tx => {
        const day = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dailyMap.has(day)) dailyMap.set(day, { name: day, income: 0, expense: 0 });
        const entry = dailyMap.get(day)!;
        if (tx.type === 'income') entry.income += tx.amount; else entry.expense += tx.amount;
    });
    return Array.from(dailyMap.values());
  }, [filteredTransactions]);

  const methodStats = useMemo(() => {
    const stats: Record<string, { income: number; expense: number; balance: number, name_en: string, name_ar: string }> = {};
    paymentMethods.forEach(pm => { stats[pm.name_en] = { income: 0, expense: 0, balance: 0, name_en: pm.name_en, name_ar: pm.name_ar }; });
    if (!stats['Cash']) stats['Cash'] = { income: 0, expense: 0, balance: 0, name_en: 'Cash', name_ar: 'نقدي' };
    filteredTransactions.forEach(tx => {
        const methodKey = tx.method || 'Unknown';
        if (!stats[methodKey]) stats[methodKey] = { income: 0, expense: 0, balance: 0, name_en: methodKey, name_ar: methodKey };
        if (tx.type === 'income') { stats[methodKey].income += tx.amount; stats[methodKey].balance += tx.amount; }
        else { stats[methodKey].expense += tx.amount; stats[methodKey].balance -= tx.amount; }
    });
    return Object.values(stats).sort((a, b) => b.balance - a.balance);
  }, [filteredTransactions, paymentMethods]);

  const getMethodIcon = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('cash')) return Coins;
      if (n.includes('bank') || n.includes('transfer')) return Landmark;
      if (n.includes('card') || n.includes('visa') || n.includes('master')) return CreditCard;
      return Wallet;
  };

  const totalTreasuryPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((treasuryPage - 1) * itemsPerPage, treasuryPage * itemsPerPage);

  // Search logic for Create Modal
  const filteredPatientsForInvoice = useMemo(() => {
    if (!patientSearch) return [];
    return patients.filter(p => 
      p.fullName.toLowerCase().includes(patientSearch.toLowerCase()) || 
      p.patientId.toLowerCase().includes(patientSearch.toLowerCase())
    ).slice(0, 5);
  }, [patients, patientSearch]);

  const InvoiceView = ({ bill }: { bill: Bill }) => {
    const taxItem = bill.items.find(i => i.description.toLowerCase().includes('tax'));
    const subtotal = bill.items.filter(i => !i.description.toLowerCase().includes('tax')).reduce((sum, i) => sum + i.amount, 0);
    const taxAmount = taxItem ? taxItem.amount : 0;
    const hospitalName = localStorage.getItem('h_name') || 'AllCare Hospital';
    const [hospitalInfo, setHospitalInfo] = useState<any>({});
    useEffect(() => { api.getPublicSettings().then(setHospitalInfo); }, []);

    return (
        <div className="p-10 bg-white min-h-[600px] text-slate-800 font-sans" id="invoice-print">
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-8 mb-8">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary-600 text-white p-2.5 rounded-xl shadow-lg">
                            <Wallet size={28}/>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">{t('billing_invoice_title')}</h1>
                            <p className="text-slate-500 font-mono text-sm">#{bill.billNumber}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Badge color={bill.status === 'paid' ? 'green' : 'red'}>{translateStatus(bill.status)}</Badge>
                        <Badge color="gray">{translateBillType(getBillType(bill))}</Badge>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-bold text-primary-600">{hospitalName}</h2>
                    <div className="text-sm text-slate-500 mt-2 space-y-1">
                        <p>{hospitalInfo.hospitalAddress || 'Atbara'}</p>
                        <p>{hospitalInfo.hospitalPhone || '-'}</p>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{t('billing_invoice_billed_to')}</p>
                    <p className="font-bold text-lg text-slate-900">{bill.patientName}</p>
                    <p className="text-slate-500 text-sm mt-1">{t('patients_table_header_patient')} ID: <span className="font-mono">#{bill.patientId}</span></p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">{t('billing_invoice_date')}</p>
                    <p className="font-bold text-lg text-slate-900">{bill.date && bill.date !== '1/1/1970' ? new Date(bill.date).toLocaleDateString() : 'N/A'}</p>
                </div>
            </div>
            <table className="w-full mb-8">
                <thead>
                    <tr className="border-b border-slate-200">
                        <th className="text-left py-4 px-2 font-bold text-xs text-slate-500 uppercase">{t('billing_invoice_description')}</th>
                        <th className="text-right py-4 px-2 font-bold text-xs text-slate-500 uppercase">{t('billing_table_header_amount')}</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {bill.items.map((item, i) => (
                        <tr key={i}>
                            <td className="py-4 px-2 text-sm font-medium">{item.description}</td>
                            <td className="py-4 px-2 text-right font-bold font-mono">${item.amount.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-end">
                <div className="w-full max-sm:max-w-none max-w-sm space-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="flex justify-between text-slate-600 text-sm"><span>{t('billing_invoice_subtotal')}</span><span className="font-mono">${subtotal.toFixed(2)}</span></div>
                    {taxAmount > 0 && <div className="flex justify-between text-slate-600 text-sm"><span>{t('billing_invoice_tax')}</span><span className="font-mono">${taxAmount.toFixed(2)}</span></div>}
                    <div className="h-px bg-slate-200 my-2"></div>
                    <div className="flex justify-between text-slate-900 font-bold text-lg"><span>{t('billing_invoice_total')}</span><span className="font-mono">${bill.totalAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-bold text-sm"><span>{t('billing_invoice_paid')}</span><span className="font-mono">-${(bill.paidAmount || 0).toFixed(2)}</span></div>
                    {bill.totalAmount > bill.paidAmount && <div className="flex justify-between text-red-600 font-bold text-xl pt-2 border-t border-slate-200 mt-2"><span>{t('billing_invoice_balance')}</span><span className="font-mono">${(bill.totalAmount - (bill.paidAmount || 0)).toFixed(2)}</span></div>}
                </div>
            </div>
        </div>
    );
  };

  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);
  const isAccountant = currentUser?.role === 'accountant' || currentUser?.role === 'admin';

  const getActionForPaidBill = (bill: Bill) => {
      if (bill.serviceStatus !== 'cancelled') {
          return <Button size="sm" variant="danger" onClick={() => handleCancelService(bill)} disabled={isProcessing}>{t('billing_action_cancel_process')}</Button>;
      } else {
          return <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white border-none" disabled={!isAccountant} icon={RefreshCcw} onClick={() => isAccountant && openRefundModal(bill)}>{t('billing_action_refund')}</Button>;
      }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('billing_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('billing_subtitle')}</p>
        </div>
      </div>

      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit mb-6 overflow-x-auto">
          {[
              { id: 'invoices', label: t('billing_tab_invoices'), icon: FileText },
              { id: 'treasury', label: t('billing_tab_treasury'), icon: Landmark },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                  <tab.icon size={18} /> {tab.label}
              </button>
          ))}
      </div>

      {activeTab === 'invoices' && (
        <div className="animate-in fade-in space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_revenue')}</h4><p className="text-3xl font-bold text-emerald-600 mt-2">${stats.totalRevenue.toLocaleString()}</p></Card>
                <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_pending')}</h4><p className="text-3xl font-bold text-orange-500 mt-2">${stats.pendingAmount.toLocaleString()}</p></Card>
                <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_stat_paid')}</h4><p className="text-3xl font-bold text-slate-800 dark:text-white mt-2">{stats.paidInvoices}</p></Card>
            </div>
            
            <Card title={t('billing_chart_revenue_by_type')}>
              <div className="h-80 w-full flex flex-col md:flex-row items-center gap-6">
                <div className="w-full md:w-1/2 h-full">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie 
                        data={stats.revenueByType} 
                        cx="50%" 
                        cy="50%" 
                        innerRadius={80} 
                        outerRadius={110} 
                        paddingAngle={5} 
                        dataKey="value" 
                        nameKey="name"
                      >
                        {stats.revenueByType.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(value) => `$${Number(value).toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full md:w-1/2 space-y-3">
                  <h4 className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">{t('billing_chart_legend')}</h4>
                  {stats.revenueByType.map((entry, index) => (
                    <div key={`legend-${index}`} className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-md" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} /><span className="text-slate-600 font-medium">{translateBillType(entry.name)}</span></div>
                      <span className="font-bold text-slate-800 font-mono">${entry.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder={t('billing_search_placeholder')} className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}/></div>
                    <div className="relative w-full sm:w-auto"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" /><select className="pl-9 pr-8 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm appearance-none cursor-pointer text-slate-900 dark:text-white" value={filterType} onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}><option value="all">{t('patients_filter_type_all')}</option><option value="Appointment">{t('nav_appointments')}</option><option value="Lab Test">{t('nav_laboratory')}</option><option value="Admission">{t('nav_admissions')}</option><option value="Operation">{t('nav_operations')}</option><option value="Procedure">{t('billing_type_procedure')}</option><option value="General">{t('billing_type_general')}</option></select></div>
                  </div>
                  {canManageBilling && (<Button onClick={() => setIsCreateModalOpen(true)} icon={Plus}>{t('billing_create_invoice_button')}</Button>)}
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_info')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('patients_table_header_patient')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_status')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_paid_progress')}</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {loading ? <tr><td colSpan={6} className="text-center py-10 text-slate-400">{t('billing_table_loading')}</td></tr> : 
                       paginatedBills.length === 0 ? <tr><td colSpan={6} className="text-center py-10 text-slate-400">{t('billing_table_empty')}</td></tr> : 
                       paginatedBills.map(bill => {
                        const paidPercent = bill.totalAmount > 0 ? (bill.paidAmount / bill.totalAmount) * 100 : 0;
                        const formattedDate = bill.date && bill.date !== '1/1/1970' ? new Date(bill.date).toLocaleDateString() : 'N/A';
                        return (
                          <tr key={bill.id}>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="font-bold">{bill.billNumber}</div><div className="text-sm text-slate-500">{formattedDate}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium">{bill.patientName}</div><div className="text-xs text-slate-500">ID: {bill.patientId}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-col gap-1"><Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : 'red'}>{translateStatus(bill.status)}</Badge><Badge color={getTypeColor(getBillType(bill)) as any}>{translateBillType(getBillType(bill))}</Badge></div></td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[150px]"><div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5"><div className="bg-primary-500 h-2.5 rounded-full" style={{ width: `${paidPercent}%` }}></div></div><p className="text-right text-[10px] mt-1 text-slate-500">${(bill.paidAmount || 0).toLocaleString()} / ${(bill.totalAmount || 0).toLocaleString()}</p></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold">${bill.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" icon={FileText} onClick={() => setSelectedBill(bill)}>{t('billing_action_view_invoice')}</Button>
                                    {canManageBilling && (<>{(bill.status === 'pending' || bill.status === 'partial') && <Button size="sm" onClick={() => openPaymentModal(bill)}>{t('billing_action_pay')}</Button>}{bill.status === 'paid' && getActionForPaidBill(bill)}</>)}
                                </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!loading && <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700"><span className="text-sm text-slate-500">{t('patients_pagination_showing')} {paginatedBills.length} {t('patients_pagination_of')} {filteredBills.length}</span><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} icon={ChevronLeft}>{t('billing_pagination_prev')}</Button><Button size="sm" variant="secondary" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} icon={ChevronRight}>{t('billing_pagination_next')}</Button></div></div>}
            </Card>
        </div>
      )}

      {activeTab === 'treasury' && (
          <div className="space-y-6 animate-in fade-in">
              <div className="flex justify-end"><Button onClick={() => setIsExpenseModalOpen(true)} icon={Plus} variant="secondary">{t('billing_record_expense_button')}</Button></div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_income')}</h4><p className="text-3xl font-bold text-green-600 mt-2 flex items-center gap-2"><ArrowUpRight size={24}/> ${treasuryStats.income.toLocaleString()}</p></Card>
                  <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_expenses')}</h4><p className="text-3xl font-bold text-red-500 mt-2 flex items-center gap-2"><ArrowDownRight size={24}/> ${treasuryStats.expenses.toLocaleString()}</p></Card>
                  <Card><h4 className="text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_net')}</h4><p className={`text-3xl font-bold mt-2 ${treasuryStats.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>${treasuryStats.net.toLocaleString()}</p></Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-96 w-full bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"><h3 className="font-bold text-slate-800 dark:text-white mb-4">{t('billing_treasury_chart_flow')}</h3><ResponsiveContainer width="100%" height="100%"><BarChart data={treasuryChartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} /><RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} /><Legend /><Bar dataKey="income" name={t('billing_treasury_type_income')} fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} /><Bar dataKey="expense" name={t('billing_treasury_type_expense')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} /></BarChart></ResponsiveContainer></div>
                  <div className="h-96 w-full bg-white dark:bg-slate-800 rounded-xl p-0 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden"><div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50"><h3 className="font-bold text-slate-800 dark:text-white">{t('billing_treasury_holdings')}</h3><p className="text-xs text-slate-500">{t('billing_treasury_holdings_subtitle')}</p></div><div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">{methodStats.map((item, idx) => { const Icon = getMethodIcon(item.name_en); return (<div key={idx} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-900"><div className={`p-3 rounded-full ${item.balance >= 0 ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}><Icon size={20} /></div><div className="flex-1 min-w-0"><div className="flex justify-between items-center mb-1"><h4 className="font-bold text-slate-700 dark:text-slate-200 truncate">{language === 'ar' ? item.name_ar : item.name_en}</h4><span className={`font-mono font-bold ${item.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-500'}`}>${item.balance.toLocaleString()}</span></div><div className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded"><ArrowUpRight size={10}/> ${item.income.toLocaleString()}</span><span className="flex items-center gap-1 text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded"><ArrowDownRight size={10}/> ${item.expense.toLocaleString()}</span></div></div></div>);})}</div></div>
              </div>

              <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row gap-4 items-center">
                      <div className="flex items-center gap-2 flex-1"><Landmark size={18} className="text-slate-500"/> <h3 className="font-bold text-slate-800 dark:text-white">{t('billing_treasury_transactions')}</h3></div>
                      <div className="flex gap-2 items-center"><div className="flex items-center gap-1 text-xs text-slate-500"><span>{t('billing_treasury_from')}</span><input type="date" className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={treasuryDate.start} onChange={(e) => setTreasuryDate({...treasuryDate, start: e.target.value})}/></div><div className="flex items-center gap-1 text-xs text-slate-500"><span>{t('billing_treasury_to')}</span><input type="date" className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none" value={treasuryDate.end} onChange={(e) => setTreasuryDate({...treasuryDate, end: e.target.value})}/></div><select className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white" value={treasuryFilter} onChange={(e) => setTreasuryFilter(e.target.value)}><option value="all">{t('patients_filter_type_all')}</option><option value="income">{t('billing_treasury_type_income')}</option><option value="expense">{t('billing_treasury_type_expense')}</option></select></div>
                  </div>
                  <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-white dark:bg-slate-900"><tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('date')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('appointments_form_type')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_category')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_description')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_method')}</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-800">{paginatedTransactions.map((tx) => (<tr key={tx.id}><td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(tx.date).toLocaleDateString()}</td><td className="px-6 py-3"><Badge color={tx.type === 'income' ? 'green' : 'red'}>{tx.type === 'income' ? t('billing_treasury_type_income') : t('billing_treasury_type_expense')}</Badge></td><td className="px-6 py-3 text-sm font-medium dark:text-slate-200">{tx.category || '-'}</td><td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{tx.description}</td><td className="px-6 py-3 text-sm dark:text-slate-300">{tx.method}</td><td className={`px-6 py-3 text-sm font-bold text-right ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}</td></tr>))}</tbody></table></div>
                  <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900"><span className="text-sm text-slate-500">{t('patients_pagination_showing')} {treasuryPage} {t('patients_pagination_of')} {totalTreasuryPages || 1}</span><div className="flex gap-2"><button onClick={() => setTreasuryPage(p => Math.max(1, p - 1))} disabled={treasuryPage === 1} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"><ChevronLeft size={16}/></button><button onClick={() => setTreasuryPage(p => Math.min(totalTreasuryPages, p + 1))} disabled={treasuryPage === totalTreasuryPages} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"><ChevronRight size={16}/></button></div></div>
              </Card>
          </div>
      )}

      {/* --- MODALS --- */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title={t('billing_modal_create_title')}>
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          
          <div className="space-y-1 relative">
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('billing_modal_create_select_patient')}</label>
            {createForm.patientId ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                 <div className="flex flex-col">
                   <span className="font-bold text-primary-900 dark:text-primary-200">{createForm.patientName}</span>
                   <span className="text-xs text-primary-600 dark:text-primary-400">ID: {patients.find(p => p.id.toString() === createForm.patientId)?.patientId}</span>
                 </div>
                 <button type="button" onClick={() => { setCreateForm({...createForm, patientId: '', patientName: ''}); setPatientSearch(''); }} className="p-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full transition-colors">
                   <X size={16} className="text-primary-600" />
                 </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text"
                  placeholder={t('patients_search_placeholder')}
                  className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientResults(true); }}
                  onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && filteredPatientsForInvoice.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                    {filteredPatientsForInvoice.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center transition-colors"
                        onClick={() => {
                          setCreateForm({ ...createForm, patientId: p.id.toString(), patientName: p.fullName });
                          setShowPatientResults(false);
                        }}
                      >
                        <span className="font-medium text-slate-900 dark:text-white">{p.fullName}</span>
                        <span className="text-xs text-slate-500 font-mono">ID: {p.patientId}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('billing_modal_create_items_label')}</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {createForm.items.map((item, index) => (
                <div key={index} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                    <select 
                      className="w-full sm:w-1/3 text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500" 
                      onChange={(e) => handleCatalogSelect(index, e.target.value)} 
                      defaultValue=""
                    >
                        <option value="" disabled>{t('billing_modal_create_quick_add')}</option>
                        {catalogItems.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}
                    </select>
                    <Input placeholder={t('billing_modal_create_item_placeholder')} value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="flex-1" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input placeholder="0.00" type="number" value={item.amount} onChange={e => handleItemChange(index, 'amount', e.target.value)} className="w-24" />
                        <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddItem} className="mt-2 w-full" icon={Plus}>{t('billing_modal_create_add_item_button')}</Button>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t dark:border-slate-700 pt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('billing_modal_create_tax_rate')}</label>
              <select className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none" value={createForm.selectedTaxId} onChange={e => setCreateForm({...createForm, selectedTaxId: e.target.value})}>
                <option value="">{t('billing_modal_create_none')}</option>
                {taxRates.filter(t => t.isActive).map(t => (<option key={t.id} value={t.id}>{language === 'ar' ? t.name_ar : t.name_en} ({t.rate}%)</option>))}
              </select>
            </div>
            <div className="text-right flex flex-col justify-center">
              <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('billing_modal_create_total_label')}</span>
              <span className="text-3xl font-bold text-primary-600">${(() => { const subtotal = createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0); const taxRate = taxRates.find(t => t.id === parseInt(createForm.selectedTaxId)); const tax = taxRate ? (subtotal * taxRate.rate) / 100 : 0; return (subtotal + tax).toFixed(2); })()}</span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t('cancel')}</Button>
             <Button type="submit" disabled={isProcessing || !createForm.patientId}>{isProcessing ? t('processing') : t('billing_modal_create_generate_button')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={t('billing_modal_payment_title')}>
        {payingBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('billing_modal_payment_balance_due')}</p>
                <p className="text-5xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">${(payingBill.totalAmount - (payingBill.paidAmount || 0)).toLocaleString()}</p>
            </div>
            <Select label={t('billing_modal_payment_method')} value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} required className="text-slate-900 dark:text-white">{paymentMethods.filter(p => p.isActive).map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}{!paymentMethods.some(p => p.name_en === 'Cash') && <option value="Cash">{t('billing_method_cash')}</option>}</Select>
            <div className="space-y-4">
                {paymentForm.method === 'Cash' && (<><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required /><Textarea label={t('patients_modal_action_notes')} rows={2} value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} /></>)}
                {paymentForm.method === 'Insurance' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-in slide-in-from-top-2"><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required className="md:col-span-2" /><div className="md:col-span-2"><Select label={t('patients_modal_form_insurance_provider')} value={paymentForm.insuranceProvider} onChange={e => setPaymentForm({...paymentForm, insuranceProvider: e.target.value})} required className="text-slate-900 dark:text-white"><option value="">{t('patients_modal_form_insurance_provider_select')}</option>{insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}</Select></div><Input label={t('patients_modal_form_insurance_policy')} value={paymentForm.policyNumber} onChange={e => setPaymentForm({...paymentForm, policyNumber: e.target.value})} required /><Input label={t('patients_modal_form_insurance_expiry')} type="date" value={paymentForm.expiryDate} onChange={e => setPaymentForm({...paymentForm, expiryDate: e.target.value})} required /></div>)}
                {paymentForm.method !== 'Cash' && paymentForm.method !== 'Insurance' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2"><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required className="md:col-span-2" /><Input label={t('billing_modal_payment_ref')} value={paymentForm.transactionId} onChange={e => setPaymentForm({...paymentForm, transactionId: e.target.value})} required /><Input label={t('date')} type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required /></div>)}
            </div>
            <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3"><Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>{t('cancel')}</Button><Button type="submit" icon={isProcessing ? undefined : CheckCircle} disabled={isProcessing}>{isProcessing ? t('processing') : t('billing_modal_payment_confirm_button')}</Button></div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={t('billing_modal_expense_title')}>
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <Select 
            label={t('billing_modal_expense_category')} 
            value={expenseForm.category} 
            onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
            required
            className="text-slate-900 dark:text-white"
          >
            <option value="General">{t('billing_modal_expense_cat_general')}</option>
            <option value="Pharmacy Refill">Pharmacy Inventory Refill</option>
            <option value="Laboratory Supplies">Lab Reagents & Consumables</option>
            <option value="Medical Supplies">{t('billing_modal_expense_cat_supplies')}</option>
            <option value="Staff Salaries">Staff Monthly Salaries</option>
            <option value="Facility Rent">Facility / Real Estate Rent</option>
            <option value="Utilities">{t('billing_modal_expense_cat_utilities')} (Power, Water, Gas)</option>
            <option value="Facility Maintenance">{t('billing_modal_expense_cat_maintenance')}</option>
            <option value="Medical Equipment">{t('billing_modal_expense_cat_equipment')}</option>
            <option value="Insurance Payouts">Insurance Claims Settlement</option>
            <option value="Taxes & Gov">Government Taxes / Licensing</option>
            <option value="Marketing">Marketing & Advertising</option>
            <option value="Cleaning Services">Cleaning & Waste Management</option>
          </Select>
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label={t('billing_modal_expense_amount')} 
              type="number" 
              required 
              value={expenseForm.amount} 
              onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} 
            />
            <Input 
              label={t('date')} 
              type="date" 
              required 
              value={expenseForm.date} 
              onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} 
            />
          </div>

          <Select 
            label={t('billing_modal_expense_method')} 
            value={expenseForm.method} 
            onChange={e => setExpenseForm({...expenseForm, method: e.target.value})}
            required
            className="text-slate-900 dark:text-white"
          >
            {paymentMethods.filter(p => p.isActive).map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}
            <option value="Cash">{t('billing_method_cash')}</option>
          </Select>

          <Textarea 
            label={t('billing_modal_expense_description')} 
            rows={3} 
            required
            value={expenseForm.description} 
            onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} 
          />

          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={isProcessing}>{isProcessing ? t('processing') : t('billing_modal_expense_save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} title={t('billing_modal_preview_title')}>{selectedBill && (<div><InvoiceView bill={selectedBill} /><div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={() => setSelectedBill(null)}>{t('close')}</Button><Button icon={Printer} onClick={() => window.print()}>{t('billing_modal_preview_print_button')}</Button></div></div>)}</Modal>
      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};