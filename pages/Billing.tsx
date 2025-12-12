
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Printer, Download, X, Lock, CreditCard, 
  Wallet, TrendingUp, AlertCircle, FileText, CheckCircle, Trash2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Filter, Calendar,
  Landmark, ArrowUpRight, ArrowDownRight, RefreshCcw
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';
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

  // Separate Treasury Filters
  const [treasurySearch, setTreasurySearch] = useState('');
  const [treasuryFilter, setTreasuryFilter] = useState('all');
  const [treasuryDate, setTreasuryDate] = useState({ start: '', end: '' });
  const [treasuryPage, setTreasuryPage] = useState(1);

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
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null); // For Invoice View
  const [payingBill, setPayingBill] = useState<Bill | null>(null); // For Payment Action
  const [refundingBill, setRefundingBill] = useState<Bill | null>(null); // For Refund Action

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

  // Refund Form State
  const [refundForm, setRefundForm] = useState({
    amount: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
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
    // Find patient to check for insurance
    const patient = patients.find(p => p.id === bill.patientId);
    const hasInsurance = patient?.hasInsurance;

    // Default to remaining balance
    const remaining = bill.totalAmount - (bill.paidAmount || 0);
    
    // Auto-fill insurance details if available
    setPaymentForm({ 
        amount: remaining.toString(), 
        method: hasInsurance ? 'Insurance' : 'Cash',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        transactionId: '',
        insuranceProvider: patient?.insuranceDetails?.provider || '',
        policyNumber: patient?.insuranceDetails?.policyNumber || '',
        expiryDate: patient?.insuranceDetails?.expiryDate || ''
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

  const openRefundModal = (bill: Bill) => {
    setRefundingBill(bill);
    // Default to fully paid amount
    setRefundForm({
        amount: bill.paidAmount.toString(),
        reason: '',
        date: new Date().toISOString().split('T')[0]
    });
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundingBill) return;

    try {
        await api.processRefund(refundingBill.id, {
            amount: parseFloat(refundForm.amount),
            reason: refundForm.reason,
            date: refundForm.date
        });
        setIsRefundModalOpen(false);
        setRefundingBill(null);
        loadData();
    } catch (e) {
        alert('Refund failed');
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

  // --- Filtering & Pagination Logic (Bills) ---
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

  // --- Filtering & Pagination Logic (Treasury) ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
        const matchesSearch = 
            (t.description && t.description.toLowerCase().includes(treasurySearch.toLowerCase())) ||
            (t.category && t.category.toLowerCase().includes(treasurySearch.toLowerCase()));
        
        const matchesType = treasuryFilter === 'all' || t.type === treasuryFilter;

        let matchesDate = true;
        if (treasuryDate.start) {
            matchesDate = matchesDate && new Date(t.date) >= new Date(treasuryDate.start);
        }
        if (treasuryDate.end) {
            const endDate = new Date(treasuryDate.end);
            endDate.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && new Date(t.date) <= endDate;
        }

        return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, treasurySearch, treasuryFilter, treasuryDate]);

  // Aggregate daily data for chart
  const treasuryChartData = useMemo(() => {
    const dailyMap = new Map<string, {name: string, income: number, expense: number}>();
    
    // Sort transactions by date asc for chart
    const sortedTrans = [...filteredTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTrans.forEach(t => {
        const day = new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dailyMap.has(day)) {
            dailyMap.set(day, { name: day, income: 0, expense: 0 });
        }
        const entry = dailyMap.get(day)!;
        if (t.type === 'income') entry.income += t.amount;
        else entry.expense += t.amount;
    });

    return Array.from(dailyMap.values());
  }, [filteredTransactions]);

  const totalTreasuryPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((treasuryPage - 1) * itemsPerPage, treasuryPage * itemsPerPage);


  // --- Render Helpers ---

  const InvoiceView = ({ bill }: { bill: Bill }) => {
    // Try to find Tax Item
    const taxItem = bill.items.find(i => i.description.toLowerCase().startsWith('tax'));
    const subtotal = bill.items.filter(i => !i.description.toLowerCase().startsWith('tax')).reduce((sum, i) => sum + i.amount, 0);
    const taxAmount = taxItem ? taxItem.amount : 0;
    const hospitalName = localStorage.getItem('hospital_name') || 'AllCare Hospital';

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
            <h2 className="text-xl font-bold text-primary-600">{hospitalName}</h2>
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
            <div className="flex