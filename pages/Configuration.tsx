
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea, ConfirmationDialog } from '../components/UI';
import { 
  Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save, Edit, 
  Bed, Users, Loader2, CheckCircle, XCircle, AlertTriangle, Upload, Download, Server, 
  CreditCard, RotateCcw, Shield, Lock, Activity, RefreshCw, Briefcase, FlaskConical, Stethoscope 
} from 'lucide-react';
import { api } from '../services/api';
import { LabTestCatalog, NurseServiceCatalog, OperationCatalog, Bed as BedType, User, Role, TaxRate, PaymentMethod, InsuranceProvider } from '../types';
import { Permissions } from '../utils/rbac';
import { useTranslation } from '../context/TranslationContext';

type CatalogType = 'dept' | 'spec' | 'lab' | 'nurse' | 'ops' | 'insurance' | 'banks';

const permissionGroups: Record<string, string[]> = {
  'permission_group_general': ['VIEW_DASHBOARD'],
  'permission_group_patients': ['VIEW_PATIENTS', 'MANAGE_PATIENTS', 'DELETE_PATIENTS'],
  'permission_group_appointments': ['VIEW_APPOINTMENTS', 'MANAGE_APPOINTMENTS', 'DELETE_APPOINTMENTS'],
  'permission_group_billing': ['VIEW_BILLING', 'MANAGE_BILLING', 'DELETE_BILLING'],
  'permission_group_hr': ['VIEW_HR', 'MANAGE_HR', 'DELETE_HR'],
  'permission_group_admissions': ['VIEW_ADMISSIONS', 'MANAGE_ADMISSIONS', 'DELETE_ADMISSIONS'],
  'permission_group_laboratory': ['VIEW_LABORATORY', 'MANAGE_LABORATORY', 'DELETE_LABORATORY'],
  'permission_group_operations': ['VIEW_OPERATIONS', 'MANAGE_OPERATIONS', 'DELETE_OPERATIONS'],
  'permission_group_reports': ['VIEW_REPORTS', 'MANAGE_REPORTS', 'VIEW_RECORDS'],
  'permission_group_system': ['VIEW_SETTINGS', 'MANAGE_SETTINGS', 'MANAGE_CONFIGURATION'],
};

const DiagnosticStat = ({ title, value, icon: Icon }: any) => (
  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-primary-600">
       <Icon size={20} />
    </div>
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</p>
      <p className="text-lg font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  </div>
);

