import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Role } from '../types';
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
  EyeOff,
  MapPin,
  PhoneCall,
  Stethoscope,
  Database,
  RefreshCw,
  Server
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
  const [serverStatus, setServerStatus] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const { t } = useTranslation();
  
  // Ref to track if component is mounted to prevent state updates after unmount
  const isMounted = useRef(true);

  const [hospitalInfo] = useState(() => ({
    name: localStorage.getItem('h_name') || "AllCare Hospital",
    address: localStorage.getItem('h_address') || "Atbara, The Big Market",
    phone: localStorage.getItem('h_phone') || "0987654321"
  }));
  
  const [activeProfile, setActiveProfile] = useState<Role | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    const checkServer = async () => {
      try {
        await api.getPublicSettings();
        if (isMounted.current) setServerStatus('online');
      } catch (e) {
        if (isMounted.current) setServerStatus('offline');
      }
    };
    checkServer();
    const interval = setInterval(checkServer, 10000);
    return () => { 
        clearInterval(interval); 
        isMounted.current = false; 
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Safety timeout: stop spinner if request takes too long (15s)
    const timeoutId = setTimeout(() => {
      if (isMounted.current && loading) {
        setLoading(false);
        setError('Connection timed out. Please check your network or try again.');
      }
    }, 15000);

    try {
      const response = await api.login(username, password);
      
      // Clear safety timeout immediately upon response
      clearTimeout(timeoutId);

      // Strict validation of response
      if (response && response.user && response.token) {
          // Success: AuthContext will update, causing this component to unmount.
          // We do not set loading false here to prevent flicker before unmount.
          login(response.user, response.token);
      } else {
          throw new Error('Invalid response received from server.');
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error("Login failed:", err);
      
      if (isMounted.current) {
          const errorMessage = err.message || '';
          
          // Heuristic to detect HTML error pages (e.g. 404/500 from proxy)
          const isHtmlError = errorMessage.trim().startsWith('<') || errorMessage.includes('DOCTYPE');
          
          // Heuristic for network errors
          const isNetworkError = errorMessage === 'Failed to fetch' || errorMessage.includes('NetworkError');

          if (isHtmlError) {
             setError('Service unreachable. The backend may be offline or misconfigured.');
          } else if (isNetworkError) {
             setError(t('login_status_offline'));
          } else {
             // Display the actual API error message (e.g. "Invalid credentials")
             setError(errorMessage || t('login_error_auth_failed'));
          }
          
          setLoading(false);
      }
    }
  };

  const handleProfileSelect = (role: Role) => {
    setActiveProfile(role);
    if (role === 'technician') {
      setUsername('labtech');
      setPassword('labtech123');
    } else if (role === 'hr') {
      setUsername('hr');
      setPassword('hr123');
    } else {
      setUsername(role);
      setPassword(`${role}123`);
    }
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
          w-10 h-10 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 border
          ${isActive 
            ? `bg-gradient-to-br ${color} text-white border-transparent ring-2 ring-primary-100` 
            : 'bg-white border-slate-100 text-slate-400 hover:border-primary-200 hover:text-primary-500 dark:bg-slate-800 dark:border-slate-700'}
        `}>
          <Icon size={18} className={isActive ? 'animate-pulse' : ''} />
          {isActive && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white text-emerald-600 rounded-full flex items-center justify-center shadow-sm border border-slate-100">
              <Check size={8} strokeWidth={4} />
            </div>
          )}
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-primary-700 dark:text-primary-400' : 'text-slate-400 group-hover:text-primary-600'}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
      
      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-cyan-100 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light" />
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-400/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/10 blur-3xl animate-pulse delay-700" />
      </div>

      <div className="relative z-10 w-full max-w-[380px] px-4">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/60 dark:border-slate-800/60 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-slate-900/5 transition-all">
          
          <div className="px-6 pt-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20 mb-3 text-white">
              <Activity size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight leading-tight">{hospitalInfo.name}</h1>
            
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                <MapPin size={10} className="text-primary-500" />
                <span>{hospitalInfo.address}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                <PhoneCall size={10} className="text-primary-500" />
                <span>{hospitalInfo.phone}</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-600 text-xs font-bold animate-in shake duration-300">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div className="group">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">{t('login_id_label')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <UserIcon size={16} />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white dark:focus:bg-slate-700 transition-all shadow-sm"
                      placeholder={t('login_id_placeholder')}
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 ml-1">{t('login_password_label')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary-500 transition-colors">
                      <Lock size={16} />
                    </div>
                    <input
                      type={passwordVisible ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white dark:focus:bg-slate-700 transition-all shadow-sm"
                      placeholder={t('login_password_placeholder')}
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisible(!passwordVisible)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                    >
                      {passwordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 transition-all"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium group-hover:text-slate-700 dark:group-hover:text-slate-200">{t('login_remember_me')}</span>
                </label>
                <a href="#" className="text-xs text-primary-600 hover:text-primary-700 font-bold transition-colors">{t('login_help')}</a>
              </div>

              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3 px-4 bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-500/25 transform active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={16}/>
                    <span>{t('login_verifying')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('login_button')}</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform rtl:group-hover:-translate-x-1" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-slate-50/80 dark:bg-slate-900/40 p-5 border-t border-slate-100 dark:border-slate-800">
            <p className="text-center text-[9px] text-slate-400 dark:text-slate-500 mb-3 font-black uppercase tracking-widest">{t('login_quick_select_title')}</p>
            <div className="grid grid-cols-3 gap-y-4 gap-x-2 px-1">
              <QuickProfile role="admin" label={t('login_profile_admin')} icon={ShieldCheck} color="from-rose-500 to-red-600" />
              <QuickProfile role="doctor" label={t('staff_role_doctor')} icon={Stethoscope} color="from-blue-600 to-indigo-600" />
              <QuickProfile role="manager" label={t('login_profile_manager')} icon={LayoutDashboard} color="from-orange-500 to-amber-500" />
              <QuickProfile role="receptionist" label={t('login_profile_desk')} icon={UserIcon} color="from-blue-500 to-cyan-500" />
              <QuickProfile role="technician" label={t('login_profile_lab')} icon={Microscope} color="from-emerald-500 to-teal-500" />
              <QuickProfile role="accountant" label={t('login_profile_finance')} icon={CreditCard} color="from-violet-500 to-purple-500" />
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex flex-col items-center gap-1.5">
           <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-600 text-[9px] font-bold uppercase tracking-widest">
              <Database size={10} />
              <span>{t('login_footer_text')}</span>
           </div>
           <p className="text-slate-400 dark:text-slate-500 text-[9px] font-bold uppercase tracking-tight">
             {t('login_developer_credit')} • 0909018730
           </p>
        </div>
      </div>
    </div>
  );
};