
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CalendarDays, 
  Receipt, 
  Stethoscope, 
  LogOut, 
  Menu, 
  X,
  Activity,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout }) => {
  // Mobile state: Open/Closed (Drawer)
  const [isMobileOpen, setMobileOpen] = useState(false);
  // Desktop state: Expanded/Collapsed (Mini sidebar)
  const [isDesktopCollapsed, setDesktopCollapsed] = useState(false);
  
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Patients', path: '/patients', icon: Users },
    { label: 'Appointments', path: '/appointments', icon: CalendarDays },
    { label: 'Billing', path: '/billing', icon: Receipt },
    { label: 'Medical Staff', path: '/staff', icon: Stethoscope },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50 bg-slate-900 text-white transition-all duration-300 ease-in-out shadow-xl flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
          lg:translate-x-0
          ${isDesktopCollapsed ? 'lg:w-20' : 'lg:w-64'}
          w-64
        `}
      >
        {/* Sidebar Header */}
        <div className={`h-16 flex items-center bg-slate-950 transition-all duration-300 ${isDesktopCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          <div className="flex items-center gap-2 font-bold text-xl text-primary-500 overflow-hidden whitespace-nowrap">
            <Activity className="w-8 h-8 flex-shrink-0" />
            <span className={`transition-opacity duration-300 ${isDesktopCollapsed ? 'opacity-0 w-0' : 'opacity-100'}`}>
              AllCare HMS
            </span>
          </div>
          {/* Mobile Close Button */}
          <button onClick={() => setMobileOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)} // Close on mobile click
                title={isDesktopCollapsed ? item.label : ''}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-lg transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'bg-primary-600 text-white shadow-md' 
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'}
                  ${isDesktopCollapsed ? 'justify-center' : ''}
                `}
              >
                <item.icon size={20} className="flex-shrink-0" />
                <span className={`font-medium transition-all duration-300 ${isDesktopCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 mb-4 transition-all duration-300 ${isDesktopCollapsed ? 'justify-center' : ''}`}>
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user?.fullName.charAt(0)}
            </div>
            <div className={`overflow-hidden transition-all duration-300 ${isDesktopCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              <p className="text-sm font-medium truncate text-white">{user?.fullName}</p>
              <p className="text-xs text-gray-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            title="Logout"
            className={`
              w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap
              ${isDesktopCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut size={20} className="flex-shrink-0" />
            <span className={`transition-all duration-300 ${isDesktopCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 lg:px-8 z-10">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Trigger */}
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Menu size={24} />
            </button>
            
            {/* Desktop Collapse Trigger */}
            <button 
              onClick={() => setDesktopCollapsed(!isDesktopCollapsed)} 
              className="hidden lg:flex p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isDesktopCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
            </button>

            <h2 className="text-lg font-semibold text-gray-800 lg:hidden">AllCare HMS</h2>
          </div>

          <div className="flex items-center gap-4">
             <span className="text-sm text-gray-500 hidden sm:block">
               {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
             </span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};
