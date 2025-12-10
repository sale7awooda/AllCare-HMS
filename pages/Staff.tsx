import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Plus, Search, Briefcase, Clock, 
  Calendar, DollarSign, Wallet,
  AlertTriangle, TrendingUp, TrendingDown, CheckCircle, User, Phone, Mail,
  Loader2, XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, User as UserType, Attendance, LeaveRequest, PayrollRecord, FinancialAdjustment } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const Staff = () => {
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'leaves' | 'payroll' | 'financials'>('directory');
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Tab specific data
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [payroll, setPayroll] = useState<PayrollRecord[]>([]);
  const [financials, setFinancials] = useState<FinancialAdjustment[]>([]);
  
  // Catalogs for dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);

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
  const [staffForm, setStaffForm] = useState<Partial<MedicalStaff & { bankName?: string, bankAccount?: string }>>({});
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'sick', startDate: '', endDate: '', reason: '' });

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [data, user, depts, specs] = await Promise.all([
        api.getStaff(),
        api.me(),
        api.getDepartments(),
        api.getSpecializations()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setCurrentUser(user);
      setDepartments(Array.isArray(depts) ? depts : []);
      setSpecializations(Array.isArray(specs) ? specs : []);
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
    setProcessMessage(staffForm.id ? 'Updating staff...' : 'Creating staff...');

    const { bankName, bankAccount, ...restOfForm } = staffForm;
    const payload = {
        ...restOfForm,
        bankDetails: { bankName, bankAccount }
    };
    
    try {
      if (payload.id) await api.updateStaff(payload.id, payload);
      else await api.addStaff(payload);
      
      setProcessStatus('success');
      setProcessMessage(staffForm.id ? 'Staff updated successfully' : 'Staff created successfully');
      
      await loadData(true);

      setTimeout(() => {
        setIsModalOpen(false);
        setProcessStatus('idle');
      }, 500);
      
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || 'Failed to save staff');
    }
  };

  const openStaffModal = (s?: MedicalStaff) => {
      let bankDetailsParsed = { bankName: '', bankAccount: '' };
      if (s?.bankDetails) {
          if (typeof s.bankDetails === 'object' && s.bankDetails !== null) {
              bankDetailsParsed = { bankName: s.bankDetails.bankName, bankAccount: s.bankDetails.bankAccount };
          } else if (typeof s.bankDetails === 'string') {
              // Handle old plain string format for backward compatibility
              bankDetailsParsed = { bankName: s.bankDetails, bankAccount: '' };
          }
      }

      const formState = s ? { ...s, ...bankDetailsParsed } : { 
          fullName: '', type: 'doctor', status: 'active', baseSalary: 0, 
          availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          availableTimeStart: '09:00', availableTimeEnd: '17:00',
          consultationFee: 0, consultationFeeFollowup: 0, consultationFeeEmergency: 0,
          joinDate: new Date().toISOString().split('T')[0],
          ...bankDetailsParsed
      };
      setStaffForm(formState);
      setIsModalOpen(true);
  };

  // Other handlers (attendance, leave, etc.) remain the same...

  const toggleDay = (day: string) => {
      const currentDays = staffForm.availableDays || [];
      if (currentDays.includes(day)) {
          setStaffForm({ ...staffForm, availableDays: currentDays.filter(d => d !== day) });
      } else {
          setStaffForm({ ...staffForm, availableDays: [...currentDays, day] });
      }
  };

  const handleMarkAttendance = async (staffId: number, status: string) => {
      const now = new Date();
      const timeString = now.toTimeString().slice(0, 5);
      await api.markAttendance({
          staffId, 
          date: selectedDate, 
          status,
          checkIn: status === 'present' || status === 'late' ? timeString : null
      });
      const data = await api.getAttendance(selectedDate);
      setAttendance(data);
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
          title: 'Generate Payroll',
          message: `Generate payroll for ${selectedMonth}? This will calculate salaries based on attendance and adjustments, overwriting any existing drafts for this month.`,
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

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'doctor': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'nurse': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'technician': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };
  
  const getStatusColor = (status: 'active' | 'inactive' | 'dismissed') => {
    switch(status) {
      case 'active': return 'green';
      case 'inactive': return 'yellow';
      case 'dismissed': return 'red';
      default: return 'gray';
    }
  };

  const formatDays = (days?: string[]) => {
    if (!days || days.length === 0) return 'None';
    if (days.length === 7) return 'Every Day';
    if (days.length === 5 && !days.includes('Sat') && !days.includes('Sun')) return 'Mon-Fri';
    return days.map(d => d.substring(0, 3)).join(', ');
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
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95 border dark:border-slate-700">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Processing</h3>
                <p className="text-slate-500 dark:text-slate-400">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 text-green-600 dark:text-green-400 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Success!</h3>
                <p className="text-slate-600 dark:text-slate-300 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 text-red-600 dark:text-red-400 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Action Failed</h3>
                <p className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl border border-red-100 dark:border-red-900/50 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">Close</Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Human Resources</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Staff directory, payroll, attendance, and leave management.</p>
        </div>
      </div>

      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {[
              { id: 'directory', label: 'Directory', icon: Briefcase },
              { id: 'attendance', label: 'Attendance', icon: Clock },
              { id: 'leaves', label: 'Leaves', icon: Calendar },
              { id: 'payroll', label: 'Payroll', icon: DollarSign },
              { id: 'financials', label: 'Loans & Fines', icon: Wallet },
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

      {activeTab === 'directory' && (
          <div className="animate-in fade-in">
              <div className="flex justify-between mb-4">
                  <div className="relative w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder="Search staff..." 
                        className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                  </div>
                  {canManageHR && <Button onClick={() => openStaffModal()} icon={Plus}>Add Employee</Button>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {sortedStaff.map(person => (
                      <div key={person.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-full">
                          <div className="flex justify-between items-start mb-4">
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${getRoleColor(person.type)}`}>
                                  {person.fullName.charAt(0)}
                              </div>
                              <Badge color={getStatusColor(person.status)}>{person.status}</Badge>
                          </div>
                          
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate" title={person.fullName}>{person.fullName}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{person.specialization}</p>
                          <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 w-fit mb-3">{person.employeeId}</div>

                          <div className="flex-1 space-y-2 text-sm border-t border-slate-100 dark:border-slate-700 pt-3">
                              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>Department</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{person.department}</span>
                              </div>
                              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>Shift</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{person.availableTimeStart} - {person.availableTimeEnd}</span>
                              </div>
                              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>Working Days</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs truncate max-w-[120px]" title={person.availableDays?.join(', ')}>
                                    {formatDays(person.availableDays)}
                                  </span>
                              </div>
                              {person.type === 'doctor' && (
                                <div className="mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-700">
                                   <div className="flex justify-between items-center text-xs">
                                      <span className="text-slate-500">Consultation</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-300">${person.consultationFee}</span>
                                   </div>
                                </div>
                              )}
                          </div>
                          
                          {canManageHR && (
                              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                  <Button size="sm" variant="outline" onClick={() => openStaffModal(person)}>Edit Profile</Button>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* Other tabs remain the same... */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={staffForm.id ? "Edit Staff" : "Add Staff Member"}>
        <form onSubmit={handleCreateStaff} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 flex items-center gap-2"><User size={16}/> Personal Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Full Name" required value={staffForm.fullName || ''} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} />
              <Input label="Phone" value={staffForm.phone || ''} onChange={e => setStaffForm({...staffForm, phone: e.target.value})} prefix={<Phone size={14}/>} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Email" type="email" value={staffForm.email || ''} onChange={e => setStaffForm({...staffForm, email: e.target.value})} prefix={<Mail size={14}/>} />
              <Input label="Join Date" type="date" value={staffForm.joinDate || ''} onChange={e => setStaffForm({...staffForm, joinDate: e.target.value})} />
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 flex items-center gap-2"><Briefcase size={16}/> Role & Department</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Role" value={staffForm.type} onChange={e => setStaffForm({...staffForm, type: e.target.value as any})}>
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="technician">Technician</option>
                <option value="anesthesiologist">Anesthesiologist</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="admin_staff">Admin Staff</option>
                <option value="hr_manager">HR Manager</option>
              </Select>
              <Select label="Department" required value={staffForm.department || ''} onChange={e => setStaffForm({...staffForm, department: e.target.value})}>
                <option value="">Select department...</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </Select>
            </div>
            <Select label="Specialization" value={staffForm.specialization || ''} onChange={e => setStaffForm({...staffForm, specialization: e.target.value})}>
              <option value="">Select specialization...</option>
              {specializations.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 flex items-center gap-2"><Clock size={16}/> Schedule & Status</h4>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                    <button type="button" key={day} onClick={() => toggleDay(day)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${staffForm.availableDays?.includes(day) ? 'bg-primary-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'}`}>
                        {day}
                    </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Start Time" type="time" value={staffForm.availableTimeStart || ''} onChange={e => setStaffForm({...staffForm, availableTimeStart: e.target.value})} />
                <Input label="End Time" type="time" value={staffForm.availableTimeEnd || ''} onChange={e => setStaffForm({...staffForm, availableTimeEnd: e.target.value})} />
              </div>
              <Select label="Status" value={staffForm.status} onChange={e => setStaffForm({...staffForm, status: e.target.value as any})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="dismissed">Dismissed</option>
              </Select>
            </div>
          </div>
          {canManageHR && (
            <div className="space-y-4">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b dark:border-slate-700 pb-1 flex items-center gap-2"><Wallet size={16}/> Financial Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label="Base Monthly Salary ($)" type="number" value={staffForm.baseSalary} onChange={e => setStaffForm({...staffForm, baseSalary: parseFloat(e.target.value)})} />
                    <Input label="Bank Name" placeholder="e.g. Bank of Khartoum" value={staffForm.bankName || ''} onChange={e => setStaffForm({...staffForm, bankName: e.target.value})} />
                </div>
                <Input label="Bank Account Number (IBAN)" placeholder="Account Number..." value={staffForm.bankAccount || ''} onChange={e => setStaffForm({...staffForm, bankAccount: e.target.value})} />
                
                {staffForm.type === 'doctor' && (
                    <div className="grid grid-cols-3 gap-3 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                        <Input label="Consultation Fee" type="number" value={staffForm.consultationFee} onChange={e => setStaffForm({...staffForm, consultationFee: parseFloat(e.target.value)})} className="bg-white" />
                        <Input label="Follow-up Fee" type="number" value={staffForm.consultationFeeFollowup} onChange={e => setStaffForm({...staffForm, consultationFeeFollowup: parseFloat(e.target.value)})} className="bg-white" />
                        <Input label="Emergency Fee" type="number" value={staffForm.consultationFeeEmergency} onChange={e => setStaffForm({...staffForm, consultationFeeEmergency: parseFloat(e.target.value)})} className="bg-white" />
                    </div>
                )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{staffForm.id ? 'Update Staff' : 'Create Staff'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title="Request Leave">
          <form onSubmit={handleLeaveRequest} className="space-y-4">
              <Select label="Staff Member" required value={leaveForm.staffId} onChange={e => setLeaveForm({...leaveForm, staffId: e.target.value})}>
                  <option value="">Select yourself...</option>
                  {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Select label="Type" value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="vacation">Vacation</option>
                  <option value="unpaid">Unpaid Leave</option>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Start Date" type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                  <Input label="End Date" type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
              </div>
              <Textarea label="Reason" required rows={3} value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
              <div className="flex justify-end pt-2">
                  <Button type="submit">Submit Request</Button>
              </div>
          </form>
      </Modal>

      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title={`Add ${adjForm.type === 'loan' ? 'Loan' : adjForm.type === 'bonus' ? 'Bonus' : 'Fine'}`}>
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <Select label="Staff Member" required value={adjForm.staffId} onChange={e => setAdjForm({...adjForm, staffId: e.target.value})}>
                  <option value="">Select staff...</option>
                  {staff.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Input label="Amount ($)" type="number" required value={adjForm.amount} onChange={e => setAdjForm({...adjForm, amount: e.target.value})} />
              <Input label="Date" type="date" required value={adjForm.date} onChange={e => setAdjForm({...adjForm, date: e.target.value})} />
              <Textarea label="Reason / Notes" required rows={2} value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} />
              <div className="flex justify-end pt-2">
                  <Button type="submit" variant={adjForm.type === 'fine' ? 'danger' : 'primary'}>Confirm</Button>
              </div>
          </form>
      </Modal>

      <ConfirmationDialog 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        type="warning"
      />
    </div>
  );
};