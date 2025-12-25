
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CalendarDays, Receipt, LogOut, X, Activity, Settings, 
  Lock, FlaskConical, Bed, ClipboardList, Wrench, Briefcase, Database, ChevronLeft, ChevronRight, Menu,
  Bell, Check, Info, AlertTriangle, XCircle, Trash2
} from 'lucide-react';
import { canAccessRoute } from '../utils/rbac';
import { Tooltip, Badge } from './UI';
import { useTranslation } from '../context/TranslationContext';
import { useAuth } from '../context/AuthContext';
import { useHeader } from '../context/HeaderContext';
import { api } from '../services/api';
import { Notification } from '../types';

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

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const hospitalName = localStorage.getItem('h_name') || 'AllCare HMS';

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth < 1024) setIsCollapsed(true);
      else if (window.innerWidth >= 1024) setIsCollapsed(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
    } catch (e) {
      console.error('Failed to load notifications');
    }
  };

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000); // Poll every 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {}
  };

  const markAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

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

  const getNotifIcon = (type: string) => {
    switch(type) {
      case 'success': return <Check size={14} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      case 'error': return <XCircle size={14} className="text-rose-500" />;
      default: return <Info size={14} className="text-blue-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200 overflow-hidden">
      <aside className={`
        fixed inset-y-0 ${isRtl ? 'right-0' : 'left-0'} z-50 bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800 dark:border-slate-900 shadow-xl transition-all duration-300 flex flex-col
        ${isMobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')} lg:translate-x-0
        ${isCollapsed ? 'w-20' : 'w-56'}
      `}>
        <div className={`h-20 flex items-center justify-between ${isCollapsed ? 'justify-center px-0' : 'px-4'} border-b border-slate-800 dark:border-slate-900 shrink-0`}>
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-900/40 flex-shrink-0">
              <Activity size={22} className="stroke-[2.5]" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col animate-in fade-in duration-300 overflow-hidden">
                <span className="font-bold text-base text-white leading-none tracking-tight truncate max-w-[120px]">{hospitalName}</span>
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-widest mt-1 opacity-80">Portal</span>
              </div>
            )}
          </div>
          {isMobileOpen && (
            <button onClick={() => setMobileOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X size={20} /></button>
          )}
        </div>

        <nav className={`flex-1 py-4 ${isCollapsed ? 'px-2' : 'px-3'} space-y-4 overflow-y-auto custom-scrollbar`}>
          {navGroups.map((group, i) => (
            <div key={i}>
              {group.titleKey && (
                !isCollapsed ? (
                  <h3 className="px-3 mb-2 text-[10px] font-black text-slate-600 uppercase tracking-widest animate-in fade-in">{t(group.titleKey)}</h3>
                ) : <div className="h-px bg-slate-800 mx-4 my-2" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  const isAllowed = canAccessRoute(user, item.path);
                  const label = t(item.labelKey);
                  const LinkEl = (
                    <Link
                      to={isAllowed ? item.path : '#'}
                      onClick={(e) => { if (!isAllowed) e.preventDefault(); setMobileOpen(false); }}
                      className={`
                        group flex items-center ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'} py-2 rounded-lg transition-all duration-200
                        ${isAllowed && isActive ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20' : ''}
                        ${isAllowed && !isActive ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : ''}
                        ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600' : ''}
                      `}
                    >
                      <div className="relative flex-shrink-0">
                        <item.icon size={18} className={isActive && isAllowed ? 'text-white' : !isAllowed ? 'text-slate-600' : ''} />
                        {!isAllowed && <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700"><Lock size={8} className="text-slate-400" /></div>}
                      </div>
                      {!isCollapsed && <span className="font-semibold text-sm whitespace-nowrap animate-in fade-in">{label}</span>}
                    </Link>
                  );
                  return isCollapsed ? <Tooltip key={item.path} content={label} side={isRtl ? "left" : "right"}>{LinkEl}</Tooltip> : <React.Fragment key={item.path}>{LinkEl}</React.Fragment>;
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`p-2 border-t border-slate-800 dark:border-slate-900 shrink-0 ${isCollapsed ? 'flex flex-col items-center gap-2' : ''}`}>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex items-center justify-center w-full p-1.5 mb-1 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors">
            {isCollapsed ? <ChevronEnd size={16} /> : <ChevronStart size={16} />}
          </button>
          <div className={`flex items-center gap-2 ${isCollapsed ? 'justify-center p-1 bg-transparent' : 'p-2 bg-slate-800/40 rounded-xl'} w-full transition-all`}>
            {!isCollapsed && (
              <div className="flex-1 overflow-hidden animate-in fade-in">
                <p className="text-xs font-bold text-slate-200 truncate">{user?.fullName}</p>
                <p className="text-[10px] text-slate-500 truncate capitalize">{user?.role}</p>
              </div>
            )}
            <button onClick={onLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1" title={t('tooltip_logout')}>
               <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col h-full min-w-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:ml-20' : 'lg:ml-56'} ${isRtl ? (isCollapsed ? 'lg:mr-20' : 'lg:mr-56') + ' lg:ml-0' : ''}`}>
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between z-40 sticky top-0 shrink-0">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <div className="flex flex-col min-w-0">
               <h1 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">{title}</h1>
               <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4 rtl:mr-4 rtl:ml-0">
            {/* Notifications Bell */}
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`p-2.5 rounded-xl transition-all relative ${isNotifOpen ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-in zoom-in">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
                    <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">{t('settings_tab_notifications')}</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] font-black text-primary-600 uppercase hover:underline">Mark all as read</button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 italic text-sm">No notifications.</div>
                    ) : (
                      notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={() => !n.isRead && markRead(n.id)}
                          className={`p-4 border-b border-slate-50 dark:border-slate-700/50 flex gap-3 transition-colors cursor-pointer group ${!n.isRead ? 'bg-primary-50/30 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                        >
                          <div className="mt-1 shrink-0">{getNotifIcon(n.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm leading-tight ${!n.isRead ? 'font-bold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{n.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase">{new Date(n.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                          </div>
                          {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary-500 self-center shrink-0"></div>}
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-3 text-center border-t border-slate-100 dark:border-slate-700">
                     <Link to="/records" onClick={() => setIsNotifOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary-600 transition-colors">View All Activity</Link>
                  </div>
                </div>
              )}
            </div>
            {actions}
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
