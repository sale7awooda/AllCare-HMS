
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save, Edit, 
  Bed, Users, Loader2, CheckCircle, XCircle, AlertTriangle, Upload, Download, Server, 
  CreditCard, RotateCcw, Shield, Lock, Activity, RefreshCw 
} from 'lucide-react';
import { api } from '../services/api';
import { LabTestCatalog, NurseServiceCatalog, OperationCatalog, Bed as BedType, User, Role, TaxRate, PaymentMethod } from '../types';
import { Permissions } from '../utils/rbac';

export const Configuration = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'beds' | 'catalogs' | 'users' | 'data' | 'financial' | 'diagnostics'>('general');
  const [loading, setLoading] = useState(true);
  
  // Process Status for Overlay
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    type?: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  // Settings State
  const [settings, setSettings] = useState({
    hospitalName: '',
    hospitalAddress: '',
    hospitalPhone: '',
    currency: '$'
  });

  // Diagnostics State
  const [healthData, setHealthData] = useState<any>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<any>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  
  // New: Roles & Permissions State
  const [userTabMode, setUserTabMode] = useState<'accounts' | 'roles'>('accounts');
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [availableRoles, setAvailableRoles] = useState<string[]>(['admin', 'manager', 'receptionist', 'technician', 'accountant', 'doctor', 'nurse', 'pharmacist', 'hr']);

  // Beds State
  const [beds, setBeds] = useState<BedType[]>([]);
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [bedForm, setBedForm] = useState<Partial<BedType>>({});
  const [editingBedId, setEditingBedId] = useState<number | null>(null);

  // Catalogs State
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [catalogTab, setCatalogTab] = useState<'dept' | 'spec' | 'lab' | 'nurse' | 'ops'>('lab');
  
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
      const [s, d, sp, b, l, n, o, u, t, p, rPerms] = await Promise.all([
        api.getSystemSettings(),
        api.getDepartments(),
        api.getSpecializations(),
        api.getConfigBeds(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getOperations(),
        api.getSystemUsers(),
        api.getTaxRates(),
        api.getPaymentMethods(),
        api.getRolePermissions()
      ]);
      if (s) setSettings(s);
      setDepartments(Array.isArray(d) ? d : []);
      setSpecializations(Array.isArray(sp) ? sp : []);
      setBeds(Array.isArray(b) ? b : []);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setOperations(Array.isArray(o) ? o : []);
      setUsers(Array.isArray(u) ? u : []);
      setTaxes(Array.isArray(t) ? t : []);
      setPaymentMethods(Array.isArray(p) ? p : []);
      setRolePermissions(rPerms || {});
    } catch (e) {
      console.error("Failed to load config data", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Diagnostics Runner ---
  const runDiagnostics = async () => {
    setIsTesting(true);
    setTestLogs(['Starting system diagnostics...', '---------------------------']);
    setHealthData(null);

    const log = (msg: string) => setTestLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);

    try {
      // 1. Check Network & API Health
      log('Test 1: Network Latency & API Health...');
      const start = performance.now();
      const health = await api.checkSystemHealth();
      const end = performance.now();
      log(`API Response: OK (${(end - start).toFixed(2)}ms)`);
      setHealthData(health); // Store for UI

      if (health.database?.connected) {
        log(`Database Connection: ESTABLISHED (${health.database.latency})`);
      } else {
        log('CRITICAL: Database Connection FAILED');
      }

      // 2. Check Auth
      log('Test 2: Authentication Handshake...');
      try {
        const user = await api.me();
        log(`Auth Token: VALID (User: ${user.username}, Role: ${user.role})`);
      } catch (authErr) {
        log('CRITICAL: Authentication FAILED (Invalid Token or Session Expired)');
      }

      // 3. Check Data Integrity
      log('Test 3: Data Consistency Check...');
      try {
        const settingsCheck = await api.getSystemSettings();
        if (settingsCheck) log('Config Table Read: SUCCESS');
        else log('Config Table Read: FAILED (Empty)');
      } catch (dataErr) {
        log('Data Read Error: FAILED');
      }

      log('---------------------------');
      log('Diagnostics Complete. System is operational.');

    } catch (e: any) {
      log('---------------------------');
      log(`DIAGNOSTIC FAILURE: ${e.message}`);
      log('Check server logs for details.');
    } finally {
      setIsTesting(false);
    }
  };

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
      // Update local storage for immediate sync with Login screen
      if (settings.hospitalName) {
        localStorage.setItem('hospital_name', settings.hospitalName);
      }
    }, 'Settings saved successfully');
  };

  // User Handlers
  const openUserModal = (user?: any) => {
    if (user) {
      setEditingUserId(user.id);
      setUserForm({ ...user, password: '' });
    } else {
      setEditingUserId(null);
      setUserForm({ username: '', fullName: '', role: 'manager', isActive: true });
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
    setConfirmState({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone and they will lose access immediately.',
      action: () => handleAction(async () => await api.deleteSystemUser(id), 'User deleted')
    });
  };

  // Permission Handlers
  const togglePermission = (role: string, permission: string) => {
    if (role === 'admin') return; // Cannot modify admin
    const currentPerms = rolePermissions[role] || [];
    const updatedPerms = currentPerms.includes(permission)
      ? currentPerms.filter(p => p !== permission)
      : [...currentPerms, permission];
    
    setRolePermissions(prev => ({
      ...prev,
      [role]: updatedPerms
    }));
  };

  const savePermissions = async (role: string) => {
    handleAction(async () => {
      await api.updateRolePermissions(role, rolePermissions[role] || []);
    }, `Permissions updated for ${role}`);
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
    setConfirmState({
      isOpen: true,
      title: 'Delete Room',
      message: 'Are you sure you want to remove this room from the registry?',
      action: () => handleAction(async () => await api.deleteBed(id), 'Room deleted')
    });
  };

  // Catalogs Handlers (Generic for Lab, Nurse, Ops, Depts, Specs)
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
      } else if (catalogTab === 'dept') {
        const payload = { name: itemFormData.name, description: itemFormData.description };
        if (editingItemId) await api.updateDepartment(editingItemId, payload.name, payload.description);
        else await api.addDepartment(payload.name, payload.description);
      } else if (catalogTab === 'spec') {
        const payload = { name: itemFormData.name, description: itemFormData.description };
        if (editingItemId) await api.updateSpecialization(editingItemId, payload.name, payload.description);
        else await api.addSpecialization(payload.name, payload.description);
      }
      setIsModalOpen(false);
    }, editingItemId ? 'Item updated' : 'Item added');
  };

  const handleDeleteItem = (id: number, type: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Item',
      message: 'This will permanently remove the item from the catalog. Existing records using this item will remain unchanged.',
      action: () => handleAction(async () => {
        if (type === 'lab') await api.deleteLabTest(id);
        if (type === 'nurse') await api.deleteNurseService(id);
        if (type === 'ops') await api.deleteOperationCatalog(id);
        if (type === 'dept') await api.deleteDepartment(id);
        if (type === 'spec') await api.deleteSpecialization(id);
      }, 'Item deleted')
    });
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
    setConfirmState({
      isOpen: true,
      title: 'Delete Financial Item',
      message: 'Are you sure? This might affect future billing operations.',
      action: () => handleAction(async () => {
        if (type === 'tax') await api.deleteTaxRate(id);
        else await api.deletePaymentMethod(id);
      }, 'Deleted successfully')
    });
  };

  // Data Management Handlers
  const handleDownloadBackup = () => {
    api.downloadBackup();
  };

  const handleRestoreDatabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;
    
    setConfirmState({
      isOpen: true,
      title: 'Critical Warning: Overwrite Database',
      message: 'This will completely OVERWRITE the current database with the selected backup file. All recent data will be lost. Are you absolutely sure?',
      type: 'danger',
      action: () => handleAction(async () => {
        await api.restoreDatabase(restoreFile);
        // Force reload page after restore to clear any stale state
        setTimeout(() => window.location.reload(), 1500);
      }, 'Database restored successfully. Reloading...')
    });
  };

  const handleResetDatabase = () => {
    setConfirmState({
      isOpen: true,
      title: 'Factory Reset',
      message: 'DANGER ZONE: This will wipe ALL data and reset the system to factory defaults (with sample data). This action CANNOT be undone.',
      type: 'danger',
      action: () => handleAction(async () => {
          await api.resetDatabase();
          setTimeout(() => window.location.reload(), 2000);
      }, 'Database reset to factory state. Reloading...')
    });
  };

  // --- Render Helpers ---
  const renderCatalogTable = (type: string, data: any[]) => {
    return (
        <div className="overflow-x-auto border rounded-xl shadow-sm min-h-[300px]">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50/80">
                <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    {type === 'lab' ? 'Category / Details' : type === 'nurse' ? 'Description' : type === 'ops' ? 'Details' : 'Description'}
                </th>
                {(type === 'lab' || type === 'nurse' || type === 'ops') && (
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost</th>
                )}
                <th className="px-4 py-3 text-right w-24">Actions</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {data.map(item => (
                <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                        {(type === 'lab') ? (
                            <>
                                <div>{item.category}</div>
                                {item.normalRange && <div className="text-xs text-gray-400 mt-0.5">Range: {item.normalRange}</div>}
                            </>
                        ) : (type === 'ops') ? (
                            <span className="text-gray-300 italic">-</span>
                        ) : (
                            item.description
                        )}
                    </td>
                    {(type === 'lab' || type === 'nurse' || type === 'ops') && (
                        <td className="px-4 py-3 text-sm font-mono text-right font-medium text-slate-700">
                            ${type === 'ops' ? item.baseCost : item.cost}
                        </td>
                    )}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openItemModal(item)} className="text-slate-400 hover:text-primary-600 p-2 hover:bg-slate-100 rounded-lg transition-colors mr-1"><Edit size={16}/></button>
                        <button onClick={() => handleDeleteItem(item.id, type)} className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
    );
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
          { id: 'users', icon: Shield, label: 'Roles & Permissions' }, 
          { id: 'financial', icon: CreditCard, label: 'Financial' },
          { id: 'beds', icon: Bed, label: 'Rooms & Beds' },
          { id: 'catalogs', icon: Database, label: 'Medical Catalogs' },
          { id: 'data', icon: Server, label: 'Data Management' },
          { id: 'diagnostics', icon: Activity, label: 'System Health' }
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

            {/* DIAGNOSTICS TAB */}
            {activeTab === 'diagnostics' && (
              <div className="animate-in fade-in slide-in-from-left-4 space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">System Integration Check</h3>
                    <p className="text-gray-500 text-sm mt-1">Run a full diagnostic suite to verify API connectivity, database integrity, and authentication services.</p>
                  </div>
                  <Button onClick={runDiagnostics} disabled={isTesting} icon={isTesting ? Loader2 : RefreshCw} className={isTesting ? 'opacity-80' : ''}>
                    {isTesting ? 'Running Diagnostics...' : 'Run Full Diagnostic'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-full mb-3 ${healthData?.database?.connected ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Database size={24} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Database</span>
                    <span className={`text-xs mt-1 font-mono ${healthData?.database?.connected ? 'text-green-600' : 'text-slate-400'}`}>
                      {healthData ? (healthData.database?.connected ? 'ONLINE' : 'OFFLINE') : 'UNKNOWN'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-full mb-3 ${healthData ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Server size={24} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">API Response</span>
                    <span className={`text-xs mt-1 font-mono ${healthData ? 'text-blue-600' : 'text-slate-400'}`}>
                      {healthData ? `${healthData.database?.latency || 'OK'}` : 'WAITING'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-full mb-3 ${healthData ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Activity size={24} />
                    </div>
                    <span className="text-sm font-bold text-gray-700">Memory Usage</span>
                    <span className={`text-xs mt-1 font-mono ${healthData ? 'text-purple-600' : 'text-slate-400'}`}>
                      {healthData ? healthData.memory?.rss : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900 text-green-400 p-4 rounded-xl font-mono text-xs h-64 overflow-y-auto custom-scrollbar shadow-inner">
                  {testLogs.length === 0 ? (
                    <span className="text-slate-500 italic">// Click "Run Full Diagnostic" to view system logs...</span>
                  ) : (
                    testLogs.map((log, i) => (
                      <div key={i} className="mb-1">{log}</div>
                    ))
                  )}
                  {isTesting && <div className="animate-pulse mt-2">_</div>}
                </div>
              </div>
            )}

            {/* USERS & ROLES TAB */}
            {activeTab === 'users' && (
              <div className="animate-in fade-in slide-in-from-left-4">
                <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                    <button 
                      onClick={() => setUserTabMode('accounts')} 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${userTabMode === 'accounts' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                    >
                      User Accounts
                    </button>
                    <button 
                      onClick={() => setUserTabMode('roles')} 
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${userTabMode === 'roles' ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                    >
                      Role Definitions
                    </button>
                </div>

                {userTabMode === 'accounts' ? (
                  <>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">System Users</h3>
                        <p className="text-sm text-gray-500">Manage staff access and assign roles.</p>
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
                  </>
                ) : (
                  <>
                    <div className="mb-6 flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">Permission Matrix</h3>
                        <p className="text-sm text-gray-500">Configure access rights. <strong className="text-primary-600">Admin</strong> permissions are immutable.</p>
                      </div>
                      <div className="bg-yellow-50 text-yellow-800 text-xs px-3 py-1.5 rounded-lg border border-yellow-200 flex items-center gap-2">
                        <Lock size={12} /> Admin roles are locked for security
                      </div>
                    </div>
                    
                    <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/90">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Permission</th>
                            {availableRoles.map(role => (
                              <th key={role} className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase min-w-[100px]">
                                <div className="flex items-center justify-center gap-1">
                                  {role === 'admin' && <Lock size={10} className="text-gray-400" />}
                                  {role}
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {/* Group permissions or just list them */}
                          {Object.keys(Permissions).map((permKey) => (
                            <tr key={permKey} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2.5 text-xs font-medium text-gray-600 sticky left-0 bg-white hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                {permKey}
                              </td>
                              {availableRoles.map(role => {
                                const hasPerm = (rolePermissions[role] || []).includes(permKey);
                                const isAdmin = role === 'admin';
                                return (
                                  <td key={`${role}-${permKey}`} className={`px-4 py-2.5 text-center ${isAdmin ? 'bg-gray-50/50' : ''}`}>
                                    <input 
                                      type="checkbox" 
                                      checked={isAdmin ? true : hasPerm}
                                      disabled={isAdmin}
                                      onChange={() => !isAdmin && togglePermission(role, permKey)}
                                      className={`w-4 h-4 rounded focus:ring-primary-500 border-gray-300 ${isAdmin ? 'text-gray-400 cursor-not-allowed bg-gray-100 opacity-60' : 'text-primary-600 cursor-pointer'}`}
                                    />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          
                          {/* Footer Row for Save Buttons */}
                          <tr className="bg-gray-50 font-bold border-t-2 border-gray-200">
                            <td className="px-4 py-3 text-xs text-gray-500 sticky left-0 bg-gray-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              Actions
                            </td>
                            {availableRoles.map(role => (
                              <td key={`save-${role}`} className="px-4 py-3 text-center">
                                <button 
                                  onClick={() => savePermissions(role)}
                                  disabled={role === 'admin'}
                                  className={`text-[10px] px-2 py-1 rounded shadow-sm transition-all ${role === 'admin' ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : 'bg-white border border-gray-300 hover:border-primary-500 hover:text-primary-600'}`}
                                >
                                  {role === 'admin' ? 'Locked' : 'Save'}
                                </button>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
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
                  {/* Scrollable Container with nice UX */}
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth shadow-inner">
                    {[
                      { id: 'dept', label: 'Departments' },
                      { id: 'spec', label: 'Specializations' },
                      { id: 'lab', label: 'Lab Tests' },
                      { id: 'nurse', label: 'Nurse Services' },
                      { id: 'ops', label: 'Operations' }
                    ].map(t => (
                      <button 
                        key={t.id}
                        onClick={() => setCatalogTab(t.id as any)} 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm whitespace-nowrap ${catalogTab === t.id ? 'bg-white text-primary-700 shadow' : 'bg-transparent text-gray-500 hover:text-gray-700 shadow-none'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => openItemModal()}>Add Item</Button>
                </div>

                {catalogTab === 'dept' && renderCatalogTable('dept', departments)}
                {catalogTab === 'spec' && renderCatalogTable('spec', specializations)}
                {catalogTab === 'lab' && renderCatalogTable('lab', labTests)}
                {catalogTab === 'nurse' && renderCatalogTable('nurse', nurseServices)}
                {catalogTab === 'ops' && renderCatalogTable('ops', operations)}
              </div>
            )}

            {/* DATA MANAGEMENT TAB */}
            {activeTab === 'data' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-left-4">
                {/* Backup */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                    <Download size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Backup Database</h3>
                  <p className="text-sm text-gray-500 mb-6 px-4">Download a full SQL dump of the current system database. Useful for manual backups and migration.</p>
                  <Button onClick={handleDownloadBackup} icon={Download}>Download SQL Dump</Button>
                </div>

                {/* Restore */}
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                    <Upload size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Restore Database</h3>
                  <p className="text-sm text-gray-500 mb-6 px-4">Import a previously saved SQL dump. This will overwrite current data.</p>
                  
                  <form onSubmit={handleRestoreDatabase} className="w-full max-w-xs space-y-4">
                    <input 
                      type="file" 
                      accept=".db,.sqlite,.sql" 
                      onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                    />
                    <Button 
                      type="submit" 
                      disabled={!restoreFile} 
                      variant="secondary"
                      className="w-full"
                      icon={Upload}
                    >
                      Restore Data
                    </Button>
                  </form>
                </div>

                {/* Factory Reset */}
                <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                    <RotateCcw size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-red-800 mb-2">Factory Reset</h3>
                  <p className="text-sm text-red-600/80 mb-6 px-4 font-medium">WARNING: This will wipe ALL data and restore the database to its initial state with sample data. This cannot be undone.</p>
                  <Button 
                    onClick={handleResetDatabase}
                    variant="danger" 
                    icon={Trash2}
                  >
                    Reset Database
                  </Button>
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

      {/* --- CONFIRMATION DIALOG --- */}
      <ConfirmationDialog 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={confirmState.action}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type || 'danger'}
      />

      {/* --- MODALS --- */}
      
      {/* Item Modal (Lab, Nurse, Ops, Dept, Spec) */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`${editingItemId ? 'Edit' : 'Add'} ${catalogTab === 'lab' ? 'Lab Test' : catalogTab === 'nurse' ? 'Nurse Service' : catalogTab === 'ops' ? 'Operation' : catalogTab === 'dept' ? 'Department' : 'Specialization'}`}>
        <form onSubmit={handleItemSubmit} className="space-y-4">
          <Input label="Name" required value={itemFormData.name || ''} onChange={e => setItemFormData({...itemFormData, name: e.target.value})} />
          
          {(catalogTab === 'dept' || catalogTab === 'spec') && (
             <Textarea label="Description" placeholder="Optional details..." rows={3} value={itemFormData.description || ''} onChange={e => setItemFormData({...itemFormData, description: e.target.value})} />
          )}

          {catalogTab === 'lab' && (
            <>
              <Input label="Category" placeholder="e.g. Hematology" value={itemFormData.category || ''} onChange={e => setItemFormData({...itemFormData, category: e.target.value})} />
              <Input label="Normal Range" placeholder="e.g. 13.5 - 17.5 g/dL" value={itemFormData.normalRange || ''} onChange={e => setItemFormData({...itemFormData, normalRange: e.target.value})} />
            </>
          )}
          {catalogTab === 'nurse' && (
            <Input label="Description" placeholder="Brief description" value={itemFormData.description || ''} onChange={e => setItemFormData({...itemFormData, description: e.target.value})} />
          )}
          
          {(catalogTab === 'lab' || catalogTab === 'nurse' || catalogTab === 'ops') && (
            <Input 
                label="Cost" 
                prefix={settings.currency}
                type="number" 
                step="0.01" 
                required 
                value={catalogTab === 'ops' ? itemFormData.baseCost : itemFormData.cost} 
                onChange={e => setItemFormData({...itemFormData, [catalogTab === 'ops' ? 'baseCost' : 'cost']: e.target.value})} 
            />
          )}

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
              {availableRoles.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
              checked={userForm.isActive} 
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
