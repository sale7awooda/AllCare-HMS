
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save, Edit, 
  Bed, Users, Loader2, CheckCircle, XCircle, AlertTriangle, Upload, Download, Server, 
  CreditCard, RotateCcw, Shield, Lock, Activity, RefreshCw, Briefcase, FlaskConical, Stethoscope,
  Landmark, ShieldCheck, Cpu, HardDrive, Clock, Hash, ChevronRight, ChevronLeft, Info
} from 'lucide-react';
import { api } from '../services/api';
import { Bed as BedType, User, Role, TaxRate, PaymentMethod, InsuranceProvider } from '../types';
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
  const [catalogForm, setCatalogForm] = useState<any>({ name_en: '', name_ar: '', description_en: '', cost: '', base_cost: '', category_en: '', related_role: '', is_active: true });

  const tabContainerRef = useRef<HTMLDivElement>(null);

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

      // FIX: Added defensive Array.isArray and object check
      setUsers(Array.isArray(u) ? u : []);
      setRolePermissions(p && typeof p === 'object' ? p : {});
      setBeds(Array.isArray(b) ? b : []);
      setTaxRates(Array.isArray(tax) ? tax : []);
      setPaymentMethods(Array.isArray(pm) ? pm : []);
    } catch (e) {
      console.error("Configuration loadData failed:", e);
      setUsers([]); setRolePermissions({}); setBeds([]); setTaxRates([]); setPaymentMethods([]);
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
      setCatalogData(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Catalog load failed:", e); setCatalogData([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'catalogs') loadCatalog(activeCatalog); }, [activeTab, activeCatalog]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabContainerRef.current) {
        const scrollAmount = 200;
        tabContainerRef.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage('Saving hospital profile settings...');
    localStorage.setItem('h_name', settings.hospitalName);
    localStorage.setItem('h_address', settings.hospitalAddress);
    localStorage.setItem('h_phone', settings.hospitalPhone);
    setTimeout(() => {
      setProcessStatus('success');
      setProcessMessage(t('config_toast_settings_saved'));
      setTimeout(() => setProcessStatus('idle'), 1500);
    }, 500);
  };

  // --- CATALOG HANDLERS ---
  const openCatalogModal = (item?: any) => {
    if (item) {
      setSelectedItem(item);
      setCatalogForm({
        name_en: item.name_en || item.fullName || '',
        name_ar: item.name_ar || '',
        description_en: item.description_en || '',
        cost: item.cost || '',
        base_cost: item.base_cost || '',
        category_en: item.category_en || '',
        related_role: item.related_role || '',
        is_active: item.isActive !== false && item.is_active !== 0
      });
    } else {
      setSelectedItem(null);
      setCatalogForm({ name_en: '', name_ar: '', description_en: '', cost: '', base_cost: '', category_en: '', related_role: '', is_active: true });
    }
    setModalType('catalog');
    setIsModalOpen(true);
  };

  const handleCatalogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage('Updating system catalog...');
    try {
      const payload = { ...catalogForm };
      if (payload.cost) payload.cost = parseFloat(payload.cost);
      if (payload.base_cost) payload.base_cost = parseFloat(payload.base_cost);

      if (selectedItem) {
        switch(activeCatalog) {
          case 'departments': await api.updateDepartment(selectedItem.id, payload); break;
          case 'specializations': await api.updateSpecialization(selectedItem.id, payload); break;
          case 'lab': await api.updateLabTest(selectedItem.id, payload); break;
          case 'nurse': await api.updateNurseService(selectedItem.id, payload); break;
          case 'ops': await api.updateOperationCatalog(selectedItem.id, payload); break;
          case 'insurance': await api.updateInsuranceProvider(selectedItem.id, payload); break;
          case 'banks': await api.updateBank(selectedItem.id, payload); break;
        }
      } else {
        switch(activeCatalog) {
          case 'departments': await api.addDepartment(payload); break;
          case 'specializations': await api.addSpecialization(payload); break;
          case 'lab': await api.addLabTest(payload); break;
          case 'nurse': await api.addNurseService(payload); break;
          case 'ops': await api.addOperationCatalog(payload); break;
          case 'insurance': await api.addInsuranceProvider(payload); break;
          case 'banks': await api.addBank(payload); break;
        }
      }
      setProcessStatus('success');
      loadCatalog(activeCatalog);
      setIsModalOpen(false);
      setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (err: any) {
      setProcessStatus('error');
      setProcessMessage(err.response?.data?.error || "Operation failed");
    }
  };

  const deleteCatalogItem = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_item_title'), message: t('config_dialog_delete_item_msg'),
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Removing item from catalog...');
        try {
          switch(activeCatalog) {
            case 'departments': await api.deleteDepartment(id); break;
            case 'specializations': await api.deleteSpecialization(id); break;
            case 'lab': await api.deleteLabTest(id); break;
            case 'nurse': await api.deleteNurseService(id); break;
            case 'ops': await api.deleteOperationCatalog(id); break;
            case 'insurance': await api.deleteInsuranceProvider(id); break;
            case 'banks': await api.deleteBank(id); break;
          }
          setProcessStatus('success'); loadCatalog(activeCatalog); setTimeout(() => setProcessStatus('idle'), 1000);
        } catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || "Failed to delete item."); 
        }
      }
    });
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
    setProcessMessage('Saving user account details...');
    try {
      if (selectedItem) await api.updateSystemUser(selectedItem.id, userForm);
      else await api.addSystemUser(userForm);
      setProcessStatus('success'); loadData(); setIsModalOpen(false); setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (err: any) { 
      setProcessStatus('error'); 
      setProcessMessage(err.response?.data?.error || "Failed to save user."); 
    }
  };

  const deleteUserAccount = (id: number, username: string) => {
    setConfirmState({
      isOpen: true, title: "Delete Account", message: `Remove system account @${username}? This cannot be undone.`,
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage('Terminating user account...');
        try { 
          await api.deleteSystemUser(id); 
          setProcessStatus('success'); 
          loadData(); 
          setTimeout(() => setProcessStatus('idle'), 1000); 
        }
        catch (e: any) { 
          setProcessStatus('error'); 
          setProcessMessage(e.response?.data?.error || "Failed to delete user.");
        }
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
    setProcessStatus('processing');
    setProcessMessage('Updating tax configurations...');
    const payload = { ...taxForm, rate: parseFloat(taxForm.rate) };
    try {
      if (selectedItem) await api.updateTaxRate(selectedItem.id, payload);
      else await api.addTaxRate(payload);
      setProcessStatus('success'); loadData(); setIsModalOpen(false); setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || "Failed to save tax."); 
    }
  };

  const deleteTaxRateEntry = (id: number) => {
    setConfirmState({
      isOpen: true, title: "Delete Tax Rate", message: "Remove this tax rate configuration?",
      action: async () => { try { await api.deleteTaxRate(id); loadData(); } catch (e) { alert("Failed"); } }
    });
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
    setProcessStatus('processing');
    setProcessMessage('Updating accepted payment methods...');
    try {
      if (selectedItem) await api.updatePaymentMethod(selectedItem.id, paymentForm);
      else await api.addPaymentMethod(paymentForm);
      setProcessStatus('success'); loadData(); setIsModalOpen(false); setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || "Failed to save payment method."); 
    }
  };

  const deletePaymentMethodEntry = (id: number) => {
    setConfirmState({
      isOpen: true, title: "Delete Method", message: "Remove this payment method from the system?",
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
    setProcessStatus('processing');
    setProcessMessage('Updating ward and bed data...');
    const payload = { ...bedForm, costPerDay: parseFloat(bedForm.costPerDay) };
    try {
      if (selectedItem) await api.updateBed(selectedItem.id, payload);
      else await api.addBed(payload);
      setProcessStatus('success'); loadData(); setIsModalOpen(false); setTimeout(() => setProcessStatus('idle'), 1000);
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || "Failed to save bed."); 
    }
  };

  const deleteBedEntry = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_room_title'), message: t('config_dialog_delete_room_msg'),
      action: async () => { try { await api.deleteBed(id); loadData(); } catch (e) { alert("Failed"); } }
    });
  };

  const togglePermission = async (role: string, perm: string) => {
    const current = rolePermissions[role] || [];
    const updated = current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm];
    try {
      await api.updateRolePermissions(role, updated);
      setRolePermissions({ ...rolePermissions, [role]: updated });
    } catch (e) { console.error("Failed to update permission"); }
  };

  const runDiagnostics = async () => {
    setProcessStatus('processing');
    setProcessMessage("Analyzing system nodes...");
    try {
      const data = await api.checkSystemHealth();
      setHealthData(data); setProcessStatus('idle');
    } catch (e: any) { 
      setProcessStatus('error'); 
      setProcessMessage(e.response?.data?.error || "Health check failed."); 
    }
  };

  const handleBackup = async () => {
    setProcessStatus('processing');
    setProcessMessage("Generating system snapshot...");
    try {
      await api.downloadBackup();
      setProcessStatus('success');
      setProcessMessage("Backup downloaded successfully.");
      setTimeout(() => setProcessStatus('idle'), 2000);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || "Failed to download backup.");
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setConfirmState({
      isOpen: true,
      title: "Confirm Restoration",
      message: "This will OVERWRITE your entire database with the uploaded file. This action cannot be undone. Proceed?",
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage("Restoring database state...");
        try {
          await api.restoreDatabase(file);
          setProcessStatus('success');
          setProcessMessage("Database restored successfully. The application will now reload.");
          setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
          setProcessStatus('error');
          setProcessMessage(err.response?.data?.error || "Restore failed. Please ensure the file is a valid SQLite database.");
        }
      }
    });
  };

  const handleReset = () => {
    setConfirmState({
      isOpen: true,
      title: "Factory Reset Warning",
      message: "Are you absolutely sure you want to wipe all system data? This will delete all clinical and financial records. Only default admin accounts will remain.",
      action: async () => {
        setProcessStatus('processing');
        setProcessMessage("Executing factory reset...");
        try {
          await api.resetDatabase();
          setProcessStatus('success');
          setProcessMessage("System reset complete. Redirecting...");
          setTimeout(() => window.location.reload(), 2000);
        } catch (err: any) {
          setProcessStatus('error');
          setProcessMessage("Reset failed.");
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
      {/* IMPROVED SIZE PROCESS HUD */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <><Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('processing')}</h3></>}
            {processStatus === 'success' && <><CheckCircle size={48} className="text-green-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('success')}</h3></>}
            {processStatus === 'error' && <><XCircle size={48} className="text-red-600 mb-4" /><h3 className="font-bold text-slate-900 dark:text-white">{t('patients_process_title_failed')}</h3><p className="text-sm text-red-500 mt-2">{processMessage}</p><Button variant="secondary" className="mt-4 w-full" onClick={() => setProcessStatus('idle')}>{t('close')}</Button></>}
          </div>
        </div>
      )}

      {/* Modern Tab Navigation Slider */}
      <div className="relative group max-w-full">
         <button onClick={() => scrollTabs('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 dark:bg-slate-800/90 shadow-lg rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronLeft size={16}/></button>
         <div ref={tabContainerRef} className="flex bg-slate-100/80 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar scroll-smooth">
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
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-white/5'}`}
              >
                <tab.icon size={14}/> {tab.label}
              </button>
            ))}
         </div>
         <button onClick={() => scrollTabs('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 dark:bg-slate-800/90 shadow-lg rounded-full flex items-center justify-center border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"><ChevronRight size={16}/></button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* --- GENERAL --- */}
        {activeTab === 'general' && (
          <Card title="Hospital Profile">
            <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label={t('config_general_hospital_name')} value={settings.hospitalName} onChange={e => setSettings({...settings, hospitalName: e.target.value})} prefix={<Building size={16}/>} />
                <Input label={t('settings_profile_phone')} value={settings.hospitalPhone} onChange={e => setSettings({...settings, hospitalPhone: e.target.value})} prefix={<Clock size={16}/>} />
                <div className="md:col-span-2"><Input label={t('config_general_address')} value={settings.hospitalAddress} onChange={e => setSettings({...settings, hospitalAddress: e.target.value})} prefix={<Hash size={16}/>} /></div>
              </div>
              <div className="pt-4 border-t dark:border-slate-700"><Button type="submit" icon={Save}>{t('config_general_save_button')}</Button></div>
            </form>
          </Card>
        )}

        {/* --- USERS & PERMISSIONS --- */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <Card title="Permission Matrix" className="!p-0 overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="min-w-full">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                       <tr><th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Feature Group</th>{Object.keys(rolePermissions).map(role => (<th key={role} className="px-4 py-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest min-w-[100px] border-l border-slate-200 dark:border-slate-700">{role}</th>))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                       {permissionGroups.map(group => (
                         <React.Fragment key={group.name}>
                           <tr className="bg-slate-50/50 dark:bg-slate-900/20"><td colSpan={Object.keys(rolePermissions).length + 1} className="px-6 py-2 text-[10px] font-black text-primary-600 uppercase tracking-widest">{group.name}</td></tr>
                           {group.perms.map(perm => (
                             <tr key={perm} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                               <td className="px-6 py-3 text-xs font-bold text-slate-700 dark:text-slate-300">{getPermissionLabel(perm)}</td>
                               {Object.keys(rolePermissions).map(role => {
                                  const hasPerm = rolePermissions[role]?.includes(perm);
                                  const isAdmin = role === 'admin';
                                  return (<td key={role} className="px-4 py-3 text-center border-l border-slate-100 dark:border-slate-800"><button disabled={isAdmin} onClick={() => togglePermission(role, perm)} className={`w-5 h-5 rounded flex items-center justify-center transition-all ${hasPerm ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-transparent'} ${isAdmin ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110'}`}><CheckCircle size={14} /></button></td>);
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
                    <tr><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Username</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Name</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Role</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th><th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th></tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-primary-600">@{u.username}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{u.fullName}</td>
                        <td className="px-6 py-4"><Badge color="blue" className="capitalize">{u.role}</Badge></td>
                        <td className="px-6 py-4"><Badge color={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Locked'}</Badge></td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => openUserModal(u)} icon={Edit}>{t('edit')}</Button>
                            <Button size="sm" variant="danger" onClick={() => deleteUserAccount(u.id, u.username)} icon={Trash2}>{t('delete')}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </Card>
          </div>
        )}

        {/* --- FINANCIAL --- */}
        {activeTab === 'financial' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card title="Tax Rates" action={<Button size="sm" icon={Plus} onClick={() => openTaxModal()} />}>
                <div className="space-y-4">
                   {taxRates.map(t_rate => (
                     <div key={t_rate.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div><p className="font-bold text-sm">{language === 'ar' ? t_rate.name_ar : t_rate.name_en}</p><div className="flex items-center gap-2"><span className="text-xs font-black text-primary-600">{t_rate.rate}%</span><Badge color={t_rate.isActive ? 'green' : 'gray'} className="text-[9px] uppercase">{t_rate.isActive ? 'Active' : 'Hidden'}</Badge></div></div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openTaxModal(t_rate)} icon={Edit}>{t('edit')}</Button>
                          <Button size="sm" variant="danger" onClick={() => deleteTaxRateEntry(t_rate.id)} icon={Trash2}>{t('delete')}</Button>
                        </div>
                     </div>
                   ))}
                </div>
             </Card>
             <Card title="Payment Methods" action={<Button size="sm" icon={Plus} onClick={() => openPaymentModal()} />}>
                <div className="space-y-4">
                   {paymentMethods.map(m => (
                     <div key={m.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3"><div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-emerald-600 shadow-sm"><CreditCard size={18}/></div><div><p className="font-bold text-sm">{language === 'ar' ? m.name_ar : m.name_en}</p><Badge color={m.isActive ? 'green' : 'gray'} className="text-[9px] uppercase">{m.isActive ? 'Enabled' : 'Disabled'}</Badge></div></div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openPaymentModal(m)} icon={Edit}>{t('edit')}</Button>
                          <Button size="sm" variant="danger" onClick={() => deletePaymentMethodEntry(m.id)} icon={Trash2}>{t('delete')}</Button>
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Room #</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Ward Type</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th><th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Daily Rate</th><th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {beds.map(b => {
                    const isLocked = b.status === 'occupied' || b.status === 'reserved';
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 group">
                        <td className="px-6 py-4 font-black text-slate-800 dark:text-white flex items-center gap-2"><Bed size={14} className="text-slate-300 group-hover:text-primary-500 transition-colors" />{b.roomNumber}</td>
                        <td className="px-6 py-4 text-sm font-medium">{b.type}</td>
                        <td className="px-6 py-4"><Badge color={b.status === 'available' ? 'green' : (b.status === 'occupied' || b.status === 'reserved') ? 'red' : 'orange'}>{b.status}</Badge></td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-primary-600">${b.costPerDay}</td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              {!isLocked ? (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => openBedModal(b)} icon={Edit}>{t('edit')}</Button>
                                  <Button size="sm" variant="danger" onClick={() => deleteBedEntry(b.id)} icon={Trash2}>{t('delete')}</Button>
                                </>
                              ) : (
                                <div title="Bed is currently in use" className="p-1.5 text-slate-300 cursor-help flex items-center gap-1 text-xs font-bold"><Lock size={14}/> {t('Locked')}</div>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  <button key={cat.id} onClick={() => setActiveCatalog(cat.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeCatalog === cat.id ? 'bg-primary-50 border-primary-200 text-primary-700 shadow-sm' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-500 hover:border-slate-300'}`}><cat.icon size={14}/> {cat.label}</button>
                ))}
             </div>
             <Card title={`${activeCatalog.charAt(0).toUpperCase() + activeCatalog.slice(1)} Catalog`} action={<Button size="sm" icon={Plus} onClick={() => openCatalogModal()}>Add Entry</Button>} className="!p-0 overflow-hidden">
                <table className="min-w-full divide-y">
                   <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Entry Name</th><th className="px-6 py-4 text-left text-[10px] font-black uppercase text-slate-500 tracking-widest">Local (AR)</th>{activeCatalog === 'lab' || activeCatalog === 'nurse' || activeCatalog === 'ops' ? (<th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Cost/Base</th>) : <th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">ID</th>}<th className="px-6 py-4 text-right text-[10px] font-black uppercase text-slate-500 tracking-widest">Actions</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {catalogData.map((item, i) => (
                        <tr key={item.id || i} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                           <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{item.name_en || item.fullName || 'Unnamed'}</td>
                           <td className="px-6 py-4 text-sm font-medium text-slate-500 dark:text-slate-400">{item.name_ar || '-'}</td>
                           <td className="px-6 py-4 text-right">{item.cost !== undefined || item.base_cost !== undefined ? (<span className="font-mono font-bold text-primary-600">${(item.cost || item.base_cost || 0).toLocaleString()}</span>) : <span className="text-[10px] font-black text-slate-300">#{item.id}</span>}</td>
                           <td className="px-6 py-4 text-right">
                             <div className="flex justify-end gap-2">
                               <Button size="sm" variant="outline" onClick={() => openCatalogModal(item)} icon={Edit}>{t('edit')}</Button>
                               <Button size="sm" variant="danger" onClick={() => deleteCatalogItem(item.id)} icon={Trash2}>{t('delete')}</Button>
                             </div>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </Card>
          </div>
        )}

        {/* --- DATA --- */}
        {activeTab === 'data' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <Card title="System Snapshot"><p className="text-sm text-slate-500 mb-6 leading-relaxed">Securely download a full binary mirror of the HMS database. This includes all patients, financial logs, and staff records.</p><Button variant="outline" icon={Download} onClick={handleBackup} className="w-full py-4 text-md">Export .DB Snapshot</Button></Card>
             <Card title="Database Restoration"><p className="text-sm text-slate-500 mb-6 leading-relaxed">Restore the system using a valid AllCare .db file. This will completely overwrite existing data. Proceed with caution.</p><div className="relative"><input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleRestore} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" /><Button variant="secondary" icon={Upload} className="w-full py-4 text-md">Upload & Restore</Button></div></Card>
             <Card title="Danger Zone" className="border-rose-100 bg-rose-50/20"><p className="text-sm text-rose-600 mb-6 font-bold uppercase tracking-wider flex items-center gap-2"><AlertTriangle size={16}/> Warning: Irreversible</p><p className="text-xs text-rose-500/80 mb-6 italic">Performing a factory reset will wipe all clinical and financial history, keeping only the default admin account.</p><Button variant="danger" icon={RotateCcw} onClick={handleReset} className="w-full py-4 text-md">Execute Factory Reset</Button></Card>
          </div>
        )}

        {/* --- DIAGNOSTICS --- */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-6">
             <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border shadow-soft">
                <div><h3 className="font-bold text-lg">System Health Monitor</h3><p className="text-xs text-slate-500">Live operational diagnostics for the HMS backend</p></div>
                <Button icon={Activity} onClick={runDiagnostics}>Refresh Status</Button>
             </div>
             {healthData ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <HealthStat icon={Server} label="API Status" value={healthData.status} color="text-emerald-500" />
                  <HealthStat icon={Clock} label="Server Uptime" value={`${Math.round(healthData.uptime / 3600)} hrs`} color="text-blue-500" />
                  <HealthStat icon={Cpu} label="CPU Latency" value={healthData.database?.latency || '-'} color="text-violet-500" />
                  <HealthStat icon={HardDrive} label="RAM Usage" value={healthData.memory?.rss || '-'} color="text-orange-500" />
                  <div className="md:col-span-2 lg:col-span-4 mt-4"><Card title="Backend Technical JSON"><pre className="text-[10px] font-mono bg-slate-900 text-emerald-400 p-4 rounded-xl overflow-x-auto">{JSON.stringify(healthData, null, 2)}</pre></Card></div>
               </div>
             ) : (<div className="p-20 text-center border-2 border-dashed rounded-3xl opacity-50"><Activity size={48} className="mx-auto mb-4 text-slate-300" /><p className="font-bold text-slate-400">Run diagnostics to see live metrics.</p></div>)}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedItem ? `Update Entry` : `Add New Entry`}>
         {modalType === 'user' && (
            <form onSubmit={handleUserSubmit} className="space-y-4">
               <Input label="Full Name" required value={userForm.fullName} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
               <div className="grid grid-cols-2 gap-4"><Input label="Username" required disabled={!!selectedItem} value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /><Select label="System Role" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as Role})}><option value="admin">Admin</option><option value="manager">Manager</option><option value="receptionist">Receptionist</option><option value="doctor">Doctor</option><option value="accountant">Accountant</option><option value="hr">HR</option></Select></div>
               <Input label="Password" type="password" required={!selectedItem} placeholder={selectedItem ? "Leave empty to keep current" : "••••••••"} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
               <div className="flex items-center gap-2 py-2"><input type="checkbox" id="userActive" checked={userForm.isActive} onChange={e => setUserForm({...userForm, isActive: e.target.checked})} /><label htmlFor="userActive" className="text-sm font-bold">Account is Active</label></div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Account' : 'Create Account'}</Button>
            </form>
         )}

         {modalType === 'catalog' && (
            <form onSubmit={handleCatalogSubmit} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input label="Name (EN)" required value={catalogForm.name_en} onChange={e => setCatalogForm({...catalogForm, name_en: e.target.value})} />
                  <Input label="Name (AR)" required value={catalogForm.name_ar} onChange={e => setCatalogForm({...catalogForm, name_ar: e.target.value})} />
               </div>
               {activeCatalog === 'specializations' && (<Select label="Linked Role" value={catalogForm.related_role} onChange={e => setCatalogForm({...catalogForm, related_role: e.target.value})}><option value="">Any</option><option value="doctor">Doctor</option><option value="nurse">Nurse</option><option value="technician">Technician</option><option value="pharmacist">Pharmacist</option></Select>)}
               {(activeCatalog === 'lab' || activeCatalog === 'nurse') && (<Input label="Service Cost ($)" type="number" required value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} />)}
               {activeCatalog === 'ops' && (<Input label="Base Cost ($)" type="number" required value={catalogForm.base_cost} onChange={e => setCatalogForm({...catalogForm, base_cost: e.target.value})} />)}
               {activeCatalog === 'lab' && (<Input label="Category (e.g. Hematology)" value={catalogForm.category_en} onChange={e => setCatalogForm({...catalogForm, category_en: e.target.value})} />)}
               {(activeCatalog === 'insurance' || activeCatalog === 'banks') && (<div className="flex items-center gap-2 py-2"><input type="checkbox" id="catActive" checked={catalogForm.is_active} onChange={e => setCatalogForm({...catalogForm, i_sactive: e.target.checked})} /><label htmlFor="catActive" className="text-sm font-bold">Active Entry</label></div>)}
               <Button type="submit" className="w-full">{selectedItem ? 'Update Catalog' : 'Add to Catalog'}</Button>
            </form>
         )}

         {modalType === 'tax' && (
            <form onSubmit={handleTaxSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4"><Input label="Name (EN)" required value={taxForm.name_en} onChange={e => setTaxForm({...taxForm, name_en: e.target.value})} /><Input label="Name (AR)" required value={taxForm.name_ar} onChange={e => setTaxForm({...taxForm, name_ar: e.target.value})} /></div>
               <Input label="Rate (%)" type="number" step="0.01" required value={taxForm.rate} onChange={e => setTaxForm({...taxForm, rate: e.target.value})} />
               <div className="flex items-center gap-2 py-2"><input type="checkbox" id="taxActive" checked={taxForm.is_active} onChange={e => setTaxForm({...taxForm, is_active: e.target.checked})} /><label htmlFor="taxActive" className="text-sm font-bold">Enabled for Billing</label></div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Tax' : 'Add Tax Rate'}</Button>
            </form>
         )}

         {modalType === 'payment' && (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4"><Input label="Method (EN)" required value={paymentForm.name_en} onChange={e => setPaymentForm({...paymentForm, name_en: e.target.value})} /><Input label="Method (AR)" required value={paymentForm.name_ar} onChange={e => setPaymentForm({...paymentForm, name_ar: e.target.value})} /></div>
               <div className="flex items-center gap-2 py-2"><input type="checkbox" id="pmActive" checked={paymentForm.is_active} onChange={e => setPaymentForm({...paymentForm, is_active: e.target.checked})} /><label htmlFor="pmActive" className="text-sm font-bold">Active Selection</label></div>
               <Button type="submit" className="w-full">{selectedItem ? 'Update Method' : 'Add Method'}</Button>
            </form>
         )}

         {modalType === 'bed' && (
            <form onSubmit={handleBedSubmit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4"><Input label="Room/Bed Number" required value={bedForm.roomNumber} onChange={e => setBedForm({...bedForm, roomNumber: e.target.value})} /><Select label="Ward Type" value={bedForm.type} onChange={e => setBedForm({...bedForm, type: e.target.value})}><option>General</option><option>Private</option><option>ICU</option><option>Emergency</option></Select></div>
               <Input label="Cost Per Day ($)" type="number" required value={bedForm.costPerDay} onChange={e => setBedForm({...bedForm, costPerDay: e.target.value})} />
               <Button type="submit" className="w-full">{selectedItem ? 'Update Ward Info' : 'Create Bed'}</Button>
            </form>
         )}
      </Modal>

      <ConfirmationDialog isOpen={confirmState.isOpen} onClose={() => setConfirmState({...confirmState, isOpen: false})} onConfirm={confirmState.action} title={confirmState.title} message={confirmState.message} />
    </div>
  );
};

const HealthStat = ({ icon: Icon, label, value, color }: any) => (
  <Card className="!p-5 bg-white dark:bg-slate-800 hover:shadow-lg transition-all group">
     <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-900 group-hover:bg-primary-50 transition-colors ${color}`}><Icon size={24} /></div>
        <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p><p className="text-xl font-black text-slate-800 dark:text-white capitalize">{value}</p></div>
     </div>
  </Card>
);
