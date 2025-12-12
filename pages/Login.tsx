import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, Role } from '@/types';
import { 
  AlertCircle, 
  Lock, 
  User as UserIcon, 
  Activity, 
  ArrowRight, 
  ShieldCheck,
  LayoutDashboard,
  CreditCard,
  Microscope,
  Check,
  Eye,
  EyeOff
} from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const { t } = useTranslation();
  
  // Read hospital name directly from cache for instant loading.
  // It's only updated from the Configuration page now.
  const [hospitalName] = useState(() => localStorage.getItem('hospital_name') || t('login_title'));
  
  const [activeProfile, setActiveProfile] = useState<Role | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // API returns { token: string, user: User }
      const response = await api.login(username, password);
      login(response.user, response.token);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || t('login_error_auth_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelect = (role: Role) => {
    setActiveProfile(role);
    // Mapping specific usernames based on seed data
    if (role === 'technician') setUsername('labtech');
    else setUsername(role);
    
    setPassword(`${role === 'technician' ? 'labtech' : role}123`);
  };

  const QuickProfile = ({ role, label, icon: Icon, color }: { role: Role, label: string, icon: any, color: string }) => {
    const isActive = activeProfile === role;
    return (
      <button
        type="button"
        onClick={() => handleProfileSelect(role)}
        className={`group relative flex flex-col items-center gap-2 transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-80 hover:opacity-100 hover:scale-105'}`}
      >
        <div className={`
          w-12 h-12 rounded-2xl flex items-center justify-center shadow-md transition-all duration-300 border
          ${isActive 
            ? `bg-gradient-to-br ${color} text-white border-transparent ring-4 ring-primary-100` 
            : 'bg-white border-slate-100 text-slate-400 hover:border-primary-200 hover:text-primary-500'}
        `}>
          <Icon size={20} className={isActive ? 'animate-pulse' : ''} />
          {isActive && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-sm border border-slate-100">
              <Check size={10} strokeWidth={4} />
            </div>
          )}
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary-700' : 'text-slate-400 group-hover:text-primary-600'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50">
      
      {/* Background Layer - Bright & Clinical */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-100" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
        
        {/* Abstract Soft Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/10 blur-3xl animate-pulse delay-700" />
      </div>

      {/* Main Content Card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="bg-white/80 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5">
          
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-slate-100">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20 mb-4 text-white">
              <Activity size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{hospitalName}</h1>
            <p className="text-slate-500 text-sm mt-1">{t('login_subtitle')}</p>
          </div>

          {/* Form Section */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Error Message */}
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={16} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('login_id_label')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <UserIcon size={18} />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm"
                      placeholder={t('login_id_placeholder')}
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">{t('login_password_label')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <Lock size={18} />
                    </div>
                    <input
                      type={passwordVisible ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all shadow-sm"
                      placeholder={t('login_password_placeholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    >
                      {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-500 font-medium">{t('login_remember_me')}</span>
                </label>
                <a href="#" className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors">{t('login_help')}</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-bold rounded-xl shadow-lg shadow-primary-500/25 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>{t('login_verifying')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('login_button')}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Login Footer */}
          <div className="bg-slate-50/80 p-6 border-t border-slate-100">
            <p className="text-center text-xs text-slate-400 mb-4 font-bold uppercase tracking-widest">{t('login_quick_select_title')}</p>
            <div className="flex justify-between items-center px-2">
              <QuickProfile role="admin" label={t('login_profile_admin')} icon={ShieldCheck} color="from-rose-500 to-red-600" />
              <QuickProfile role="manager" label={t('login_profile_manager')} icon={LayoutDashboard} color="from-orange-500 to-amber-500" />
              <QuickProfile role="receptionist" label={t('login_profile_desk')} icon={UserIcon} color="from-blue-500 to-cyan-500" />
              <QuickProfile role="technician" label={t('login_profile_lab')} icon={Microscope} color="from-emerald-500 to-teal-500" />
              <QuickProfile role="accountant" label={t('login_profile_finance')} icon={CreditCard} color="from-violet-500 to-purple-500" />
            </div>
          </div>
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-6 font-medium">
          {t('login_footer_text')}
        </p>
      </div>
    </div>
  );
};