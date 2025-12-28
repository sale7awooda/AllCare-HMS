
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Briefcase, Clock, 
  Calendar, DollarSign, Wallet,
  Loader2, Edit, Trash2, MapPin,
  LogIn, LogOut, CheckCircle, XCircle, User, Info, CreditCard, ChevronRight, Eye, RefreshCw, Save,
  ChevronLeft, CalendarDays, Hash, Landmark, FileText, Filter, Ban
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, Attendance, LeaveRequest, PayrollRecord, FinancialAdjustment, PaymentMethod } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

const DAYS_OF_WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_OF_WEEK_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];

const formatNumber = (val: string | number) => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('en-US').format(num);
};

const parseNumber = (val: string) => {
  return val.replace(/,/g, '');
};

const FormattedInput = ({ label, value, onChange, prefix, ...props }: any) => {
  const [displayValue, setDisplayValue] = useState(formatNumber(value));

  useEffect(() => {
    setDisplayValue(formatNumber(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseNumber(e.target.value);
    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
      setDisplayValue(e.target.value); 
      onChange(raw);
    }
  };

  const handleBlur = () => {
    setDisplayValue(formatNumber(value));
  };

  return (
    <Input
      {...props}
      label={label}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      prefix={prefix}
    />
  );
};

export const Staff = () => {
  const { t, language } = useTranslation();
  const isRtl = language === 'ar';
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'leaves' | 'payroll' | 'financials'>('directory');
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  
  const DAYS_OF_WEEK = language === 'ar' ? DAYS_OF_WEEK_AR : DAYS_OF_WEEK_EN;
  const canManageHR = hasPermission(currentUser, Permissions.MANAGE_HR);

  // Tab specific data
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [financials, setFinancials] = useState<FinancialAdjustment[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false); 
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false); 
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); 
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); 
  
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} });

  const [staffForm, setStaffForm] = useState<any>({});
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'bonus' as FinancialAdjustment['type'], amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'sick' as LeaveRequest['type'], startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], reason: '' });
  const [attendanceModal, setAttendanceModal] = useState<any>(null);
  
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null);
  const [isPayrollDetailModalOpen, setIsPayrollDetailModalOpen] = useState(false);
  const [isPayNowModalOpen, setIsPayNowModalOpen] = useState(false);
  const [payNowForm, setPayNowForm] = useState({ method: 'Cash', reference: '', notes: '' });

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [data, pms, depts, specs] = await Promise.all([
        api.getStaff(), 
        api.getPaymentMethods(),
        api.getDepartments(),
        api.getSpecializations()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setPaymentMethods(Array.isArray(pms) ? pms : []);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSpecializations(Array.isArray(specs) ? specs : []);
    } catch (e) { console.error(e); } finally { if (!isBackground) setLoading(false); }
  };

  const loadFinancials = async () => {
    try {
      const data = await api.getFinancials('all');
      setFinancials(data);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const fetchTabData = async () => {
        if (activeTab === 'attendance') {
            const data = await api.getAttendance(selectedDate);
            setAttendance(data);
        }
        else if (activeTab === 'leaves') setLeaves(await api.getLeaves());
        else if (activeTab === 'payroll') setPayroll(await api.getPayroll(selectedMonth));
        else if (activeTab === 'financials') loadFinancials();
    };
    if(activeTab !== 'directory') fetchTabData();
  }, [activeTab, selectedDate, selectedMonth]);

  // --- Filtered Data Hooks ---
  const sortedStaff = useMemo(() => {
    return staff
      .filter(s => s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                  s.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  s.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => (a.status === 'active' ? -1 : 1));
  }, [staff, searchTerm]);

  const filteredAttendanceStaff = useMemo(() => {
    return staff.filter(s => 
      s.status === 'active' && 
      s.fullName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staff, searchTerm]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => 
      l.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [leaves, searchTerm]);

  const filteredPayroll = useMemo(() => {
    return payroll.filter(p => 
      p.staffName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [payroll, searchTerm]);

  const filteredFinancials = useMemo(() => {
    return financials.filter(f => 
      f.staffName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [financials, searchTerm]);

  // --- Auto-fill logic for Adjustments ---
  useEffect(() => {
    if (!isAdjustmentModalOpen) return;
    let reason = "";
    switch(adjForm.type) {
      case 'bonus': reason = t('staff_adj_bonus_note'); break;
      case 'fine': reason = t('staff_adj_fine_note'); break;
      case 'loan': reason = t('staff_adj_loan_note'); break;
      case 'extra': reason = t('staff_adj_extra_note') || "Operation Fee"; break;
    }
    setAdjForm(prev => ({ ...prev, reason }));
  }, [adjForm.type, isAdjustmentModalOpen, t]);

  // --- Auto-fill logic for Leaves ---
  useEffect(() => {
    if (!isLeaveModalOpen) return;
    let reason = "";
    switch(leaveForm.type) {
      case 'sick': reason = t('staff_leave_sick_note'); break;
      case 'vacation': reason = t('staff_leave_vacation_note'); break;
      case 'casual': reason = t('staff_leave_casual_note'); break;
      case 'unpaid': reason = t('staff_leave_unpaid_note'); break;
    }
    setLeaveForm(prev => ({ ...prev, reason }));
  }, [leaveForm.type, isLeaveModalOpen, t]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(t('staff_process_saving'));
    const payload = { 
      ...staffForm, 
      baseSalary: parseFloat(parseNumber(staffForm.baseSalary)) || 0,
      consultationFee: parseFloat(parseNumber(staffForm.consultationFee)) || 0,
      consultationFeeFollowup: parseFloat(parseNumber(staffForm.consultationFeeFollowup)) || 0,
      consultationFeeEmergency: parseFloat(parseNumber(staffForm.consultationFeeEmergency)) || 0,
    };
    try {
      if (staffForm.id) await api.updateStaff(staffForm.id, payload);
      else await api.addStaff(payload);
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsModalOpen(false); setProcessStatus('idle'); }, 500);
    } catch (err: any) { 
      setProcessStatus('error'); 
      setProcessMessage(err.response?.data?.error || t('staff_save_fail')); 
    }
  };

  const openStaffModal = (s?: MedicalStaff) => {
      setStaffForm(s ? { 
        ...s, 
        baseSalary: s.baseSalary?.toString() || '',
        consultationFee: s.consultationFee?.toString() || '',
        consultationFeeFollowup: s.consultationFeeFollowup?.toString() || '',
        consultationFeeEmergency: s.consultationFeeEmergency?.toString() || '',
        address: s.address || '', 
        department: s.department || '',
        specialization: s.specialization || '',
        /* Fix: Corrected property naming available_time_start -> availableTimeStart */
        availableTimeStart: s.availableTimeStart || '09:00',
        /* Fix: Corrected property naming available_time_end -> availableTimeEnd */
        availableTimeEnd: s.availableTimeEnd || '17:00'
      } : { 
        fullName: '', 
        type: 'doctor', 
        status: 'active', 
        baseSalary: '', 
        availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 
        availableTimeStart: '09:00', 
        availableTimeEnd: '17:00', 
        consultationFee: '', 
        consultationFeeFollowup: '',
        consultationFeeEmergency: '',
        joinDate: new Date().toISOString().split('T')[0], 
        address: '', 
        department: '',
        specialization: '',
      });
      setIsModalOpen(true);
  };

  const toggleDay = (day: string) => {
      const currentDays = staffForm.availableDays || [];
      const dayEN = DAYS_OF_WEEK_EN[DAYS_OF_WEEK.indexOf(day)];
      setStaffForm({ ...staffForm, availableDays: currentDays.includes(dayEN) ? currentDays.filter((d: string) => d !== dayEN) : [...currentDays, dayEN] });
  };
  
  const getPrefix = (type: string) => {
    switch(type) {
        case 'doctor': return 'Dr. ';
        case 'nurse': return 'Nurse ';
        case 'technician': return 'Tech. ';
        case 'radiologist': return 'Rad. ';
        case 'pharmacist': return 'Pharma. ';
        default: return '';
    }
  };

  const formatPrefixedName = (person: any) => {
      const name = person.fullName || '';
      const prefix = getPrefix(person.type);
      if (name.startsWith(prefix)) return name;
      return prefix + name;
  };

  const handleCheckIn = (staffMember: MedicalStaff) => {
    setConfirmState({
        isOpen: true, title: t('staff_attendance_confirm'), message: t('staff_attendance_checkin_confirm', {name: staffMember.fullName, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}),
        action: async () => {
            setProcessStatus('processing');
            setProcessMessage(t('staff_process_attendance'));
            try {
                const now = new Date();
                const timeString = now.toTimeString().slice(0, 5);
                await api.markAttendance({ staffId: staffMember.id, date: selectedDate, status: staffMember.availableTimeStart && timeString > staffMember.availableTimeStart ? 'late' : 'present', checkIn: timeString });
                const updated = await api.getAttendance(selectedDate);
                setAttendance(updated);
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { 
              setProcessStatus('error'); 
              setProcessMessage(e.response?.data?.error || e.message || t('staff_attendance_mark_fail')); 
            }
        }
    });
  };

  const handleCheckOut = (record: Attendance) => {
    setConfirmState({
        isOpen: true, title: t('staff_attendance_confirm'), message: t('staff_attendance_checkout_confirm', {name: record.staffName}),
        action: async () => {
            setProcessStatus('processing');
            setProcessMessage(t('staff_process_attendance'));
            try {
                await api.markAttendance({ staffId: record.staffId, date: record.date, status: record.status, checkOut: new Date().toTimeString().slice(0, 5) });
                const updated = await api.getAttendance(selectedDate);
                setAttendance(updated);
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { 
              setProcessStatus('error'); 
              setProcessMessage(e.response?.data?.error || e.message || t('error'));
            }
        }
    });
  };

  const openAttendanceModal = (staffId: number, staffName: string, status: any) => {
      const existing = attendance.find(a => a.staffId === staffId);
      setAttendanceModal({ isOpen: true, staffId, staffName, status: existing?.status || status, checkIn: existing?.checkIn || '', checkOut: existing?.checkOut || '' });
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setProcessStatus('processing');
      setProcessMessage(t('staff_process_attendance'));
      try {
          await api.markAttendance({ staffId: attendanceModal.staffId, date: selectedDate, status: attendanceModal.status, checkIn: attendanceModal.checkIn || null, checkOut: attendanceModal.checkOut || null });
          const updated = await api.getAttendance(selectedDate);
          setAttendance(updated);
          setProcessStatus('success'); setTimeout(() => { setProcessStatus('idle'); setAttendanceModal(null); }, 500);
      } catch (err: any) { 
        setProcessStatus('error'); 
        setProcessMessage(err.response?.data?.error || err.message || t('error'));
      }
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!leaveForm.staffId) {
          setProcessStatus('error');
          setProcessMessage(t('staff_form_select_employee'));
          return;
      }
      setProcessStatus('processing');
      setProcessMessage(t('staff_process_leave'));
      try {
        await api.requestLeave(leaveForm);
        setLeaves(await api.getLeaves());
        setProcessStatus('success'); setTimeout(() => { setIsLeaveModalOpen(false); setProcessStatus('idle'); }, 1000);
      } catch (e: any) { 
        setProcessStatus('error'); 
        setProcessMessage(e.response?.data?.error || e.message || t('error'));
      }
  };

  const updateLeaveStatus = (id: number, status: string) => {
      setConfirmState({
        isOpen: true, title: status === 'approved' ? t('staff_action_approve') : t('staff_action_reject'), message: t('confirm'),
        action: async () => {
            setProcessStatus('processing');
            setProcessMessage(t('processing'));
            try {
                await api.updateLeaveStatus(id, status);
                setLeaves(await api.getLeaves());
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { 
              setProcessStatus('error'); 
              setProcessMessage(e.response?.data?.error || e.message || t('error'));
            }
        }
      });
  };

  const handleGeneratePayroll = () => {
      setConfirmState({
          isOpen: true, title: t('staff_tab_payroll'), message: t('staff_generate_payroll_confirm', {month: selectedMonth}),
          action: async () => {
              setProcessStatus('processing');
              setProcessMessage(t('staff_process_payroll_gen'));
              try {
                  await api.generatePayroll({ month: selectedMonth });
                  setPayroll(await api.getPayroll(selectedMonth));
                  setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
              } catch(e: any) { 
                setProcessStatus('error'); 
                setProcessMessage(e.response?.data?.error || e.message || t('error'));
              }
          }
      });
  };

  const openPayNowModal = (record: PayrollRecord) => {
      setSelectedPayroll(record);
      setPayNowForm({ 
        method: 'Cash', 
        reference: '', 
        notes: `${t('staff_payroll_notes')}: ${record.month}` 
      });
      setIsPayNowModalOpen(true);
  };

  const handlePayNowSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPayroll) return;
      
      setProcessStatus('processing');
      setProcessMessage(t('staff_process_payroll_pay'));
      try {
          await api.updatePayrollStatus(selectedPayroll.id, { 
              status: 'paid', 
              paymentMethod: payNowForm.method, 
              transactionRef: payNowForm.reference, 
              notes: payNowForm.notes 
          });
          setPayroll(await api.getPayroll(selectedMonth));
          setProcessStatus('success'); 
          setIsPayNowModalOpen(false);
          setTimeout(() => setProcessStatus('idle'), 1000);
      } catch(e: any) { 
        setProcessStatus('error'); 
        setProcessMessage(e.response?.data?.error || e.message || t('error'));
      }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!adjForm.staffId || !adjForm.amount) {
        setProcessStatus('error');
        setProcessMessage(t('staff_form_select_employee'));
        return;
      }
      setProcessStatus('processing');
      setProcessMessage(t('staff_process_adj'));
      try {
        await api.addAdjustment({ ...adjForm, amount: parseFloat(parseNumber(adjForm.amount)), status: adjForm.type === 'bonus' ? 'approved' : 'pending' });
        loadFinancials();
        setProcessStatus('success'); setTimeout(() => { setIsAdjustmentModalOpen(false); setProcessStatus('idle'); }, 1000);
      } catch (e: any) { 
        setProcessStatus('error'); 
        setProcessMessage(e.response?.data?.error || e.message || t('error'));
      }
  };

  const handleApproveAdjustment = async (id: number) => {
      setProcessStatus('processing');
      try {
          /* Fix: Corrected api call name to updateFinancialStatus which was added to api service */
          await api.updateFinancialStatus(id, 'approved');
          loadFinancials();
          setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
      } catch(e) { setProcessStatus('error'); }
  };

  const handleDeclineAdjustment = async (id: number) => {
      setConfirmState({
          isOpen: true, title: t('cancel'), message: t('confirm'),
          action: async () => {
              setProcessStatus('processing');
              try {
                  /* Fix: Corrected api call name to updateFinancialStatus which was added to api service */
                  await api.updateFinancialStatus(id, 'declined');
                  loadFinancials();
                  setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
              } catch(e) { setProcessStatus('error'); }
          }
      });
  };

  const openPayrollDetails = (p: PayrollRecord) => {
      setSelectedPayroll(p);
      setIsPayrollDetailModalOpen(true);
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const shiftMonth = (direction: 'prev' | 'next') => {
      const [year, month] = selectedMonth.split('-').map(Number);
      const d = new Date(year, month - 1);
      if (direction === 'prev') d.setMonth(d.getMonth() - 1);
      else d.setMonth(d.getMonth() + 1);
      setSelectedMonth(d.toISOString().slice(0, 7));
  };

  const SearchableEmployeeSelect = ({ label, value, onChange, placeholder }: any) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const selected = useMemo(() => staff.find(s => s.id.toString() === value), [staff, value]);
    const results = useMemo(() => {
        const query = search.toLowerCase();
        if (!query) return staff.slice(0, 10);
        return staff.filter(s => 
          s.fullName.toLowerCase().includes(query) || 
          s.department?.toLowerCase().includes(query) ||
          s.employeeId?.toLowerCase().includes(query)
        ).slice(0, 10);
    }, [staff, search]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative space-y-1.5" ref={containerRef}>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">{label}</label>
            {selected && !open ? (
                <div className="flex items-center justify-between p-3.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-800 flex items-center justify-center text-primary-600 font-bold text-sm">
                            {selected.fullName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-primary-900 dark:text-primary-100">{selected.fullName}</span>
                            <span className="text-[10px] text-primary-600 dark:text-primary-400 uppercase font-black tracking-widest">{t(`staff_role_${selected.type}`)} • {selected.department}</span>
                        </div>
                    </div>
                    <button type="button" onClick={() => setOpen(true)} className="p-2 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-xl transition-colors">
                        <RefreshCw size={16} className="text-primary-600"/>
                    </button>
                </div>
            ) : (
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder={placeholder || t('staff_search_placeholder')}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all shadow-sm"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onFocus={() => setOpen(true)}
                        autoComplete="off"
                    />
                    {open && (
                        <div className="absolute z-[110] w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto custom-scrollbar">
                            {results.length > 0 ? (
                                results.map(s => (
                                    <button 
                                      key={s.id} 
                                      type="button" 
                                      className="w-full px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b last:border-0 border-slate-100 dark:border-slate-700 flex items-center justify-between group transition-colors" 
                                      onClick={() => { onChange(s.id.toString()); setOpen(false); setSearch(''); }}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">{s.fullName}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-black mt-0.5">{t(`staff_role_${s.type}`)} • {s.department}</span>
                                        </div>
                                        <ChevronRight size={16} className={`text-slate-300 group-hover:text-primary-400 ${language === 'ar' ? 'rotate-180' : ''}`} />
                                    </button>
                                ))
                            ) : (
                                <div className="p-6 text-center text-xs text-slate-400 italic">{t('no_data')}</div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  };

  const HeaderTabs = useMemo(() => (
    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar">
        {[
            { id: 'directory', label: t('staff_tab_directory'), icon: Briefcase },
            { id: 'attendance', label: t('staff_tab_attendance'), icon: Clock },
            { id: 'leaves', label: t('staff_tab_leaves'), icon: Calendar },
            { id: 'payroll', label: t('staff_tab_payroll'), icon: DollarSign },
            { id: 'financials', label: t('staff_tab_financials'), icon: Wallet },
        ].map(tab => (
            <button 
                key={tab.id} 
                onClick={() => { setActiveTab(tab.id as any); setSearchTerm(''); }} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
                <tab.icon size={14}/> 
                <span className="hidden sm:inline">{tab.label}</span>
            </button>
        ))}
    </div>
  ), [activeTab, t]);

  useHeader(t('staff_title'), t('staff_subtitle'), HeaderTabs);

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-in fade-in slide-in-from-top-2">
         <div className="w-full md:w-auto flex-1 flex flex-col sm:flex-row gap-4">
            <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder={t('staff_search_placeholder')} 
                    className="pl-9 pr-4 py-2.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            {activeTab === 'attendance' && (
                <div className="flex items-center gap-2">
                    <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 border border-slate-200 dark:border-slate-700" onClick={() => shiftDate(-1)}><ChevronLeft size={16}/></button>
                    <div className="relative group">
                        <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)} 
                            className="pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 border border-slate-200 dark:border-slate-700" onClick={() => shiftDate(1)}><ChevronRight size={16}/></button>
                </div>
            )}
            {activeTab === 'payroll' && (
                <div className="flex items-center gap-2">
                    <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 border border-slate-200 dark:border-slate-700" onClick={() => shiftMonth('prev')}><ChevronLeft size={16}/></button>
                    <div className="relative">
                        <input 
                            type="month" 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)} 
                            className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                        />
                    </div>
                    <button className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500 border border-slate-200 dark:border-slate-700" onClick={() => shiftMonth('next')}><ChevronRight size={16}/></button>
                </div>
            )}
         </div>

         <div className="flex gap-3 w-full md:w-auto justify-end">
            {activeTab === 'directory' && canManageHR && (
                <Button onClick={() => openStaffModal()} icon={Plus} className="shadow-md">
                    {t('staff_add_employee_button')}
                </Button>
            )}
            {activeTab === 'payroll' && canManageHR && (
                <Button icon={DollarSign} onClick={handleGeneratePayroll} className="shadow-md">
                    {t('staff_generate_payroll')}
                </Button>
            )}
            {activeTab === 'leaves' && (
                 <Button icon={Plus} onClick={() => setIsLeaveModalOpen(true)} className="shadow-md">{t('staff_leave_request')}</Button>
            )}
            {activeTab === 'financials' && canManageHR && (
                 <Button icon={Plus} onClick={() => setIsAdjustmentModalOpen(true)} className="shadow-md">{t('staff_financial_add_entry')}</Button>
            )}
         </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 gap-4 animate-in fade-in duration-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="text-slate-500 font-medium">{t('loading')}</p>
        </div>
      ) : (
        <>
          {activeTab === 'directory' && (
              <div className="animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{sortedStaff.map(person => {
                    const statusColors: any = { active: 'green', inactive: 'gray', onleave: 'yellow', dismissed: 'red' };
                    return (
                      <div key={person.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
                        <div className="flex-1 min-w-0 mb-4">
                          <h3 className="font-bold text-lg text-slate-800 dark:text-white line-clamp-2 leading-tight mb-2 min-h-[3rem]">{formatPrefixedName(person)}</h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t(`staff_role_${person.type}`)}</p>
                            <Badge color={statusColors[person.status] || 'gray'} className="text-[8px] px-1.5 py-0 uppercase font-black">{person.status}</Badge>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                          <div className="flex items-center gap-2 text-xs"><Briefcase size={12} className="text-slate-300 shrink-0"/> <span className="truncate">{person.department || t('patients_modal_view_na')}</span></div>
                          <div className="flex items-center gap-2 text-xs"><MapPin size={12} className="text-slate-300 shrink-0"/> <span className="truncate">{person.address || t('patients_modal_view_na')}</span></div>
                        </div>
                        {canManageHR && <Button variant="outline" size="sm" className="w-full mt-auto no-print" onClick={() => openStaffModal(person)} icon={Edit}>{t('edit')}</Button>}
                      </div>
                    )})}</div>
              </div>
          )}

          {activeTab === 'attendance' && (
              <div className="animate-in fade-in space-y-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden shadow-soft">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_form_role')}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('status')}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_attendance_time')}</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Check Out</th>
                          {canManageHR && <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest no-print">{t('actions')}</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredAttendanceStaff.map(s => { 
                          const record = attendance.find(a => a.staffId === s.id); 
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                              <td><div className="px-6 py-4"><div className="font-bold text-slate-900 dark:text-white">{formatPrefixedName(s)}</div><div className="text-[10px] text-slate-400 uppercase font-black">{t(`staff_role_${s.type}`)}</div></div></td>
                              <td className="px-6 py-4">{record ? <Badge color={record.status === 'present' ? 'green' : 'yellow'}>{record.status}</Badge> : <span className="text-slate-300">-</span>}</td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-600 dark:text-slate-400">{record?.checkIn || '-'}</td>
                              <td className="px-6 py-4 font-mono font-bold text-slate-600 dark:text-slate-400">{record?.checkOut || '-'}</td>
                              {canManageHR && <td className="px-6 py-4 text-right no-print"><div className="flex justify-end gap-2">{!record?.checkIn && <Button size="sm" onClick={() => handleCheckIn(s)} icon={LogIn}>Check In</Button>}{record?.checkIn && !record?.checkOut && <Button size="sm" variant="secondary" onClick={() => handleCheckOut(record)} icon={LogOut}>Check Out</Button>}<Button size="sm" variant="ghost" onClick={() => openAttendanceModal(s.id, s.fullName, 'present')} icon={Edit}>{t('edit')}</Button></div></td>}
                            </tr>
                          )
                        })}
                        {filteredAttendanceStaff.length === 0 && (
                          <tr><td colSpan={canManageHR ? 5 : 4} className="text-center py-20 text-slate-300 font-bold">{t('no_data')}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
              </div>
          )}

          {activeTab === 'leaves' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
                  {filteredLeaves.length === 0 ? <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl opacity-50"><Calendar size={48} className="mx-auto mb-4 text-slate-300"/><p className="text-slate-400 font-bold">{t('staff_no_leaves')}</p></div> : filteredLeaves.map(leave => (<div key={leave.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"><div className={`absolute top-0 left-0 w-1.5 h-full ${leave.status === 'approved' ? 'bg-emerald-500' : leave.status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}`}></div><div className="flex justify-between items-start mb-3"><div><h4 className="font-bold text-slate-800 dark:text-white leading-tight">{leave.staffName}</h4><p className="text-[10px] font-black text-slate-400 uppercase mt-1">{leave.type}</p></div><Badge color={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'yellow'}>{leave.status}</Badge></div><div className="space-y-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800"><Calendar size={14}/> {new Date(leave.startDate).toLocaleDateString()} <ChevronRight size={12} className={language === 'ar' ? 'rotate-180' : ''}/> {new Date(leave.endDate).toLocaleDateString()}</div><p className="text-sm italic text-slate-500 dark:text-slate-400 leading-relaxed">"{leave.reason}"</p></div>{canManageHR && leave.status === 'pending' && <div className="flex gap-2 mt-5 pt-4 border-t border-slate-50 dark:border-slate-700 no-print"><Button size="sm" className="flex-1 bg-emerald-600 border-none text-white shadow-emerald-200" onClick={() => updateLeaveStatus(leave.id, 'approved')} icon={CheckCircle}>{t('staff_action_approve')}</Button><Button size="sm" variant="danger" className="flex-1" onClick={() => updateLeaveStatus(leave.id, 'rejected')} icon={XCircle}>{t('staff_action_reject')}</Button></div>}</div>))}
              </div>
          )}

          {activeTab === 'payroll' && (
              <div className="animate-in fade-in space-y-4">
                  <Card className="!p-0 overflow-hidden shadow-soft">
                    <table className="min-w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_form_role')}</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_payroll_base')}</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest font-bold">{t('staff_payroll_net')}</th>
                          <th className="px-6 py-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('status')}</th>
                          <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest no-print">{t('actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredPayroll.length === 0 ? <tr><td colSpan={5} className="text-center py-20 text-slate-300 font-bold">{t('staff_payroll_empty')}</td></tr> : filteredPayroll.map(p => (<tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40"><td><div className="px-6 py-4 font-bold text-slate-800 dark:text-white">{p.staffName}</div></td><td className="px-6 py-4 text-right font-mono text-slate-500">${p.baseSalary.toLocaleString()}</td><td className="px-6 py-4 text-right font-mono font-black text-primary-600 text-base">${p.netSalary.toLocaleString()}</td><td className="px-6 py-4 text-center"><Badge color={p.status === 'paid' ? 'green' : 'yellow'}>{p.status}</Badge></td><td className="px-6 py-4 text-right no-print"><div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => openPayrollDetails(p)} icon={Eye}>{t('view')}</Button>{canManageHR && p.status === 'draft' && <Button size="sm" onClick={() => openPayNowModal(p)} icon={CreditCard}>{t('staff_payroll_paid_via')}</Button>}</div></td></tr>))}
                      </tbody>
                    </table>
                  </Card>
              </div>
          )}

          {activeTab === 'financials' && (
              <Card className="!p-0 overflow-hidden animate-in fade-in shadow-soft">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('date')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_form_role')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('appointments_form_type')}</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('staff_form_adj_reason')}</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('billing_table_header_amount')}</th>
                      {canManageHR && <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredFinancials.length === 0 ? <tr><td colSpan={6} className="text-center py-20 text-slate-300 font-bold">{t('no_data')}</td></tr> : filteredFinancials.map(f => {
                      /* Fix: Comparison error resolved by updating FinancialAdjustment type in types.ts */
                      const isPendingExtra = f.type === 'extra' && f.status === 'pending';
                      return (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <td className="px-6 py-4 text-slate-500 font-medium">{new Date(f.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{f.staffName}</td>
                          <td className="px-6 py-4">
                            {/* Fix: Badge color 'violet' changed to 'purple' to align with UI component constraints */}
                            <Badge color={f.type === 'bonus' ? 'green' : f.type === 'loan' ? 'blue' : f.type === 'extra' ? 'purple' : 'red'}>{f.type}</Badge>
                            {f.status && f.status !== 'approved' && <span className="ml-2 text-[10px] opacity-60">({f.status})</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs italic">"{f.reason}"</td>
                          {/* Fix: Unintentional comparison logic resolved by types.ts update */}
                          <td className={`px-6 py-4 text-right font-mono font-black ${f.type === 'bonus' || f.type === 'extra' ? 'text-emerald-600' : 'text-rose-600'}`}>${f.amount.toLocaleString()}</td>
                          {canManageHR && (
                            <td className="px-6 py-4 text-right">
                              {isPendingExtra && (
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => handleApproveAdjustment(f.id)} icon={CheckCircle}>Approve</Button>
                                  <Button size="sm" variant="danger" onClick={() => handleDeclineAdjustment(f.id)} icon={Ban}>Decline</Button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
          )}
        </>
      )}

      <Modal isOpen={!!attendanceModal} onClose={() => setAttendanceModal(null)} title={t('staff_modal_attendance_title')}>
        {attendanceModal && (
          <form onSubmit={handleAttendanceSubmit} className="space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('staff_form_select_employee')}</p>
               <p className="font-bold text-slate-800 dark:text-white">{attendanceModal.staffName}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('status')} value={attendanceModal.status} onChange={e => setAttendanceModal({...attendanceModal, status: e.target.value})}>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="half_day">Half Day</option>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <Input label="Check In" type="time" value={attendanceModal.checkIn} onChange={e => setAttendanceModal({...attendanceModal, checkIn: e.target.value})} />
                <Input label="Check Out" type="time" value={attendanceModal.checkOut} onChange={e => setAttendanceModal({...attendanceModal, checkOut: e.target.value})} />
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
               <Button type="button" variant="secondary" onClick={() => setAttendanceModal(null)}>{t('cancel')}</Button>
               <Button type="submit" icon={Save}>{t('save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title={t('staff_leave_request')}>
        <form onSubmit={handleLeaveRequest} className="space-y-5">
          <SearchableEmployeeSelect label={t('staff_form_select_employee')} value={leaveForm.staffId} onChange={(val: string) => setLeaveForm({...leaveForm, staffId: val})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Select label={t('staff_form_leave_type')} value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value as any})}>
                <option value="sick">Sick Leave</option>
                <option value="vacation">Vacation</option>
                <option value="casual">Casual Leave</option>
                <option value="unpaid">Unpaid Leave</option>
             </Select>
             <div className="grid grid-cols-2 gap-2">
                <Input label={t('staff_form_start_date')} type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                <Input label={t('staff_form_end_date')} type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
             </div>
          </div>
          <Textarea label={t('staff_form_reason_notes')} rows={3} required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
          <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsLeaveModalOpen(false)}>{t('cancel')}</Button>
             <Button type="submit" icon={CheckCircle}>{t('submit')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title={t('staff_financial_add_entry')}>
        <form onSubmit={handleAdjustmentSubmit} className="space-y-5">
          <SearchableEmployeeSelect label={t('staff_form_select_employee')} value={adjForm.staffId} onChange={(val: string) => setAdjForm({...adjForm, staffId: val})} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <Select label={t('staff_form_adj_type')} value={adjForm.type} onChange={e => setAdjForm({...adjForm, type: e.target.value as any})}>
                <option value="bonus">Bonus / Addition</option>
                <option value="extra">Extra / Operation Fee (Requires Approval)</option>
                <option value="fine">Fine / Deduction</option>
                <option value="loan">Loan / Advance</option>
             </Select>
             <FormattedInput label={t('staff_form_amount')} required value={adjForm.amount} onChange={(val: string) => setAdjForm({...adjForm, amount: val})} prefix={<DollarSign size={14}/>} />
             <Input label={t('staff_form_effective_date')} type="date" required value={adjForm.date} onChange={e => setAdjForm({...adjForm, date: e.target.value})} />
          </div>
          <Textarea label={t('staff_form_adj_reason')} rows={3} required value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} />
          <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
             <Button type="button" variant="secondary" onClick={() => setIsAdjustmentModalOpen(false)}>{t('cancel')}</Button>
             <Button type="submit" icon={Save}>{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={staffForm.id ? t('staff_edit_employee') : t('staff_add_employee_button')}>
        <form onSubmit={handleCreateStaff} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('patients_modal_form_fullName')} required value={staffForm.fullName} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} prefix={<User size={14}/>} />
            <Select label={t('staff_form_role')} value={staffForm.type} onChange={e => setStaffForm({...staffForm, type: e.target.value})}>
                <option value="doctor">{t('staff_role_doctor')}</option>
                <option value="nurse">{t('staff_role_nurse')}</option>
                <option value="technician">{t('staff_role_technician')}</option>
                <option value="lab_technician">Lab Technician</option>
                <option value="radiologist">Radiologist</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="anesthesiologist">Anesthesiologist</option>
                <option value="receptionist">Receptionist</option>
                <option value="accountant">Accountant</option>
                <option value="hr_manager">HR Manager</option>
                <option value="manager">Manager</option>
                <option value="security">Security</option>
                <option value="maintenance">Maintenance</option>
                <option value="staff">Other Staff</option>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <Select label={t('staff_form_department')} value={staffForm.department} onChange={e => setStaffForm({...staffForm, department: e.target.value})}>
                <option value="">{t('staff_form_department')}</option>
                {departments.map(d => <option key={d.id} value={d.name_en}>{language === 'ar' ? d.name_ar : d.name_en}</option>)}
             </Select>
             <Select label={t('staff_form_specialization')} value={staffForm.specialization} onChange={e => setStaffForm({...staffForm, specialization: e.target.value})}>
                <option value="">{t('staff_form_specialization')}</option>
                {specializations
                  .filter(s => !s.related_role || s.related_role === staffForm.type)
                  .map(s => <option key={s.id} value={s.name_en}>{language === 'ar' ? s.name_ar : s.name_en}</option>)}
             </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('patients_modal_form_address')} value={staffForm.address} onChange={e => setStaffForm({...staffForm, address: e.target.value})} prefix={<MapPin size={14}/>} />
            <Select label={t('staff_form_status')} value={staffForm.status} onChange={e => setStaffForm({...staffForm, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="onleave">On Leave</option>
                <option value="dismissed">Dismissed</option>
            </Select>
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2"><DollarSign size={14}/> {t('staff_form_financials')}</h4>
            
            {staffForm.type === 'doctor' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormattedInput label={t('staff_form_base_salary')} required value={staffForm.baseSalary} onChange={(val: string) => setStaffForm({...staffForm, baseSalary: val})} prefix={<Hash size={14}/>} />
                    <FormattedInput label={t('staff_form_fee_initial')} value={staffForm.consultationFee} onChange={(val: string) => setStaffForm({...staffForm, consultationFee: val})} prefix={<Hash size={14}/>} />
                </div>
            ) : (
                <div className="grid grid-cols-1">
                    <FormattedInput label={t('staff_form_base_salary')} required value={staffForm.baseSalary} onChange={(val: string) => setStaffForm({...staffForm, baseSalary: val})} prefix={<Hash size={14}/>} />
                </div>
            )}

            {staffForm.type === 'doctor' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                    <FormattedInput label={t('staff_form_fee_followup')} value={staffForm.consultationFeeFollowup} onChange={(val: string) => setStaffForm({...staffForm, consultationFeeFollowup: val})} prefix={<Hash size={14}/>} />
                    <FormattedInput label={t('staff_form_fee_emergency')} value={staffForm.consultationFeeEmergency} onChange={(val: string) => setStaffForm({...staffForm, consultationFeeEmergency: val})} prefix={<Hash size={14}/>} />
                </div>
            )}
          </div>
          <div className="pt-4 border-t dark:border-slate-700">
            <h4 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2"><Clock size={16}/> {t('staff_form_availability')}</h4>
            <div className="flex flex-wrap gap-2 mb-5">{DAYS_OF_WEEK.map((day) => (<button key={day} type="button" onClick={() => toggleDay(day)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${ (staffForm.availableDays || []).includes(DAYS_OF_WEEK_EN[DAYS_OF_WEEK.indexOf(day)]) ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{day}</button>))}</div>
            
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{isRtl ? 'أوقات المناوبة' : 'SHIFT TIMING'}</p>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <LogIn size={12} className="text-emerald-500" /> {t('staff_form_start_time')}
                        </label>
                        <div className="relative group">
                            <input 
                                type="time" 
                                value={staffForm.availableTimeStart} 
                                onChange={e => setStaffForm({...staffForm, availableTimeStart: e.target.value})} 
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all outline-none"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <LogOut size={12} className="text-rose-500" /> {t('staff_form_end_time')}
                        </label>
                        <div className="relative group">
                            <input 
                                type="time" 
                                value={staffForm.availableTimeEnd} 
                                onChange={e => setStaffForm({...staffForm, availableTimeEnd: e.target.value})} 
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-black text-slate-900 dark:text-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/5 transition-all outline-none"
                            />
                        </div>
                    </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-3 italic">* {isRtl ? 'يتم استخدام هذه الأوقات لحساب التأخير في الحضور.' : 'These times are used for calculating late attendance status.'}</p>
            </div>
          </div>
          <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700 sticky bottom-[-24px] bg-white dark:bg-slate-800 py-3 z-10">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit" icon={Save}>{t('save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isPayNowModalOpen} onClose={() => setIsPayNowModalOpen(false)} title={t('staff_process_payroll_pay')}>
        {selectedPayroll && (
          <form onSubmit={handlePayNowSubmit} className="space-y-6">
            <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('staff_payroll_breakdown_title', { name: selectedPayroll.staffName })}</p>
                <p className="text-4xl font-black text-primary-600 font-mono tracking-tighter">${selectedPayroll.netSalary.toLocaleString()}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label={t('staff_form_payment_method')} value={payNowForm.method} onChange={e => setPayNowForm({...payNowForm, method: e.target.value})} required>
                   {paymentMethods.filter(pm => pm.isActive).map(pm => <option key={pm.id} value={pm.name_en}>{pm.name_en}</option>)}
                </Select>
                <Input label={t('staff_form_ref_no')} placeholder="Ref: 0012345" value={payNowForm.reference} onChange={e => setPayNowForm({...payNowForm, reference: e.target.value})} />
            </div>
            <Textarea label={t('staff_form_disbursement_notes')} placeholder={t('staff_payroll_notes')} value={payNowForm.notes} onChange={e => setPayNowForm({...payNowForm, notes: e.target.value})} />
            <div className="pt-4 flex justify-end gap-3 border-t dark:border-slate-700">
               <Button type="button" variant="secondary" onClick={() => setIsPayNowModalOpen(false)}>{t('cancel')}</Button>
               <Button type="submit" icon={CheckCircle}>{t('confirm')}</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isPayrollDetailModalOpen} onClose={() => setIsPayrollDetailModalOpen(false)} title={t('staff_payroll_breakdown_title', { name: selectedPayroll?.staffName })}>
         {selectedPayroll && (
            <div className="space-y-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('staff_payroll_net')} ({selectedPayroll.month})</p>
                    <p className="text-4xl font-black text-primary-600 font-mono tracking-tighter">${selectedPayroll.netSalary.toLocaleString()}</p>
                    <div className="mt-4 flex justify-center"><Badge color={selectedPayroll.status === 'paid' ? 'green' : 'yellow'}>{selectedPayroll.status.toUpperCase()}</Badge></div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('staff_payroll_summary_title')}</h4>
                    <div className="bg-white dark:bg-slate-800 border rounded-2xl overflow-hidden shadow-sm">
                        <div className="p-4 flex justify-between items-center border-b dark:border-slate-700">
                           <span className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center gap-2"><Briefcase size={14}/> {t('staff_payroll_base_salary')}</span>
                           <span className="font-mono font-bold text-slate-900 dark:text-white">${selectedPayroll.baseSalary.toLocaleString()}</span>
                        </div>
                        <div className="p-4 flex justify-between items-center border-b dark:border-slate-700 bg-emerald-50/30 dark:bg-emerald-900/10">
                           <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Plus size={14}/> {t('staff_payroll_bonuses')}</span>
                           <span className="font-mono font-bold text-emerald-600">+${selectedPayroll.totalBonuses.toLocaleString()}</span>
                        </div>
                        <div className="p-4 flex justify-between items-center bg-rose-50/30 dark:bg-rose-900/10">
                           <span className="text-sm font-medium text-rose-700 dark:text-rose-400 flex items-center gap-2"><Hash size={14}/> {t('staff_payroll_fines')}</span>
                           <span className="font-mono font-bold text-rose-600">-${selectedPayroll.totalFines.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                {selectedPayroll.status === 'paid' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('staff_payroll_disbursement_title')}</h4>
                    <div className="bg-slate-50 dark:bg-slate-900/50 border rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('staff_payroll_paid_via')}</p><p className="text-sm font-bold flex items-center gap-2"><Landmark size={14} className="text-primary-600"/> {selectedPayroll.paymentMethod || t('patients_modal_view_na')}</p></div>
                       <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('staff_payroll_reference')}</p><p className="text-sm font-bold flex items-center gap-2 font-mono"><FileText size={14} className="text-primary-600"/> {selectedPayroll.transactionRef || 'N/A'}</p></div>
                       <div className="md:col-span-2 border-t pt-3"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('staff_payroll_notes')}</p><p className="text-xs italic text-slate-600 dark:text-slate-400">"{selectedPayroll.paymentNotes || t('no_data')}"</p></div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t dark:border-slate-700 flex justify-end gap-3">
                    <Button variant="secondary" onClick={() => setIsPayrollDetailModalOpen(false)}>{t('close')}</Button>
                </div>
            </div>
         )}
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message}/>
    </div>
  );
};
