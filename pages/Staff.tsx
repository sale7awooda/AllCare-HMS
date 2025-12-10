
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, Mail, Phone, Briefcase, Lock, 
  LayoutGrid, List as ListIcon, User, Stethoscope, 
  CheckCircle, XCircle, Clock, Shield, Calendar, DollarSign, Wallet, FileText,
  AlertTriangle, TrendingUp, TrendingDown, Menu
} from 'lucide-react';
import { api } from '../services/api';
import { MedicalStaff, User as UserType, Attendance, LeaveRequest, PayrollRecord, FinancialAdjustment } from '../types';
import { hasPermission, Permissions } from '../utils/rbac';

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
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false); // Staff Add/Edit
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false); // Fine/Bonus/Loan
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false); // Request Leave
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // For attendance
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // For payroll YYYY-MM

  // Forms
  const [staffForm, setStaffForm] = useState<Partial<MedicalStaff>>({});
  const [adjForm, setAdjForm] = useState({ staffId: '', type: 'bonus', amount: '', reason: '', date: new Date().toISOString().split('T')[0] });
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'sick', startDate: '', endDate: '', reason: '' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [data, user] = await Promise.all([
        api.getStaff(),
        api.me()
      ]);
      setStaff(Array.isArray(data) ? data : []);
      setCurrentUser(user);
    } catch (e) {
      console.error("Failed to load staff data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Effect to load tab data when tab changes
  useEffect(() => {
    const fetchTabData = async () => {
        if (activeTab === 'attendance') {
            const data = await api.getAttendance(selectedDate);
            setAttendance(Array.isArray(data) ? data : []);
        } else if (activeTab === 'leaves') {
            const data = await api.getLeaves();
            setLeaves(Array.isArray(data) ? data : []);
        } else if (activeTab === 'payroll') {
            const data = await api.getPayroll(selectedMonth);
            setPayroll(Array.isArray(data) ? data : []);
        } else if (activeTab === 'financials') {
            const data = await api.getFinancials('all');
            setFinancials(Array.isArray(data) ? data : []);
        }
    };
    fetchTabData();
  }, [activeTab, selectedDate, selectedMonth]);

  const canManageHR = hasPermission(currentUser, Permissions.MANAGE_HR);

  // --- ACTIONS ---

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.fullName) return;
    try {
      if (staffForm.id) await api.updateStaff(staffForm.id, staffForm as any);
      else await api.addStaff(staffForm as any);
      setIsModalOpen(false);
      loadData();
      setStaffForm({});
    } catch (err: any) { alert(err.response?.data?.error); }
  };

  const openStaffModal = (s?: MedicalStaff) => {
      setStaffForm(s || { fullName: '', type: 'doctor', isAvailable: true, baseSalary: 0 });
      setIsModalOpen(true);
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
      // Refresh
      const data = await api.getAttendance(selectedDate);
      setAttendance(data);
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.requestLeave(leaveForm);
          setIsLeaveModalOpen(false);
          const data = await api.getLeaves();
          setLeaves(data);
      } catch (e) { alert('Failed'); }
  };

  const updateLeaveStatus = async (id: number, status: string) => {
      await api.updateLeaveStatus(id, status);
      const data = await api.getLeaves();
      setLeaves(data);
  };

  const handleGeneratePayroll = async () => {
      if(!confirm(`Generate payroll for ${selectedMonth}? This will overwrite existing drafts.`)) return;
      try {
          await api.generatePayroll({ month: selectedMonth });
          const data = await api.getPayroll(selectedMonth);
          setPayroll(data);
      } catch (e) { alert('Failed'); }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          await api.addAdjustment({ ...adjForm, amount: parseFloat(adjForm.amount) });
          setIsAdjustmentModalOpen(false);
          const data = await api.getFinancials('all');
          setFinancials(data);
      } catch (e) { alert('Failed'); }
  };

  // --- RENDER HELPERS ---

  const getRoleColor = (role: string) => {
    switch(role) {
      case 'doctor': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'nurse': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'technician': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Human Resources</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Staff directory, payroll, attendance, and leave management.</p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* --- DIRECTORY TAB --- */}
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
                  {staff.filter(s => s.fullName.toLowerCase().includes(searchTerm.toLowerCase())).map(person => (
                      <div key={person.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all">
                          <div className="flex justify-between items-start mb-4">
                              <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${getRoleColor(person.type)}`}>
                                  {person.fullName.charAt(0)}
                              </div>
                              <Badge color={person.isAvailable ? 'green' : 'gray'}>{person.isAvailable ? 'Active' : 'Off Duty'}</Badge>
                          </div>
                          
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">{person.fullName}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{person.specialization}</p>
                          <div className="text-xs font-mono bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300 w-fit mb-3">{person.employeeId}</div>

                          <div className="space-y-2 text-sm border-t border-slate-100 dark:border-slate-700 pt-3">
                              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>Department</span>
                                  <span className="font-medium text-slate-800 dark:text-slate-200">{person.department}</span>
                              </div>
                              {canManageHR && (
                                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                      <span>Salary</span>
                                      <span className="font-medium text-emerald-600">${person.baseSalary?.toLocaleString()}</span>
                                  </div>
                              )}
                              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>Phone</span>
                                  <span>{person.phone}</span>
                              </div>
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

      {/* --- ATTENDANCE TAB --- */}
      {activeTab === 'attendance' && (
          <Card className="!p-0 animate-in fade-in">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-4">
                      <h3 className="font-bold text-slate-700 dark:text-white">Daily Attendance</h3>
                      <input 
                        type="date" 
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                      />
                  </div>
                  <div className="flex gap-4 text-sm">
                      <span className="flex items-center gap-1 text-green-600 font-bold"><div className="w-2 h-2 rounded-full bg-green-500"></div> Present: {attendance.filter(a => a.status === 'present').length}</span>
                      <span className="flex items-center gap-1 text-red-500 font-bold"><div className="w-2 h-2 rounded-full bg-red-500"></div> Absent: {attendance.filter(a => a.status === 'absent').length}</span>
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Employee</th>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Check In</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Check Out</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                              {canManageHR && <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>}
                          </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                          {staff.map(person => {
                              const record = attendance.find(a => a.staffId === person.id);
                              return (
                                  <tr key={person.id}>
                                      <td className="px-6 py-4 font-medium text-sm text-slate-900 dark:text-white">{person.fullName}</td>
                                      <td className="px-6 py-4 text-sm text-slate-500 capitalize">{person.type}</td>
                                      <td className="px-6 py-4 text-center text-sm font-mono text-slate-600 dark:text-slate-300">{record?.checkIn || '--:--'}</td>
                                      <td className="px-6 py-4 text-center text-sm font-mono text-slate-600 dark:text-slate-300">{record?.checkOut || '--:--'}</td>
                                      <td className="px-6 py-4 text-center">
                                          {record ? (
                                              <Badge color={record.status === 'present' ? 'green' : record.status === 'late' ? 'yellow' : 'red'}>
                                                  {record.status}
                                              </Badge>
                                          ) : <span className="text-slate-400 text-xs">Not Marked</span>}
                                      </td>
                                      {canManageHR && (
                                          <td className="px-6 py-4 text-right">
                                              <div className="flex justify-end gap-2">
                                                  <button onClick={() => handleMarkAttendance(person.id, 'present')} className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100" title="Present"><CheckCircle size={16}/></button>
                                                  <button onClick={() => handleMarkAttendance(person.id, 'late')} className="p-1.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100" title="Late"><Clock size={16}/></button>
                                                  <button onClick={() => handleMarkAttendance(person.id, 'absent')} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Absent"><XCircle size={16}/></button>
                                              </div>
                                          </td>
                                      )}
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}

      {/* --- LEAVES TAB --- */}
      {activeTab === 'leaves' && (
          <div className="animate-in fade-in space-y-4">
              <div className="flex justify-end">
                  <Button onClick={() => setIsLeaveModalOpen(true)} icon={Plus}>Request Leave</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leaves.map(leave => (
                      <Card key={leave.id} className="relative border-l-4 border-l-primary-500">
                          <div className="flex justify-between items-start mb-2">
                              <div>
                                  <h4 className="font-bold text-slate-800 dark:text-white">{leave.staffName}</h4>
                                  <span className="text-xs text-slate-500 capitalize">{leave.type} Leave</span>
                              </div>
                              <Badge color={leave.status === 'approved' ? 'green' : leave.status === 'rejected' ? 'red' : 'yellow'}>{leave.status}</Badge>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded text-xs font-mono text-slate-600 dark:text-slate-300 mb-2">
                              {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 italic">"{leave.reason}"</p>
                          
                          {leave.status === 'pending' && canManageHR && (
                              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                  <Button size="sm" variant="primary" className="flex-1 bg-emerald-600" onClick={() => updateLeaveStatus(leave.id, 'approved')}>Approve</Button>
                                  <Button size="sm" variant="danger" className="flex-1" onClick={() => updateLeaveStatus(leave.id, 'rejected')}>Reject</Button>
                              </div>
                          )}
                      </Card>
                  ))}
              </div>
          </div>
      )}

      {/* --- PAYROLL TAB --- */}
      {activeTab === 'payroll' && canManageHR && (
          <Card className="!p-0 animate-in fade-in">
              <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-4">
                      <h3 className="font-bold text-slate-700 dark:text-white">Monthly Payroll</h3>
                      <input 
                        type="month" 
                        className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                      />
                  </div>
                  <Button onClick={handleGeneratePayroll} icon={DollarSign}>Run Payroll</Button>
              </div>
              <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                              <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Employee</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Base Salary</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-green-600 uppercase">Bonuses</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-red-500 uppercase">Deductions</th>
                              <th className="px-6 py-3 text-right text-xs font-bold text-slate-900 dark:text-white uppercase">Net Pay</th>
                              <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase">Status</th>
                          </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                          {payroll.length === 0 ? (
                              <tr><td colSpan={6} className="text-center py-8 text-slate-500">No payroll generated for this month.</td></tr>
                          ) : payroll.map(p => (
                              <tr key={p.id}>
                                  <td className="px-6 py-4 font-medium text-sm text-slate-900 dark:text-white">{p.staffName}</td>
                                  <td className="px-6 py-4 text-right text-sm font-mono text-slate-600 dark:text-slate-300">${p.baseSalary.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-sm font-mono text-green-600">+${p.totalBonuses.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-sm font-mono text-red-500">-${p.totalFines.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-right text-sm font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900/50">${p.netSalary.toLocaleString()}</td>
                                  <td className="px-6 py-4 text-center">
                                      <Badge color={p.status === 'paid' ? 'green' : 'gray'}>{p.status}</Badge>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}

      {/* --- FINANCIALS TAB --- */}
      {activeTab === 'financials' && canManageHR && (
          <div className="animate-in fade-in space-y-4">
              <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div>
                      <h3 className="font-bold text-slate-800 dark:text-white">Adjustments & Loans</h3>
                      <p className="text-sm text-slate-500">Manage one-time bonuses, fines, or staff loans.</p>
                  </div>
                  <div className="flex gap-2">
                      <Button variant="outline" className="text-green-600 border-green-200" onClick={() => { setAdjForm(prev => ({...prev, type: 'bonus'})); setIsAdjustmentModalOpen(true); }} icon={TrendingUp}>Add Bonus</Button>
                      <Button variant="outline" className="text-red-600 border-red-200" onClick={() => { setAdjForm(prev => ({...prev, type: 'fine'})); setIsAdjustmentModalOpen(true); }} icon={TrendingDown}>Add Fine</Button>
                      <Button variant="outline" className="text-blue-600 border-blue-200" onClick={() => { setAdjForm(prev => ({...prev, type: 'loan'})); setIsAdjustmentModalOpen(true); }} icon={Wallet}>Issue Loan</Button>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                  {financials.length === 0 && <p className="text-center py-8 text-slate-500">No records found.</p>}
                  {financials.map(item => (
                      <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-full ${item.type === 'bonus' ? 'bg-green-100 text-green-600' : item.type === 'fine' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {item.type === 'bonus' ? <TrendingUp size={20}/> : item.type === 'fine' ? <AlertTriangle size={20}/> : <Wallet size={20}/>}
                              </div>
                              <div>
                                  <h4 className="font-bold text-slate-800 dark:text-white">{item.staffName}</h4>
                                  <p className="text-sm text-slate-500 capitalize">{item.type} • {item.reason}</p>
                              </div>
                          </div>
                          <div className="text-right">
                              <p className={`text-lg font-bold font-mono ${item.type === 'bonus' ? 'text-green-600' : item.type === 'fine' ? 'text-red-600' : 'text-blue-600'}`}>
                                  {item.type === 'bonus' ? '+' : '-'}${item.amount.toLocaleString()}
                              </p>
                              <p className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- MODALS --- */}

      {/* 1. Staff Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Staff Details">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <Input label="Full Name" required value={staffForm.fullName || ''} onChange={e => setStaffForm({...staffForm, fullName: e.target.value})} />
          
          <div className="grid grid-cols-2 gap-4">
             <Select label="Role" value={staffForm.type} onChange={e => setStaffForm({...staffForm, type: e.target.value as any})}>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="technician">Technician</option>
              <option value="admin_staff">Admin Staff</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="hr_manager">HR Manager</option>
            </Select>
            <Input label="Department" required value={staffForm.department || ''} onChange={e => setStaffForm({...staffForm, department: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Specialization" value={staffForm.specialization || ''} onChange={e => setStaffForm({...staffForm, specialization: e.target.value})} />
            <Input label="Email" type="email" value={staffForm.email || ''} onChange={e => setStaffForm({...staffForm, email: e.target.value})} />
          </div>

          {canManageHR && (
              <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300">Financial Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                      <Input label="Base Salary ($)" type="number" value={staffForm.baseSalary} onChange={e => setStaffForm({...staffForm, baseSalary: parseFloat(e.target.value)})} />
                      <Input label="Consultation Fee ($)" type="number" value={staffForm.consultationFee} onChange={e => setStaffForm({...staffForm, consultationFee: parseFloat(e.target.value)})} />
                  </div>
                  <Input label="Bank Details" placeholder="Bank Name - Account Number" value={staffForm.bankDetails || ''} onChange={e => setStaffForm({...staffForm, bankDetails: e.target.value})} />
              </div>
          )}
          
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Staff</Button>
          </div>
        </form>
      </Modal>

      {/* 2. Adjustment Modal (Fine/Bonus/Loan) */}
      <Modal isOpen={isAdjustmentModalOpen} onClose={() => setIsAdjustmentModalOpen(false)} title={`Add ${adjForm.type.charAt(0).toUpperCase() + adjForm.type.slice(1)}`}>
          <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              <Select label="Employee" required value={adjForm.staffId} onChange={e => setAdjForm({...adjForm, staffId: e.target.value})}>
                  <option value="">Select Employee...</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Amount ($)" type="number" required value={adjForm.amount} onChange={e => setAdjForm({...adjForm, amount: e.target.value})} />
                  <Input label="Date" type="date" required value={adjForm.date} onChange={e => setAdjForm({...adjForm, date: e.target.value})} />
              </div>
              <Textarea label="Reason / Notes" required value={adjForm.reason} onChange={e => setAdjForm({...adjForm, reason: e.target.value})} />
              <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsAdjustmentModalOpen(false)}>Cancel</Button>
                  <Button type="submit" variant={adjForm.type === 'bonus' ? 'primary' : adjForm.type === 'loan' ? 'outline' : 'danger'}>
                      Confirm {adjForm.type.charAt(0).toUpperCase() + adjForm.type.slice(1)}
                  </Button>
              </div>
          </form>
      </Modal>

      {/* 3. Leave Request Modal */}
      <Modal isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)} title="Request Leave">
          <form onSubmit={handleLeaveRequest} className="space-y-4">
              <Select label="Employee" required value={leaveForm.staffId} onChange={e => setLeaveForm({...leaveForm, staffId: e.target.value})}>
                  <option value="">Select Employee...</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </Select>
              <Select label="Leave Type" value={leaveForm.type} onChange={e => setLeaveForm({...leaveForm, type: e.target.value})}>
                  <option value="sick">Sick Leave</option>
                  <option value="vacation">Vacation</option>
                  <option value="casual">Casual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
              </Select>
              <div className="grid grid-cols-2 gap-4">
                  <Input label="Start Date" type="date" required value={leaveForm.startDate} onChange={e => setLeaveForm({...leaveForm, startDate: e.target.value})} />
                  <Input label="End Date" type="date" required value={leaveForm.endDate} onChange={e => setLeaveForm({...leaveForm, endDate: e.target.value})} />
              </div>
              <Textarea label="Reason" required value={leaveForm.reason} onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})} />
              <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setIsLeaveModalOpen(false)}>Cancel</Button>
                  <Button type="submit">Submit Request</Button>
              </div>
          </form>
      </Modal>

    </div>
  );
};
