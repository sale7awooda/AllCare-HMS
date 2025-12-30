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
  const [cancellationModal, setCancellationModal] = useState<{isOpen: boolean, billId: number | null}>({ isOpen: false, billId: null });
  
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

  // Defined before HeaderTabs to fix reference error
  const openExpenseModal = (expense?: Transaction) => {
    if (expense) {
      setEditingExpenseId(expense.id);
      setExpenseForm({
        category: expense.category,
        amount: expense.amount.toString(),
        method: expense.method,
        date: expense.date.split('T')[0],
        description: expense.description || ''
      });
    } else {
      setEditingExpenseId(null);
      setExpenseForm({
        category: 'General',
        amount: '',
        method: 'Cash',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
    }
    setIsExpenseModalOpen(true);
  };

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

      // Calculate Stats
      const totalRev = billsArr.filter(b => b.status === 'paid' || b.status === 'partial').reduce((acc, b) => acc + b.paidAmount, 0);
      const pendingAmt = billsArr.filter(b => b.status === 'pending' || b.status === 'partial').reduce((acc, b) => acc + (b.totalAmount - b.paidAmount), 0);
      
      setStats({
        totalRevenue: totalRev,
        pendingAmount: pendingAmt,
        paidInvoices: billsArr.filter(b => b.status === 'paid').length,
        totalPendingInvoices: billsArr.filter(b => b.status === 'pending' || b.status === 'partial').length,
        revenueByType: [] // Can be populated if needed
      });

      const income = transactionsArr.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const expenses = transactionsArr.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      setTreasuryStats({
        income,
        expenses,
        net: income - expenses,
        incomeByMethod: []
      });

    } catch (error) {
      console.error("Failed to load billing data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // --- Handlers ---

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try {
        if (editingExpenseId) {
            await api.updateExpense(editingExpenseId, expenseForm);
        } else {
            await api.addExpense(expenseForm);
        }
        setProcessStatus('success');
        await loadData();
        setTimeout(() => {
            setIsExpenseModalOpen(false);
            setProcessStatus('idle');
        }, 1000);
    } catch (e: any) {
        setProcessStatus('error');
        setProcessMessage(e.response?.data?.error || t('error'));
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Treasury Tab Content */}
      {activeTab === 'treasury' && (
        <div className="animate-in fade-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <Card className="bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800">
                    <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{t('reports_stat_net_profit')}</p>
                    <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-2">${treasuryStats.net.toLocaleString()}</p>
                </Card>
                <Card>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('reports_chart_income_method')}</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white mt-2">${treasuryStats.income.toLocaleString()}</p>
                </Card>
                <Card>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('billing_treasury_expenses')}</p>
                    <p className="text-3xl font-black text-rose-600 mt-2">${treasuryStats.expenses.toLocaleString()}</p>
                </Card>
            </div>
            
            <Card className="!p-0 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('records_table_type')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_treasury_table_category')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_treasury_table_description')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_amount')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {transactions.map(tx => (
                            <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{new Date(tx.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4"><Badge color={tx.type === 'income' ? 'green' : 'red'}>{tx.type}</Badge></td>
                                <td className="px-6 py-4 text-sm font-bold">{tx.category}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">{tx.description}</td>
                                <td className={`px-6 py-4 text-right font-mono font-bold ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                                </td>
                            </tr>
                        ))}
                        {transactions.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-400">{t('no_data')}</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
      )}

      {/* Invoices Tab Content */}
      {activeTab === 'invoices' && (
        <div className="animate-in fade-in">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('reports_stat_gross_revenue')}</p>
                    <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">${stats.totalRevenue.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('reports_stat_outstanding')}</p>
                    <p className="text-2xl font-black text-orange-500 mt-1">${stats.pendingAmount.toLocaleString()}</p>
                </div>
            </div>

            <Card className="!p-0 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_invoice')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_patient')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('date')}</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('status')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('billing_table_header_amount')}</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {bills.map(bill => (
                            <tr key={bill.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="px-6 py-4 font-mono text-sm font-bold text-slate-600 dark:text-slate-300">#{bill.billNumber}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{bill.patientName}</td>
                                <td className="px-6 py-4 text-sm text-slate-500">{new Date(bill.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4"><Badge color={bill.status === 'paid' ? 'green' : bill.status === 'partial' ? 'yellow' : 'red'}>{translateStatus(bill.status)}</Badge></td>
                                <td className="px-6 py-4 text-right">
                                    <div className="font-mono font-bold text-slate-900 dark:text-white">${bill.totalAmount.toLocaleString()}</div>
                                    {bill.paidAmount > 0 && bill.paidAmount < bill.totalAmount && (
                                        <div className="text-xs text-emerald-600">Paid: ${bill.paidAmount.toLocaleString()}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {/* Action buttons could go here */}
                                </td>
                            </tr>
                        ))}
                        {bills.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">{t('no_data')}</td></tr>}
                    </tbody>
                </table>
            </Card>
        </div>
      )}

      {/* Expense Modal */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title={editingExpenseId ? t('edit') : t('billing_record_expense_button')}>
        <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <Select label={t('billing_treasury_table_category')} value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}>
                    <option value="General">General</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Salaries">Salaries</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Refund">Refund</option>
                </Select>
                <Input type="date" label={t('date')} value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Input type="number" label={t('billing_table_header_amount')} value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} prefix="$" />
                <Select label={t('staff_form_payment_method')} value={expenseForm.method} onChange={e => setExpenseForm({...expenseForm, method: e.target.value})}>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.name_en}>{language === 'ar' ? pm.name_ar : pm.name_en}</option>)}
                </Select>
            </div>
            <Textarea label={t('billing_treasury_table_description')} value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} />
            
            <div className="flex justify-end pt-4 gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsExpenseModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit" disabled={processStatus === 'processing'}>{t('save')}</Button>
            </div>
        </form>
      </Modal>
    </div>
  );
};