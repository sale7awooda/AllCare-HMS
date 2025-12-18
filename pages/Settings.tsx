
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Select } from '../components/UI';
import { 
  User, Lock, Moon, Sun, Monitor, Save, Camera, Mail, Phone, Hash, 
  Palette, Type, Layout, Check, Bell, Globe, Shield, Laptop, Smartphone, LogOut 
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
  useHeader(t('settings_title'), '');

  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', phone: '', timezone: 'UTC+3' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [notifPrefs, setNotifPrefs] = useState({ email_appointments: true, email_labs: true, push_messages: true, push_shifts: false, system_downtime: true });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.me(); setUser(userData);
        setProfileForm({ fullName: userData.fullName || '', email: userData.email || '', phone: userData.phone || '', timezone: 'UTC+3' });
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadUser();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => { setMessage({ type, text }); setTimeout(() => setMessage(null), 3000); };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.updateProfile(profileForm); showMessage('success', t('settings_toast_profile_success')); } 
    catch (e: any) { showMessage('error', t('settings_toast_profile_error')); }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">{t('loading')}</div>;

  const tabs = [
    { id: 'profile', label: t('settings_tab_profile'), icon: User },
    { id: 'notifications', label: t('settings_tab_notifications'), icon: Bell },
    { id: 'security', label: t('settings_tab_security'), icon: Shield },
    { id: 'appearance', label: t('settings_tab_appearance'), icon: Palette },
  ];

  const ToggleSwitch = ({ label, checked, onChange, description }: any) => (
    <div className="flex items-center justify-between py-3">
      <div><p className="font-medium">{label}</p>{description && <p className="text-xs text-slate-500">{description}</p>}</div>
      <button type="button" onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary-600' : 'bg-slate-200'}`}><span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'}`} /></button>
    </div>
  );

  return (
    <div className="space-y-6">
      {message && (<div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>{message.text}</div>)}

      <div className="flex border-b bg-white dark:bg-slate-800 rounded-t-xl px-4 pt-2 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-6 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-600 bg-primary-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><tab.icon size={18}/> {tab.label}</button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 p-6 min-h-[500px]">
        {activeTab === 'profile' && (
          <div className="max-w-4xl animate-in fade-in">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex flex-col items-center gap-4"><div className="w-32 h-32 rounded-full bg-slate-100 flex items-center justify-center text-4xl font-bold text-slate-400">{user?.fullName?.charAt(0)}</div><Badge color="blue">{user?.role}</Badge></div>
              <form onSubmit={handleProfileUpdate} className="flex-1 space-y-5"><Input label={t('settings_profile_fullName')} value={profileForm.fullName} onChange={e => setProfileForm({...profileForm, fullName: e.target.value})} /><Input label={t('settings_profile_email')} type="email" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} /><div className="flex justify-end pt-4"><Button type="submit" icon={Save}>{t('settings_profile_save_button')}</Button></div></form>
            </div>
          </div>
        )}
        
        {activeTab === 'appearance' && (
          <div className="max-w-3xl space-y-8 animate-in fade-in">
            <div className="space-y-4">
              <h3 className="font-bold text-lg">{t('settings_appearance_title')}</h3>
              <div className="grid grid-cols-3 gap-4">{['light', 'dark', 'system'].map((id) => (<button key={id} onClick={() => setTheme(id as any)} className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${theme === id ? 'border-primary-500 bg-primary-50' : 'border-slate-200'}`}><span className="font-medium text-sm capitalize">{id}</span></button>))}</div>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-lg">{t('settings_appearance_accent')}</h3>
              <div className="flex flex-wrap gap-4">{['blue', 'teal', 'violet', 'rose', 'orange', 'emerald'].map((id) => (<button key={id} onClick={() => setAccent(id as any)} className={`w-10 h-10 rounded-full transition-all ${accent === id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-md' : 'opacity-80'}`} style={{ backgroundColor: id }} />))}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
