
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge } from '../components/UI';
import { User, Lock, Moon, Sun, Monitor, Save, Camera, Mail, Phone, Hash, Palette, Type, Layout, Check } from 'lucide-react';
import { api } from '../services/api';
import { User as UserType } from '../types';
import { useTheme } from '../context/ThemeContext';

export const Settings = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'appearance'>('profile');
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Consume Theme Context
  const { theme, setTheme, accent, setAccent, density, setDensity, fontSize, setFontSize } = useTheme();

  // Profile Form
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    phone: '',
  });

  // Password Form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.me();
        setUser(userData);
        setProfileForm({
          fullName: userData.fullName || '',
          email: userData.email || '',
          phone: userData.phone || '',
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
    setTimeout(() => setMessage(null), 3000);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateProfile(profileForm);
      showMessage('success', 'Profile updated successfully.');
    } catch (e: any) {
      showMessage('error', e.response?.data?.error || 'Failed to update profile.');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('error', 'New passwords do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters.');
      return;
    }

    try {
      await api.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      showMessage('success', 'Password changed successfully.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) {
      showMessage('error', e.response?.data?.error || 'Failed to change password.');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading settings...</div>;

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Palette },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'} animate-in fade-in slide-in-from-top-2`}>
          {message.text}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-t-xl px-4 pt-2 overflow-x-auto transition-colors">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)} 
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap 
              ${activeTab === tab.id 
                ? 'border-primary-600 text-primary-600 bg-primary-50/50 dark:bg-primary-900/20' 
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'text-primary-600' : 'text-gray-400 dark:text-slate-500'}/> 
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-slate-800 rounded-b-xl shadow-sm border border-t-0 border-gray-200 dark:border-slate-700 p-6 min-h-[500px] transition-colors">
        
        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl animate-in fade-in slide-in-from-left-4">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4 w-full md:w-auto">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-700 border-4 border-white dark:border-slate-600 shadow-lg flex items-center justify-center text-4xl font-bold text-slate-400 dark:text-slate-500 overflow-hidden">
                    {user?.fullName?.charAt(0)}
                  </div>
                  <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="text-white" size={32} />
                  </div>
                  <div className="absolute bottom-0 right-0 bg-green-500 w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"></div>
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-gray-900 dark:text-white">{user?.fullName}</h3>
                  <Badge color="blue" className="mt-1">{user?.role}</Badge>
                </div>
              </div>

              {/* Form Section */}
              <form onSubmit={handleProfileUpdate} className="flex-1 w-full space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input 
                    label="Full Name" 
                    value={profileForm.fullName} 
                    onChange={e => setProfileForm({...profileForm, fullName: e.target.value})} 
                  />
                  <div className="relative opacity-70">
                    <Input 
                      label="Username" 
                      value={user?.username || ''} 
                      disabled
                      className="pl-10 bg-slate-50 dark:bg-slate-900/50 cursor-not-allowed"
                    />
                    <Hash size={16} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="relative">
                    <Input 
                      label="Email Address" 
                      type="email"
                      value={profileForm.email} 
                      onChange={e => setProfileForm({...profileForm, email: e.target.value})}
                      className="pl-10"
                    />
                    <Mail size={16} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <Input 
                      label="Phone Number" 
                      value={profileForm.phone} 
                      onChange={e => setProfileForm({...profileForm, phone: e.target.value})}
                      className="pl-10"
                    />
                    <Phone size={16} className="absolute left-3 top-[38px] text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="pt-4 flex justify-end border-t border-gray-100 dark:border-slate-700 mt-6">
                  <Button type="submit" icon={Save}>Save Changes</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-left-4">
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-xl p-4 mb-6 flex items-start gap-3">
              <div className="p-2 bg-white dark:bg-orange-900/40 rounded-lg text-orange-600 dark:text-orange-400 shadow-sm"><Lock size={20}/></div>
              <div>
                <h4 className="font-bold text-orange-800 dark:text-orange-300">Password Security</h4>
                <p className="text-sm text-orange-700 dark:text-orange-400/80">Ensure your account is secure by using a strong password. We recommend updating it every 90 days.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-5">
              <Input 
                label="Current Password" 
                type="password"
                required
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
              />
              <hr className="border-slate-100 dark:border-slate-700 my-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input 
                  label="New Password" 
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                />
                <Input 
                  label="Confirm New Password" 
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                />
              </div>
              <div className="pt-4 flex justify-end">
                <Button type="submit" variant="primary">Update Password</Button>
              </div>
            </form>
          </div>
        )}

        {/* APPEARANCE TAB */}
        {activeTab === 'appearance' && (
          <div className="max-w-3xl space-y-8 animate-in fade-in slide-in-from-left-4">
            
            {/* Theme Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Monitor size={20} className="text-primary-600" />
                <h3 className="font-bold text-lg">Interface Theme</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { id: 'light', label: 'Light Mode', icon: Sun },
                  { id: 'dark', label: 'Dark Mode', icon: Moon },
                  { id: 'system', label: 'System Auto', icon: Monitor }
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setTheme(option.id as any)}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3
                      ${theme === option.id 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' 
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'}
                    `}
                  >
                    <option.icon size={28} />
                    <span className="font-medium text-sm">{option.label}</span>
                    {theme === option.id && (
                      <div className="absolute top-2 right-2 bg-primary-500 text-white rounded-full p-0.5">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Accent Color Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                <Palette size={20} className="text-primary-600" />
                <h3 className="font-bold text-lg">Accent Color</h3>
              </div>
              <div className="flex flex-wrap gap-4">
                {[
                  { id: 'blue', color: 'bg-blue-600' },
                  { id: 'cyan', color: 'bg-cyan-600' },
                  { id: 'teal', color: 'bg-teal-600' },
                  { id: 'emerald', color: 'bg-emerald-600' },
                  { id: 'violet', color: 'bg-violet-600' },
                  { id: 'indigo', color: 'bg-indigo-600' },
                  { id: 'fuchsia', color: 'bg-fuchsia-600' },
                  { id: 'pink', color: 'bg-pink-600' },
                  { id: 'rose', color: 'bg-rose-600' },
                  { id: 'orange', color: 'bg-orange-600' },
                  { id: 'amber', color: 'bg-amber-500' },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setAccent(option.id as any)}
                    className={`
                      w-10 h-10 rounded-full ${option.color} transition-all flex items-center justify-center
                      ${accent === option.id ? 'ring-2 ring-offset-2 ring-slate-400 scale-110 shadow-md' : 'hover:scale-105 opacity-80 hover:opacity-100'}
                    `}
                  >
                    {accent === option.id && <Check size={16} className="text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-slate-100 dark:border-slate-700" />

            {/* Interface Density & Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Layout size={20} className="text-primary-600" />
                  <h3 className="font-bold text-lg">Density</h3>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg w-fit">
                  {['comfortable', 'compact'].map((option) => (
                    <button
                      key={option}
                      onClick={() => setDensity(option as any)}
                      className={`
                        px-4 py-2 rounded-md text-sm font-medium capitalize transition-all
                        ${density === option ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}
                      `}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Type size={20} className="text-primary-600" />
                  <h3 className="font-bold text-lg">Font Size</h3>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setFontSize('sm')}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${fontSize === 'sm' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                  >
                    Aa
                  </button>
                  <button 
                    onClick={() => setFontSize('md')}
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold transition-all ${fontSize === 'md' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                  >
                    Aa
                  </button>
                  <button 
                    onClick={() => setFontSize('lg')}
                    className={`w-12 h-12 rounded-lg border flex items-center justify-center text-lg font-bold transition-all ${fontSize === 'lg' ? 'border-primary-500 bg-primary-50 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}
                  >
                    Aa
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};