export const Configuration = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'general' | 'beds' | 'catalogs' | 'users' | 'data' | 'financial' | 'diagnostics'>('general');
  const [loading, setLoading] = useState(true);
  
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    type?: 'danger' | 'warning';
  }>({ isOpen: false, title: '', message: '', action: () => {} });

  // Data States
  const [settings, setSettings] = useState({ hospitalName: '', hospitalAddress: '', hospitalPhone: '', currency: '$' });
  const [healthData, setHealthData] = useState<any>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [beds, setBeds] = useState<BedType[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [specializations, setSpecializations] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [taxes, setTaxes] = useState<TaxRate[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  // Modal & Form States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState<any>({});
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userTabMode, setUserTabMode] = useState<'accounts' | 'roles'>('accounts');
  const [availableRoles] = useState<string[]>(['admin', 'manager', 'receptionist', 'technician', 'accountant', 'doctor', 'nurse', 'pharmacist', 'hr']);
  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [bedForm, setBedForm] = useState<Partial<BedType>>({});
  const [editingBedId, setEditingBedId] = useState<number | null>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogType>('lab');
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [itemFormData, setItemFormData] = useState<any>({});
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [financeForm, setFinanceForm] = useState<any>({});
  const [editingFinanceId, setEditingFinanceId] = useState<number | null>(null);
  const [financeTab, setFinanceTab] = useState<'tax' | 'payment'>('tax');
  const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);


  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, d, sp, b, l, n, o, ip, bn, u, t, p, rPerms] = await Promise.all([
        api.getSystemSettings(),
        api.getDepartments(),
        api.getSpecializations(),
        api.getBeds(), 
        api.getLabTests(),
        api.getNurseServices(),
        api.getOperations(),
        api.getInsuranceProviders(),
        api.getBanks(),
        api.getSystemUsers(),
        api.getTaxRates(),
        api.getPaymentMethods(),
        api.getRolePermissions()
      ]);
      if (s) setSettings(prev => ({ ...prev, hospitalName: s.hospitalName || '', hospitalAddress: s.hospitalAddress || '', hospitalPhone: s.hospitalPhone || '', currency: s.currency || '$' }));
      setDepartments(Array.isArray(d) ? d : []);
      setSpecializations(Array.isArray(sp) ? sp : []);
      setBeds(Array.isArray(b) ? b : []);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setOperations(Array.isArray(o) ? o : []);
      setInsuranceProviders(Array.isArray(ip) ? ip : []);
      setBanks(Array.isArray(bn) ? bn : []);
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

  useEffect(() => { loadAllData(); }, []);

  const handleAction = async (action: () => Promise<void>, successMsg: string) => {
    setProcessStatus('processing');
    setProcessMessage(t('processing'));
    try {
      await action();
      setProcessStatus('success');
      setProcessMessage(successMsg);
      await loadAllData(true);
      setTimeout(() => { setProcessStatus('idle'); }, 1500);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || e.message || 'An error occurred');
    }
  };

  // --- Handlers for each section ---

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      await api.updateSystemSettings(settings);
      if (settings.hospitalName) localStorage.setItem('hospital_name', settings.hospitalName);
    }, t('config_toast_settings_saved'));
  };

  // User Handlers
  const openUserModal = (user?: any) => {
    setEditingUserId(user ? user.id : null);
    setUserForm(user ? { ...user, password: '' } : { username: '', fullName: '', role: 'manager', isActive: true });
    setIsUserModalOpen(true);
  };
  const handleUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (editingUserId) await api.updateSystemUser(editingUserId, userForm);
      else await api.addSystemUser(userForm);
      setIsUserModalOpen(false);
    }, editingUserId ? t('config_toast_user_updated') : t('config_toast_user_created'));
  };
  const handleDeleteUser = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_user_title'), message: t('config_dialog_delete_user_msg'),
      action: () => handleAction(async () => await api.deleteSystemUser(id), t('config_toast_user_deleted'))
    });
  };
  const togglePermission = (role: string, permission: string) => {
    if (role === 'admin') return;
    const currentPerms = rolePermissions[role] || [];
    const updatedPerms = currentPerms.includes(permission) ? currentPerms.filter(p => p !== permission) : [...currentPerms, permission];
    setRolePermissions(prev => ({ ...prev, [role]: updatedPerms }));
  };
  const savePermissions = (role: string) => {
    handleAction(async () => await api.updateRolePermissions(role, rolePermissions[role] || []), t('config_toast_perms_updated', {role}));
  };

  // Bed Handlers
  const openBedModal = (bed?: BedType) => {
    setEditingBedId(bed ? bed.id : null);
    // Ensure default values to prevent uncontrolled input issues
    setBedForm(bed ? { ...bed } : { roomNumber: '', type: 'General', status: 'available', costPerDay: 0 });
    setIsBedModalOpen(true);
  };
  const handleBedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (editingBedId) await api.updateBed(editingBedId, bedForm);
      else await api.addBed(bedForm);
      setIsBedModalOpen(false);
    }, editingBedId ? t('config_toast_room_updated') : t('config_toast_room_added'));
  };
  const handleDeleteBed = (id: number) => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_room_title'), message: t('config_dialog_delete_room_msg'),
      action: () => handleAction(async () => await api.deleteBed(id), t('config_toast_room_deleted'))
    });
  };

  // Catalog Handlers
  const openItemModal = (item?: any) => {
    setEditingItemId(item ? item.id : null);
    setItemFormData(item ? { ...item } : {});
    setIsItemModalOpen(true);
  };
  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { apiAdd, apiUpdate } = catalogMetadata[catalogTab];
    handleAction(async () => {
      if (editingItemId) await apiUpdate(editingItemId, itemFormData);
      else await apiAdd(itemFormData);
      setIsItemModalOpen(false);
    }, editingItemId ? t('config_toast_item_updated') : t('config_toast_item_added'));
  };
  const handleDeleteItem = (id: number) => {
    const { apiDelete } = catalogMetadata[catalogTab];
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_item_title'), message: t('config_dialog_delete_item_msg'),
      action: () => handleAction(async () => await apiDelete(id), t('config_toast_item_deleted'))
    });
  };

  // Financial Handlers
  const openFinanceModal = (type: 'tax' | 'payment', item?: any) => {
    setFinanceTab(type);
    setEditingFinanceId(item ? item.id : null);
    setFinanceForm(item ? { ...item } : { name_en: '', name_ar: '', isActive: true });
    setIsFinanceModalOpen(true);
  };
  const handleFinanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAction(async () => {
      if (financeTab === 'tax') {
        if (editingFinanceId) await api.updateTaxRate(editingFinanceId, financeForm);
        else await api.addTaxRate(financeForm);
      } else {
        if (editingFinanceId) await api.updatePaymentMethod(editingFinanceId, financeForm);
        else await api.addPaymentMethod(financeForm);
      }
      setIsFinanceModalOpen(false);
    }, editingFinanceId ? t('config_toast_item_updated') : t('config_toast_item_added'));
  };
  const handleDeleteFinance = (id: number, type: 'tax' | 'payment') => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_delete_item_title'), message: t('config_dialog_delete_item_msg'),
      action: () => handleAction(async () => {
        if (type === 'tax') await api.deleteTaxRate(id);
        else await api.deletePaymentMethod(id);
      }, t('config_toast_item_deleted'))
    });
  };

  // Data Management Handlers
  const handleDownloadBackup = () => api.downloadBackup();
  const handleRestoreDatabase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) return;
    setConfirmState({
      isOpen: true, title: t('config_dialog_overwrite_db_title'), message: t('config_dialog_overwrite_db_msg'), type: 'danger',
      action: () => handleAction(async () => {
        await api.restoreDatabase(restoreFile);
        setTimeout(() => window.location.reload(), 1500);
      }, t('config_toast_db_restored'))
    });
  };
  const handleResetDatabase = () => {
    setConfirmState({
      isOpen: true, title: t('config_dialog_factory_reset_title'), message: t('config_dialog_factory_reset_msg'), type: 'danger',
      action: () => handleAction(async () => {
          await api.resetDatabase();
          setTimeout(() => window.location.reload(), 2000);
      }, t('config_toast_db_reset'))
    });
  };
  
  // Diagnostics
  const runDiagnostics = async () => {
    setIsTesting(true);
    setTestLogs([t('config_diag_start')]);
    try {
      const addLog = (msg: string) => setTestLogs(prev => [...prev, msg]);
      await new Promise(res => setTimeout(res, 300));
      
      addLog(t('config_diag_check_api'));
      const health = await api.checkSystemHealth();
      setHealthData(health);
      addLog(t('config_diag_server_ok', {uptime: (health.uptime / 60).toFixed(1)}));
      
      await new Promise(res => setTimeout(res, 500));
      addLog(t('config_diag_verify_db'));
      addLog(t('config_diag_db_ok', {latency: health.database.latency}));
      
      await new Promise(res => setTimeout(res, 300));
      addLog(t('config_diag_all_ok'));
    } catch (e: any) {
      setTestLogs(prev => [...prev, t('config_diag_failed', {error: e.message})]);
      setHealthData({ status: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  // --- DYNAMIC CATALOG CONFIGURATION ---
  const catalogMetadata: Record<CatalogType, any> = {
    dept: {
      label: t('config_catalog_dept'),
      data: departments,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'description_en', label: t('config_field_desc_en'), type: 'textarea' },
        { name: 'description_ar', label: t('config_field_desc_ar'), type: 'textarea' },
      ],
      apiAdd: api.addDepartment, apiUpdate: api.updateDepartment, apiDelete: api.deleteDepartment
    },
    spec: {
      label: t('config_catalog_spec'),
      data: specializations,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'related_role', label: t('config_field_related_role'), type: 'select', options: availableRoles },
        { name: 'description_en', label: t('config_field_desc_en'), type: 'textarea' },
        { name: 'description_ar', label: t('config_field_desc_ar'), type: 'textarea' },
      ],
      apiAdd: api.addSpecialization, apiUpdate: api.updateSpecialization, apiDelete: api.deleteSpecialization
    },
    lab: {
      label: t('config_catalog_lab'),
      data: labTests,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'category_en', label: t('config_field_category_en'), type: 'text' },
        { name: 'category_ar', label: t('config_field_category_ar'), type: 'text' },
        { name: 'cost', label: t('config_field_cost'), type: 'number', prefix: '$' },
        { name: 'normal_range', label: t('config_field_normal_range'), type: 'text' },
      ],
      apiAdd: api.addLabTest, apiUpdate: api.updateLabTest, apiDelete: api.deleteLabTest
    },
    nurse: {
      label: t('config_catalog_nurse'),
      data: nurseServices,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'description_en', label: t('config_field_desc_en'), type: 'textarea' },
        { name: 'description_ar', label: t('config_field_desc_ar'), type: 'textarea' },
        { name: 'cost', label: t('config_field_cost'), type: 'number', prefix: '$' },
      ],
      apiAdd: api.addNurseService, apiUpdate: api.updateNurseService, apiDelete: api.deleteNurseService
    },
    ops: {
      label: t('config_catalog_ops'),
      data: operations,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'base_cost', label: t('config_field_base_cost'), type: 'number', prefix: '$' },
      ],
      apiAdd: api.addOperationCatalog, apiUpdate: api.updateOperationCatalog, apiDelete: api.deleteOperationCatalog
    },
    insurance: {
      label: t('config_catalog_insurance'),
      data: insuranceProviders,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'is_active', label: t('config_field_status'), type: 'toggle' },
      ],
      apiAdd: api.addInsuranceProvider, apiUpdate: api.updateInsuranceProvider, apiDelete: api.deleteInsuranceProvider
    },
    banks: {
      label: t('config_catalog_banks'),
      data: banks,
      fields: [
        { name: 'name_en', label: t('config_field_name_en'), type: 'text', required: true },
        { name: 'name_ar', label: t('config_field_name_ar'), type: 'text', required: true },
        { name: 'is_active', label: t('config_field_status'), type: 'toggle' },
      ],
      apiAdd: api.addBank, apiUpdate: api.updateBank, apiDelete: api.deleteBank
    }
  };

  const formatPermissionName = (p: string) => {
    return p.replace(/_/g, ' ').toLowerCase();
  };


  return (
    <div className="space-y-6">
      {/* STATUS OVERLAY */}
      {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center">
            {processStatus === 'processing' && <Loader2 className="w-12 h-12 text-primary-600 animate-spin mb-4" />}
            {processStatus === 'success' && <CheckCircle className="w-12 h-12 text-green-600 mb-4" />}
            {processStatus === 'error' && <XCircle className="w-12 h-12 text-red-600 mb-4" />}
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{processStatus === 'processing' ? t('patients_process_title_processing') : processStatus === 'success' ? t('patients_process_title_success') : t('patients_process_title_failed')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-6">{processMessage}</p>
            {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')} className="w-full">{t('patients_process_close_button')}</Button>}
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('config_title')}</h1>

      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-4 pt-2 overflow-x-auto">
        {[
          { id: 'general', icon: SettingsIcon, label: t('config_tab_general') },
          { id: 'users', icon: Shield, label: t('config_tab_roles') }, 
          { id: 'financial', icon: CreditCard, label: t('config_tab_financial') },
          { id: 'beds', icon: Bed, label: t('config_tab_beds') },
          { id: 'catalogs', icon: Database, label: t('config_tab_catalogs') },
          { id: 'data', icon: Server, label: t('config_tab_data') },
          { id: 'diagnostics', icon: Activity, label: t('config_tab_health') }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-5 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap 
              ${activeTab === tab.id 
                ? 'border-primary-600 text-primary-600 bg-primary-50/50 dark:bg-primary-900/20' 
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <tab.icon size={18}/> {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 border-gray-200 dark:border-slate-700 p-6 min-h-[400px] relative">
        {loading && <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-800/80 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>}

        {!loading && (
          <>
            {activeTab === 'general' && (
              <form onSubmit={handleSaveSettings} className="max-w-xl space-y-6 animate-in fade-in">
                <Input label={t('config_general_hospital_name')} value={settings.hospitalName} onChange={e => setSettings({...settings, hospitalName: e.target.value})} />
                <Input label={t('config_general_address')} value={settings.hospitalAddress} onChange={e => setSettings({...settings, hospitalAddress: e.target.value})} />
                <Input label={t('settings_profile_phone')} value={settings.hospitalPhone} onChange={e => setSettings({...settings, hospitalPhone: e.target.value})} />
                <div className="pt-4 border-t dark:border-slate-700">
                  <Button type="submit" icon={Save}>{t('config_general_save_button')}</Button>
                </div>
              </form>
            )}

            {activeTab === 'users' && (
              <div className="animate-in fade-in">
                <div className="flex gap-2 mb-6">
                   <Button variant={userTabMode === 'accounts' ? 'primary' : 'outline'} onClick={() => setUserTabMode('accounts')} icon={Users}>{t('config_users_accounts_tab')}</Button>
                   <Button variant={userTabMode === 'roles' ? 'primary' : 'outline'} onClick={() => setUserTabMode('roles')} icon={Lock}>{t('config_users_roles_tab')}</Button>
                </div>

                {userTabMode === 'accounts' ? (
                  <>
                    <div className="flex justify-end mb-4"><Button icon={Plus} onClick={() => openUserModal()}>{t('config_users_add_button')}</Button></div>
                    <div className="overflow-x-auto border rounded-xl shadow-sm">
                      <table className="min-w-full divide-y">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_users_header_user')}</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_users_header_role')}</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('config_users_header_status')}</th>
                            <th className="px-4 py-3 text-right">{t('actions')}</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y dark:bg-slate-800">
                          {users.map(user => (
                            <tr key={user.id}>
                              <td className="px-4 py-3"><div className="font-medium">{user.fullName}</div><div className="text-xs text-slate-500">{user.username}</div></td>
                              <td className="px-4 py-3 capitalize"><Badge color="blue">{user.role}</Badge></td>
                              <td className="px-4 py-3 text-center"><Badge color={user.isActive ? 'green' : 'gray'}>{user.isActive ? t('config_users_active') : t('config_users_inactive')}</Badge></td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                    <Button size="sm" variant="outline" onClick={() => openUserModal(user)} icon={Edit}>{t('edit')}</Button>
                                    <Button size="sm" variant="danger" onClick={() => handleDeleteUser(user.id)} icon={Trash2}>{t('delete')}</Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                      <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">
                            {t('config_users_feature_column')}
                          </th>
                          {availableRoles.map(role => (
                            <th key={role} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                              <div className="flex flex-col items-center gap-2">
                                <span className="capitalize">{role}</span>
                                {role !== 'admin' && (
                                  <Button size="sm" onClick={() => savePermissions(role)} className="!px-2 !py-0.5 !text-[10px] h-auto">
                                    {t('config_users_permissions_save_button')}
                                  </Button>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800">
                        {Object.entries(permissionGroups).map(([groupKey, perms]) => (
                          <React.Fragment key={groupKey}>
                            <tr className="bg-slate-50/50 dark:bg-slate-900/50">
                              <td colSpan={availableRoles.length + 1} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300">
                                {t(groupKey)}
                              </td>
                            </tr>
                            {perms.map(p => (
                              <tr key={p} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                                  {formatPermissionName(p)}
                                </td>
                                {availableRoles.map(role => (
                                  <td key={`${role}-${p}`} className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      className="h-5 w-5 rounded text-primary-600 focus:ring-primary-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                                      checked={(rolePermissions[role] || []).includes(p)}
                                      onChange={() => togglePermission(role, p)}
                                      disabled={role === 'admin'}
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'financial' && (
              <div className="animate-in fade-in">
                <div className="flex gap-2 mb-6">
                   <Button variant={financeTab === 'tax' ? 'primary' : 'outline'} onClick={() => setFinanceTab('tax')}>{t('config_financial_tax_tab')}</Button>
                   <Button variant={financeTab === 'payment' ? 'primary' : 'outline'} onClick={() => setFinanceTab('payment')}>{t('config_financial_payment_tab')}</Button>
                </div>
                {financeTab === 'tax' ? (
                  <div>
                    <div className="flex justify-end mb-4"><Button size="sm" icon={Plus} onClick={() => openFinanceModal('tax')}>{t('add')}</Button></div>
                    {taxes.map(t => (
                        <div key={t.id} className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded transition-colors">
                            <span>{t.name_en} ({t.rate}%)</span>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openFinanceModal('tax', t)} icon={Edit}>{t('edit')}</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteFinance(t.id, 'tax')} icon={Trash2}>{t('delete')}</Button>
                            </div>
                        </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-end mb-4"><Button size="sm" icon={Plus} onClick={() => openFinanceModal('payment')}>{t('add')}</Button></div>
                    {paymentMethods.map(p => (
                        <div key={p.id} className="flex justify-between items-center py-2 border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 px-2 rounded transition-colors">
                            <div className="flex items-center gap-2">
                                <span>{p.name_en}</span>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openFinanceModal('payment', p)} icon={Edit}>{t('edit')}</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteFinance(p.id, 'payment')} icon={Trash2}>{t('delete')}</Button>
                            </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'beds' && (
              <div className="animate-in fade-in">
                <div className="flex justify-end mb-4"><Button icon={Plus} onClick={() => openBedModal()}>{t('config_beds_add_button')}</Button></div>
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="min-w-full divide-y">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_beds_header_room')}</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_beds_header_type')}</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('config_beds_header_cost')}</th>
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase">{t('config_beds_header_status')}</th>
                        <th className="px-4 py-3 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y dark:bg-slate-800">
                      {beds.map(bed => (
                        <tr key={bed.id}>
                          <td className="px-4 py-3 font-medium">{bed.roomNumber}</td>
                          <td className="px-4 py-3">{bed.type}</td>
                          <td className="px-4 py-3 text-right font-mono">${bed.costPerDay}</td>
                          <td className="px-4 py-3 text-center capitalize"><Badge color={bed.status === 'available' ? 'green' : bed.status === 'cleaning' ? 'purple' : 'red'}>{t(`config_bed_status_${bed.status}`)}</Badge></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openBedModal(bed)} icon={Edit}>{t('edit')}</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteBed(bed.id)} icon={Trash2}>{t('delete')}</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'catalogs' && (
              <div className="animate-in fade-in">
                <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
                  <div className="flex gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                    {Object.keys(catalogMetadata).map(key => (
                      <button 
                        key={key}
                        onClick={() => setCatalogTab(key as CatalogType)} 
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm whitespace-nowrap ${catalogTab === key ? 'bg-white dark:bg-slate-800 text-primary-700 shadow' : 'bg-transparent text-gray-500 hover:text-gray-700'}`}
                      >
                        {catalogMetadata[key as CatalogType].label}
                      </button>
                    ))}
                  </div>
                  <Button size="sm" icon={Plus} onClick={() => openItemModal()}>{t('config_catalogs_add_button')}</Button>
                </div>

                <div className="overflow-x-auto border rounded-xl shadow-sm">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50/80 dark:bg-slate-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_catalogs_header_name_en')}</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{t('config_catalogs_header_name_ar')}</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">{t('config_catalogs_header_details')}</th>
                        <th className="px-4 py-3 text-right">{t('actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {catalogMetadata[catalogTab].data.map((item: any) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name_en}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300">{item.name_ar}</td>
                          <td className="px-4 py-3 text-sm text-right font-mono text-slate-500">
                            {item.cost !== undefined && `$${item.cost}`}
                            {item.base_cost !== undefined && `$${item.base_cost}`}
                            {item.rate !== undefined && `${item.rate}%`}
                            {item.related_role && <span className="mr-2 text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{item.related_role}</span>}
                            {item.isActive !== undefined && <Badge color={item.isActive ? 'green' : 'gray'}>{item.isActive ? t('config_users_active') : t('config_users_inactive')}</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                                <Button size="sm" variant="ghost" onClick={() => openItemModal(item)} icon={Edit}>{t('edit')}</Button>
                                <Button size="sm" variant="danger" onClick={() => handleDeleteItem(item.id)} icon={Trash2}>{t('delete')}</Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {activeTab === 'data' && (
              <div className="max-w-xl space-y-8 animate-in fade-in">
                <Card title={t('config_data_backup_title')} action={<Button icon={Download} onClick={handleDownloadBackup}>{t('config_data_backup_button')}</Button>}>
                  <p>{t('config_data_backup_note')}</p>
                </Card>
                <Card title={t('config_data_restore_title')}>
                  <form onSubmit={handleRestoreDatabase} className="space-y-4">
                    <Input type="file" accept=".db,.sqlite,.sqlite3" onChange={e => setRestoreFile(e.target.files ? e.target.files[0] : null)} />
                    <Button type="submit" icon={Upload} disabled={!restoreFile}>{t('config_data_restore_button')}</Button>
                  </form>
                </Card>
                <Card title={t('config_data_danger_title')} className="border-red-500 bg-red-50 dark:bg-red-900/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-red-800 dark:text-red-300">{t('config_data_danger_reset_title')}</h4>
                      <p className="text-sm text-red-600 dark:text-red-400">{t('config_data_danger_reset_note')}</p>
                    </div>
                    <Button variant="danger" icon={RotateCcw} onClick={handleResetDatabase}>{t('config_data_danger_reset_button')}</Button>
                  </div>
                </Card>
              </div>
            )}
            
            {activeTab === 'diagnostics' && (
              <div className="max-w-3xl space-y-6 animate-in fade-in">
                <Button onClick={runDiagnostics} disabled={isTesting} icon={isTesting ? undefined : RefreshCw}>
                  {isTesting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>{t('config_health_running_button')}</> : t('config_health_run_button')}
                </Button>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <DiagnosticStat title={t('config_health_stat_status')} value={healthData?.status || t('none')} icon={healthData?.status === 'operational' ? CheckCircle : AlertTriangle} />
                  <DiagnosticStat title={t('config_health_stat_latency')} value={healthData?.database?.latency || t('none')} icon={Database} />
                  <DiagnosticStat title={t('config_health_stat_uptime')} value={healthData?.uptime ? `${(healthData.uptime / 60).toFixed(1)} mins` : t('none')} icon={Activity} />
                  <DiagnosticStat title={t('config_health_stat_memory')} value={healthData?.memory?.rss || t('none')} icon={Server} />
                </div>

                {testLogs.length > 0 && (
                  <div className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs font-mono h-64 overflow-y-auto custom-scrollbar">
                    {testLogs.map((log, i) => <p key={i} className={`flex items-start gap-2 ${log.startsWith('❌') ? 'text-red-400' : log.startsWith('✅') ? 'text-green-400' : ''}`}><span className="text-slate-600 select-none">&gt;</span><span className="flex-1">{log}</span></p>)}
                  </div>
                )}
              </div>
            )}

          </>
        )}
      </div>

       {/* CATALOG ITEM MODAL (DYNAMIC) */}
      <Modal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)} 
        title={`${editingItemId ? t('edit') : t('add')} ${catalogMetadata[catalogTab].label}`}
      >
        <form onSubmit={handleItemSubmit} className="space-y-4">
          {catalogMetadata[catalogTab].fields.map((field: any) => {
            if (field.type === 'textarea') {
              return <Textarea key={field.name} label={field.label} value={itemFormData[field.name] || ''} onChange={e => setItemFormData({...itemFormData, [field.name]: e.target.value})} required={field.required} />
            }
            if (field.type === 'select') {
                return (
                    <Select key={field.name} label={field.label} value={itemFormData[field.name] || ''} onChange={e => setItemFormData({...itemFormData, [field.name]: e.target.value})}>
                        <option value="">{t('config_field_related_role')}...</option>
                        {field.options.map((opt: string) => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>)}
                    </Select>
                )
            }
            if (field.type === 'toggle') {
              return (
                <div key={field.name} className="flex items-center gap-2">
                  <input type="checkbox" id={field.name} checked={itemFormData[field.name] !== false} onChange={e => setItemFormData({...itemFormData, [field.name]: e.target.checked})} />
                  <label htmlFor={field.name}>{field.label}</label>
                </div>
              )
            }
            return <Input key={field.name} label={field.label} type={field.type || 'text'} value={itemFormData[field.name] || ''} onChange={e => setItemFormData({...itemFormData, [field.name]: e.target.value})} required={field.required} prefix={field.prefix} />
          })}
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsItemModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{editingItemId ? t('edit') : t('add')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUserId ? t('edit') : t('add')}>
        <form onSubmit={handleUserSubmit} className="space-y-4">
          <Input label={t('patients_modal_form_fullName')} required value={userForm.fullName || ''} onChange={e => setUserForm({...userForm, fullName: e.target.value})} />
          <Input label={t('settings_profile_username')} required value={userForm.username || ''} onChange={e => setUserForm({...userForm, username: e.target.value})} />
          <Input label={t('login_password_label')} type="password" placeholder={editingUserId ? t('settings_security_new_password') : ''} value={userForm.password || ''} onChange={e => setUserForm({...userForm, password: e.target.value})} required={!editingUserId} />
          <Input label={t('settings_profile_email')} type="email" value={userForm.email || ''} onChange={e => setUserForm({...userForm, email: e.target.value})} />
          <Select label={t('config_users_header_role')} value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})}>
            {availableRoles.map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
          </Select>
          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsUserModalOpen(false)}>{t('cancel')}</Button>
            <Button type="submit">{editingUserId ? t('edit') : t('add')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isBedModalOpen} onClose={() => setIsBedModalOpen(false)} title={editingBedId ? t('edit') : t('add')}>
         <form onSubmit={handleBedSubmit} className="space-y-4">
           <Input label={t('config_beds_header_room')} required value={bedForm.roomNumber || ''} onChange={e => setBedForm({...bedForm, roomNumber: e.target.value})} />
           <Select label={t('config_beds_header_type')} value={bedForm.type || 'General'} onChange={e => setBedForm({...bedForm, type: e.target.value as any})}>
             <option value="General">General</option>
             <option value="Private">Private</option>
             <option value="ICU">ICU</option>
           </Select>
           <Input label={t('config_beds_header_cost')} type="number" value={bedForm.costPerDay || 0} onChange={e => setBedForm({...bedForm, costPerDay: parseFloat(e.target.value)})} />
           <Select label={t('status')} value={bedForm.status || 'available'} onChange={e => setBedForm({...bedForm, status: e.target.value as any})}>
             <option value="available">{t('config_bed_status_available')}</option>
             <option value="maintenance">{t('config_bed_status_maintenance')}</option>
             <option value="cleaning">{t('config_bed_status_cleaning')}</option>
             <option value="reserved">{t('config_bed_status_reserved')}</option>
             <option value="occupied">{t('config_bed_status_occupied')}</option>
           </Select>
           <div className="flex justify-end pt-4 gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsBedModalOpen(false)}>{t('cancel')}</Button>
             <Button type="submit">{editingBedId ? t('edit') : t('add')}</Button>
           </div>
         </form>
      </Modal>

      <Modal isOpen={isFinanceModalOpen} onClose={() => setIsFinanceModalOpen(false)} title={`${editingFinanceId ? t('edit') : t('add')} ${financeTab === 'tax' ? t('config_financial_tax_tab') : t('config_financial_payment_tab')}`}>
        <form onSubmit={handleFinanceSubmit} className="space-y-4">
           <Input label={t('config_field_name_en')} required value={financeForm.name_en || ''} onChange={e => setFinanceForm({...financeForm, name_en: e.target.value})} />
           <Input label={t('config_field_name_ar')} required value={financeForm.name_ar || ''} onChange={e => setFinanceForm({...financeForm, name_ar: e.target.value})} />
           {financeTab === 'tax' ? (
             <>
               <Input label={t('config_field_rate')} type="number" required value={financeForm.rate || ''} onChange={e => setFinanceForm({...financeForm, rate: e.target.value})} />
               <div className="flex items-center gap-2">
                   <input 
                       type="checkbox" 
                       id="financeActive"
                       checked={financeForm.isActive !== false} // Default true
                       onChange={e => setFinanceForm({...financeForm, isActive: e.target.checked})} 
                   /> 
                   <label htmlFor="financeActive">{t('config_users_active')}</label>
               </div>
             </>
           ) : null}
           <div className="flex justify-end pt-2 gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsFinanceModalOpen(false)}>{t('cancel')}</Button>
             <Button type="submit">{t('save')}</Button>
           </div>
        </form>
      </Modal>

      {/* --- CONFIRMATION DIALOG --- */}
      <ConfirmationDialog 
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState({ ...confirmState, isOpen: false })}
        onConfirm={() => {
          confirmState.action();
          setConfirmState({ ...confirmState, isOpen: false });
        }}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type || 'danger'}
      />
    </div>
  );
};
