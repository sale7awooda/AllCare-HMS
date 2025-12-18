import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Select } from '../components/UI';
import { 
  User, Lock, Moon, Sun, Monitor, Save, Mail, Phone, 
  Palette, Bell, Shield, Laptop, RefreshCw, Languages, Globe, Check,
  Terminal, Smartphone, BellRing, UserCheck, ShieldAlert, KeyRound, Fingerprint
} from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'appearance'>('profile');
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const { theme, setTheme, accent, setAccent, density, setDensity, fontSize, setFontSize } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  // Sync Header
  useHeader(t('nav_settings'), '');

  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', phone: '', timezone: 'UTC+3' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  
  // Notification Prefs Mock State
  const [notifPrefs, setNotifPrefs] = useState({
    email_appointments: true,
    email_labs: true,
    push_patients: true,
    push_security: false,
    sms_emergency: true
  });

  const ACCENT_COLORS = [
    'slate', 'zinc', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 
    'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 
    'purple', 'fuchsia', 'pink', 'rose'
  ];

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.me();
        setUser(userData);
        setProfileForm({
          fullName: userData.fullName || '',
          email: userData.email || '',
          phone: userData.phone || '',
          timezone: 'UTC+3'
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile(profileForm);
      showMessage('success', t('settings_toast_profile_success'));
    } catch (e: any) {
      showMessage('error', t('settings_toast_profile_error'));
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return showMessage('error', t('settings_toast_password_mismatch'));
    }
    try {
      await api.changePassword(passwordForm);
      showMessage('success', t('settings_toast_password_success'));
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      showMessage('error', t('settings_toast_password_error'));
    }
  };

  const ToggleSwitch = ({ label, checked, onChange, description, icon: Icon }: any) => (
    <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:bg-slate-100 dark:hover:bg-slate-900">
      <div className="flex items-center gap-3">
        {Icon && <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm text-slate-400"><Icon size={18}/></div>}
        <div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{label}</p>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 ${checked ? 'bg-primary-600' : 'bg-slate-200 dark:bg-slate-700'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <RefreshCw className="animate-spin text-primary-600" size={32} />
      <p className="text-slate-500 font-medium">{t('loading')}</p>
    </div>
  );

  const tabs = [
    { id: 'profile', label: t('settings_tab_profile'), icon: User },
    { id: 'notifications', label: t('settings_tab_notifications'), icon: Bell },
    { id: 'security', label: t('settings_tab_security'), icon: Shield },
    { id: 'appearance', label: t('settings_tab_appearance'), icon: Palette },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {message && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300'}`}>
          <div className={`p-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
             {message.type === 'success' ? <Check size={16} /> : <ShieldAlert size={16} />}
          </div>
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Nav */}
        <div className="lg:col-span-3 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20 translate-x-2 rtl:-translate-x-2' 
                  : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card title={t('settings_tab_profile')}>
                <div className="flex flex-col md:flex-row gap-8 items-start mb-8">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-3xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 font-black text-3xl shadow-inner border-4 border-white dark:border-slate-800">
                      {user?.fullName?.charAt(0)}
                    </div>
                    <div className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-slate-700 rounded-xl shadow-lg border border-slate-100 dark:border-slate-600 text-slate-500 group-hover:text-primary-600 transition-colors cursor-pointer">
                       <Laptop size={14} />
                    </div>
                  </div>
                  <div className="flex-1 space-y-1">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white">{user?.fullName}</h2>
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-widest">{user?.role} Access</p>
                    <div className="flex gap-2 mt-2">
                      <Badge color="blue">v1.2.0 Stable</Badge>
                      <Badge color="green">Authorized</Badge>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label={t('settings_profile_fullName')} value={profileForm.fullName} onChange={e => setProfileForm({...profileForm, fullName: e.target.value})} prefix={<User size={16}/>} />
                  <Input label={t('settings_profile_email')} type="email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} prefix={<Mail size={16}/>} />
                  <Input label={t('settings_profile_phone')} value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} prefix={<Phone size={16}/>} />
                  <Select label={t('settings_profile_timezone')} value={profileForm.timezone} onChange={e => setProfileForm({...profileForm, timezone: e.target.value})}>
                     <option value="UTC+0">{t('settings_timezone_utc')}</option>
                     <option value="UTC+2">{t('settings_timezone_utc2')}</option>
                     <option value="UTC+3">{t('settings_timezone_utc3')}</option>
                     <option value="UTC+4">{t('settings_timezone_utc4')}</option>
                  </Select>
                  
                  <div className="md:col-span-2 pt-6 border-t dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                      <Globe className="text-slate-400 ml-2" size={18} />
                      <div className="flex p-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
                        <button type="button" onClick={() => setLanguage('en')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${language === 'en' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>ENGLISH</button>
                        <button type="button" onClick={() => setLanguage('ar')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${language === 'ar' ? 'bg-primary-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>العربية</button>
                      </div>
                    </div>
                    <Button type="submit" icon={Save}>{t('settings_profile_save_button')}</Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card title={t('settings_notifications_title')}>
                <div className="space-y-4">
                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">{t('settings_notifications_email_alerts_title')}</h3>
                   <div className="grid grid-cols-1 gap-3">
                     <ToggleSwitch 
                        label={t('settings_notifications_email_appointments')} 
                        description={t('settings_notifications_email_appointments_desc')}
                        checked={notifPrefs.email_appointments} 
                        onChange={(v: boolean) => setNotifPrefs({...notifPrefs, email_appointments: v})} 
                        icon={Mail}
                     />
                     <ToggleSwitch 
                        label={t('settings_notifications_email_labs')} 
                        description={t('settings_notifications_email_labs_desc')}
                        checked={notifPrefs.email_labs} 
                        onChange={(v: boolean) => setNotifPrefs({...notifPrefs, email_labs: v})} 
                        icon={RefreshCw}
                     />
                   </div>

                   <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1 pt-4">{t('settings_notifications_push_title')}</h3>
                   <div className="grid grid-cols-1 gap-3">
                      <ToggleSwitch 
                        label={t('settings_notifications_push_messages')} 
                        description="Direct messages from colleagues"
                        checked={notifPrefs.push_patients} 
                        onChange={(v: boolean) => setNotifPrefs({...notifPrefs, push_patients: v})} 
                        icon={BellRing}
                      />
                      <ToggleSwitch 
                        label="Security Alerts" 
                        description="Login from new devices or suspicious activity"
                        checked={notifPrefs.push_security} 
                        onChange={(v: boolean) => setNotifPrefs({...notifPrefs, push_security: v})} 
                        icon={Shield}
                      />
                   </div>

                   <div className="pt-6 flex justify-end">
                      <Button variant="secondary" onClick={() => showMessage('success', t('settings_toast_notifications_success'))}>{t('settings_notifications_save_button')}</Button>
                   </div>
                </div>
              </Card>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-in fade-in duration-300">
               <Card title={t('settings_security_password_title')}>
                  <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                     <Input label={t('settings_security_current_password')} type="password" required value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} prefix={<Lock size={16}/>} />
                     <Input label={t('settings_security_new_password')} type="password" required value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} prefix={<KeyRound size={16}/>} />
                     <Input label={t('settings_security_confirm_password')} type="password" required value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} prefix={<KeyRound size={16}/>} />
                     <div className="pt-2">
                        <Button type="submit" className="w-full">{t('settings_security_update_password_button')}</Button>
                     </div>
                  </form>
               </Card>

               <Card title={t('settings_security_sessions_title')}>
                  <div className="space-y-4">
                     <div className="flex items-center gap-4 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-800">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-primary-600"><Laptop size={24}/></div>
                        <div className="flex-1">
                           <p className="font-bold text-slate-800 dark:text-white">Windows PC - Chrome Browser</p>
                           <p className="text-xs text-slate-500 font-medium">Atbara, Sudan • <span className="text-primary-600 font-bold">{t('settings_security_active_now')}</span></p>
                        </div>
                        <Badge color="green">Current</Badge>
                     </div>
                     <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 opacity-60">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-400"><Smartphone size={24}/></div>
                        <div className="flex-1">
                           <p className="font-bold text-slate-800 dark:text-white">iPhone 13 - Safari</p>
                           <p className="text-xs text-slate-500 font-medium">Khartoum, Sudan • {t('settings_security_last_seen')} 2 days ago</p>
                        </div>
                     </div>
                     <div className="pt-2 flex justify-start">
                        <Button variant="outline" size="sm" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100">{t('settings_security_logout_all_button')}</Button>
                     </div>
                  </div>
               </Card>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <Card title={t('settings_appearance_title')}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: 'light', label: t('settings_appearance_light'), icon: Sun, color: 'bg-white border-slate-200 text-slate-900' },
                    { id: 'dark', label: t('settings_appearance_dark'), icon: Moon, color: 'bg-slate-900 border-slate-800 text-white' },
                    { id: 'system', label: t('settings_appearance_system'), icon: Monitor, color: 'bg-slate-50 border-slate-200 text-slate-700' }
                  ].map((mode) => (
                    <button 
                      key={mode.id} 
                      onClick={() => setTheme(mode.id as any)}
                      className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${
                        theme === mode.id 
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-primary-200'
                      }`}
                    >
                      <div className={`p-4 rounded-full ${theme === mode.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                         <mode.icon size={28} />
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest">{mode.label}</span>
                      {theme === mode.id && <div className="absolute top-2 right-2 text-primary-600"><Check size={16} strokeWidth={3} /></div>}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title={t('settings_appearance_accent')}>
                 <p className="text-xs text-slate-500 mb-6 font-medium">Customize the primary brand color for your portal interface.</p>
                 <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
                   {ACCENT_COLORS.map(color => (
                     <button
                        key={color}
                        onClick={() => setAccent(color as any)}
                        className={`group relative w-12 h-12 rounded-2xl transition-all duration-300 ${
                          accent === color ? 'ring-4 ring-offset-4 ring-primary-500 scale-110 shadow-xl' : 'hover:scale-105 shadow-sm'
                        }`}
                        title={color}
                        style={{ backgroundColor: color }}
                     >
                       {accent === color && <Check className="absolute inset-0 m-auto text-white drop-shadow-md" size={20} strokeWidth={4} />}
                     </button>
                   ))}
                 </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card title={t('settings_appearance_density')}>
                  <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    <button 
                      onClick={() => setDensity('comfortable')} 
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${density === 'comfortable' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Laptop size={16}/> {t('settings_appearance_density_comfortable')}
                    </button>
                    <button 
                      onClick={() => setDensity('compact')} 
                      className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${density === 'compact' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Smartphone size={16}/> {t('settings_appearance_density_compact')}
                    </button>
                  </div>
                </Card>

                <Card title={t('settings_appearance_fontSize')}>
                  <div className="flex p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                    {['sm', 'md', 'lg'].map(size => (
                      <button 
                        key={size}
                        onClick={() => setFontSize(size as any)} 
                        className={`flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-black uppercase transition-all ${fontSize === size ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};