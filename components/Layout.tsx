
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarDays, Receipt, LogOut, X, Activity, Settings, 
  Lock, FlaskConical, Bed, ClipboardList, Wrench, Briefcase, Database, ChevronLeft, ChevronRight, Menu, Pill
} from 'lucide-react';
import { canAccessRoute } from '../utils/rbac';
import { Tooltip } from './UI';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout: onLogout } = useAuth();
  const { title, subtitle, actions } = useHeader();
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t, language } = useTranslation();
  const location = useLocation();
  const isRtl = language === 'ar';
  const ChevronStart = isRtl ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRtl ? ChevronLeft : ChevronRight;

  const hospitalName = localStorage.getItem('h_name') || 'AllCare HMS';

  const navGroups = [
    { items: [{ label: 'Dashboard', path: '/', icon: LayoutDashboard }] },
    { title: 'Clinical', items: [
        { label: 'Patients', path: '/patients', icon: Users },
        { label: 'Appointments', path: '/appointments', icon: CalendarDays },
        { label: 'Admissions', path: '/admissions', icon: Bed },
        { label: 'Laboratory', path: '/laboratory', icon: FlaskConical },
        { label: 'Pharmacy', path: '/pharmacy', icon: Pill },
        { label: 'Operations', path: '/operations', icon: Activity },
    ]},
    { title: 'Management', items: [
        { label: 'Billing', path: '/billing', icon: Receipt },
        { label: 'HR', path: '/hr', icon: Briefcase },
    ]},
    { title: 'System', items: [
        { label: 'Reports', path: '/reports', icon: ClipboardList },
        { label: 'Records', path: '/records', icon: Database },
        { label: 'Configuration', path: '/configuration', icon: Wrench },
        { label: 'Settings', path: '/settings', icon: Settings },
    ]}
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-hidden">
      <aside className={`
        fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800 dark:border-slate-900 shadow-xl transition-all duration-300 flex flex-col
        ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')} lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-56'}
      `}>
        <div className={`h-20 flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-4'} border-b border-slate-800 dark:border-slate-900 shrink-0`}>
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
              <Activity size={22} className="stroke-[2.5]" />
            </div>
            {!isCollapsed && <span className="font-bold text-base text-white tracking-tight truncate max-w-[120px]">{hospitalName}</span>}
          </div>
          {isMobileOpen && <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>}
        </div>

        <nav className={`flex-1 py-4 ${isCollapsed ? 'px-2' : 'px-3'} space-y-4 overflow-y-auto custom-scrollbar`}>
          {navGroups.map((group, i) => (
            <div key={i}>
              {group.title && !isCollapsed && <h3 className="px-3 mb-2 text-[10px] font-black text-slate-600 uppercase tracking-widest">{group.title}</h3>}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isAllowed = canAccessRoute(user, item.path);
                  return (
                    <Link
                      key={item.path}
                      to={isAllowed ? item.path : '#'}
                      onClick={() => setMobileOpen(false)}
                      className={`
                        group flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-lg transition-all duration-200
                        ${isAllowed && isActive ? 'bg-primary-600 text-white shadow-md' : ''}
                        ${isAllowed && !isActive ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : ''}
                        ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600' : ''}
                      `}
                    >
                      <item.icon size={18} />
                      {!isCollapsed && <span className="font-semibold text-sm whitespace-nowrap">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-slate-800 shrink-0">
          <button onClick={onLogout} className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:text-red-400 transition-colors">
             <LogOut size={16} /> {!isCollapsed && <span className="text-sm font-bold">Sign Out</span>}
          </button>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-56'} ${isRtl ? (isCollapsed ? 'lg:mr-20' : 'lg:mr-56') + ' lg:ml-0' : ''}`}>
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between z-40 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <div className="flex flex-col min-w-0">
               <h1 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">{title}</h1>
               <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
};
