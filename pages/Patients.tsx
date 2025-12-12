import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { 
  Plus, Search, Filter, User, Phone, MapPin, Edit, 
  Calendar, CreditCard, Activity, FileText,
  CheckCircle, AlertCircle, Loader2
} from 'lucide-react';
import { api } from '../services/api';
import { Patient, InsuranceProvider } from '../types';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { hasPermission, Permissions } from '../utils/rbac';
import { useNavigate } from 'react-router-dom';

export const Patients = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [insuranceProviders, setInsuranceProviders] = useState<InsuranceProvider[]>([]);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  
  // Process State
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [processMessage, setProcessMessage] = useState('');

  // Form State
  const initialFormState = {
    fullName: '', phone: '', age: '', gender: 'male', type: 'outpatient',
    address: '', bloodGroup: '', allergies: '', medicalHistory: '', symptoms: '',
    hasInsurance: false,
    insuranceDetails: { provider: '', policyNumber: '', expiryDate: '', notes: '' },
    emergencyContact: { name: '', phone: '', relation: '' }
  };
  const [formData, setFormData] = useState<any>(initialFormState);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pts, ins] = await Promise.all([
        api.getPatients(),
        api.getInsuranceProviders()
      ]);
      setPatients(Array.isArray(pts) ? pts : []);
      setInsuranceProviders(Array.isArray(ins) ? ins : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessStatus('processing');
    setProcessMessage(currentPatient ? t('patients_process_updating') : t('patients_process_registering'));

    try {
      const payload = {
        ...formData,
        age: parseInt(formData.age),
        // Ensure insurance details are only sent if insurance is checked
        insuranceDetails: formData.hasInsurance ? formData.insuranceDetails : null,
        emergencyContact: formData.emergencyContact
      };

      if (currentPatient) {
        await api.updatePatient(currentPatient.id, payload);
      } else {
        await api.addPatient(payload);
      }

      setProcessStatus('success');
      setProcessMessage(currentPatient ? t('patients_process_update_success') : t('patients_process_register_success'));
      await loadData();
      setTimeout(() => {
        setIsModalOpen(false);
        setProcessStatus('idle');
      }, 1500);
    } catch (e: any) {
      setProcessStatus('error');
      setProcessMessage(e.response?.data?.error || t('patients_process_error_save'));
    }
  };

  const openModal = (patient?: Patient) => {
    setCurrentPatient(patient || null);
    if (patient) {
      setFormData({
        fullName: patient.fullName,
        phone: patient.phone,
        age: patient.age.toString(),
        gender: patient.gender,
        type: patient.type,
        address: patient.address,
        bloodGroup: patient.bloodGroup || '',
        allergies: patient.allergies || '',
        medicalHistory: patient.medicalHistory || '',
        symptoms: patient.symptoms || '',
        hasInsurance: patient.hasInsurance,
        insuranceDetails: patient.insuranceDetails || { provider: '', policyNumber: '', expiryDate: '', notes: '' },
        emergencyContact: patient.emergencyContact || { name: '', phone: '', relation: '' }
      });
    } else {
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const openActionMenu = (patient: Patient) => {
    setCurrentPatient(patient);
    setIsActionModalOpen(true);
  };

  // Filter
  const filteredPatients = useMemo(() => {
    return patients.filter(p => {
        const matchesSearch = p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              p.phone.includes(searchTerm) || 
                              p.patientId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || p.type === filterType;
        return matchesSearch && matchesType;
    });
  }, [patients, searchTerm, filterType]);

  const canManage = hasPermission(user, Permissions.MANAGE_PATIENTS);

  return (
    <div className="space-y-6">
       {/* Process Overlay */}
       {processStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4 min-w-[300px]">
                {processStatus === 'processing' && <Loader2 className="animate-spin text-primary-600" size={32} />}
                {processStatus === 'success' && <CheckCircle className="text-green-600" size={32} />}
                {processStatus === 'error' && <AlertCircle className="text-red-600" size={32} />}
                <p className="text-slate-800 dark:text-white font-medium">{processMessage}</p>
                {processStatus === 'error' && <Button variant="secondary" onClick={() => setProcessStatus('idle')}>{t('close')}</Button>}
            </div>
        </div>
       )}

       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('patients_title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('patients_subtitle')}</p>
        </div>
        {canManage ? (
            <Button onClick={() => openModal()} icon={Plus}>{t('patients_register_button')}</Button>
        ) : (
            <Button disabled variant="secondary" icon={Plus}>{t('patients_register_button')}</Button>
        )}
      </div>

      <Card className="!p-0 border border-slate-200 dark:border-slate-700 shadow-sm overflow-visible z-10">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-t-xl flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder={t('patients_search_placeholder')}
                    className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>
            <div className="flex items-center gap-2">
                <Filter className="text-slate-400 w-4 h-4" />
                <select 
                    className="pl-2 pr-8 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                >
                    <option value="all">{t('patients_filter_type_all')}</option>
                    <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                    <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                    <option value="emergency">{t('patients_filter_type_emergency')}</option>
                </select>
            </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-white dark:bg-slate-900">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_patient')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_contact')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_status')}</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_demographics')}</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">{t('patients_table_header_actions')}</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                    {loading ? (
                        <tr><td colSpan={5} className="text-center py-20 text-slate-500">{t('loading')}</td></tr>
                    ) : filteredPatients.length === 0 ? (
                        <tr><td colSpan={5} className="text-center py-20 text-slate-500">{t('patients_table_empty')}</td></tr>
                    ) : (
                        filteredPatients.map(patient => (
                            <tr key={patient.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 font-bold">
                                            {patient.fullName.charAt(0)}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-bold text-slate-900 dark:text-white">{patient.fullName}</div>
                                            <div className="text-xs text-slate-500">{patient.patientId}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2"><Phone size={14} /> {patient.phone}</div>
                                    {patient.address && <div className="text-xs text-slate-400 flex items-center gap-2 mt-1"><MapPin size={12} /> {patient.address}</div>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Badge color={patient.type === 'inpatient' ? 'red' : patient.type === 'emergency' ? 'orange' : 'green'}>
                                        {patient.type}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                    {patient.age} yrs / {patient.gender}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        <Button 
                                            size="sm" 
                                            variant="primary" 
                                            onClick={() => openActionMenu(patient)}
                                            className="shadow-sm"
                                        >
                                            {t('patients_manage_button')}
                                        </Button>
                                        {canManage && (
                                            <Button 
                                                size="sm" 
                                                variant="secondary" 
                                                onClick={() => openModal(patient)}
                                                icon={Edit}
                                            >
                                                {t('patients_edit_button')}
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </Card>

      {/* Patient Add/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={currentPatient ? t('patients_modal_edit_title') : t('patients_modal_new_title')}>
        <form onSubmit={handleSave} className="space-y-6">
            
            {/* Personal Info */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_personal_title')}</h4>
                <Input label={t('patients_modal_form_fullName')} required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('patients_modal_form_phone')} required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                    <Input label={t('patients_modal_form_age')} type="number" required value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Select label={t('patients_modal_form_gender')} value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                        <option value="male">{t('patients_modal_form_gender_male')}</option>
                        <option value="female">{t('patients_modal_form_gender_female')}</option>
                    </Select>
                    <Select label={t('patients_modal_form_type')} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                        <option value="outpatient">{t('patients_filter_type_outpatient')}</option>
                        <option value="inpatient">{t('patients_filter_type_inpatient')}</option>
                        <option value="emergency">{t('patients_filter_type_emergency')}</option>
                    </Select>
                </div>
                <Input label={t('patients_modal_form_address')} value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>

            {/* Medical Info */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_medical_title')}</h4>
                <div className="grid grid-cols-2 gap-4">
                    <Input label={t('patients_modal_form_bloodGroup')} value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value})} placeholder="e.g. O+" />
                    <Input label={t('patients_modal_form_allergies')} value={formData.allergies} onChange={e => setFormData({...formData, allergies: e.target.value})} placeholder={t('patients_modal_form_allergies_placeholder')} />
                </div>
                <Textarea label={t('patients_modal_form_symptoms')} value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} rows={2} />
                <Textarea label={t('patients_modal_form_medicalHistory')} value={formData.medicalHistory} onChange={e => setFormData({...formData, medicalHistory: e.target.value})} rows={2} placeholder={t('patients_modal_form_medicalHistory_placeholder')} />
            </div>

            {/* Emergency Contact */}
            <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_emergency_title')}</h4>
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1">
                        <Input label={t('patients_modal_form_emergency_relation')} value={formData.emergencyContact.relation} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, relation: e.target.value}})} placeholder={t('patients_modal_form_emergency_relation_placeholder')} />
                    </div>
                    <div className="col-span-2">
                        <Input label={t('patients_modal_form_emergency_name')} value={formData.emergencyContact.name} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, name: e.target.value}})} />
                    </div>
                </div>
                <Input label={t('patients_modal_form_emergency_phone')} value={formData.emergencyContact.phone} onChange={e => setFormData({...formData, emergencyContact: {...formData.emergencyContact, phone: e.target.value}})} />
            </div>

            {/* Insurance */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('patients_modal_form_insurance_title')}</h4>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={formData.hasInsurance} onChange={e => setFormData({...formData, hasInsurance: e.target.checked})} />
                        {t('patients_modal_form_has_insurance')}
                    </label>
                </div>
                
                {formData.hasInsurance && (
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in">
                        <Select label={t('patients_modal_form_insurance_provider')} value={formData.insuranceDetails.provider} onChange={e => setFormData({...formData, insuranceDetails: {...formData.insuranceDetails, provider: e.target.value}})}>
                            <option value="">{t('patients_modal_form_insurance_provider_select')}</option>
                            {insuranceProviders.map(p => <option key={p.id} value={p.name_en}>{p.name_en}</option>)}
                        </Select>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label={t('patients_modal_form_insurance_policy')} value={formData.insuranceDetails.policyNumber} onChange={e => setFormData({...formData, insuranceDetails: {...formData.insuranceDetails, policyNumber: e.target.value}})} />
                            <Input label={t('patients_modal_form_insurance_expiry')} type="date" value={formData.insuranceDetails.expiryDate} onChange={e => setFormData({...formData, insuranceDetails: {...formData.insuranceDetails, expiryDate: e.target.value}})} />
                        </div>
                        <Textarea label={t('patients_modal_form_insurance_notes')} value={formData.insuranceDetails.notes} onChange={e => setFormData({...formData, insuranceDetails: {...formData.insuranceDetails, notes: e.target.value}})} rows={2} />
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4 border-t dark:border-slate-700 gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>{t('cancel')}</Button>
                <Button type="submit">{t('patients_modal_save_button')}</Button>
            </div>
        </form>
      </Modal>

      {/* Action Menu Modal */}
      <Modal isOpen={isActionModalOpen} onClose={() => setIsActionModalOpen(false)} title={t('patients_modal_action_menu_title', {name: currentPatient?.fullName})}>
         <div className="grid grid-cols-2 gap-4">
            <Button variant="outline" className="justify-start h-auto py-4 flex-col gap-2" onClick={() => navigate('/appointments')}>
                <Calendar size={24} className="text-primary-600 mb-1" />
                <span>{t('patients_modal_action_appointment')}</span>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4 flex-col gap-2" onClick={() => navigate('/laboratory')}>
                <Activity size={24} className="text-orange-500 mb-1" />
                <span>{t('patients_modal_action_lab')}</span>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4 flex-col gap-2" onClick={() => navigate('/admissions')}>
                <Activity size={24} className="text-red-500 mb-1" />
                <span>{t('patients_modal_action_admission')}</span>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-4 flex-col gap-2" onClick={() => navigate('/billing')}>
                <CreditCard size={24} className="text-green-600 mb-1" />
                <span>{t('nav_billing')}</span>
            </Button>
         </div>
      </Modal>
    </div>
  );
};
