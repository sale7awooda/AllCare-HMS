
import React, { useState } from 'react';
import { api } from '../services/api';
import { User, Role } from '../types';
import { 
  AlertCircle, 
  Lock, 
  User as UserIcon, 
  Activity, 
  ArrowRight, 
  CheckCircle2,
  Stethoscope,
  ShieldCheck,
  LayoutDashboard
} from 'lucide-react';

interface LoginProps {
  onLogin: (u: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = (role: Role) => {
    // Mapping specific usernames based on seed data
    if (role === 'technician') setUsername('labtech');
    else setUsername(role);
    
    setPassword(`${role === 'technician' ? 'labtech' : role}123`);
  };

  const DemoButton = ({ role, label, icon: Icon }: { role: Role, label: string, icon: any }) => (
    <button
      type="button"
      onClick={() => handleDevLogin(role)}
      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-primary-500 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-400 hover:shadow-sm transition-all"
    >
      <Icon size={14} className="opacity-70" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:max-w-md space-y-8">
          
          {/* Header */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-900/20">
                <Activity size={24} className="stroke-[2.5]" />
              </div>
              <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">AllCare HMS</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Welcome back
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Please sign in to access your dashboard.
            </p>
          </div>

          {/* Form */}
          <div className="mt-8 space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Username or Employee ID
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <UserIcon size={18} />
                    </div>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-400">
                    Remember me
                  </label>
                </div>

                <div className="text-sm">
                  <a href="#" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">
                    Forgot password?
                  </a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Authenticating...
                  </>
                ) : (
                  <>
                    Sign in <ArrowRight size={16} className="ml-2 opacity-80" />
                  </>
                )}
              </button>
            </form>

            {/* Demo Access Section */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 text-center">
                One-Click Demo Access
              </p>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                   <DemoButton role="admin" label="Admin" icon={ShieldCheck} />
                   <DemoButton role="manager" label="Manager" icon={LayoutDashboard} />
                   <DemoButton role="doctor" label="Doctor" icon={Stethoscope} />
                   <DemoButton role="nurse" label="Nurse" icon={Activity} />
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                   <DemoButton role="receptionist" label="Reception" icon={UserIcon} />
                   <DemoButton role="technician" label="Lab Tech" icon={Activity} />
                   <DemoButton role="accountant" label="Finance" icon={CheckCircle2} />
                   <DemoButton role="hr" label="HR" icon={UserIcon} />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Right Side - Image/Hero */}
      <div className="hidden lg:block relative w-0 flex-1 overflow-hidden bg-slate-900">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/90 to-slate-900/90 z-10" />
        <img
          className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
          src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80"
          alt="Hospital hallway"
        />
        
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-20 text-white">
          <div className="flex items-center gap-2 opacity-50">
            <Activity size={24} />
            <span className="font-bold tracking-widest text-sm uppercase">AllCare Systems</span>
          </div>

          <div className="max-w-xl">
             <h1 className="text-5xl font-bold mb-6 leading-tight">
               Excellence in <br/>
               <span className="text-primary-400">Healthcare Management</span>
             </h1>
             <p className="text-lg text-slate-300 leading-relaxed mb-8">
               Streamline patient care, appointments, billing, and staff management with our comprehensive hospital operating system. Secure, efficient, and reliable.
             </p>
             
             <div className="flex items-center gap-8">
               <div className="flex -space-x-4">
                 {[1,2,3,4].map(i => (
                   <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-900 bg-slate-700 flex items-center justify-center text-xs font-bold relative z-0">
                      <UserIcon size={16} className="opacity-50" />
                   </div>
                 ))}
               </div>
               <div>
                 <p className="font-bold text-white">2,000+ Staff</p>
                 <p className="text-xs text-slate-400">Trust AllCare Daily</p>
               </div>
             </div>
          </div>

          <div className="flex justify-between items-end text-xs text-slate-500 font-medium">
             <p>© 2024 AllCare HMS. All rights reserved.</p>
             <div className="flex gap-6">
                <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-white transition-colors">Help Center</a>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
