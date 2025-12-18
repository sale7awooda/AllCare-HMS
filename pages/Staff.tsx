import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Briefcase, Clock, 
  Calendar, DollarSign, Wallet,
  Loader2, Edit, Trash2, MapPin,
  LogIn, LogOut, CheckCircle, XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, Attendance, LeaveRequest, PayrollRecord, FinancialAdjustment } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

const DAYS_OF_WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_OF_WEEK_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];

const roleDepartmentMap: Record<string, string[]> = {
  doctor: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'General Surgery', 'Emergency', 'Obstetrics and Gynecology', 'Dermatology', 'Radiology', 'Anesthesiology', 'Internal Medicine'],
  nurse: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'General Surgery', 'Emergency', 'Obstetrics and Gynecology', 'Internal Medicine'],
  technician: ['Radiology', 'Laboratory'],
  anesthesiologist: ['Anesthesiology', 'General Surgery'],
  pharmacist: ['Pharmacy'],
  hr_manager: ['Administration', 'HR'],
  accountant: ['Finance', 'Administration'],
  manager: ['Administration', 'Management'],
  staff: ['Administration', 'Maintenance', 'Security', 'Support Services', 'Finance', 'IT Support'],
  medical_assistant: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General Surgery', 'Internal Medicine'],
  receptionist: ['Administration', 'Front Desk']
};

