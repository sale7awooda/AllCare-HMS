

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Printer, CreditCard, 
  Wallet, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, Search, Filter,
  Landmark, ArrowUpRight, ArrowDownRight, Coins, X, Edit, TrendingUp,
  Banknote, ShieldCheck, RotateCcw, Ban, Activity, Stethoscope
} from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, PaymentMethod, TaxRate, Transaction, InsuranceProvider } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { formatMoney, formatDateSafely, getStatusColor, translateStatus } from '../utils/formatters';

export const Billing = () => {
  const { t, language } = useTranslation();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const canManageBilling = hasPermission(currentUser, Permissions.MANAGE_BILLING);

  const [activeTab, setActiveTab] = useState<'invoices' | 'treasury' | 'operations'>('invoices');
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [catalogItems, setCatalogItems] = useState<{label: string, cost: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [operations, setOperations] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

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
  const [isPayShareModalOpen, setIsPayShareModalOpen] = useState(false);
  
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

  // Operation Share Payment State
  const [selectedShare, setSelectedShare] = useState<any>(null);
  const [sharePaymentForm, setSharePaymentForm] = useState({ method: 'Cash', notes: '' });

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [b, p, pm, taxes, labs, services, trans, ins, ops_catalog, beds, ops] = await Promise.all([
        api.getBills(), 
        api.getPatients(),
        api.getPaymentMethods(),
        api.getTaxRates(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getTransactions(),
        api.getInsuranceProviders(),
        api.getOperations(), 
        api.getBeds(),
        api.getScheduledOperations()
      ]);
      
      const billsArr = Array.isArray(b) ? b : [];
      setBills(billsArr);
      setPatients(Array.isArray(p) ? p : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
      setTaxRates(Array.isArray(taxes) ? taxes : []);
      const transactionsArr = Array.isArray(trans) ? trans : [];
      setTransactions(transactionsArr);
      setInsuranceProviders(Array.isArray(ins) ? ins : []);
      setOperations(Array.isArray(ops) ? ops : []);

      const catalog = [
        ...(Array.isArray(labs) ? labs.map((l: any) => ({ label: `${t('nav_laboratory')}: ${language === 'ar' ? l.name_ar : l.name_en}`, cost: l.cost })) : []),
        ...(Array.isArray(services) ? services.map((s: any) => ({ label: `${t('billing_type_procedure')}: ${language === 'ar' ? s.name_ar : s.name_en}`, cost: s.cost })) : []),
        ...(Array.isArray(ops_catalog) ? ops_catalog.map((o: any) => ({ label: `${t('nav_operations')}: ${language === 'ar' ? o.name_ar : o.name_en}`, cost: o.base_cost })) : []),
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

  const handleAddItem = () => { setCreateForm({ ...createForm, items: [...createForm.items, { description: '', amount: '' }] }); };
  const handleRemoveItem = (index: number) => { setCreateForm({ ...createForm, items: createForm.items.filter((_, i) => i !== index) }); };
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
    let formattedItems = createForm.items.filter(i => i.description && i.amount).map(i => ({ description: i.description, amount: parseFloat(i.amount) }));
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
        await api.createBill({ patientId: parseInt(createForm.patientId), patientName: createForm.patientName, totalAmount: total, items: formattedItems });
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
    let defaultMethod = '';
    const activePMs = getFilteredPaymentMethods();
    if (activePMs.length > 0) {
        const cashMethod = activePMs.find(p => p.name_en.toLowerCase() === 'cash');
        const insuranceMethod = activePMs.find(p => p.name_en.toLowerCase() === 'insurance');
        if (patient?.hasInsurance && insuranceMethod) defaultMethod = insuranceMethod.name_en;
        else if (cashMethod) defaultMethod = cashMethod.name_en;
        else defaultMethod = activePMs[0].name_en;
    }
    setPaymentForm({ amount: remaining.toString(), method: defaultMethod, date: new Date().toISOString().split('T')[0], notes: '', transactionId: '', insuranceProvider: patient?.hasInsurance ? patient?.insuranceDetails?.provider || '' : '', policyNumber: patient?.hasInsurance ? patient?.insuranceDetails?.policyNumber || '' : '', expiryDate: patient?.hasInsurance ? patient?.insuranceDetails?.expiryDate || '' : '' });
    setIsPaymentModalOpen(true);
  };
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setIsProcessing(true);
    const payload: any = { amount: parseFloat(paymentForm.amount), method: paymentForm.method, date: paymentForm.date, details: { notes: paymentForm.notes } };
    if (paymentForm.method.toLowerCase() === 'insurance') {
        payload.details = { ...payload.details, provider: paymentForm.insuranceProvider, policyNumber: paymentForm.policyNumber, expiryDate: paymentForm.expiryDate };
    } else if (paymentForm.method.toLowerCase() !== 'cash') {
        payload.details = { ...payload.details, transactionId: paymentForm.transactionId };
    }
    try {
      await api.recordPayment(payingBill.id, payload);
      setIsPaymentModalOpen(false);
      setPayingBill(null);
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || t('billing_payment_failed')); } finally { setIsProcessing(false); }
  };
  const openRefundModal = (bill: Bill) => {
    setPayingBill(bill);
    setRefundForm({ amount: (bill.paidAmount || 0).toString(), reason: '', method: 'Cash', date: new Date().toISOString().split('T')[0] });
    setIsRefundModalOpen(true);
  };
  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingBill) return;
    setIsProcessing(true);
    try {
      await api.processRefund(payingBill.id, { amount: parseFloat(refundForm.amount), reason: refundForm.reason, date: refundForm.date, method: refundForm.method });
      setIsRefundModalOpen(false);
      setPayingBill(null);
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || t('billing_refund_failed')); } finally { setIsProcessing(false); }
  };
  const handleCancelService = (bill: Bill) => {
    setConfirmState({
      isOpen: true,
      title: t('billing_action_cancel_process'),
      message: "Are you sure you want to cancel the service associated with this invoice? This action is required before a refund can be processed.",
      action: async () => {
        setIsProcessing(true);
        try { await api.cancelService(bill.id); loadData(); } catch (e: any) { alert(e.response?.data?.error || t('billing_cancel_service_failed')); } finally { setIsProcessing(false); }
      }
    });
  };
  const handleExpenseSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProcessing(true);
      try {
          const payload = { ...expenseForm, amount: parseFloat(expenseForm.amount) };
          if (editingExpenseId) await api.updateExpense(editingExpenseId, payload);
          else await api.addExpense(payload);
          setIsExpenseModalOpen(false);
          setEditingExpenseId(null);
          loadData();
      } catch(err: any) { alert(err.response?.data?.error || (editingExpenseId ? "Failed to update expense." : t('billing_expense_failed'))); } finally { setIsProcessing(false); }
  };
  const openExpenseModal = (tx?: Transaction) => {
      const activePMs = getFilteredPaymentMethods();
      const cashMethod = activePMs.find(p => p.name_en.toLowerCase() === 'cash')?.name_en || (activePMs[0]?.name_en || 'Cash');
      if (tx) {
        setEditingExpenseId(tx.id);
        setExpenseForm({ category: tx.category || 'General', amount: tx.amount.toString(), method: tx.method || cashMethod, date: tx.date ? (tx.date.includes('T') ? tx.date.split('T')[0] : tx.date.split(' ')[0]) : new Date().toISOString().split('T')[0], description: tx.description || '' });
      } else {
        setEditingExpenseId(null);
        setExpenseForm({ category: 'General', amount: '', method: cashMethod, date: new Date().toISOString().split('T')[0], description: '' });
      }
      setIsExpenseModalOpen(true);
  };

  const operationsShares = useMemo(() => {
    const allShares: any[] = [];
    operations.forEach((op) => {
        if (op.costDetails) {
            const surgeonFee = op.costDetails.surgeonFee || 0;
            if (surgeonFee > 0) {
                allShares.push({
                    opId: op.id,
                    opName: op.operation_name,
                    date: op.created_at,
                    patientName: op.patientName,
                    role: 'Lead Surgeon',
                    staffName: op.doctorName || 'Assigned Surgeon',
                    amount: surgeonFee,
                    isPaid: op.costDetails.surgeonPaid,
                    paidDate: op.costDetails.surgeonPaidDate,
                    targetType: 'surgeon'
                });
            }
            if (Array.isArray(op.costDetails.participants)) {
                op.costDetails.participants.forEach((part: any, idx: number) => {
                    if (part.fee > 0) {
                        allShares.push({
                            opId: op.id,
                            opName: op.operation_name,
                            date: op.created_at,
                            patientName: op.patientName,
                            role: part.role,
                            staffName: part.name,
                            amount: part.fee,
                            isPaid: part.isPaid,
                            paidDate: part.paidDate,
                            targetType: 'participant',
                            targetIndex: idx
                        });
                    }
                });
            }
        }
    });
    return allShares.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [operations]);

  const openPayShareModal = (share: any) => {
      setSelectedShare(share);
      const activePMs = getFilteredPaymentMethods();
      const defaultMethod = activePMs.find(p => p.name_en.toLowerCase() === 'cash')?.name_en || (activePMs[0]?.name_en || 'Cash');
      setSharePaymentForm({ method: defaultMethod, notes: '' });
      setIsPayShareModalOpen(true);
  };

  const handlePayShareSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedShare) return;
      setIsProcessing(true);
      try {
          await api.payOperationShare(selectedShare.opId, {
              targetType: selectedShare.targetType,
              targetIndex: selectedShare.targetIndex,
              amount: selectedShare.amount,
              method: sharePaymentForm.method,
              notes: sharePaymentForm.notes
          });
          setIsPayShareModalOpen(false);
          loadData();
      } catch (err: any) {
          alert(err.response?.data?.error || "Failed to process share payment.");
      } finally {
          setIsProcessing(false);
      }
  };

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      const matchesSearch = bill.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || bill.billNumber.toLowerCase().includes(searchTerm.toLowerCase());
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
                        <Badge color={getStatusColor(bill.status) as any}>{translateStatus(bill.status, t)}</Badge>
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
                    <p className="font-bold text-lg text-slate-900">{new Date(bill.date).toLocaleDateString()}</p>
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
                    <div className="flex justify-between text-slate-600 text-sm"><span>{t('billing_invoice_subtotal')}</span><span className="font-mono">${formatMoney(subtotal)}</span></div>
                    {taxAmount > 0 && <div className="flex justify-between text-slate-600 text-sm"><span>{t('billing_invoice_tax')}</span><span className="font-mono">${taxAmount.toFixed(2)}</span></div>}
                    <div className="h-px bg-slate-200 my-2"></div>
                    <div className="flex justify-between text-slate-900 font-bold text-lg"><span>{t('billing_invoice_total')}</span><span className="font-mono">${bill.totalAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-bold text-sm"><span>{t('billing_invoice_paid')}</span><span className="font-mono">-${(bill.paidAmount || 0).toFixed(2)}</span></div>
                    {bill.totalAmount > bill.paidAmount && <div className="flex justify-between text-red-600 font-bold text-xl pt-2 border-t border-slate-200 mt-2"><span>{t('billing_invoice_balance')}</span><span className="font-mono">${(bill.totalAmount - (bill.paidAmount || 0)).toLocaleString()}</span></div>}
                </div>
            </div>
        </div>
    );
  };

  // Move useHeader hook after all state and functions are defined
  useHeader(
    t('billing_title'),
    t('billing_subtitle'),
    activeTab === 'invoices' ? (
      canManageBilling && <Button onClick={() => setIsCreateModalOpen(true)} icon={Plus}>{t('billing_create_invoice_button')}</Button>
    ) : activeTab === 'treasury' ? (
      <Button onClick={() => openExpenseModal()} icon={Plus} variant="secondary">{t('billing_record_expense_button')}</Button>
    ) : null
  );

  return (
    <div className="space-y-6">
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-fit mb-6 overflow-x-auto">
          {[
              { id: 'invoices', label: t('billing_tab_invoices'), icon: FileText },
              { id: 'treasury', label: t('billing_tab_treasury'), icon: Landmark },
              { id: 'operations', label: 'Operations Breakdown', icon: Activity },
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
                <Card className="hover:shadow-lg transition-all"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_revenue')}</h4><p className="text-3xl font-black text-emerald-600 mt-2">${stats.totalRevenue.toLocaleString()}</p></Card>
                <Card className="hover:shadow-lg transition-all border-l-4 border-l-orange-400"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_pending')}</h4><p className="text-3xl font-black text-orange-500 mt-2">${stats.pendingAmount.toLocaleString()}</p></Card>
                <Card className="hover:shadow-lg transition-all border-l-4 border-l-primary-400"><h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_stat_paid')}</h4><div className="flex items-baseline gap-2 mt-2"><p className="text-3xl font-black text-slate-800 dark:text-white">{stats.paidInvoices}</p><span className="text-sm font-bold text-slate-400">/ {stats.totalPendingInvoices} Pending</span></div></Card>
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
                        const isCancelled = bill.status === 'cancelled' || bill.serviceStatus === 'cancelled';
                        const isPaid = (bill.paidAmount || 0) > 0;
                        const isCompleted = bill.serviceStatus === 'completed';
                        
                        const canRefund = isPaid && isCancelled && !isCompleted;
                        const canCancelService = !isCancelled && !isCompleted;

                        return (
                          <tr key={bill.id} className={isCancelled ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="font-bold">{bill.billNumber}</div><div className="text-sm text-slate-500">{new Date(bill.date).toLocaleDateString()}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium">{bill.patientName}</div><div className="text-xs text-slate-500">ID: {bill.patientId}</div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex flex-col gap-1"><Badge color={getStatusColor(bill.status) as any}>{translateStatus(bill.status, t)}</Badge><Badge color="gray">{translateBillType(getBillType(bill))}</Badge></div></td>
                            <td className="px-6 py-4 whitespace-nowrap min-w-[150px]"><div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5"><div className={`h-2.5 rounded-full transition-all duration-500 ${isCancelled ? 'bg-red-400' : 'bg-primary-500'}`} style={{ width: `${paidPercent}%` }}></div></div><p className="text-right text-[10px] mt-1 text-slate-500 font-bold font-mono">${(bill.paidAmount || 0).toLocaleString()} / ${(bill.totalAmount || 0).toLocaleString()}</p></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold">${bill.totalAmount.toLocaleString()}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" icon={FileText} onClick={() => setSelectedBill(bill)}>{t('billing_action_view_invoice')}</Button>
                                    {canManageBilling && (
                                      <>
                                        {!isCancelled && (bill.status === 'pending' || bill.status === 'partial') && (
                                          <Button size="sm" onClick={() => openPaymentModal(bill)}>{t('billing_action_pay')}</Button>
                                        )}
                                        {canCancelService && (
                                          <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleCancelService(bill)} icon={Ban}>{t('cancel')}</Button>
                                        )}
                                        {canRefund && (
                                          <Button size="sm" variant="secondary" onClick={() => openRefundModal(bill)} icon={RotateCcw}>{t('billing_action_refund')}</Button>
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
                {!loading && (
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
                )}
            </Card>
        </div>
      )}

      {/* --- TREASURY TAB --- */}
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
                      <div className="flex gap-2 items-center"><select className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none text-slate-900 dark:text-white" value={treasuryFilter} onChange={(e) => setTreasuryFilter(e.target.value)}><option value="all">{t('patients_filter_type_all')}</option><option value="income">{t('billing_treasury_type_income')}</option><option value="expense">{t('billing_treasury_type_expense')}</option></select></div>
                  </div>
                  <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-white dark:bg-slate-900"><tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('date')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('appointments_form_type')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_category')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_description')}</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">{t('billing_treasury_table_method')}</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('billing_table_header_amount')}</th><th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">{t('actions')}</th></tr></thead><tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-800">{paginatedTransactions.map((tx) => (<tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"><td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-300 font-mono">{new Date(tx.date).toLocaleDateString()}</td><td className="px-6 py-3"><Badge color={tx.type === 'income' ? 'green' : 'red'}>{tx.type === 'income' ? t('billing_treasury_type_income') : t('billing_treasury_type_expense')}</Badge></td><td className="px-6 py-3 text-sm font-bold dark:text-slate-200">{tx.category || '-'}</td><td className="px-6 py-3 text-sm text-slate-500 dark:text-slate-400">{tx.description}</td><td className="px-6 py-3 text-sm dark:text-slate-300 font-bold">{tx.method}</td><td className={`px-6 py-3 text-sm font-black text-right font-mono ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}</td><td className="px-6 py-3 text-right">{tx.type === 'expense' && canManageBilling && (<Button size="sm" variant="ghost" icon={Edit} onClick={() => openExpenseModal(tx)} />)}</td></tr>))}</tbody></table></div>
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900">
                    <div className="flex gap-2">
                      <button onClick={() => setTreasuryPage(p => Math.max(1, p - 1))} disabled={treasuryPage === 1} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all border border-slate-200 dark:border-slate-700"><ChevronLeft size={16}/></button>
                      <button onClick={() => setTreasuryPage(p => Math.min(totalTreasuryPages, p + 1))} disabled={treasuryPage === totalTreasuryPages} className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all border border-slate-200 dark:border-slate-700"><ChevronRight size={16}/></button>
                    </div>
                  </div>
              </Card>
          </div>
      )}

      {/* --- OPERATIONS BREAKDOWN TAB --- */}
      {activeTab === 'operations' && (
          <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-in fade-in">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Activity size={18} className="text-primary-600"/> Surgical Team Payouts</h3>
                  <p className="text-xs text-slate-500 mt-1">Track and disperse payments for surgeons and staff for completed operations.</p>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Operation Info</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Staff Name</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Share Amount</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white dark:bg-slate-800">
                          {operationsShares.length === 0 ? (
                              <tr><td colSpan={6} className="text-center py-10 text-slate-400 font-medium">No payable operations found.</td></tr>
                          ) : (
                              operationsShares.map((share: any, index: number) => (
                                  <tr key={`${share.opId}-${index}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                      <td className="px-6 py-4">
                                          <div className="font-bold text-sm text-slate-800 dark:text-white">{share.opName}</div>
                                          <div className="text-xs text-slate-500">{new Date(share.date).toLocaleDateString()} • {share.patientName}</div>
                                      </td>
                                      <td className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">{share.role}</td>
                                      <td className="px-6 py-4 text-sm font-bold flex items-center gap-2">
                                          <Stethoscope size={14} className="text-slate-400"/>
                                          {share.staffName}
                                      </td>
                                      <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">${share.amount.toLocaleString()}</td>
                                      <td className="px-6 py-4 text-center">
                                          <Badge color={share.isPaid ? 'green' : 'yellow'}>{share.isPaid ? 'Paid' : 'Unpaid'}</Badge>
                                          {share.isPaid && <div className="text-[9px] text-slate-400 mt-1">{new Date(share.paidDate).toLocaleDateString()}</div>}
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          {!share.isPaid && canManageBilling && (
                                              <Button size="sm" onClick={() => openPayShareModal(share)}>Pay Share</Button>
                                          )}
                                      </td>
                                  </tr>
                              ))
                          )}
                      </tbody>
                  </table>
              </div>
          </Card>
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
                  className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientResults(true); }}
                  onFocus={() => setShowPatientResults(true)}
                />
                {showPatientResults && filteredPatientsForInvoice.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                    {filteredPatientsForInvoice.map(p => (
                      <button key={p.id} type="button" className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 border-b last:border-0 border-slate-100 dark:border-slate-700 flex justify-between items-center" onClick={() => { setCreateForm({ ...createForm, patientId: p.id.toString(), patientName: p.fullName }); setShowPatientResults(false); }}>
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
                    <select className="w-full sm:w-1/3 text-xs p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" onChange={(e) => handleCatalogSelect(index, e.target.value)} defaultValue=""><option value="" disabled>{t('billing_modal_create_quick_add')}</option>{catalogItems.map((c, i) => <option key={i} value={c.label}>{c.label}</option>)}</select>
                    <Input placeholder={t('billing_modal_create_item_placeholder')} value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="flex-1" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Input placeholder="0.00" type="number" value={item.amount} onChange={e => handleItemChange(index, 'amount', e.target.value)} className="w-24" />
                        <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={handleAddItem} className="mt-2 w-full" icon={Plus}>{t('billing_modal_create_add_item_button')}</Button>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t dark:border-slate-700 pt-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('billing_modal_create_tax_rate')}</label>
              <select className="w-full rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white" value={createForm.selectedTaxId} onChange={e => setCreateForm({...createForm, selectedTaxId: e.target.value})}>
                <option value="">{t('billing_modal_create_none')}</option>
                {taxRates.filter(t => t.isActive).map(t => (<option key={t.id} value={t.id}>{language === 'ar' ? t.name_ar : t.name_en} ({t.rate}%)</option>))}
              </select>
            </div>
            <div className="text-right flex flex-col justify-center">
              <span className="block text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{t('billing_modal_create_total_label')}</span>
              <span className="text-3xl font-bold text-primary-600">${(() => { const subtotal = createForm.items.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0); const taxRate = taxRates.find(t => t.id === parseInt(createForm.selectedTaxId)); const tax = taxRate ? (subtotal * taxRate.rate) / 100 : 0; return (subtotal + tax).toFixed(2); })()}</span>
            </div>
          </div>
          <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3"><Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)}>{t('cancel')}</Button><Button type="submit" disabled={isProcessing || !createForm.patientId}>{isProcessing ? t('processing') : t('billing_modal_create_generate_button')}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title={t('billing_modal_payment_title')}>
        {payingBill && (
          <form onSubmit={handlePaymentSubmit} className="space-y-6">
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-inner">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('billing_modal_payment_balance_due')}</p>
                <p className="text-5xl font-black text-slate-900 dark:text-white font-mono tracking-tighter">${(payingBill.totalAmount - (payingBill.paidAmount || 0)).toLocaleString()}</p>
            </div>
            <Select label={t('billing_modal_payment_method')} value={paymentForm.method} onChange={e => setPaymentForm({...paymentForm, method: e.target.value})} required className="text-slate-900 dark:text-white">
                {getFilteredPaymentMethods().map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}
            </Select>
            <div className="space-y-4">
                {paymentForm.method.toLowerCase() === 'cash' && (<><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required /><Textarea label={t('patients_modal_action_notes')} rows={2} value={paymentForm.notes} onChange={e => setPaymentForm({...paymentForm, notes: e.target.value})} /></>)}
                {paymentForm.method.toLowerCase() === 'insurance' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30 animate-in slide-in-from-top-2"><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required className="md:col-span-2" /><div className="md:col-span-2"><Select label={t('patients_modal_form_insurance_provider')} value={paymentForm.insuranceProvider} onChange={e => setPaymentForm({...paymentForm, insuranceProvider: e.target.value})} required className="text-slate-900 dark:text-white"><option value="">{t('patients_modal_form_insurance_provider_select')}</option>{insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>)}</Select></div><Input label={t('patients_modal_form_insurance_policy')} value={paymentForm.policyNumber} onChange={e => setPaymentForm({...paymentForm, policyNumber: e.target.value})} required /><Input label={t('patients_modal_form_insurance_expiry')} type="date" value={paymentForm.expiryDate} onChange={e => setPaymentForm({...paymentForm, expiryDate: e.target.value})} required /></div>)}
                {paymentForm.method.toLowerCase() !== 'cash' && paymentForm.method.toLowerCase() !== 'insurance' && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 animate-in slide-in-from-top-2"><Input label={t('billing_table_header_amount')} type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} required className="md:col-span-2" /><Input label={t('billing_modal_payment_ref')} value={paymentForm.transactionId} onChange={e => setPaymentForm({...paymentForm, transactionId: e.target.value})} required /><Input label={t('date')} type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} required /></div>)}
            </div>
            <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3"><Button type="button" variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>{t('cancel')}</Button><Button type="submit" icon={isProcessing ? undefined : CheckCircle} disabled={isProcessing}>{isProcessing ? t('processing') : t('billing_modal_payment_confirm_button')}</Button></div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isRefundModalOpen} onClose={() => setIsRefundModalOpen(false)} title={t('billing_modal_refund_title')}>
        {payingBill && (
          <form onSubmit={handleRefundSubmit} className="space-y-6">
            <div className="text-center p-6 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800">
               <p className="text-xs font-black text-rose-400 uppercase tracking-widest mb-1">{t('billing_modal_refund_total_paid')}</p>
               <p className="text-4xl font-black text-rose-600 font-mono tracking-tighter">${(payingBill.paidAmount || 0).toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input label={t('billing_modal_refund_amount')} type="number" value={refundForm.amount} onChange={e => setRefundForm({...refundForm, amount: e.target.value})} required max={payingBill.paidAmount} />
               <Select label={t('billing_modal_refund_method')} value={refundForm.method} onChange={e => setRefundForm({...refundForm, method: e.target.value})} required>
                  {getFilteredPaymentMethods().map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}
               </Select>
            </div>
            <Select label={t('billing_modal_refund_reason')} value={refundForm.reason} onChange={e => setRefundForm({...refundForm, reason: e.target.value})} required>
               <option value="">Select Reason...</option>
               <option value="Service Not Performed">{t('billing_modal_refund_reason_service')}</option>
               <option value="Incorrect Pricing">{t('billing_modal_refund_reason_overcharged')}</option>
               <option value="Double Payment">{t('billing_modal_refund_reason_duplicate')}</option>
               <option value="Customer Request">{t('billing_modal_refund_reason_satisfaction')}</option>
               <option value="Other">{t('billing_modal_refund_reason_other')}</option>
            </Select>
            <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
               <Button type="button" variant="secondary" onClick={() => setIsRefundModalOpen(false)}>{t('cancel')}</Button>
               <Button type="submit" variant="danger" icon={RotateCcw} disabled={isProcessing}>{isProcessing ? t('processing') : t('billing_modal_refund_confirm')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={editingExpenseId ? "Update Expense Entry" : t('billing_modal_expense_title')}>
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <Select label={t('billing_modal_expense_category')} value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} required className="text-slate-900 dark:text-white">
            <option value="General">{t('billing_modal_expense_cat_general')}</option>
            <option value="Pharmacy Refill">Pharmacy Inventory Refill</option>
            <option value="Laboratory Supplies">Lab Reagents & Consumables</option>
            <option value="Medical Supplies">{t('billing_modal_expense_cat_supplies')}</option>
            <option value="Staff Salaries">Staff Monthly Salaries</option>
            <option value="Facility Rent">Facility / Real Estate Rent</option>
            <option value="Utilities">{t('billing_modal_expense_cat_utilities')}</option>
            <option value="Facility Maintenance">{t('billing_modal_expense_cat_maintenance')}</option>
            <option value="Medical Equipment">{t('billing_modal_expense_cat_equipment')}</option>
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('billing_modal_expense_amount')} type="number" required value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
            <Input label={t('date')} type="date" required value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
          </div>
          <Select label={t('billing_modal_expense_method')} value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value})} required className="text-slate-900 dark:text-white">
            {getFilteredPaymentMethods().length === 0 ? <option value="">No methods configured</option> : getFilteredPaymentMethods().map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}
          </Select>
          <Textarea label={t('billing_modal_expense_description')} rows={3} required value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" disabled={isProcessing}>{isProcessing ? t('processing') : (editingExpenseId ? t('save') : t('billing_modal_expense_save'))}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPayShareModalOpen} onClose={() => setIsPayShareModalOpen(false)} title="Process Share Payout">
        {selectedShare && (
            <form onSubmit={handlePayShareSubmit} className="space-y-6">
                <div className="p-5 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800 text-center">
                    <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-1">Paying {selectedShare.role}</p>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{selectedShare.staffName}</h3>
                    <p className="text-4xl font-black text-emerald-600 font-mono tracking-tighter">${selectedShare.amount.toLocaleString()}</p>
                </div>
                
                <Select label={t('billing_modal_payment_method')} value={sharePaymentForm.method} onChange={e => setSharePaymentForm({...sharePaymentForm, method: e.target.value})}>
                    {getFilteredPaymentMethods().map(p => (<option key={p.id} value={p.name_en}>{language === 'ar' ? p.name_ar : p.name_en}</option>))}
                </Select>
                
                <Textarea label="Payout Notes" rows={2} value={sharePaymentForm.notes} onChange={e => setSharePaymentForm({...sharePaymentForm, notes: e.target.value})} placeholder="Check number, transaction reference..." />
                
                <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
                    <Button type="button" variant="secondary" onClick={() => setIsPayShareModalOpen(false)}>{t('cancel')}</Button>
                    <Button type="submit" disabled={isProcessing} icon={CheckCircle}>{isProcessing ? t('processing') : 'Confirm Payout'}</Button>
                </div>
            </form>
        )}
      </Modal>

      <Modal isOpen={!!selectedBill} onClose={() => setSelectedBill(null)} title={t('billing_modal_preview_title')}>
        {selectedBill && (<div><InvoiceView bill={selectedBill} /><div className="mt-6 flex justify-end gap-3 no-print"><Button variant="secondary" onClick={() => setSelectedBill(null)}>{t('close')}</Button><Button icon={Printer} onClick={() => window.print()}>{t('billing_modal_preview_print_button')}</Button></div></div>)}
      </Modal>
      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};
