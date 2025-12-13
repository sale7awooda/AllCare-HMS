
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarDays, Receipt, LogOut, X, Activity, Settings, 
  Lock, FlaskConical, Bed, ClipboardList, Wrench, Briefcase, Database, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { canAccessRoute } from '../utils/rbac';
import { Tooltip } from './UI';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout: onLogout } = useAuth();
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t, language } = useTranslation();
  const location = useLocation();
  const isRtl = language === 'ar';
  const ChevronStart = isRtl ? ChevronRight : ChevronLeft;
  const ChevronEnd = isRtl ? ChevronLeft : ChevronRight;

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) setIsCollapsed(true);
      else if (window.innerWidth >= 1024) setIsCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navGroups = [
    { items: [{ labelKey: 'nav_dashboard', path: '/', icon: LayoutDashboard }] },
    { titleKey: 'nav_clinical', items: [
        { labelKey: 'nav_patients', path: '/patients', icon: Users },
        { labelKey: 'nav_appointments', path: '/appointments', icon: CalendarDays },
        { labelKey: 'nav_admissions', path: '/admissions', icon: Bed },
        { labelKey: 'nav_laboratory', path: '/laboratory', icon: FlaskConical },
        { labelKey: 'nav_operations', path: '/operations', icon: Activity },
    ]},
    { titleKey: 'nav_management', items: [
        { labelKey: 'nav_billing', path: '/billing', icon: Receipt },
        { labelKey: 'nav_hr', path: '/hr', icon: Briefcase },
    ]},
    { titleKey: 'nav_system', items: [
        { labelKey: 'nav_reports', path: '/reports', icon: ClipboardList },
        { labelKey: 'nav_records', path: '/records', icon: Database },
        { labelKey: 'nav_configuration', path: '/configuration', icon: Wrench },
        { labelKey: 'nav_settings', path: '/settings', icon: Settings },
    ]}
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-hidden">
      <aside className={`
        fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800 dark:border-slate-900 shadow-xl transition-all duration-300
        ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')} lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-64'}
      `}>
        <div className={`h-28 flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-6'} border-b border-slate-800 dark:border-slate-900 shrink-0`}>
          <div className="flex items-center gap-4 overflow-hidden whitespace-nowrap">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-900/50 flex-shrink-0">
              <Activity size={28} className="stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col animate-in fade-in duration-300">
                <span className="font-bold text-xl text-white leading-none tracking-tight">AllCare</span>
                <span className="text-xs font-medium text-primary-400 uppercase tracking-widest mt-1">Medical</span>
              </div>
            )}
          </div>
          {isMobileOpen && (
            <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={24} /></button>
          )}
        </div>

        <nav className={`flex-1 py-6 ${isCollapsed ? 'px-2' : 'px-3'} space-y-6 overflow-y-auto custom-scrollbar`}>
          {navGroups.map((group, i) => (
            <div key={i}>
              {group.titleKey && (
                !isCollapsed ? (
                  <h3 className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider animate-in fade-in">{t(group.titleKey)}</h3>
                ) : <div className="h-px bg-slate-800 mx-4 my-3" />
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isAllowed = canAccessRoute(user, item.path);
                  const label = t(item.labelKey);
                  const LinkEl = (
                    <Link
                      to={isAllowed ? item.path : '#'}
                      onClick={(e) => { if (!isAllowed) e.preventDefault(); setMobileOpen(false); }}
                      className={`
                        group flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all duration-200
                        ${isAllowed && isActive ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20' : ''}
                        ${isAllowed && !isActive ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : ''}
                        ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600' : ''}
                      `}
                    >
                      <div className="relative flex-shrink-0">
                        <item.icon size={20} className={isActive && isAllowed ? 'text-white' : !isAllowed ? 'text-slate-600' : ''} />
                        {!isAllowed && <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700"><Lock size={8} className="text-slate-400" /></div>}
                      </div>
                      {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap animate-in fade-in">{label}</span>}
                      {!isCollapsed && !isAllowed && <Lock size={14} className="ml-auto text-slate-600" />}
                    </Link>
                  );
                  return isCollapsed ? <Tooltip key={item.path} content={label} side={isRtl ? "left" : "right"}>{LinkEl}</Tooltip> : <React.Fragment key={item.path}>{LinkEl}</React.Fragment>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`p-4 border-t border-slate-800 dark:border-slate-900 shrink-0 ${isCollapsed ? 'flex flex-col items-center gap-4' : ''}`}>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex items-center justify-center w-full p-2 mb-3 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
            {isCollapsed ? <ChevronEnd size={20} /> : <ChevronStart size={20} />}
          </button>
          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center p-0 bg-transparent' : 'p-3'} rounded-xl w-full`}>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden animate-in fade-in">
                <p className="text-sm font-semibold text-slate-200 truncate">{user?.fullName}</p>
                <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
              </div>
            )}
            <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1" title={t('tooltip_logout')}>
               <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'} ${isRtl ? 'lg:mr-20 lg:ml-0' : ''}`}>
        <header className="h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-4 flex items-center justify-between z-40 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            {!isMobileOpen && <h2 className="text-lg font-bold text-slate-800 dark:text-white truncate hidden sm:block">{t('header_system_online')}</h2>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </div>
      </main>
      
      {isMobileOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-in fade-in" onClick={() => setMobileOpen(false)}></div>}
    </div>
  );
};
// FIX: Removed extraneous file marker that was causing a syntax error.