export const Staff = () => {
  const { t, language } = useTranslation();
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
  
  // Catalogs for dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);

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
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'sick', startDate: '', endDate: '', reason: '' });
  const [attendanceModal, setAttendanceModal] = useState<any>(null);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [data, depts, specs, bankData] = await Promise.all([
        api.getStaff(), api.getDepartments(), api.getSpecializations(), api.getBanks()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSpecializations(Array.isArray(specs) ? specs : []);
      setBanks(Array.isArray(bankData) ? bankData : []);
    } catch (e) { console.error(e); } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const fetchTabData = async () => {
        if (activeTab === 'attendance') setAttendance(await api.getAttendance(selectedDate));
        else if (activeTab === 'leaves') setLeaves(await api.getLeaves());
        else if (activeTab === 'payroll') setPayroll(await api.getPayroll(selectedMonth));
        else if (activeTab === 'financials') setFinancials(await api.getFinancials('all'));
    };
    if(activeTab !== 'directory') fetchTabData();
  }, [activeTab, selectedDate, selectedMonth]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    const { bankName, bankAccount, ...restOfForm } = staffForm;
    const payload = { ...restOfForm, bankDetails: { bankName, bankAccount } };
    try {
      if (staffForm.id) await api.updateStaff(staffForm.id, payload);
      else await api.addStaff(payload);
      setProcessStatus('success');
      await loadData(true);
      setTimeout(() => { setIsModalOpen(false); setProcessStatus('idle'); }, 500);
    } catch (err: any) { setProcessStatus('error'); setProcessMessage(err.response?.data?.error || t('staff_save_fail')); }
  };

  const openStaffModal = (s?: MedicalStaff) => {
      let bankDetailsParsed = { bankName: '', bankAccount: '' };
      if (s?.bankDetails) {
          if (typeof s.bankDetails === 'object' && s.bankDetails !== null) bankDetailsParsed = { bankName: s.bankDetails.bankName, bankAccount: s.bankDetails.bankAccount };
          else if (typeof s.bankDetails === 'string') bankDetailsParsed = { bankName: s.bankDetails, bankAccount: '' };
      }
      setStaffForm(s ? { ...s, address: s.address || '', ...bankDetailsParsed } : { fullName: '', type: 'doctor', status: 'active', baseSalary: '', availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], availableTimeStart: '09:00', availableTimeEnd: '17:00', consultationFee: '', joinDate: new Date().toISOString().split('T')[0], address: '', ...bankDetailsParsed });
      setIsModalOpen(true);
  };

  const toggleDay = (day: string) => {
      const currentDays = staffForm.availableDays || [];
      const dayEN = DAYS_OF_WEEK_EN[DAYS_OF_WEEK.indexOf(day)];
      setStaffForm({ ...staffForm, availableDays: currentDays.includes(dayEN) ? currentDays.filter((d: string) => d !== dayEN) : [...currentDays, dayEN] });
  };
  
  const filteredDepartments = useMemo(() => {
    if (!staffForm.type) return departments;
    const allowedDepts = roleDepartmentMap[staffForm.type];
    return !allowedDepts ? departments : departments.filter(d => allowedDepts.includes(d.name_en));
  }, [staffForm.type, departments]);

  const filteredSpecializations = useMemo(() => {
    return !staffForm.type ? specializations : specializations.filter(s => !s.related_role || s.related_role === staffForm.type);
  }, [staffForm.type, specializations]);

  const handleCheckIn = (staffMember: MedicalStaff) => {
    setConfirmState({
        isOpen: true, title: t('staff_attendance_confirm'), message: t('staff_attendance_checkin_confirm', {name: staffMember.fullName, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}),
        action: async () => {
            setProcessStatus('processing');
            try {
                const now = new Date();
                const timeString = now.toTimeString().slice(0, 5);
                await api.markAttendance({ staffId: staffMember.id, date: selectedDate, status: staffMember.availableTimeStart && timeString > staffMember.availableTimeStart ? 'late' : 'present', checkIn: timeString });
                setAttendance(await api.getAttendance(selectedDate));
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { setProcessStatus('error'); setProcessMessage(e.message || t('staff_attendance_mark_fail')); }
        }
    });
  };

  const handleCheckOut = (record: Attendance) => {
    setConfirmState({
        isOpen: true, title: t('staff_attendance_confirm'), message: t('staff_attendance_checkout_confirm', {name: record.staffName}),
        action: async () => {
            setProcessStatus('processing');
            try {
                await api.markAttendance({ staffId: record.staffId, date: record.date, status: record.status, checkOut: new Date().toTimeString().slice(0, 5) });
                setAttendance(await api.getAttendance(selectedDate));
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { setProcessStatus('error'); }
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
      try {
          await api.markAttendance({ staffId: attendanceModal.staffId, date: selectedDate, status: attendanceModal.status, checkIn: attendanceModal.checkIn || null, checkOut: attendanceModal.checkOut || null });
          setAttendance(await api.getAttendance(selectedDate));
          setProcessStatus('success'); setTimeout(() => { setProcessStatus('idle'); setAttendanceModal(null); }, 500);
      } catch (err: any) { setProcessStatus('error'); }
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      setProcessStatus('processing');
      try {
        await api.requestLeave(leaveForm);
        setLeaves(await api.getLeaves());
        setProcessStatus('success'); setTimeout(() => { setIsLeaveModalOpen(false); setProcessStatus('idle'); }, 1000);
      } catch (e: any) { setProcessStatus('error'); }
  };

  const updateLeaveStatus = (id: number, status: string) => {
      setConfirmState({
        isOpen: true, title: status === 'approved' ? t('hr_approve') : t('hr_reject'), message: t('confirm'),
        action: async () => {
            setProcessStatus('processing');
            try {
                await api.updateLeaveStatus(id, status);
                setLeaves(await api.getLeaves());
                setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
            } catch (e: any) { setProcessStatus('error'); }
        }
      });
  };

  const handleGeneratePayroll = () => {
      setConfirmState({
          isOpen: true, title: t('staff_tab_payroll'), message: t('staff_generate_payroll_confirm', {month: selectedMonth}),
          action: async () => {
              setProcessStatus('processing');
              try {
                  await api.generatePayroll({ month: selectedMonth });
                  setPayroll(await api.getPayroll(selectedMonth));
                  setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
              } catch(e: any) { setProcessStatus('error'); }
          }
      });
  };

  const handleMarkPaid = (record: PayrollRecord) => {
      setConfirmState({
          isOpen: true, title: t('confirm'), message: t('staff_payroll_paid_confirm', {name: record.staffName}),
          action: async () => {
              setProcessStatus('processing');
              try {
                  await api.updatePayrollStatus(record.id, 'paid');
                  setPayroll(await api.getPayroll(selectedMonth));
                  setProcessStatus('success'); setTimeout(() => setProcessStatus('idle'), 1000);
              } catch(e: any) { setProcessStatus('error'); }
          }
      });
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setProcessStatus('processing');
      try {
        await api.addAdjustment({ ...adjForm, amount: parseFloat(adjForm.amount) });
        setFinancials(await api.getFinancials('all'));
        setProcessStatus('success'); setTimeout(() => { setIsAdjustmentModalOpen(false); setProcessStatus('idle'); }, 1000);
      } catch (e: any) { setProcessStatus('error'); }
  };

  /* FIX: Moved useHeader after handleGeneratePayroll and other functions to avoid block-scoped access error during component body evaluation. */
  // Sync Header
  useHeader(
    t('staff_title'),
    t('staff_subtitle'),
    <div className="flex gap-2">
      {activeTab === 'directory' && canManageHR && <Button onClick={() => openStaffModal()} icon={Plus}>{t('staff_add_employee_button')}</Button>}
      {activeTab === 'leaves' && <Button icon={Plus} onClick={() => setIsLeaveModalOpen(true)}>{t('staff_leave_request')}</Button>}
      {activeTab === 'payroll' && canManageHR && <Button icon={DollarSign} onClick={handleGeneratePayroll}>{t('staff_generate_payroll')}</Button>}
      {activeTab === 'financials' && canManageHR && <Button icon={Plus} onClick={() => setIsAdjustmentModalOpen(true)}>{t('staff_financial_add_entry')}</Button>}
    </div>
  );

  const sortedStaff = staff.filter(s => s.fullName.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => (a.status === 'active' ? -1 : 1));

  return (
    <div className="space-y-6">
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" /><h3 className="font-bold">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto w-fit">
          {[
              { id: 'directory', label: t('staff_tab_directory'), icon: Briefcase },
              { id: 'attendance', label: t('staff_tab_attendance'), icon: Clock },
              { id: 'leaves', label: t('staff_tab_leaves'), icon: Calendar },
              { id: 'payroll', label: t('staff_tab_payroll'), icon: DollarSign },
              { id: 'financials', label: t('staff_tab_financials'), icon: Wallet },
          ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><tab.icon size={16} /> {tab.label}</button>
          ))}
      </div>

      {activeTab === 'directory' && (
          <div className="animate-in fade-in">
              <div className="relative w-full sm:w-72 mb-6"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><input type="text" placeholder={t('staff_search_placeholder')} className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">{sortedStaff.map(person => (<div key={person.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group"><div className="flex justify-between items-start mb-4"><div className="flex items-center gap-3"><div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white bg-slate-400`}>{person.fullName.charAt(0)}</div><div><h3 className="font-bold text-slate-800 dark:text-white line-clamp-1">{person.fullName}</h3><Badge color="blue">{t(`staff_role_${person.type}`)}</Badge></div></div><div className={`w-2 h-2 rounded-full ${person.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div></div><div className="space-y-2 text-sm text-slate-500 dark:text-slate-400 mb-4"><div className="flex items-center gap-2"><Briefcase size={14}/> {person.department || t('patients_modal_view_na')}</div><div className="flex items-center gap-2"><MapPin size={14}/> {person.phone || t('patients_modal_view_na')}</div></div>{canManageHR && <Button variant="outline" className="w-full" onClick={() => openStaffModal(person)}>{t('edit')}</Button>}</div>))}</div>
          </div>
      )}

      {activeTab === 'attendance' && (
          <div className="animate-in fade-in space-y-4">
              <div className="flex justify-end"><Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" /></div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="px-4 py-3">{t('staff_form_role_title')}</th><th className="px-4 py-3">{t('status')}</th><th className="px-4 py-3">{t('staff_attendance_time')}</th><th className="px-4 py-3">Check Out</th>{canManageHR && <th className="px-4 py-3 text-right">{t('actions')}</th>}</tr></thead><tbody className="divide-y">{staff.filter(s => s.status === 'active').map(s => { const record = attendance.find(a => a.staffId === s.id); return (<tr key={s.id} className="hover:bg-slate-50"><td><div className="px-4 py-3"><div className="font-bold">{s.fullName}</div><div className="text-xs text-slate-400">{t(`staff_role_${s.type}`)}</div></div></td><td className="px-4 py-3">{record ? <Badge color={record.status === 'present' ? 'green' : 'yellow'}>{record.status}</Badge> : '-'}</td><td className="px-4 py-3 font-mono">{record?.checkIn || '-'}</td><td className="px-4 py-3 font-mono">{record?.checkOut || '-'}</td>{canManageHR && <td className="px-4 py-3 text-right"><div className="flex justify-end gap-2">{!record?.checkIn && <Button size="sm" onClick={() => handleCheckIn(s)}>In</Button>}{record?.checkIn && !record?.checkOut && <Button size="sm" variant="secondary" onClick={() => handleCheckOut(record)}>Out</Button>}<Button size="sm" variant="ghost" onClick={() => openAttendanceModal(s.id, s.fullName, 'present')}><Edit size={14}/></Button></div></td>}</tr>)})}</tbody></table></div>
          </div>
      )}

      {activeTab === 'leaves' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in">
              {leaves.length === 0 ? <p className="col-span-full text-center text-slate-400 py-10">{t('staff_no_leaves')}</p> : leaves.map(leave => (<div key={leave.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border shadow-sm relative overflow-hidden"><div className={`absolute top-0 left-0 w-1 h-full ${leave.status === 'approved' ? 'bg-green-500' : 'bg-yellow-500'}`}></div><div className="flex justify-between items-start mb-2"><h4 className="font-bold">{leave.staffName}</h4><Badge color={leave.status === 'approved' ? 'green' : 'yellow'}>{leave.status}</Badge></div><div className="text-sm text-slate-500"><p>{leave.type} • {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</p><p className="italic mt-2">"{leave.reason}"</p></div>{canManageHR && leave.status === 'pending' && <div className="flex gap-2 mt-4"><Button size="sm" className="flex-1 bg-green-600 border-none text-white" onClick={() => updateLeaveStatus(leave.id, 'approved')}>{t('hr_approve')}</Button><Button size="sm" variant="danger" className="flex-1" onClick={() => updateLeaveStatus(leave.id, 'rejected')}>{t('hr_reject')}</Button></div>}</div>))}
          </div>
      )}

      {activeTab === 'payroll' && (
          <div className="animate-in fade-in space-y-4">
              <div className="flex justify-start"><Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto" /></div>
              <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border"><table className="min-w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="px-4 py-3">{t('staff_form_role_title')}</th><th className="px-4 py-3 text-right">{t('staff_payroll_base')}</th><th className="px-4 py-3 text-right font-bold">{t('staff_payroll_net')}</th><th className="px-4 py-3 text-center">{t('status')}</th>{canManageHR && <th className="px-4 py-3"></th>}</tr></thead><tbody className="divide-y">{payroll.length === 0 ? <tr><td colSpan={5} className="text-center py-8">{t('staff_payroll_empty')}</td></tr> : payroll.map(p => (<tr key={p.id}><td><div className="px-4 py-3 font-medium">{p.staffName}</div></td><td className="px-4 py-3 text-right font-mono">${p.baseSalary.toLocaleString()}</td><td className="px-4 py-3 text-right font-mono font-bold">${p.netSalary.toLocaleString()}</td><td className="px-4 py-3 text-center"><Badge color={p.status === 'paid' ? 'green' : 'yellow'}>{p.status}</Badge></td><td className="px-4 py-3 text-right">{p.status === 'draft' && <Button size="sm" onClick={() => handleMarkPaid(p)}>Pay</Button>}</td></tr>))}</tbody></table></div>
          </div>
      )}

      {activeTab === 'financials' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border overflow-hidden animate-in fade-in"><table className="min-w-full text-sm text-left"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="px-4 py-3">{t('date')}</th><th className="px-4 py-3">{t('staff_form_role_title')}</th><th className="px-4 py-3">{t('appointments_form_type')}</th><th className="px-4 py-3 text-right">{t('billing_table_header_amount')}</th></tr></thead><tbody className="divide-y">{financials.map(f => (<tr key={f.id}><td className="px-4 py-3">{new Date(f.date).toLocaleDateString()}</td><td className="px-4 py-3 font-medium">{f.staffName}</td><td className="px-4 py-3"><Badge color={f.type === 'bonus' ? 'green' : 'red'}>{f.type}</Badge></td><td className={`px-4 py-3 text-right font-mono font-bold ${f.type === 'bonus' ? 'text-green-600' : 'text-red-600'}`}>${f.amount.toLocaleString()}</td></tr>))}</tbody></table></div>
      )}

      {/* MODALS */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={staffForm.id ? t('staff_edit_employee') : t('staff_add_employee_button')}>
        <form onSubmit={handleCreateStaff} className="space-y-4 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 gap-4"><Input label={t('patients_modal_form_fullName')} required value={staffForm.fullName} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} /><Select label={t('staff_form_role')} value={staffForm.type} onChange={e => setStaffForm({...staffForm, type: e.target.value})}><option value="doctor">{t('staff_role_doctor')}</option><option value="nurse">{t('staff_role_nurse')}</option><option value="technician">{t('staff_role_technician')}</option></Select></div>
          <div className="grid grid-cols-2 gap-4"><Select label={t('staff_form_department')} value={staffForm.department || ''} onChange={e => setStaffForm({...staffForm, department: e.target.value})}><option value="">Select...</option>{departments.map((d: any) => <option key={d.id} value={d.name_en}>{d.name_en}</option>)}</Select><Select label={t('staff_form_specialization')} value={staffForm.specialization || ''} onChange={e => setStaffForm({...staffForm, specialization: e.target.value})}><option value="">Select...</option>{specializations.map((s: any) => <option key={s.id} value={s.name_en}>{s.name_en}</option>)}</Select></div>
          <div className="grid grid-cols-2 gap-4"><Input label={t('staff_form_base_salary')} type="number" required value={staffForm.baseSalary} onChange={e => setStaffForm({...staffForm, baseSalary: e.target.value})} /><Input label={t('staff_form_consultation_fee')} type="number" value={staffForm.consultationFee} onChange={e => setStaffForm({...staffForm, consultationFee: e.target.value})} /></div>
          <div className="pt-4 border-t"><h4 className="text-sm font-bold text-slate-500 mb-2">{t('staff_form_availability')}</h4><div className="flex flex-wrap gap-2 mb-3">{DAYS_OF_WEEK.map((day) => (<button key={day} type="button" onClick={() => toggleDay(day)} className={`w-8 h-8 rounded-full text-xs font-bold ${ (staffForm.availableDays || []).includes(DAYS_OF_WEEK_EN[DAYS_OF_WEEK.indexOf(day)]) ? 'bg-primary-600 text-white' : 'bg-slate-100'}`}>{day}</button>))}</div><div className="grid grid-cols-2 gap-4"><Input label={t('staff_form_start_time')} type="time" value={staffForm.availableTimeStart} onChange={e => setStaffForm({...staffForm, availableTimeStart: e.target.value})} /><Input label={t('staff_form_end_time')} type="time" value={staffForm.availableTimeEnd} onChange={e => setStaffForm({...staffForm, availableTimeEnd: e.target.value})} /></div></div>
          <div className="flex justify-end pt-4 gap-3 border-t"><Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button><Button type="submit">{t('save')}</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!attendanceModal} onClose={() => setAttendanceModal(null)} title={t('staff_modal_attendance_title')}>
          {attendanceModal && (<form onSubmit={handleAttendanceSubmit} className="space-y-4"><div className="bg-slate-50 p-3 rounded-lg text-center"><p className="font-bold">{attendanceModal.staffName}</p></div><Select label={t('status')} value={attendanceModal.status} onChange={e => setAttendanceModal({...attendanceModal, status: e.target.value})}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></Select><div className="grid grid-cols-2 gap-4"><Input label="In" type="time" value={attendanceModal.checkIn} onChange={e => setAttendanceModal({...attendanceModal, checkIn: e.target.value})} /><Input label="Out" type="time" value={attendanceModal.checkOut} onChange={e => setAttendanceModal({...attendanceModal, checkOut: e.target.value})} /></div><div className="flex justify-end pt-4 gap-3"><Button type="button" variant="secondary" onClick={() => setAttendanceModal(null)}>{t('cancel')}</Button><Button type="submit">{t('save')}</Button></div></form>)}
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title={t('staff_leave_request')}><form onSubmit={handleLeaveRequest} className="space-y-4"><Select label={t('staff_form_role_title')} required value={leaveForm.staffId} onChange={e => setLeaveForm({...leaveForm, staffId: e.target.value})}><option value="">Select Employee...</option>{staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</Select><div className="grid grid-cols-2 gap-4"><Input label="Start" type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} /><Input label="End" type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} /></div><Textarea label={t('appointments_form_reason')} required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} /><Button type="submit" className="w-full">{t('submit')}</Button></form></Modal>

      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title={t('staff_financial_add_entry')}><form onSubmit={handleAdjustmentSubmit} className="space-y-4"><Select label={t('staff_form_role_title')} required value={adjForm.staffId} onChange={e => setAdjForm({...adjForm, staffId: e.target.value})}><option value="">Select Employee...</option>{staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</Select><Select label="Type" value={adjForm.type} onChange={e => setAdjForm({...adjForm, type: e.target.value})}><option value="bonus">Bonus</option><option value="fine">Fine</option></Select><Input label="Amount" type="number" required value={adjForm.amount} onChange={e => setAdjForm({...adjForm, amount: e.target.value})} /><Textarea label="Reason" required value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} /><Button type="submit" className="w-full">{t('save')}</Button></form></Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message}/>
    </div>
  );
};
