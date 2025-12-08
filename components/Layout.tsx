import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Receipt, 
  Stethoscope, 
  LogOut, 
  Menu, 
  X,
  Activity, // Operations
  ChevronLeft,
  Settings,
  Bell,
  Lock,
  FlaskConical, // Laboratory
  Bed, // Admissions
  ClipboardList, // Reports
  Wrench, // Configuration (for admin)
  Briefcase // HR specific icon
} from 'lucide-react';
import { User } from '../types';
import { canAccessRoute } from '../utils/rbac';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isSidebarExpanded, setSidebarExpanded] = useState(true);
  
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Patients', path: '/patients', icon: Users },
    { label: 'Appointments', path: '/appointments', icon: CalendarDays },
    { label: 'Admissions', path: '/admissions', icon: Bed }, 
    { label: 'Laboratory', path: '/laboratory', icon: FlaskConical },
    { label: 'Operations', path: '/operations', icon: Activity },
    { label: 'Billing', path: '/billing', icon: Receipt },
    { label: 'HR', path: '/hr', icon: Briefcase }, 
    { label: 'Reports', path: '/reports', icon: ClipboardList },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Configuration', path: '/configuration', icon: Wrench },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className={`h-20 flex items-center ${isSidebarExpanded ? 'px-6' : 'px-0 justify-center'} border-b border-slate-800 transition-all duration-300 shrink-0`}>
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-900/50 flex-shrink-0">
            <Activity size={20} className="stroke-[2.5]" />
          </div>
          <div className={`flex flex-col transition-all duration-300 ${isSidebarExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
            <span className="font-bold text-lg text-white leading-none tracking-tight">AllCare</span>
            <span className="text-xs font-medium text-primary-400 uppercase tracking-widest">Medical</span>
          </div>
        </div>
        
        <button onClick={() => setMobileOpen(false)} className="lg:hidden ml-auto text-slate-400 hover:text-white">
          <X size={24} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isAllowed = canAccessRoute(user, item.path);

          return (
            <Link
              key={item.path}
              to={isAllowed ? item.path : '#'}
              onClick={(e) => {
                if (!isAllowed) e.preventDefault();
                setMobileOpen(false);
              }}
              className={`
                group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                ${!isSidebarExpanded ? 'justify-center' : ''}
                
                ${isAllowed && isActive ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20' : ''}
                ${isAllowed && !isActive ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : ''}
                ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600' : ''}
              `}
              title={!isSidebarExpanded ? item.label : ''}
            >
              <div className="relative flex-shrink-0">
                <item.icon 
                  size={22} 
                  className={`transition-colors ${isActive && isAllowed ? 'text-white' : ''} ${!isAllowed ? 'text-slate-600' : ''}`} 
                />
                {!isAllowed && (
                  <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700">
                    <Lock size={10} className="text-slate-400" />
                  </div>
                )}
              </div>

              <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isSidebarExpanded ? 'opacity-100' : 'opacity-0 w-0 hidden'}`}>
                {item.label}
              </span>
              
              {!isAllowed && isSidebarExpanded && (
                <Lock size={14} className="ml-auto text-slate-600" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className={`
          flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50
          ${!isSidebarExpanded ? 'justify-center' : ''}
        `}>
          <div className="w-9 h-9 rounded-lg bg-slate-700 border border-slate-600 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
            {user?.fullName.charAt(0)}
          </div>
          
          {isSidebarExpanded && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.fullName}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          )}

          {isSidebarExpanded && (
             <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Logout">
               <LogOut size={18} />
             </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar (Drawer) */}
      <div className={`fixed inset-0 z-50 lg:hidden pointer-events-none ${isMobileOpen ? 'pointer-events-auto' : ''}`}>
        <div 
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className={`absolute top-0 left-0 bottom-0 w-72 bg-slate-900 transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside 
        className={`
          hidden lg:block sidebar-transition relative z-20 shrink-0
          ${isSidebarExpanded ? 'w-72' : 'w-20'}
        `}
      >
        <SidebarContent />
        
        <button 
          onClick={() => setSidebarExpanded(!isSidebarExpanded)}
          className="absolute -right-3 top-24 w-6 h-6 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-primary-600 hover:border-primary-500 shadow-md transition-all z-50"
        >
          <ChevronLeft size={14} className={`transition-transform duration-300 ${!isSidebarExpanded ? 'rotate-180' : ''}`} />
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {navItems.find(i => i.path === location.pathname)?.label || 'Overview'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-xs font-medium text-green-700">System Online</span>
             </div>
             <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
             <button className="relative p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-colors">
               <Bell size={20} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8 scroll-smooth bg-slate-50/50">
          <div className="max-w-7xl mx-auto space-y-8 pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};