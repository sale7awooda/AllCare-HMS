
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save, Edit, Bed, Users, Loader2, CheckCircle, XCircle, AlertTriangle, Upload, Download, Server, CreditCard } from 'lucide-react';
import { api } from '../services/api';
import { LabTestCatalog, NurseServiceCatalog, OperationCatalog, Bed as BedType, User, Role, TaxRate, PaymentMethod } from '../types';

export const Configuration = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'departments' | 'beds' | 'catalogs' | 'users' | 'data' | 'financial'>('general');
  const [loading, setLoading] = useState(true);
  
  // Process Status for Overlay
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Settings State
  const [settings, setSettings] = useState({
    hospitalName: '',
    hospitalAddress: '',
    hospitalPhone: '',
    currency: '$'
  });

  // Departments State
  const [departments, setDepartments] = useState<any[]>([]);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<any>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  // Beds State
  const [beds, setBeds] = useState<BedType[]>([]);
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [bedForm, setBedForm] = useState<Partial<BedType>>({});
  const [editingBedId, setEditingBedId] = useState<number | null>(null);

  // Catalogs State
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [catalogTab, setCatalogTab] = useState<'lab' | 'nurse' | 'ops'>('lab');
  
  // Modal State for Catalogs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemFormData, setItemFormData] = useState<any>({});
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  // Financial State
  const [taxes, setTaxes] = useState<TaxRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [financeForm, setFinanceForm] = useState<any>({});
  const [editingFinanceId, setEditingFinanceId] = useState<number | null>(null);
  const [financeType, setFinanceType] = useState<'tax' | 'payment'>('tax');
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);

  // Data Management State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, d, b, l, n, o, u, t, p] = await Promise.all([
        api.getSystemSettings(),
        api.getDepartments(),
        api.getConfigBeds(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getOperations(),
        api.getSystemUsers(),
        api.getTaxRates(),
        api.getPaymentMethods()
      ]);
      if (s) setSettings(s);
      setDepartments(Array.isArray(d) ? d : []);
      setBeds(Array.isArray(b) ? b : []);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setOperations(Array.isArray(o) ? o : []);
      setUsers(Array.isArray(u) ? u : []);
      setTaxes(Array.isArray(t) ? t : []);
      setPaymentMethods(Array.isArray(p) ? p : []);
    } catch (e) {
      console.error("Failed to load config data", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Helper to handle async actions with feedback ---
  const handleAction = async (action: () => Promise<void>, successMsg: string) => {
    setProcessStatus('processing');
    setProcessMessage('Processing...');
    try {
      await action();
      setProcessStatus('success');
      setProcessMessage(successMsg);
      await loadAllData(true); // Refresh data silently
      setTimeout(() => {
        setProcessStatus('idle');
        setProcessMessage('');
      }, 1500);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || e.message || 'An error occurred');
    }
  };

  // --- Handlers ---

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      await api.updateSystemSettings(settings);
    }, 'Settings saved successfully');
  };

  // User Handlers
  const openUserModal = (user?: any) => {
    if (user) {
      setEditingUserId(user.id);
      setUserForm({ ...user, password: '' });
    } else {
      setEditingUserId(null);
      setUserForm({ username: '', fullName: '', role: 'doctor', isActive: true });
    }
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (editingUserId) await api.updateSystemUser(editingUserId, userForm);
      else await api.addSystemUser(userForm);
      setIsUserModalOpen(false);
    }, editingUserId ? 'User updated' : 'User created');
  };

  const handleDeleteUser = (id: number) => {
    if (confirm('Are you sure? This will delete the user account.')) {
      handleAction(async () => await api.deleteSystemUser(id), 'User deleted');
    }
  };

  // Departments Handlers
  const handleDeptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name) return;
    handleAction(async () => {
      if (editingDeptId) await api.updateDepartment(editingDeptId, deptForm.name, deptForm.description);
      else await api.addDepartment(deptForm.name, deptForm.description);
      setDeptForm({ name: '', description: '' });
      setEditingDeptId(null);
    }, editingDeptId ? 'Department updated' : 'Department added');
  };

  const handleEditDept = (dept: any) => {
    setDeptForm({ name: dept.name, description: dept.description });
    setEditingDeptId(dept.id);
  };

  const handleCancelDeptEdit = () => {
    setDeptForm({ name: '', description: '' });
    setEditingDeptId(null);
  };

  const handleDeleteDept = (id: number) => {
    if (confirm('Are you sure? This will permanently delete the department.')) {
      handleAction(async () => await api.deleteDepartment(id), 'Department deleted');
    }
  };

  // Bed Handlers
  const openBedModal = (bed?: BedType) => {
    if (bed) {
      setEditingBedId(bed.id);
      setBedForm({ ...bed });
    } else {
      setEditingBedId(null);
      setBedForm({ type: 'General', status: 'available', costPerDay: 0 });
    }
    setIsBedModalOpen(true);
  };

  const handleBedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (editingBedId) await api.updateBed(editingBedId, bedForm);
      else await api.addBed(bedForm);
      setIsBedModalOpen(false);
    }, editingBedId ? 'Room updated' : 'Room added');
  };

  const handleDeleteBed = (id: number) => {
    if (confirm('Delete this room/bed?')) {
      handleAction(async () => await api.deleteBed(id), 'Room deleted');
    }
  };

  // Catalogs Handlers
  const openItemModal = (item?: any) => {
    if (item) {
      setEditingItemId(item.id);
      setItemFormData({ ...item });
    } else {
      setEditingItemId(null);
      setItemFormData({});
    }
    setIsModalOpen(true);
  };

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (catalogTab === 'lab') {
        if (editingItemId) await api.updateLabTest(editingItemId, itemFormData);
        else await api.addLabTest(itemFormData);
      } else if (catalogTab === 'nurse') {
        if (editingItemId) await api.updateNurseService(editingItemId, itemFormData);
        else await api.addNurseService(itemFormData);
      } else if (catalogTab === 'ops') {
        const payload = { name: itemFormData.name, baseCost: parseFloat(itemFormData.baseCost) };
        if (editingItemId) await api.updateOperationCatalog(editingItemId, payload);
        else await api.addOperationCatalog(payload);
      }
      setIsModalOpen(false);
    }, editingItemId ? 'Item updated' : 'Item added');
  };

  const handleDeleteItem = (id: number, type: 'lab' | 'nurse' | 'ops') => {
    if (!confirm('Delete this item? This cannot be undone.')) return;
    handleAction(async () => {
      if (type === 'lab') await api.deleteLabTest(id);
      if (type === 'nurse') await api.deleteNurseService(id);
      if (type === 'ops') await api.deleteOperationCatalog(id);
    }, 'Item deleted');
  };

  // Financial Handlers
  const openFinanceModal = (type: 'tax' | 'payment', item?: any) => {
    setFinanceType(type);
    if (item) {
      setEditingFinanceId(item.id);
      setFinanceForm({ ...item });
    } else {
      setEditingFinanceId(null);
      setFinanceForm({ name: '', rate: 0, isActive: true });
    }
    setIsFinanceModalOpen(true);
  };

  const handleFinanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (financeType === 'tax') {
        if (editingFinanceId) await api.updateTaxRate(editingFinanceId, financeForm);
        else await api.addTaxRate(financeForm);
      } else {
        if (editingFinanceId) await api.updatePaymentMethod(editingFinanceId, financeForm);
        else await api.addPaymentMethod(financeForm);
      }
      setIsFinanceModalOpen(false);
    }, editingFinanceId ? 'Updated successfully' : 'Created successfully');
  };

  const handleDeleteFinance = (id: number, type: 'tax' | 'payment') => {
    if (!confirm('Delete this item?')) return;
    handleAction(async () => {
      if (type === 'tax') await api.deleteTaxRate(id);
      else await api.deletePaymentMethod(id);
    }, 'Deleted successfully');
  };

  // Data Management Handlers
  const handleDownloadBackup = () => {
    api.downloadBackup();
  };

  const handleRestoreDatabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;
    if (!confirm('CRITICAL WARNING: This will OVERWRITE your entire database. All current data will be lost. Are you absolutely sure?')) return;

    handleAction(async () => {
      await api.restoreDatabase(restoreFile);
      // Force reload page after restore to clear any stale state
      setTimeout(() => window.location.reload(), 1500);
    }, 'Database restored successfully. Reloading...');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 overflow-x-auto">
        {[
          { id: 'general', icon: SettingsIcon, label: 'General' },
          { id: 'users', icon: Users, label: 'Users & Roles' },
          { id: 'financial', icon: CreditCard, label: 'Financial' },
          { id: 'departments', icon: Building, label: 'Departments' },
          { id: 'beds', icon: Bed, label: 'Rooms & Beds' },
          { id: 'catalogs', icon: Database, label: 'Medical Catalogs' },
          { id: 'data', icon: Server, label: 'Data Management' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-5 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap 
              ${activeTab === tab.id 
                ? 'border-primary-600 text-primary-600 bg-primary-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            <tab.icon size={18}/> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6 min-h-[400px] relative">
        {/* Loading State for Tab Content */}
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-2" />
            <p>Loading configuration...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* GENERAL SETTINGS TAB */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveSettings} className="max-w-xl space-y-6 animate-in fade-in slide-in-from-left-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex gap-3">
                  <Wrench className="shrink-0 mt-0.5" size={18}/>
                  <div>
                    <p className="font-bold">System Information</p>
                    <p>Update global settings that appear on reports, invoices, and the dashboard.</p>
                  </div>
                </div>
                <Input label="Hospital Name" value={settings.hospitalName} onChange={e => setSettings({...settings, hospitalName: e.target.value})} />
                <Input label="Address" value={settings.hospitalAddress} onChange={e => setSettings({...settings, hospitalAddress: e.target.value})} />
                <div className="grid grid-cols-2 gap-6">
                  <Input label="Phone" value={settings.hospitalPhone} onChange={e => setSettings({...settings, hospitalPhone: e.target.value})} />
                  <Input label="Currency Symbol" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} className="w-20 text-center font-bold" />
                </div>
                <div className="pt-4 border-t">
                  <Button type="submit" icon={Save}>Save Settings</Button>
                </div>
              </form>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">System Users</h3>
                    <p className="text-sm text-gray-500">Manage staff access and roles.</p>
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => openUserModal()}>Add User</Button>
                </div>
                
                {users.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No users found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">User</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Role</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Email</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs mr-3">
                                  {(u.fullName || u.username || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{u.fullName || u.username}</div>
                                  <div className="text-xs text-gray-500 font-mono">@{u.username}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm capitalize"><Badge color="blue">{u.role}</Badge></td>
                            <td className="px-4 py-3 text-sm text-gray-500">{u.email || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button onClick={() => openUserModal(u)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                              <button onClick={() => handleDeleteUser(u.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* FINANCIAL TAB */}
            {activeTab === 'financial' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4">
                {/* Tax Rates */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">Tax Rates</h3>
                    <Button size="sm" icon={Plus} onClick={() => openFinanceModal('tax')}>Add Tax</Button>
                  </div>
                  <div className="border rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Rate (%)</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {taxes.map(t => (
                          <tr key={t.id}>
                            <td className="px-4 py-3 text-sm font-medium">{t.name}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono">{t.rate}%</td>
                            <td className="px-4 py-3 text-center"><Badge color={t.isActive ? 'green' : 'gray'}>{t.isActive ? 'Active' : 'Inactive'}</Badge></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => openFinanceModal('tax', t)} className="p-1 text-slate-400 hover:text-primary-600"><Edit size={14}/></button>
                                <button onClick={() => handleDeleteFinance(t.id, 'tax')} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Methods */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-800 text-lg">Payment Methods</h3>
                    <Button size="sm" icon={Plus} onClick={() => openFinanceModal('payment')}>Add Method</Button>
                  </div>
                  <div className="border rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50/80">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-right w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paymentMethods.map(p => (
                          <tr key={p.id}>
                            <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                            <td className="px-4 py-3 text-center"><Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Active' : 'Inactive'}</Badge></td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-1">
                                <button onClick={() => openFinanceModal('payment', p)} className="p-1 text-slate-400 hover:text-primary-600"><Edit size={14}/></button>
                                <button onClick={() => handleDeleteFinance(p.id, 'payment')} className="p-1 text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* DEPARTMENTS TAB */}
            {activeTab === 'departments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-left-4">
                <div className="lg:col-span-1 space-y-4 border-r border-gray-100 pr-6">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                      {editingDeptId ? <Edit size={16} className="text-primary-600"/> : <Plus size={16} className="text-green-600"/>}
                      {editingDeptId ? 'Edit Department' : 'Add Department'}
                    </h3>
                    <form onSubmit={handleDeptSubmit} className="space-y-4">
                      <Input label="Name" placeholder="e.g. Neurology" required value={deptForm.name} onChange={e => setDeptForm({...deptForm, name: e.target.value})} />
                      <Textarea label="Description" rows={3} placeholder="Optional details..." value={deptForm.description} onChange={e => setDeptForm({...deptForm, description: e.target.value})} />
                      <div className="flex gap-2 pt-2">
                        <Button type="submit" icon={editingDeptId ? Save : Plus} className="flex-1">{editingDeptId ? 'Update' : 'Add'}</Button>
                        {editingDeptId && <Button type="button" variant="secondary" onClick={handleCancelDeptEdit}>Cancel</Button>}
                      </div>
                    </form>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <h3 className="font-bold text-gray-800 mb-4">Existing Departments ({departments.length})</h3>
                  {departments.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed text-gray-400">
                      No departments added yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                      {departments.map(dept => (
                        <div key={dept.id} className="p-4 border border-gray-200 rounded-xl flex justify-between items-start bg-white hover:shadow-md hover:border-primary-200 transition-all group">
                          <div>
                            <p className="font-bold text-gray-800">{dept.name}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{dept.description || 'No description'}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditDept(dept)} className="text-slate-400 hover:text-primary-600 p-1.5 hover:bg-slate-50 rounded transition-colors">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleDeleteDept(dept.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* BEDS TAB */}
            {activeTab === 'beds' && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">Hospital Rooms & Beds</h3>
                    <p className="text-sm text-gray-500">Configure availability and pricing.</p>
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => openBedModal()}>Add Room</Button>
                </div>
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Room No</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost/Day</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {beds.map(bed => (
                        <tr key={bed.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{bed.roomNumber}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{bed.type}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-700">${bed.costPerDay}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge color={bed.status === 'available' ? 'green' : bed.status === 'maintenance' ? 'yellow' : 'red'}>
                              {bed.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openBedModal(bed)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                            <button onClick={() => handleDeleteBed(bed.id)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MEDICAL CATALOGS TAB */}
            {activeTab === 'catalogs' && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                    {[
                      { id: 'lab', label: 'Lab Tests' },
                      { id: 'nurse', label: 'Nurse Services' },
                      { id: 'ops', label: 'Operations' }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setCatalogTab(t.id as any)} 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${catalogTab === t.id ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => openItemModal()}>Add Item</Button>
                </div>

                <div className="overflow-x-auto border rounded-xl shadow-sm min-h-[300px]">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50/80">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                          {catalogTab === 'lab' ? 'Category / Details' : catalogTab === 'nurse' ? 'Description' : 'Details'}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost</th>
                        <th className="px-4 py-3 text-right w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {catalogTab === 'lab' && labTests.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            <div>{item.category}</div>
                            {item.normalRange && <div className="text-xs text-gray-400 mt-0.5">Range: {item.normalRange}</div>}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-700">${item.cost}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openItemModal(item)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                            <button onClick={() => handleDeleteItem(item.id, 'lab')} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                      {catalogTab === 'nurse' && nurseServices.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.description}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-700">${item.cost}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openItemModal(item)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                            <button onClick={() => handleDeleteItem(item.id, 'nurse')} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                      {catalogTab === 'ops' && operations.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-300 italic">-</td>
                          <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-700">${item.baseCost}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button onClick={() => openItemModal(item)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                            <button onClick={() => handleDeleteItem(item.id, 'ops')} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DATA MANAGEMENT TAB */}
            {activeTab === 'data' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-left-4">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Download size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Backup Database</h3>
                  <p className="text-sm text-gray-500 mb-6 px-4">Download a full SQL dump of the current system database. Useful for manual backups and migration.</p>
                  <Button onClick={handleDownloadBackup} icon={Download}>Download SQL Dump</Button>
                </div>

                <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Restore Database</h3>
                  <p className="text-sm text-red-600 mb-6 px-4 font-medium">WARNING: This will overwrite all current data. Proceed with caution.</p>
                  
                  <form onSubmit={handleRestoreDatabase} className="w-full max-w-xs space-y-4">
                    <input 
                      type="file" 
                      accept=".db,.sqlite,.sql" 
                      onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-100 file:text-red-700 hover:file:bg-red-200"
                    />
                    <Button 
                      type="submit" 
                      disabled={!restoreFile} 
                      variant="danger" 
                      className="w-full"
                      icon={Upload}
                    >
                      Restore Data
                    </Button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* PROCESS STATUS OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 relative overflow-hidden text-center transform scale-100 animate-in zoom-in-95">
            {processStatus === 'processing' && (
              <>
                <div className="relative mb-6">
                   <div className="w-16 h-16 border-4 border-slate-100 border-t-primary-600 rounded-full animate-spin"></div>
                   <Loader2 className="absolute inset-0 m-auto text-primary-600 animate-pulse" size={24}/>
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Processing</h3>
                <p className="text-slate-500">{processMessage}</p>
              </>
            )}
            {processStatus === 'success' && (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 animate-in zoom-in duration-300">
                  <CheckCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Success!</h3>
                <p className="text-slate-600 font-medium">{processMessage}</p>
              </>
            )}
            {processStatus === 'error' && (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600 animate-in zoom-in duration-300">
                  <XCircle size={40} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Action Failed</h3>
                <p className="text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm mb-6 w-full">{processMessage}</p>
                <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">Close</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      
      {/* Item Modal (Lab, Nurse, Ops) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingItemId ? 'Edit' : 'Add'} ${catalogTab === 'lab' ? 'Lab Test' : catalogTab === 'nurse' ? 'Nurse Service' : 'Operation'}`}>
        <form onSubmit={handleItemSubmit} className="space-y-4">
          <Input label="Name" required value={itemFormData.name || ''} onChange={e => setItemFormData({...itemFormData, name: e.target.value})} />
          {catalogTab === 'lab' && (
            <>
              <Input label="Category" placeholder="e.g. Hematology" value={itemFormData.category || ''} onChange={e => setItemFormData({...itemFormData, category: e.target.value})} />
              <Input label="Normal Range" placeholder="e.g. 13.5 - 17.5 g/dL" value={itemFormData.normalRange || ''} onChange={e => setItemFormData({...itemFormData, normalRange: e.target.value})} />
            </>
          )}
          {catalogTab === 'nurse' && (
            <Input label="Description" placeholder="Brief description" value={itemFormData.description || ''} onChange={e => setItemFormData({...itemFormData, description: e.target.value})} />
          )}
          <Input 
            label="Cost" 
            prefix={settings.currency}
            type="number" 
            step="0.01" 
            required 
            value={catalogTab === 'ops' ? itemFormData.baseCost : itemFormData.cost} 
            onChange={e => setItemFormData({...itemFormData, [catalogTab === 'ops' ? 'baseCost' : 'cost']: e.target.value})} 
          />
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingItemId ? 'Update Item' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>

      {/* Bed Modal */}
      <Modal isOpen={isBedModalOpen} onClose={() => setIsBedModalOpen(false)} title={`${editingBedId ? 'Edit' : 'Add'} Room/Bed`}>
        <form onSubmit={handleBedSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Room Number" required value={bedForm.roomNumber || ''} onChange={e => setBedForm({...bedForm, roomNumber: e.target.value})} placeholder="e.g. 101" />
            <Select label="Type" required value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value as any})}>
              <option value="General">General</option>
              <option value="Private">Private</option>
              <option value="ICU">ICU</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input 
                label="Cost per Day" 
                prefix={settings.currency} 
                type="number" 
                required 
                value={bedForm.costPerDay} 
                onChange={e => setBedForm({...bedForm, costPerDay: parseFloat(e.target.value)})}
                disabled={bedForm.status === 'occupied'}
                className={bedForm.status === 'occupied' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}
              />
              {bedForm.status === 'occupied' && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertTriangle size={12}/> Cost locked (Occupied)
                </p>
              )}
            </div>
            <Select label="Status" value={bedForm.status} onChange={e => setBedForm({...bedForm, status: e.target.value as any})}>
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
            </Select>
          </div>
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsBedModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingBedId ? 'Update Room' : 'Add Room'}</Button>
          </div>
        </form>
      </Modal>

      {/* User Modal */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={`${editingUserId ? 'Edit' : 'Add'} System User`}>
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Username" required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} disabled={!!editingUserId} />
            <Input label="Full Name" required value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Select label="Role" required value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="receptionist">Receptionist</option>
              <option value="accountant">Accountant</option>
              <option value="doctor">Doctor</option>
              <option value="nurse">Nurse</option>
              <option value="technician">Technician</option>
              <option value="pharmacist">Pharmacist</option>
              <option value="hr">HR</option>
            </Select>
            <Input label="Email" type="email" value={userForm.email || ''} onChange={e => setUserForm({...userForm, email: e.target.value})} />
          </div>

          <div className="border-t pt-4 mt-2">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {editingUserId ? 'Change Password (Optional)' : 'Password'}
            </label>
            <Input 
              type="password" 
              placeholder={editingUserId ? 'Leave blank to keep current' : 'Enter password'} 
              required={!editingUserId}
              value={userForm.password || ''} 
              onChange={e => setUserForm({...userForm, password: e.target.value})} 
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="isActive" 
              checked={userForm.isActive} // Updated to use consistent camelCase
              onChange={e => setUserForm({...userForm, isActive: e.target.checked})}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">User Account Active</label>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingUserId ? 'Update User' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>

      {/* Finance Modal */}
      <Modal isOpen={isFinanceModalOpen} onClose={() => setIsFinanceModalOpen(false)} title={`${editingFinanceId ? 'Edit' : 'Add'} ${financeType === 'tax' ? 'Tax Rate' : 'Payment Method'}`}>
        <form onSubmit={handleFinanceSubmit} className="space-y-4">
          <Input label="Name" required value={financeForm.name || ''} onChange={e => setFinanceForm({...financeForm, name: e.target.value})} placeholder={financeType === 'tax' ? 'e.g. VAT' : 'e.g. Credit Card'} />
          
          {financeType === 'tax' && (
            <Input label="Rate (%)" type="number" step="0.01" required value={financeForm.rate || ''} onChange={e => setFinanceForm({...financeForm, rate: parseFloat(e.target.value)})} />
          )}

          <div className="flex items-center gap-2 mt-2">
            <input 
              type="checkbox" 
              id="isFinanceActive" 
              checked={financeForm.isActive !== false} // Default true
              onChange={e => setFinanceForm({...financeForm, isActive: e.target.checked})}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 border-gray-300"
            />
            <label htmlFor="isFinanceActive" className="text-sm text-gray-700">Active</label>
          </div>

          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsFinanceModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editingFinanceId ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
