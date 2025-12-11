
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Briefcase, Clock, 
  Calendar, DollarSign, Wallet,
  AlertTriangle, CheckCircle, User, Phone, Mail,
  Loader2, XCircle, Edit, Trash2, X, Check, MapPin
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, Attendance, LeaveRequest, PayrollRecord, FinancialAdjustment } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

const DAYS_OF_WEEK_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_OF_WEEK_AR = ['إث', 'ثل', 'أر', 'خم', 'جم', 'سب', 'أح'];

// Extended mapping for Role -> Departments
const roleDepartmentMap: Record<string, string[]> = {
  doctor: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'General Surgery', 'Emergency', 'Obstetrics and Gynecology', 'Dermatology', 'Radiology', 'Anesthesiology', 'Internal Medicine'],
  nurse: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'General Surgery', 'Emergency', 'Obstetrics and Gynecology', 'Internal Medicine'],
  technician: ['Radiology', 'Laboratory'],
  anesthesiologist: ['Anesthesiology', 'General Surgery'],
  pharmacist: ['Pharmacy'],
  hr_manager: ['Administration', 'HR'],
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
  const [isModalOpen, setIsModalOpen] = useState(false); // Staff Add/Edit
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false); // Fine/Bonus/Loan
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); // Request Leave
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // For attendance
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // For payroll YYYY-MM
  
  // Advanced Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Confirm State
  const [confirmState, setConfirmState] = useState<{isOpen: boolean, title: string, message: string, action: () => void}>({ isOpen: false, title: '', message: '', action: () => {} });

  // Forms
  const [staffForm, setStaffForm] = useState<Partial<MedicalStaff & { bankName?: string, bankAccount?: string, address?: string } | any>>({});
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'sick', startDate: '', endDate: '', reason: '' });

  // New Attendance Modal State
  const [attendanceModal, setAttendanceModal] = useState<{
      isOpen: boolean;
      staffId: number;
      staffName: string;
      status: 'present' | 'late' | 'absent';
      checkIn: string;
      checkOut: string;
      isUpdate: boolean;
  } | null>(null);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [data, depts, specs, bankData] = await Promise.all([
        api.getStaff(),
        api.getDepartments(),
        api.getSpecializations(),
        api.getBanks()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSpecializations(Array.isArray(specs) ? specs : []);
      setBanks(Array.isArray(bankData) ? bankData : []);
    } catch (e) {
      console.error("Failed to load staff data:", e);
    } finally {
      if (!isBackground) setLoading(false);
    }
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

  const canManageHR = hasPermission(currentUser, Permissions.MANAGE_HR);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName) return;

    setProcessStatus('processing');
    setProcessMessage(staffForm.id ? t('staff_updating') : t('staff_creating'));

    const { bankName, bankAccount, ...restOfForm } = staffForm;
    
    // Ensure numbers are converted, empty string becomes 0
    const payload = {
        ...restOfForm,
        baseSalary: parseFloat(restOfForm.baseSalary) || 0,
        consultationFee: parseFloat(restOfForm.consultationFee) || 0,
        consultationFeeFollowup: parseFloat(restOfForm.consultationFeeFollowup) || 0,
        consultationFeeEmergency: parseFloat(restOfForm.consultationFeeEmergency) || 0,
        bankDetails: { bankName, bankAccount }
    };
    
    try {
      if (payload.id) await api.updateStaff(payload.id, payload);
      else await api.addStaff(payload);
      
      setProcessStatus('success');
      setProcessMessage(staffForm.id ? t('staff_update_success') : t('staff_create_success'));
      
      await loadData(true);

      setTimeout(() => {
        setIsModalOpen(false);
        setProcessStatus('idle');
      }, 500);
      
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || t('staff_save_fail'));
    }
  };

  const openStaffModal = (s?: MedicalStaff) => {
      let bankDetailsParsed = { bankName: '', bankAccount: '' };
      if (s?.bankDetails) {
          if (typeof s.bankDetails === 'object' && s.bankDetails !== null) {
              bankDetailsParsed = { bankName: s.bankDetails.bankName, bankAccount: s.bankDetails.bankAccount };
          } else if (typeof s.bankDetails === 'string') {
              bankDetailsParsed = { bankName: s.bankDetails, bankAccount: '' };
          }
      }

      // Initialize number fields as strings (or empty strings if 0 for new)
      const formState = s ? { 
          ...s, 
          ...bankDetailsParsed,
      } : { 
          fullName: '', type: 'doctor', status: 'active', 
          baseSalary: '', 
          availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          availableTimeStart: '09:00', availableTimeEnd: '17:00',
          consultationFee: '', consultationFeeFollowup: '', consultationFeeEmergency: '',
          joinDate: new Date().toISOString().split('T')[0],
          address: '',
          ...bankDetailsParsed
      };

      setStaffForm(formState);
      setIsModalOpen(true);
  };

  const toggleDay = (day: string) => {
      const currentDays = staffForm.availableDays || [];
      const dayEN = DAYS_OF_WEEK_EN[DAYS_OF_WEEK.indexOf(day)];
      if (currentDays.includes(dayEN)) {
          setStaffForm({ ...staffForm, availableDays: currentDays.filter((d: string) => d !== dayEN) });
      } else {
          setStaffForm({ ...staffForm, availableDays: [...currentDays, dayEN] });
      }
  };
  
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    // Reset department and specialization when role changes to prevent invalid selections
    setStaffForm(prev => ({
        ...prev,
        type: newType as any,
        department: '',
        specialization: ''
    }));
  };
  
  // Filter Departments based on Role
  const filteredDepartments = useMemo(() => {
    if (!staffForm.type) return departments;
    const allowedDepts = roleDepartmentMap[staffForm.type];
    
    // If role has specific mappings, filter. Otherwise show all (fallback).
    if (!allowedDepts || allowedDepts.length === 0) return departments;
    
    return departments.filter(d => allowedDepts.includes(d.name_en));
  }, [staffForm.type, departments]);

  // Filter Specializations based on Role
  const filteredSpecializations = useMemo(() => {
    if (!staffForm.type) return specializations;
    return specializations.filter(s => !s.related_role || s.related_role === staffForm.type);
  }, [staffForm.type, specializations]);

  const openAttendanceModal = (staffId: number, staffName: string, status: 'present' | 'late' | 'absent') => {
      const existingRecord = attendance.find(a => a.staffId === staffId);
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 5);
      
      setAttendanceModal({
          isOpen: true,
          staffId,
          staffName,
          status: existingRecord ? existingRecord.status : status,
          checkIn: existingRecord?.checkIn || (status !== 'absent' ? timeString : ''),
          checkOut: existingRecord?.checkOut || '',
          isUpdate: !!existingRecord
      });
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!attendanceModal) return;

      setProcessStatus('processing');
      setProcessMessage(t('processing'));

      try {
          await api.markAttendance({
              staffId: attendanceModal.staffId, 
              date: selectedDate, 
              status: attendanceModal.status,
              checkIn: ['present', 'late'].includes(attendanceModal.status) ? attendanceModal.checkIn : null,
              checkOut: ['present', 'late'].includes(attendanceModal.status) && attendanceModal.checkOut ? attendanceModal.checkOut : null
          });
          const data = await api.getAttendance(selectedDate);
          setAttendance(data);
          
          setProcessStatus('success');
          setTimeout(() => {
              setProcessStatus('idle');
              setAttendanceModal(null);
          }, 500);
      } catch (err: any) {
          setProcessStatus('error');
          setProcessMessage(err.message || 'Failed to mark attendance');
      }
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      await api.requestLeave(leaveForm);
      setIsLeaveModalOpen(false);
      const data = await api.getLeaves();
      setLeaves(data);
  };

  const updateLeaveStatus = async (id: number, status: string) => {
      await api.updateLeaveStatus(id, status);
      const data = await api.getLeaves();
      setLeaves(data);
  };

  const handleGeneratePayroll = () => {
      setConfirmState({
          isOpen: true,
          title: t('staff_tab_payroll'),
          message: t('staff_generate_payroll_confirm', {month: selectedMonth}),
          action: async () => {
              await api.generatePayroll({ month: selectedMonth });
              const data = await api.getPayroll(selectedMonth);
              setPayroll(data);
          }
      });
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await api.addAdjustment({ ...adjForm, amount: parseFloat(adjForm.amount) });
      setIsAdjustmentModalOpen(false);
      const data = await api.getFinancials('all');
      setFinancials(data);
  };

  const statusOrder: { [key in MedicalStaff['status']]: number } = {
    active: 1,
    inactive: 2,
    dismissed: 3,
  };

  const sortedStaff = staff
    .filter(s => s.fullName.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99));

  return (
    <div className="space-y-6">
      {/* Loading & Status Overlay */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95 border dark:border-slate-700">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{t('processing')}</h3>
                <p className="text-slate-500 dark:text-slate-400">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{t('success')}</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('patients_process_title_failed')}</h3>
                <p className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('close')}</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('staff_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('staff_subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {[
              { id: 'directory', label: t('staff_tab_directory'), icon: Briefcase },
              { id: 'attendance', label: t('staff_tab_attendance'), icon: Clock },
              { id: 'leaves', label: t('staff_tab_leaves'), icon: Calendar },
              { id: 'payroll', label: t('staff_tab_payroll'), icon: DollarSign },
              { id: 'financials', label: t('staff_tab_financials'), icon: Wallet },
          ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                  <tab.icon size={16} /> {tab.label}
              </button>
          ))}
      </div>

      {/* --- DIRECTORY TAB --- */}
      {activeTab === 'directory' && (
          <div className="animate-in fade-in">
              <div className="flex justify-between mb-4">
                  <div className="relative w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder={t('staff_search_placeholder')} 
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  {canManageHR && <Button onClick={() => openStaffModal()} icon={Plus}>{t('staff_add_employee_button')}</Button>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sortedStaff.map(person => (
                      <div key={person.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group">
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-white bg-gradient-to-br from-slate-400 to-slate-500`}>
                                      {person.fullName.charAt(0)}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-slate-800 dark:text-white line-clamp-1">{person.fullName}</h3>
                                      <Badge color="blue">{t(`staff_role_${person.type}`)}</Badge>
                                  </div>
                              </div>
                              <div className={`w-2 h-2 rounded-full ${person.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          </div>
                          
                          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                              <div className="flex items-center gap-2"><Briefcase size={14}/> {person.department || t('patients_modal_view_na')}</div>
                              <div className="flex items-center gap-2"><Phone size={14}/> {person.phone || t('patients_modal_view_na')}</div>
                              <div className="flex items-center gap-2 truncate"><Mail size={14}/> {person.email || t('patients_modal_view_na')}</div>
                          </div>

                          {canManageHR && (
                              <Button variant="outline" className="w-full" onClick={() => openStaffModal(person)}>
                                  {t('edit')}
                              </Button>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- ATTENDANCE TAB --- */}
      {activeTab === 'attendance' && (
          <div className="animate-in fade-in">
              <div className="flex justify-end mb-4">
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">{t('staff_form_role_title')}</th>
                              <th className="px-4 py-3">{t('status')}</th>
                              <th className="px-4 py-3">{t('staff_attendance_time')}</th>
                              <th className="px-4 py-3">Check Out</th>
                              {canManageHR && <th className="px-4 py-3 text-right">{t('actions')}</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {staff.filter(s => s.status === 'active').map(s => {
                              const record = attendance.find(a => a.staffId === s.id);
                              return (
                                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{s.fullName} <span className="text-xs text-slate-400 block">{t(`staff_role_${s.type}`)}</span></td>
                                      <td className="px-4 py-3">
                                          <Badge color={record?.status === 'present' ? 'green' : record?.status === 'absent' ? 'red' : record?.status === 'late' ? 'orange' : 'gray'}>
                                              {record?.status || 'Pending'}
                                          </Badge>
                                      </td>
                                      <td className="px-4 py-3">{record?.checkIn || '-'}</td>
                                      <td className="px-4 py-3">{record?.checkOut || '-'}</td>
                                      {canManageHR && (
                                          <td className="px-4 py-3 text-right">
                                              <div className="flex justify-end gap-1">
                                                  <button onClick={() => openAttendanceModal(s.id, s.fullName, 'present')} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Present"><CheckCircle size={16}/></button>
                                                  <button onClick={() => openAttendanceModal(s.id, s.fullName, 'late')} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Late"><Clock size={16}/></button>
                                                  <button onClick={() => openAttendanceModal(s.id, s.fullName, 'absent')} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Absent"><XCircle size={16}/></button>
                                              </div>
                                          </td>
                                      )}
                                  </tr>
                              )
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- LEAVES TAB --- */}
      {activeTab === 'leaves' && (
          <div className="animate-in fade-in">
              <div className="flex justify-end mb-4">
                  <Button icon={Plus} onClick={() => setIsLeaveModalOpen(true)}>{t('staff_modal_leave_title')}</Button>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">{t('staff_form_role_title')}</th>
                              <th className="px-4 py-3">{t('appointments_form_type')}</th>
                              <th className="px-4 py-3">{t('date')}</th>
                              <th className="px-4 py-3">{t('patients_modal_action_reason')}</th>
                              <th className="px-4 py-3">{t('status')}</th>
                              {canManageHR && <th className="px-4 py-3 text-right">{t('actions')}</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {leaves.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('no_data')}</td></tr> : leaves.map(leave => (
                              <tr key={leave.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                  <td className="px-4 py-3 font-medium">{leave.staffName}</td>
                                  <td className="px-4 py-3 capitalize">{t(`hr_leave_${leave.type}`)}</td>
                                  <td className="px-4 py-3 text-slate-500">{new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}</td>
                                  <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{leave.reason}</td>
                                  <td className="px-4 py-3"><Badge color={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'yellow'}>{leave.status}</Badge></td>
                                  {canManageHR && leave.status === 'pending' && (
                                      <td className="px-4 py-3 text-right space-x-2">
                                          <button onClick={() => updateLeaveStatus(leave.id, 'approved')} className="text-green-600 hover:underline">{t('hr_approve')}</button>
                                          <button onClick={() => updateLeaveStatus(leave.id, 'rejected')} className="text-red-600 hover:underline">{t('hr_reject')}</button>
                                      </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- PAYROLL TAB --- */}
      {activeTab === 'payroll' && (
          <div className="animate-in fade-in">
              <div className="flex justify-between items-center mb-4">
                  <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-auto" />
                  {canManageHR && <Button icon={DollarSign} onClick={handleGeneratePayroll}>Generate Payroll</Button>}
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">{t('staff_form_role_title')}</th>
                              <th className="px-4 py-3 text-right">{t('staff_form_salary')}</th>
                              <th className="px-4 py-3 text-right">{t('hr_adj_bonus')}</th>
                              <th className="px-4 py-3 text-right">{t('staff_tab_financials')}</th>
                              <th className="px-4 py-3 text-right font-bold">Net Salary</th>
                              <th className="px-4 py-3 text-center">{t('status')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {payroll.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">{t('no_data')}</td></tr> : payroll.map(p => (
                              <tr key={p.id}>
                                  <td className="px-4 py-3 font-medium">{p.staffName}</td>
                                  <td className="px-4 py-3 text-right">${p.baseSalary.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-green-600">+${p.totalBonuses.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right text-red-600">-${p.totalFines.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">${p.netSalary.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-center"><Badge color={p.status === 'paid' ? 'green' : 'yellow'}>{p.status}</Badge></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- FINANCIALS TAB --- */}
      {activeTab === 'financials' && (
          <div className="animate-in fade-in">
              <div className="flex justify-end mb-4">
                  <Button icon={Plus} onClick={() => setIsAdjustmentModalOpen(true)}>{t('hr_add_entry')}</Button>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
                          <tr>
                              <th className="px-4 py-3">{t('date')}</th>
                              <th className="px-4 py-3">{t('staff_form_role_title')}</th>
                              <th className="px-4 py-3">{t('appointments_form_type')}</th>
                              <th className="px-4 py-3">{t('billing_table_header_amount')}</th>
                              <th className="px-4 py-3">{t('patients_modal_action_reason')}</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {financials.length === 0 ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">{t('no_data')}</td></tr> : financials.map(f => (
                              <tr key={f.id}>
                                  <td className="px-4 py-3 text-slate-500">{new Date(f.date).toLocaleDateString()}</td>
                                  <td className="px-4 py-3 font-medium">{f.staffName}</td>
                                  <td className="px-4 py-3 capitalize"><Badge color={f.type === 'bonus' ? 'green' : f.type === 'fine' ? 'red' : 'orange'}>{t(`hr_adj_${f.type}`)}</Badge></td>
                                  <td className="px-4 py-3 font-mono">${f.amount}</td>
                                  <td className="px-4 py-3 text-slate-500">{f.reason}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Attendance Modal (New) */}
      {attendanceModal && (
          <Modal isOpen={attendanceModal.isOpen} onClose={() => setAttendanceModal(null)} title={t('staff_attendance_modal_title')}>
              <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-500">{t('staff_form_role_title')}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{attendanceModal.staffName}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-500">{t('date')}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{selectedDate}</span>
                      </div>
                  </div>

                  <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">{t('staff_attendance_mark_as')}</label>
                      <div className="flex gap-4">
                          <select 
                            className="block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border"
                            value={attendanceModal.status}
                            onChange={(e) => setAttendanceModal({...attendanceModal, status: e.target.value as any})}
                          >
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="absent">Absent</option>
                          </select>
                      </div>
                  </div>

                  {['present', 'late'].includes(attendanceModal.status) && (
                      <div className="grid grid-cols-2 gap-4">
                        <Input 
                            type="time" 
                            label={t('staff_attendance_time')} 
                            required 
                            value={attendanceModal.checkIn} 
                            onChange={e => setAttendanceModal({...attendanceModal, checkIn: e.target.value})} 
                        />
                        {attendanceModal.isUpdate && (
                          <Input 
                              type="time" 
                              label="Check Out" 
                              value={attendanceModal.checkOut} 
                              onChange={e => setAttendanceModal({...attendanceModal, checkOut: e.target.value})} 
                          />
                        )}
                      </div>
                  )}

                  {attendanceModal.status === 'absent' && (
                      <p className="text-sm text-slate-500 italic">
                          {t('hr_absent_warning')}
                      </p>
                  )}

                  <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700 mt-6">
                      <Button type="button" variant="secondary" onClick={() => setAttendanceModal(null)}>{t('cancel')}</Button>
                      <Button type="submit">{t('staff_attendance_confirm')}</Button>
                  </div>
              </form>
          </Modal>
      )}

      {/* Staff Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={staffForm.id ? t('staff_modal_edit_title') : t('staff_modal_add_title')}>
          <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">{t('staff_form_personal_title')}</h4>
                  <Input label={t('patients_modal_form_fullName')} required value={staffForm.fullName || ''} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} />
                  <div className="grid grid-cols-2 gap-4">
                      <Input label={t('settings_profile_email')} type="email" value={staffForm.email || ''} onChange={e => setStaffForm({...staffForm, email: e.target.value})} />
                      <Input label={t('settings_profile_phone')} value={staffForm.phone || ''} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} />
                  </div>
                  <Input label={t('patients_modal_form_address')} value={staffForm.address || ''} onChange={e => setStaffForm({...staffForm, address: e.target.value})} />
              </div>

              <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">{t('staff_form_role_title')}</h4>
                  <div className="grid grid-cols-2 gap-4">
                      <Select label="Role" value={staffForm.type} onChange={handleTypeChange}>
                          {Object.keys(roleDepartmentMap).map(role => <option key={role} value={role} className="capitalize">{t(`staff_role_${role}`)}</option>)}
                      </Select>
                      <Select label={t('status')} value={staffForm.status} onChange={e => setStaffForm({...staffForm, status: e.target.value as any})}>
                          <option value="active">{t('staff_status_active')}</option>
                          <option value="inactive">{t('staff_status_inactive')}</option>
                          <option value="dismissed">{t('staff_status_dismissed')}</option>
                      </Select>
                  </div>
                  
                  {/* Department Select - Filtered by Role */}
                  <Select 
                    label={t('staff_select_department')} 
                    value={staffForm.department || ''} 
                    onChange={e => setStaffForm({...staffForm, department: e.target.value})}
                  >
                      <option value="">{t('staff_select_department')}</option>
                      {filteredDepartments.map(d => <option key={d.id} value={d.name_en}>{language === 'ar' ? d.name_ar : d.name_en}</option>)}
                  </Select>
                  
                  {/* Specialization Select - Filtered by Role */}
                  {filteredSpecializations.length > 0 && (
                    <Select 
                        label={t('staff_select_specialization')} 
                        value={staffForm.specialization || ''} 
                        onChange={e => setStaffForm({...staffForm, specialization: e.target.value})}
                    >
                        <option value="">{t('staff_select_specialization')}</option>
                        {filteredSpecializations.map(s => <option key={s.id} value={s.name_en}>{language === 'ar' ? s.name_ar : s.name_en}</option>)}
                    </Select>
                  )}
              </div>

              <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">{t('staff_form_schedule_title')}</h4>
                  <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day, i) => (
                          <button 
                              key={day} 
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${(staffForm.availableDays || []).includes(DAYS_OF_WEEK_EN[i]) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'}`}
                          >
                              {day}
                          </button>
                      ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Input type="time" label="Start Time" value={staffForm.availableTimeStart || ''} onChange={e => setStaffForm({...staffForm, availableTimeStart: e.target.value})} />
                      <Input type="time" label="End Time" value={staffForm.availableTimeEnd || ''} onChange={e => setStaffForm({...staffForm, availableTimeEnd: e.target.value})} />
                  </div>
              </div>

              <div className="space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">{t('staff_form_financial_title')}</h4>
                  <Input type="number" label={t('staff_form_salary')} value={staffForm.baseSalary} onChange={e => setStaffForm({...staffForm, baseSalary: e.target.value})} />
                  <div className="grid grid-cols-3 gap-3">
                      <Input type="number" label={t('staff_form_consultation_fee')} value={staffForm.consultationFee} onChange={e => setStaffForm({...staffForm, consultationFee: e.target.value})} />
                      <Input type="number" label={t('staff_form_followup_fee')} value={staffForm.consultationFeeFollowup} onChange={e => setStaffForm({...staffForm, consultationFeeFollowup: e.target.value})} />
                      <Input type="number" label={t('staff_form_emergency_fee')} value={staffForm.consultationFeeEmergency} onChange={e => setStaffForm({...staffForm, consultationFeeEmergency: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <Select label={t('staff_form_bank_name')} value={staffForm.bankName || ''} onChange={e => setStaffForm({...staffForm, bankName: e.target.value})}>
                          <option value="">Select Bank...</option>
                          {banks.map(bank => <option key={bank.id} value={bank.name_en}>{language === 'ar' ? bank.name_ar : bank.name_en}</option>)}
                      </Select>
                      <Input label={t('staff_form_bank_account')} value={staffForm.bankAccount || ''} onChange={e => setStaffForm({...staffForm, bankAccount: e.target.value})} />
                  </div>
                  <Input type="date" label={t('staff_join_date')} value={staffForm.joinDate || ''} onChange={e => setStaffForm({...staffForm, joinDate: e.target.value})} />
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t dark:border-slate-700">
                  <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                  <Button type="submit">{t('save')}</Button>
              </div>
          </form>
      </Modal>

      {/* Leave Request Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title={t('staff_modal_leave_title')}>
          <form onSubmit={handleLeaveRequest} className="space-y-4">
              <Select label={t('staff_form_role_title')} required value={leaveForm.staffId} onChange={e => setLeaveForm({...leaveForm, staffId: e.target.value})}>
                  <option value="">Select Staff...</option>
                  {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Select label={t('appointments_form_type')} value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
                  <option value="sick">{t('hr_leave_sick')}</option>
                  <option value="vacation">{t('hr_leave_vacation')}</option>
                  <option value="casual">{t('hr_leave_casual')}</option>
                  <option value="unpaid">{t('hr_leave_unpaid')}</option>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                  <Input type="date" label="Start Date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                  <Input type="date" label="End Date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
              </div>
              <Textarea label={t('patients_modal_action_reason')} rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
              <div className="flex justify-end pt-4 gap-3">
                  <Button type="button" variant="secondary" onClick={() => setIsLeaveModalOpen(false)}>{t('cancel')}</Button>
                  <Button type="submit">{t('submit')}</Button>
              </div>
          </form>
      </Modal>

      {/* Financial Adjustment Modal */}
      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title={t('hr_financial_adjustment')}>
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <Select label={t('staff_form_role_title')} required value={adjForm.staffId} onChange={e => setAdjForm({...adjForm, staffId: e.target.value})}>
                  <option value="">Select Staff...</option>
                  {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Select label={t('appointments_form_type')} value={adjForm.type} onChange={e => setAdjForm({...adjForm, type: e.target.value})}>
                  <option value="bonus">{t('hr_adj_bonus')}</option>
                  <option value="fine">{t('hr_adj_fine')}</option>
                  <option value="loan">{t('hr_adj_loan')}</option>
              </Select>
              <Input type="number" label={`${t('billing_table_header_amount')} ($)`} required value={adjForm.amount} onChange={e => setAdjForm({...adjForm, amount: e.target.value})} />
              <Input type="date" label={t('date')} required value={adjForm.date} onChange={e => setAdjForm({...adjForm, date: e.target.value})} />
              <Textarea label={t('patients_modal_action_reason')} rows={2} value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} />
              <div className="flex justify-end pt-4 gap-3">
                  <Button type="button" variant="secondary" onClick={() => setIsAdjustmentModalOpen(false)}>{t('cancel')}</Button>
                  <Button type="submit">{t('submit')}</Button>
              </div>
          </form>
      </Modal>

      {/* Confirmation Dialog */}
      <ConfirmationDialog 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
      />
    </div>
  );
};
