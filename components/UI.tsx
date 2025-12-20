
import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';

// --- Card ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200 ${className}`}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
        {title && <h3 className="text-base font-bold text-slate-800 dark:text-white tracking-tight">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6 dark:text-slate-200">{children}</div>
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
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-500 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500 border border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-900/50",
    outline: "border border-slate-200 text-slate-600 hover:border-primary-200 hover:text-primary-600 hover:bg-primary-50 focus:ring-primary-500 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700",
    ghost: "text-slate-500 hover:text-primary-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
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
export const Badge: React.FC<{ children: React.ReactNode; color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'orange' | 'purple'; className?: string }> = ({ children, color = 'gray', className = '' }) => {
  const colors: Record<string, string> = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    red: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    yellow: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    blue: 'bg-primary-50 text-primary-700 border-primary-100 dark:bg-primary-900/30 dark:text-primary-400 dark:border-primary-800',
    gray: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    orange: 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    purple: 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${colors[color] || colors.gray} ${className}`}>
      {children}
    </span>
  );
};

// --- Modal ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string }> = ({ isOpen, onClose, title, children, className = '' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl ring-1 ring-slate-900/5 dark:ring-white/10 overflow-hidden animate-in zoom-in-95 duration-200 ${className}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50 dark:border-slate-700 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg p-2 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar dark:text-slate-200">{children}</div>
      </div>
    </div>
  );
};

// --- Confirmation Dialog ---
export const ConfirmationDialog: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  onConfirm: () => void; 
  title: string; 
  message: React.ReactNode; 
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}> = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', type = 'danger' }) => {
  if (!isOpen) return null;
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className={`flex gap-4 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200'} p-4 rounded-xl`}>
          <AlertCircle size={24} className="shrink-0" />
          <div className="text-sm font-medium leading-relaxed">
            {message}
          </div>
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
          <Button 
            variant={type === 'danger' ? 'danger' : 'primary'} 
            onClick={() => { onConfirm(); onClose(); }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// --- Form Input ---
// Omit 'prefix' from InputHTMLAttributes to avoid conflict with our ReactNode prefix prop
export const Input = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> & { label?: string; error?: string; prefix?: React.ReactNode }>(
  ({ label, error, className = '', prefix, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div className="relative">
        {prefix && (
          <div className="absolute inset-y-0 left-0 ps-3 flex items-center pointer-events-none">
            <span className="text-gray-500 dark:text-slate-400 sm:text-sm font-medium">{prefix}</span>
          </div>
        )}
        <input
          ref={ref}
          className={`block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 ${prefix ? 'ps-10 pe-4' : 'px-4'} border transition-all duration-200 ${error ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1"><AlertCircle size={12}/> {error}</p>}
    </div>
  )
);
Input.displayName = 'Input';

// --- Form Textarea ---
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }>(
  ({ label, error, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={`block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border transition-all duration-200 ${error ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800' : ''} ${className}`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1"><AlertCircle size={12}/> {error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
  ({ label, error, children, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={`block w-full rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-300 dark:border-slate-700 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2.5 px-4 border appearance-none transition-all duration-200 ${error ? 'border-red-300 dark:border-red-800' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </div>
  )
);
Select.displayName = 'Select';

// --- Tooltip ---
export const Tooltip: React.FC<{ children: React.ReactNode; content: React.ReactNode; side?: 'right' | 'top' | 'bottom' | 'left'; delay?: number }> = ({ children, content, side = 'right', delay = 0 }) => {
  const [show, setShow] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0, height: 0, width: 0 });
  let timeoutId: any;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.top, left: rect.left, height: rect.height, width: rect.width });
    
    if (delay) {
      timeoutId = setTimeout(() => setShow(true), delay);
    } else {
      setShow(true);
    }
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutId);
    setShow(false);
  };

  const isRtl = document.documentElement.dir === 'rtl';
  let effectiveSide = side;
  if (isRtl) {
    if (side === 'right') effectiveSide = 'left';
    else if (side === 'left') effectiveSide = 'right';
  }

  const getStyles = () => {
    const base = { position: 'fixed' as 'fixed', zIndex: 9999, pointerEvents: 'none' as 'none' };
    switch (effectiveSide) {
      case 'right':
        return { ...base, top: pos.top + pos.height / 2, left: pos.left + pos.width + 10, transform: 'translateY(-50%)' };
      case 'left':
        return { ...base, top: pos.top + pos.height / 2, left: pos.left - 10, transform: 'translate(-100%, -50%)' };
      case 'top':
        return { ...base, top: pos.top - 10, left: pos.left + pos.width / 2, transform: 'translate(-50%, -100%)' };
      case 'bottom':
        return { ...base, top: pos.top + pos.height + 10, left: pos.left + pos.width / 2, transform: 'translate(-50%, 0)' };
      default:
        return base;
    }
  };

  const arrowStyles = () => {
      switch (effectiveSide) {
      case 'right': return "top-1/2 -left-1 -translate-y-1/2 border-r-slate-900 dark:border-r-white border-y-transparent border-l-transparent";
      case 'left': return "top-1/2 -right-1 -translate-y-1/2 border-l-slate-900 dark:border-l-white border-y-transparent border-r-transparent";
      case 'top': return "bottom-[-4px] left-1/2 -translate-x-1/2 border-t-slate-900 dark:border-t-white border-x-transparent border-b-transparent";
      case 'bottom': return "top-[-4px] left-1/2 -translate-x-1/2 border-b-slate-900 dark:border-b-white border-x-transparent border-t-transparent";
      default: return "";
      }
  };

  return (
    <>
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="w-full">
        {children}
      </div>
      {show && (
        <div 
          className="fixed px-3 py-1.5 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-md shadow-xl whitespace-nowrap z-[100] animate-in fade-in zoom-in-95 duration-150"
          style={getStyles()}
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 ${arrowStyles()}`}></div>
        </div>
      )}
    </>
  );
};