import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => (
  <div className={`bg-white rounded-2xl shadow-card border border-slate-200 overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
        {title && <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ElementType;
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) => {
  const baseStyle = "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-500/20 focus:ring-primary-500 active:scale-[0.98]",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500 active:scale-[0.98]",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500 border border-red-100",
    outline: "border border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600 hover:bg-primary-50 focus:ring-primary-500 bg-white",
    ghost: "text-slate-500 hover:text-primary-600 hover:bg-slate-50"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2.5"
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {Icon && <Icon className={`w-[1.1em] h-[1.1em] ${!children ? '' : ''}`} />}
      {children}
    </button>
  );
};

// --- Badge ---
export const Badge: React.FC<{ children: React.ReactNode; color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' }> = ({ children, color = 'gray' }) => {
  const colors = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    yellow: 'bg-amber-50 text-amber-700 border-amber-100',
    blue: 'bg-primary-50 text-primary-700 border-primary-100',
    gray: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${colors[color]}`}>
      {children}
    </span>
  );
};

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5 scale-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 shrink-0">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-2 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

// --- Form Input ---
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
      <input
        ref={ref}
        className={`block w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border transition-all duration-200 ${error ? 'border-red-300 bg-red-50' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1"><AlertCircle size={12}/> {error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// --- Form Textarea ---
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={`block w-full rounded-xl bg-white text-slate-900 placeholder:text-slate-400 border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border transition-all duration-200 ${error ? 'border-red-300 bg-red-50' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600 font-medium flex items-center gap-1"><AlertCircle size={12}/> {error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
  ({ label, error, children, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={`block w-full rounded-xl bg-white text-slate-900 border-slate-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border appearance-none transition-all duration-200 ${error ? 'border-red-300' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';