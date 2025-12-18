
import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save, Edit, 
  Bed, Users, Loader2, CheckCircle, XCircle, AlertTriangle, Upload, Download, Server, 
  CreditCard, RotateCcw, Shield, Lock, Activity, RefreshCw, Briefcase, FlaskConical, Stethoscope,
  Landmark, ShieldCheck, Cpu, HardDrive, Clock, Hash
} from 'lucide-react';
import { api } from '../services/api';
import { LabTestCatalog, NurseServiceCatalog, OperationCatalog, Bed as BedType, User, Role, TaxRate, PaymentMethod, InsuranceProvider, MedicalStaff } from '../types';
import { Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

type ConfigTab = 'general' | 'users' | 'beds' | 'catalogs' | 'data' | 'financial' | 'diagnostics';
type CatalogType = 'departments' | 'specializations' | 'lab' | 'nurse' | 'ops' | 'insurance' | 'banks';

export const Configuration = () => {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<ConfigTab>('general');
  const [activeCatalog, setActiveCatalog] = useState<CatalogType>('departments');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [settings, setSettings] = useState({ hospitalName: '', hospitalAddress: '', hospitalPhone: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [beds, setBeds] = useState<BedType[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [catalogData, setCatalogData] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'user' | 'tax' | 'payment' | 'bed' | 'catalog' | ''>('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');
  const [confirmState, setConfirmState] = useState<any>({ isOpen: false, title: '', message: '', action: () => {} });

  // Form States
  const [userForm, setUserForm] = useState({ username: '', password: '', fullName: '', role: 'receptionist', email: '', isActive: true });
  const [taxForm, setTaxForm] = useState({ name_en: '', name_ar: '', rate: '', is_active: true });
  const [paymentForm, setPaymentForm] = useState({ name_en: '', name_ar: '', is_active: true });
  const [bedForm, setBedForm] = useState({ roomNumber: '', type: 'General', costPerDay: '', status: 'available' });

  // Sync Header
  useHeader(t('config_title'), '');

  const loadData = async () => {
    setLoading(true);
    try {
      const hospitalName = localStorage.getItem('h_name') || 'AllCare Hospital';
      const hospitalAddress = localStorage.getItem('h_address') || '';
      const hospitalPhone = localStorage.getItem('h_phone') || '';
      setSettings({ hospitalName, hospitalAddress, hospitalPhone });

      const [u, p, b, tax, pm] = await Promise.all([
        api.getSystemUsers(),
        api.getRolePermissions(),
        api.getBeds(),
        api.getTaxRates(),
        api.getPaymentMethods()
      ]);

      setUsers(u || []);
      setRolePermissions(p || {});
      setBeds(b || []);
      setTaxRates(tax || []);
      setPaymentMethods(pm || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async (type: CatalogType) => {
    setLoading(true);
    try {
      let data = [];
      switch(type) {
        case 'departments': data = await api.getDepartments(); break;
        case 'specializations': data = await api.getSpecializations(); break;
        case 'lab': data = await api.getLabTests(); break;
        case 'nurse': data = await api.getNurseServices(); break;
        case 'ops': data = await api.getOperations(); break;
        case 'insurance': data = await api.getInsuranceProviders(); break;
        case 'banks': data = await api.getBanks(); break;
      }
      setCatalogData(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'catalogs') loadCatalog(activeCatalog); }, [activeTab, activeCatalog]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    localStorage.setItem('h_name', settings.hospitalName);
    localStorage.setItem('h_address', settings.hospitalAddress);
    localStorage.setItem('h_phone', settings.hospitalPhone);
    setTimeout(() => {
      setProcessStatus('success');
      setProcessMessage(t('config_toast_settings_saved'));
      setTimeout(() => setProcessStatus('idle'), 1500);
    }, 500);
  };

  // --- USER HANDLERS ---
  const openUserModal = (user?: User) => {
    if (user) {
      setSelectedItem(user);
      setUserForm({ username: user.username, password: '', fullName: user.fullName, role: user.role, email: user.email || '', isActive: user.is_active !== false });
    } else {
      setSelectedItem(null);
      setUserForm({ username: '', password: '', fullName: '', role: 'receptionist', email: '', isActive: true });
    }
    setModalType('user');
    setIsModalOpen(true);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    try {
      if (selectedItem) await api.updateSystemUser(selectedItem.id, userForm);
      else await api.addSystemUser(userForm);
      setProcessStatus('success');
      loadData();
      setIsModalOpen(false);
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || "Failed to save user.");
    }
  };

  const deleteUser = (id: number, username: string) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_user_title'), message: `${t('config_dialog_delete_user_msg')} (@${username})`,
      action: async () => {
        try { await api.deleteSystemUser(id); loadData(); } catch (e) { alert("Failed to delete"); }
      }
    });
  };

  // --- TAX HANDLERS ---
  const openTaxModal = (tax?: TaxRate) => {
    if (tax) {
      setSelectedItem(tax);
      setTaxForm({ name_en: tax.name_en, name_ar: tax.name_ar, rate: tax.rate.toString(), is_active: tax.isActive });
    } else {
      setSelectedItem(null);
      setTaxForm({ name_en: '', name_ar: '', rate: '', is_active: true });
    }
    setModalType('tax');
    setIsModalOpen(true);
  };

  const handleTaxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...taxForm, rate: parseFloat(taxForm.rate) };
    try {
      if (selectedItem) await api.updateTaxRate(selectedItem.id, payload);
      else await api.addTaxRate(payload);
      loadData();
      setIsModalOpen(false);
    } catch (e) { alert("Failed to save tax."); }
  };

  // --- PAYMENT METHOD HANDLERS ---
  const openPaymentModal = (pm?: PaymentMethod) => {
    if (pm) {
      setSelectedItem(pm);
      setPaymentForm({ name_en: pm.name_en, name_ar: pm.name_ar, is_active: pm.isActive });
    } else {
      setSelectedItem(null);
      setPaymentForm({ name_en: '', name_ar: '', is_active: true });
    }
    setModalType('payment');
    setIsModalOpen(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedItem) await api.updatePaymentMethod(selectedItem.id, paymentForm);
      else await api.addPaymentMethod(paymentForm);
      loadData();
      setIsModalOpen(false);
    } catch (e) { alert("Failed to save payment method."); }
  };

  const deletePaymentMethod = (id: number) => {
    setConfirmState({
      isOpen: true, title: "Delete Payment Method", message: "This will remove this payment option from the system.",
      action: async () => { try { await api.deletePaymentMethod(id); loadData(); } catch (e) { alert("Failed"); } }
    });
  };

  // --- BED HANDLERS ---
  const openBedModal = (bed?: BedType) => {
    if (bed) {
      if (bed.status === 'occupied' || bed.status === 'reserved') {
          alert("Beds that are occupied or reserved cannot be updated or deleted for data integrity.");
          return;
      }
      setSelectedItem(bed);
      setBedForm({ roomNumber: bed.roomNumber, type: bed.type, costPerDay: bed.costPerDay.toString(), status: bed.status });
    } else {
      setSelectedItem(null);
      setBedForm({ roomNumber: '', type: 'General', costPerDay: '50', status: 'available' });
    }
    setModalType('bed');
    setIsModalOpen(true);
  };

  const handleBedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...bedForm, costPerDay: parseFloat(bedForm.costPerDay) };
    try {
      if (selectedItem) await api.updateBed(selectedItem.id, payload);
      else await api.addBed(payload);
      loadData();
      setIsModalOpen(false);
    } catch (e) { alert("Failed to save bed."); }
  };

  const deleteBed = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_room_title'), message: t('config_dialog_delete_room_msg'),
      action: async () => { try { await api.deleteBed(id); loadData(); } catch (e) { alert("Failed"); } }
    });
  };

  const runDiagnostics = async () => {
    setProcessStatus('processing');
    setProcessMessage("Analyzing system nodes...");
    try {
      const data = await api.checkSystemHealth();
      setHealthData(data);
      setProcessStatus('idle');
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage("Health check failed.");
    }
  };

  const togglePermission = async (role: string, perm: string) => {
    const current = rolePermissions[role] || [];
    const updated = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    try {
      await api.updateRolePermissions(role, updated);
      setRolePermissions({ ...rolePermissions, [role]: updated });
    } catch (e) {
      console.error("Failed to update permission");
    }
  };

  // FIX: Implemented handleBackup function to trigger binary download of database snapshot.
  const handleBackup = async () => {
    setProcessStatus('processing');
    setProcessMessage("Preparing system snapshot...");
    try {
      await api.downloadBackup();
      setProcessStatus('success');
      setProcessMessage("Backup downloaded successfully.");
      setTimeout(() => setProcessStatus('idle'), 1500);
    } catch (e) {
      setProcessStatus('error');
      setProcessMessage("Failed to download backup.");
    }
  };

  // FIX: Implemented handleRestore function to manage database snapshot file upload and restoration.
  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmState({
      isOpen: true,
      title: "Confirm Restoration",
      message: "This will completely overwrite the current database. This action is irreversible. Are you sure?",
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage("Restoring database from snapshot...");
        try {
          await api.restoreDatabase(file);
          setProcessStatus('success');
          setProcessMessage("System restored successfully. Reloading...");
          setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
          setProcessStatus('error');
          setProcessMessage(err.response?.data?.error || "Failed to restore database.");
        }
      }
    });
  };

  // FIX: Implemented handleReset function to perform a factory reset after user confirmation.
  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      title: "Factory Reset",
      message: "WARNING: This will delete all clinical and financial records. Only the admin user will remain. Proceed with absolute caution.",
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage("Performing factory reset...");
        try {
          await api.resetDatabase();
          setProcessStatus('success');
          setProcessMessage("System has been reset. Reloading...");
          setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
          setProcessStatus('error');
          setProcessMessage("Failed to reset system.");
        }
      }
    });
  };

  const getPermissionLabel = (perm: string) => {
    return perm.split('_').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const permissionGroups = [
    { name: t('permission_group_general'), perms: [Permissions.VIEW_DASHBOARD, Permissions.VIEW_REPORTS, Permissions.VIEW_RECORDS] },
    { name: t('permission_group_patients'), perms: [Permissions.VIEW_PATIENTS, Permissions.MANAGE_PATIENTS, Permissions.DELETE_PATIENTS] },
    { name: t('permission_group_appointments'), perms: [Permissions.VIEW_APPOINTMENTS, Permissions.MANAGE_APPOINTMENTS, Permissions.DELETE_APPOINTMENTS] },
    { name: t('permission_group_billing'), perms: [Permissions.VIEW_BILLING, Permissions.MANAGE_BILLING, Permissions.DELETE_BILLING] },
    { name: t('permission_group_hr'), perms: [Permissions.VIEW_HR, Permissions.MANAGE_HR, Permissions.DELETE_HR] },
    { name: t('permission_group_admissions'), perms: [Permissions.VIEW_ADMISSIONS, Permissions.MANAGE_ADMISSIONS, Permissions.DELETE_ADMISSIONS] },
    { name: t('permission_group_laboratory'), perms: [Permissions.VIEW_LABORATORY, Permissions.MANAGE_LABORATORY, Permissions.DELETE_LABORATORY] },
    { name: t('permission_group_operations'), perms: [Permissions.VIEW_OPERATIONS, Permissions.MANAGE_OPERATIONS, Permissions.DELETE_OPERATIONS] },
    { name: t('permission_group_system'), perms: [Permissions.VIEW_SETTINGS, Permissions.MANAGE_SETTINGS, Permissions.MANAGE_CONFIGURATION] },
  ];

  if (loading && !catalogData.length && !users.length) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <Loader2 className="animate-spin text-primary-600" size={40} />
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Processing HUD */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-16 h-16 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle size={48} className="text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle size={48} className="text-red-600 mb-4" />}
            <h3 className="text-xl font-bold">{processStatus === 'processing' ? t('processing') : processStatus === 'success' ? t('success') : t('error')}</h3>
            <p className="text-sm text-slate-500 mt-2">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" className="mt-6 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button>}
          </div>
        </div>
      )}

      {/* Main Tab Navigation */}
      <div className="flex bg-white dark:bg-slate-800 p-1 rounded-2xl shadow-soft border border-slate-200 dark:border-slate-700 overflow-x-auto">
        {[
          { id: 'general', icon: SettingsIcon, label: t('config_tab_general') },
          { id: 'users', icon: Shield, label: t('config_tab_roles') }, 
          { id: 'financial', icon: CreditCard, label: t('config_tab_financial') },
          { id: 'beds', icon: Bed, label: t('config_tab_beds') },
          { id: 'catalogs', icon: Database, label: t('config_tab_catalogs') },
          { id: 'data', icon: HardDrive, label: t('config_tab_data') },
          { id: 'diagnostics', icon: Activity, label: t('config_tab_health') },
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id as any)} 
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <tab.icon size={16}/> {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* --- GENERAL SETTINGS --- */}
        {activeTab === 'general' && (
          <Card title="Hospital Profile">
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label={t('config_general_hospital_name')} value={settings.hospitalName} onChange={e => setSettings({...settings, hospitalName: e.target.value})} prefix={<Building size={16}/>} />
                <Input label={t('settings_profile_phone')} value={settings.hospitalPhone} onChange={e => setSettings({...settings, hospitalPhone: e.target.value})} prefix={<Clock size={16}/>} />
                <div className="md:col-span-2">
                  <Input label={t('config_general_address')} value={settings.hospitalAddress} onChange={e => setSettings({...settings, hospitalAddress: e.target.value})} prefix={<Hash size={16}/>} />
                </div>
              </div>
              <div className="pt-4 border-t dark:border-slate-700">
                <Button type="submit" icon={Save}>{t('config_general_save_button')}</Button>
              </div>
            </form>
          </Card>
        )}

        {/* --- USERS & PERMISSIONS --- */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <Card title="Permission Matrix (Role Control)" className="!p-0 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                       <tr>
                         <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Permission Group</th>
                         {Object.keys(rolePermissions).map(role => (
                           <th key={role} className="px-4 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[100px] border-l border-slate-200 dark:border-slate-700">{role}</th>
                         ))}
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                       {permissionGroups.map(group => (
                         <React.Fragment key={group.name}>
                           <tr className="bg-slate-50/50 dark:bg-slate-900/20">
                             <td colSpan={Object.keys(rolePermissions).length + 1} className="px-6 py-2 text-[10px] font-black text-primary-600 uppercase tracking-widest">{group.name}</td>
                           </tr>
                           {group.perms.map(perm => (
                             <tr key={perm} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                               <td className="px-6 py-3 text-xs font-bold text-slate-700 dark:text-slate-300">{getPermissionLabel(perm)}</td>
                               {Object.keys(rolePermissions).map(role => {
                                  const hasPerm = rolePermissions[role]?.includes(perm);
                                  const isAdmin = role === 'admin';
                                  return (
                                    <td key={role} className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800">
                                       <button 
                                          disabled={isAdmin}
                                          onClick={() => togglePermission(role, perm)}
                                          className={`w-5 h-5 rounded flex items-center justify-center transition-all ${hasPerm ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent'} ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}
                                       >
                                         <CheckCircle size={14} />
                                       </button>
                                    </td>
                                  );
                               })}
                             </tr>
                           ))}
                         </React.Fragment>
                       ))}
                    </tbody>
                 </table>
               </div>
            </Card>

            <Card title="Active System Accounts" action={<Button size="sm" icon={Plus} onClick={() => openUserModal()}>New Account</Button>} className="!p-0 overflow-hidden">
               <table className="min-w-full divide-y">
                 <thead className="bg-slate-50 dark:bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Username</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Name</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Role</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-primary-600">@{u.username}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{u.fullName}</td>
                        <td className="px-6 py-4"><Badge color="blue" className="capitalize">{u.role}</Badge></td>
                        <td className="px-6 py-4"><Badge color={u.isActive ? 'green' : 'gray'}>{u.isActive ? 'Active' : 'Locked'}</Badge></td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => openUserModal(u)} className="text-slate-400 hover:text-primary-600"><Edit size={16}/></button>
                             <button onClick={() => deleteUser(u.id, u.username)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                           </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </Card>
          </div>
        )}

        {/* --- FINANCIAL SETTINGS --- */}
        {activeTab === 'financial' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card 
               title="Tax Rates" 
               action={<Button size="lg" icon={Plus} onClick={() => openTaxModal()} className="shadow-lg transform active:scale-95 transition-all" />}
               className="hover:border-primary-200 transition-colors"
             >
                <div className="space-y-4">
                   {taxRates.length === 0 ? <p className="text-center py-10 text-slate-400 italic">No tax rates defined.</p> : 
                    taxRates.map(t => (
                     <div key={t.id} className="group flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-primary-600 shadow-sm font-bold">%</div>
                           <div>
                              <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{language === 'ar' ? t.name_ar : t.name_en}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-primary-600">{t.rate}%</span>
                                <Badge color={t.isActive ? 'green' : 'gray'} className="text-[9px] uppercase">{t.isActive ? 'Active' : 'Hidden'}</Badge>
                              </div>
                           </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openTaxModal(t)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm"><Edit size={16}/></button>
                           <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm"><Trash2 size={16}/></button>
                        </div>
                     </div>
                   ))}
                </div>
             </Card>
             <Card 
               title="Payment Methods" 
               action={<Button size="lg" variant="secondary" icon={Plus} onClick={() => openPaymentModal()} className="shadow-lg transform active:scale-95 transition-all" />}
               className="hover:border-primary-200 transition-colors"
             >
                <div className="space-y-4">
                   {paymentMethods.length === 0 ? <p className="text-center py-10 text-slate-400 italic">No payment methods configured.</p> : 
                    paymentMethods.map(m => (
                     <div key={m.id} className="group flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-primary-800 transition-all">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><CreditCard size={18}/></div>
                           <div>
                             <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{language === 'ar' ? m.name_ar : m.name_en}</p>
                             <Badge color={m.isActive ? 'green' : 'gray'} className="text-[9px] uppercase">{m.isActive ? 'Online' : 'Disabled'}</Badge>
                           </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => openPaymentModal(m)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm"><Edit size={16}/></button>
                           <button onClick={() => deletePaymentMethod(m.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg shadow-sm"><Trash2 size={16}/></button>
                        </div>
                     </div>
                   ))}
                </div>
             </Card>
          </div>
        )}

        {/* --- WARDS & BEDS --- */}
        {activeTab === 'beds' && (
          <Card title="Ward Management" action={<Button size="sm" icon={Plus} onClick={() => openBedModal()}>Add Bed</Button>} className="!p-0 overflow-hidden">
            <table className="min-w-full divide-y">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Room #</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Ward Type</th>
                  <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Daily Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {beds.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer group" onClick={() => openBedModal(b)}>
                    <td className="px-6 py-4 font-black text-slate-800 dark:text-white flex items-center gap-2">
                       <Bed size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />
                       {b.roomNumber}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">{b.type}</td>
                    <td className="px-6 py-4"><Badge color={b.status === 'available' ? 'green' : (b.status === 'occupied' || b.status === 'reserved') ? 'red' : 'orange'}>{b.status}</Badge></td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-primary-600 flex justify-end items-center gap-4">
                       ${b.costPerDay}
                       <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          {b.status !== 'occupied' && b.status !== 'reserved' ? <Trash2 size={14} className="text-slate-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); deleteBed(b.id); }} /> : <Lock size={12} className="text-slate-300" />}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* --- CATALOGS --- */}
        {activeTab === 'catalogs' && (
          <div className="space-y-6">
             <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {[
                  { id: 'departments', icon: Building, label: 'Departments' },
                  { id: 'specializations', icon: Stethoscope, label: 'Specialties' },
                  { id: 'lab', icon: FlaskConical, label: 'Laboratory' },
                  { id: 'nurse', icon: Activity, label: 'Nursing' },
                  { id: 'ops', icon: Activity, label: 'Theaters' },
                  { id: 'insurance', icon: ShieldCheck, label: 'Insurance' },
                  { id: 'banks', icon: Landmark, label: 'Banks' },
                ].map(cat => (
                  <button 
                    key={cat.id} 
                    onClick={() => setActiveCatalog(cat.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeCatalog === cat.id ? 'bg-primary-50 border-primary-200 text-primary-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <cat.icon size={14}/> {cat.label}
                  </button>
                ))}
             </div>
             
             <Card title={`${activeCatalog.charAt(0).toUpperCase() + activeCatalog.slice(1)} Catalog`} action={<Button size="sm" icon={Plus}>Add Entry</Button>} className="!p-0 overflow-hidden">
                <table className="min-w-full divide-y">
                   <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr>
                         <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Entry Name</th>
                         <th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Local (AR)</th>
                         {activeCatalog === 'lab' || activeCatalog === 'nurse' || activeCatalog === 'ops' ? (
                           <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Cost/Base</th>
                         ) : <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">ID</th>}
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {catalogData.map((item, i) => (
                        <tr key={item.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                           <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{item.name_en || item.fullName || 'Unnamed'}</td>
                           <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">{item.name_ar || '-'}</td>
                           <td className="px-6 py-4 text-right">
                              {item.cost !== undefined || item.base_cost !== undefined ? (
                                <span className="font-mono font-bold text-primary-600">${(item.cost || item.base_cost || 0).toLocaleString()}</span>
                              ) : <span className="text-[10px] font-black text-slate-300">#{item.id}</span>}
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </Card>
          </div>
        )}

        {/* --- DATA MANAGEMENT --- */}
        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <Card title="System Snapshot" className="lg:col-span-1">
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">Securely download a full binary mirror of the HMS database. This includes all patients, financial logs, and staff records.</p>
                <Button variant="outline" icon={Download} onClick={handleBackup} className="w-full py-4 text-md">Export .DB Snapshot</Button>
             </Card>
             <Card title="Database Restoration" className="lg:col-span-1">
                <p className="text-sm text-slate-500 mb-6 leading-relaxed">Restore the system using a valid AllCare .db file. This will completely overwrite existing data. Proceed with caution.</p>
                <div className="relative">
                  <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleRestore} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <Button variant="secondary" icon={Upload} className="w-full py-4 text-md">Upload & Restore</Button>
                </div>
             </Card>
             <Card title="Danger Zone" className="lg:col-span-1 border-rose-100 bg-rose-50/20">
                <p className="text-sm text-rose-600 mb-6 font-bold uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={16}/> Warning: Irreversible</p>
                <p className="text-xs text-rose-500/80 mb-6 italic">Performing a factory reset will wipe all clinical and financial history, keeping only the default admin account.</p>
                <Button variant="danger" icon={RotateCcw} onClick={handleReset} className="w-full py-4 text-md">Execute Factory Reset</Button>
             </Card>
          </div>
        )}

        {/* --- DIAGNOSTICS --- */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-soft">
                <div>
                   <h3 className="font-bold text-lg">System Health Monitor</h3>
                   <p className="text-xs text-slate-500">Live operational diagnostics for the HMS backend</p>
                </div>
                <Button icon={Activity} onClick={runDiagnostics}>Refresh Status</Button>
             </div>

             {healthData ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <HealthStat icon={Server} label="API Status" value={healthData.status} color="text-emerald-500" />
                  <HealthStat icon={Clock} label="Server Uptime" value={`${Math.round(healthData.uptime / 3600)} hrs`} color="text-blue-500" />
                  <HealthStat icon={Cpu} label="CPU Latency" value={healthData.database?.latency || '-'} color="text-violet-500" />
                  <HealthStat icon={HardDrive} label="RAM Usage" value={healthData.memory?.rss || '-'} color="text-orange-500" />
                  
                  <div className="md:col-span-2 lg:col-span-4 mt-4">
                     <Card title="Backend Technical JSON">
                        <pre className="text-[10px] font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto">
                           {JSON.stringify(healthData, null, 2)}
                        </pre>
                     </Card>
                  </div>
               </div>
             ) : (
               <div className="p-20 text-center border-2 border-dashed rounded-3xl opacity-50">
                  <Activity size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="font-bold text-slate-400">Run diagnostics to see live metrics.</p>
               </div>
             )}
          </div>
        )}
      </div>

      {/* REUSABLE MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedItem ? `Update Entry` : `Add New Entry`}>
         {modalType === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-4">
               <Input label="Full Name" required value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Username" required disabled={!!selectedItem} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} />
                  <Select label="System Role" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as Role})}>
                     <option value="admin">Admin</option>
                     <option value="manager">Manager</option>
                     <option value="receptionist">Receptionist</option>
                     <option value="doctor">Doctor</option>
                     <option value="accountant">Accountant</option>
                     <option value="hr">HR</option>
                  </Select>
               </div>
               <Input label="Password" type="password" required={!selectedItem} placeholder={selectedItem ? "Leave empty to keep current" : "••••••••"} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
               <div className="flex items-center gap-2 py-2">
                  <input type="checkbox" id="userActive" checked={userForm.isActive} onChange={e => setUserForm({...userForm, isActive: e.target.checked})} />
                  <label htmlFor="userActive" className="text-sm font-bold">Account is Active</label>
               </div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Account' : 'Create Account'}</Button>
            </form>
         )}

         {modalType === 'tax' && (
            <form onSubmit={handleTaxSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Name (EN)" required value={taxForm.name_en} onChange={e => setTaxForm({...taxForm, name_en: e.target.value})} />
                  <Input label="Name (AR)" required value={taxForm.name_ar} onChange={e => setTaxForm({...taxForm, name_ar: e.target.value})} />
               </div>
               <Input label="Rate (%)" type="number" step="0.01" required value={taxForm.rate} onChange={e => setTaxForm({...taxForm, rate: e.target.value})} />
               <div className="flex items-center gap-2 py-2">
                  <input type="checkbox" id="taxActive" checked={taxForm.is_active} onChange={e => setTaxForm({...taxForm, is_active: e.target.checked})} />
                  <label htmlFor="taxActive" className="text-sm font-bold">Enabled for Billing</label>
               </div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Tax' : 'Add Tax Rate'}</Button>
            </form>
         )}

         {modalType === 'payment' && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Method (EN)" required value={paymentForm.name_en} onChange={e => setPaymentForm({...paymentForm, name_en: e.target.value})} />
                  <Input label="Method (AR)" required value={paymentForm.name_ar} onChange={e => setPaymentForm({...paymentForm, name_ar: e.target.value})} />
               </div>
               <div className="flex items-center gap-2 py-2">
                  <input type="checkbox" id="pmActive" checked={paymentForm.is_active} onChange={e => setPaymentForm({...paymentForm, is_active: e.target.checked})} />
                  <label htmlFor="pmActive" className="text-sm font-bold">Active Selection</label>
               </div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Method' : 'Add Method'}</Button>
            </form>
         )}

         {modalType === 'bed' && (
            <form onSubmit={handleBedSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Room/Bed Number" required value={bedForm.roomNumber} onChange={e => setBedForm({...bedForm, roomNumber: e.target.value})} />
                  <Select label="Ward Type" value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value})}>
                     <option>General</option>
                     <option>Private</option>
                     <option>ICU</option>
                     <option>Emergency</option>
                  </Select>
               </div>
               <Input label="Cost Per Day ($)" type="number" required value={bedForm.costPerDay} onChange={e => setBedForm({...bedForm, costPerDay: e.target.value})} />
               {selectedItem && (
                 <Select label="Status" value={bedForm.status} onChange={e => setBedForm({...bedForm, status: e.target.value})}>
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="cleaning">Cleaning</option>
                 </Select>
               )}
               <Button type="submit" className="w-full">{selectedItem ? 'Update Ward Info' : 'Create Bed'}</Button>
            </form>
         )}
      </Modal>

      <ConfirmationDialog 
        isOpen={confirmState.isOpen} 
        onClose={() => setConfirmState({...confirmState, isOpen: false})} 
        onConfirm={confirmState.action} 
        title={confirmState.title} 
        message={confirmState.message} 
      />
    </div>
  );
};

const HealthStat = ({ icon: Icon, label, value, color }: any) => (
  <Card className="!p-5 bg-white dark:bg-slate-800 hover:shadow-lg transition-all group">
     <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900 group-hover:bg-primary-50 transition-colors ${color}`}>
           <Icon size={24} />
        </div>
        <div>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
           <p className="text-xl font-black text-slate-800 dark:text-white capitalize">{value}</p>
        </div>
     </div>
  </Card>
);
