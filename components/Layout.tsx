
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Receipt, 
  LogOut, 
  Menu, 
  X,
  Activity, // Operations
  Settings,
  Bell,
  Lock,
  FlaskConical, // Laboratory
  Bed, // Admissions
  ClipboardList, // Reports
  Wrench, // Configuration (for admin)
  Briefcase, // HR specific icon
  Database, // Records
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { User } from '../types';
import { canAccessRoute } from '../utils/rbac';
import { Tooltip } from './UI'; // Updated import

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

// Define structure for grouped navigation
type NavGroup = {
  title?: string;
  items: {
    label: string;
    path: string;
    icon: React.ElementType;
  }[];
};

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const location = useLocation();

  // Handle responsive auto-collapse
  useEffect(() => {
    const handleResize = () => {
      // Auto-collapse on tablet (md), expand on desktop (lg)
      if (window.innerWidth >= 768 && window.innerWidth < 1024) {
        setIsCollapsed(true);
      } else if (window.innerWidth >= 1024) {
        setIsCollapsed(false);
      }
    };

    // Initial check
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navGroups: NavGroup[] = [
    {
      items: [
        { label: 'Dashboard', path: '/', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Clinical',
      items: [
        { label: 'Patients', path: '/patients', icon: Users },
        { label: 'Appointments', path: '/appointments', icon: CalendarDays },
        { label: 'Admissions', path: '/admissions', icon: Bed },
        { label: 'Laboratory', path: '/laboratory', icon: FlaskConical },
        { label: 'Operations', path: '/operations', icon: Activity },
      ]
    },
    {
      title: 'Management',
      items: [
        { label: 'Billing', path: '/billing', icon: Receipt },
        { label: 'HR', path: '/hr', icon: Briefcase },
      ]
    },
    {
      title: 'System',
      items: [
        { label: 'Reports', path: '/reports', icon: ClipboardList },
        { label: 'Records', path: '/records', icon: Database },
        { label: 'Configuration', path: '/configuration', icon: Wrench },
        { label: 'Settings', path: '/settings', icon: Settings },
      ]
    }
  ];

  // Helper to find active label for header
  const getActiveLabel = () => {
    for (const group of navGroups) {
      const item = group.items.find(i => i.path === location.pathname);
      if (item) return item.label;
    }
    return 'Overview';
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-950 text-slate-300 border-r border-slate-800 dark:border-slate-900 shadow-xl transition-all duration-300">
      {/* Brand Header */}
      <div className={`h-20 flex items-center ${isCollapsed && !mobile ? 'justify-center px-0' : 'px-6'} border-b border-slate-800 dark:border-slate-900 shrink-0 transition-all duration-300`}>
        <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-900/50 flex-shrink-0">
            <Activity size={20} className="stroke-[2.5]" />
          </div>
          {(!isCollapsed || mobile) && (
            <div className="flex flex-col animate-in fade-in duration-300">
              <span className="font-bold text-lg text-white leading-none tracking-tight">AllCare</span>
              <span className="text-xs font-medium text-primary-400 uppercase tracking-widest">Medical</span>
            </div>
          )}
        </div>
        
        {mobile && (
          <button onClick={() => setMobileOpen(false)} className="ml-auto text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex-1 py-6 ${isCollapsed && !mobile ? 'px-2' : 'px-3'} space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar`}>
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Group Header */}
            {group.title && (
              !isCollapsed || mobile ? (
                <h3 className="px-3 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider animate-in fade-in duration-300">
                  {group.title}
                </h3>
              ) : (
                <div className="h-px bg-slate-800 mx-4 my-3" title={group.title}></div>
              )
            )}
            
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = location.pathname === item.path;
                const isAllowed = canAccessRoute(user, item.path);

                const LinkElement = (
                  <Link
                    to={isAllowed ? item.path : '#'}
                    // Removed native title prop to use custom Tooltip
                    onClick={(e) => {
                      if (!isAllowed) e.preventDefault();
                      if (mobile) setMobileOpen(false);
                    }}
                    className={`
                      group flex items-center ${isCollapsed && !mobile ? 'justify-center px-0' : 'gap-3 px-3'} py-2.5 rounded-xl transition-all duration-200
                      
                      ${isAllowed && isActive ? 'bg-primary-600 text-white shadow-md shadow-primary-900/20' : ''}
                      ${isAllowed && !isActive ? 'text-slate-400 hover:bg-slate-800 hover:text-white dark:hover:bg-slate-900' : ''}
                      ${!isAllowed ? 'opacity-40 cursor-not-allowed bg-transparent text-slate-600' : ''}
                    `}
                  >
                    <div className="relative flex-shrink-0">
                      <item.icon 
                        size={20} 
                        className={`transition-colors ${isActive && isAllowed ? 'text-white' : ''} ${!isAllowed ? 'text-slate-600' : ''}`} 
                      />
                      {!isAllowed && (
                        <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-0.5 border border-slate-700">
                          <Lock size={8} className="text-slate-400" />
                        </div>
                      )}
                    </div>

                    {(!isCollapsed || mobile) && (
                      <span className="font-medium text-sm whitespace-nowrap animate-in fade-in duration-300">
                        {item.label}
                      </span>
                    )}
                    
                    {(!isCollapsed || mobile) && !isAllowed && (
                      <Lock size={14} className="ml-auto text-slate-600" />
                    )}
                  </Link>
                );

                // Use Tooltip only when collapsed and on desktop
                if (isCollapsed && !mobile) {
                  return (
                    <Tooltip key={item.path} content={item.label} side="right">
                      {LinkElement}
                    </Tooltip>
                  );
                }

                return <React.Fragment key={item.path}>{LinkElement}</React.Fragment>;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className={`p-4 border-t border-slate-800 dark:border-slate-900 shrink-0 ${isCollapsed && !mobile ? 'flex flex-col items-center gap-4' : ''}`}>
        
        {/* Desktop Collapse Toggle (Moved to Top of Footer) */}
        {!mobile && (
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`
              flex items-center justify-center w-full p-2 mb-3 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors
            `}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}

        <div className={`flex items-center gap-3 ${isCollapsed && !mobile ? 'justify-center p-0' : 'p-2'} rounded-xl bg-slate-800/50 dark:bg-slate-900/50 border border-slate-700/50 dark:border-slate-800/50 w-full`}>
          <div className="w-9 h-9 rounded-lg bg-slate-700 dark:bg-slate-800 border border-slate-600 dark:border-slate-700 flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0">
            {user?.fullName?.charAt(0) || '?'}
          </div>
          
          {(!isCollapsed || mobile) && (
            <div className="flex-1 overflow-hidden animate-in fade-in duration-300">
              <p className="text-sm font-semibold text-slate-200 truncate">{user?.fullName}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role}</p>
            </div>
          )}

           {(!isCollapsed || mobile) ? (
             <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1" title="Logout">
               <LogOut size={18} />
             </button>
           ) : (
             // Collapsed Logout
             <button onClick={onLogout} className="text-slate-400 hover:text-red-400 transition-colors p-1 ml-1">
                <Tooltip content="Logout" side="right">
                  <LogOut size={18} />
                </Tooltip>
             </button>
           )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Mobile Sidebar (Drawer) */}
      <div className={`fixed inset-0 z-50 md:hidden pointer-events-none ${isMobileOpen ? 'pointer-events-auto' : ''}`}>
        <div 
          className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isMobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className={`absolute top-0 left-0 bottom-0 w-72 bg-slate-900 transition-transform duration-300 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <SidebarContent mobile={true} />
        </div>
      </div>

      {/* Desktop/Tablet Sidebar (Collapsible) */}
      <aside className={`hidden md:block relative z-20 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-72'}`}>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 lg:px-8 shrink-0 z-10 sticky top-0 transition-colors duration-200">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <Menu size={24} />
            </button>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
              {getActiveLabel()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-full border border-green-100 dark:border-green-800">
               <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
               <span className="text-xs font-medium text-green-700 dark:text-green-400">System Online</span>
             </div>
             <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block"></div>
             <button className="relative p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-full transition-colors">
               <Bell size={20} />
               <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8 scroll-smooth bg-slate-50/50 dark:bg-slate-950/50">
          <div className="max-w-7xl mx-auto space-y-8 pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
