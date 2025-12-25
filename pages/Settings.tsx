
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from '../components/UI';
import { 
  Moon, Sun, Monitor, Laptop, Smartphone, Globe2, Clock, Check, Palette, Type
} from 'lucide-react';
import { useTheme, colorPalettes, AccentColor } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Settings = () => {
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { theme, setTheme, accent, setAccent, density, setDensity, fontSize, setFontSize } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  // Sync Header
  useHeader(t('settings_title'), t('settings_subtitle'));

  const ACCENT_COLORS: AccentColor[] = [
    'slate', 'zinc', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 
    'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 
    'purple', 'fuchsia', 'pink', 'rose'
  ];

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      {message && (
        <div className={`fixed bottom-8 right-8 z-50 p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' : 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300'}`}>
          <div className={`p-2 rounded-full ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
             <Check size={16} />
          </div>
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      {/* Interface Theme Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Monitor size={14} /> {t('settings_appearance_title')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'light', label: t('settings_appearance_light'), icon: Sun },
            { id: 'dark', label: t('settings_appearance_dark'), icon: Moon },
            { id: 'system', label: t('settings_appearance_system'), icon: Monitor }
          ].map((mode) => (
            <button 
              key={mode.id} 
              onClick={() => setTheme(mode.id as any)}
              className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-4 ${
                theme === mode.id 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-primary-200'
              }`}
            >
              <div className={`p-4 rounded-full ${theme === mode.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}>
                 <mode.icon size={28} />
              </div>
              <span className="font-black text-xs uppercase tracking-widest">{mode.label}</span>
              {theme === mode.id && <div className="absolute top-3 right-3 text-primary-600"><Check size={16} strokeWidth={3} /></div>}
            </button>
          ))}
        </div>
      </section>

      {/* Accent Color Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Palette size={14} /> {t('settings_appearance_accent')}
        </h3>
        <Card>
           <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
             {ACCENT_COLORS.map(color => (
               <button
                  key={color}
                  onClick={() => setAccent(color)}
                  className={`group relative w-full aspect-square rounded-xl transition-all duration-300 border-2 ${
                    accent === color ? 'ring-4 ring-offset-4 ring-primary-500 scale-110 shadow-xl border-white dark:border-slate-800' : 'hover:scale-105 shadow-sm border-transparent'
                  }`}
                  title={color}
                  style={{ backgroundColor: colorPalettes[color][500] }}
               >
                 {accent === color && <Check className="absolute inset-0 m-auto text-white drop-shadow-md" size={20} strokeWidth={4} />}
               </button>
             ))}
           </div>
        </Card>
      </section>

      {/* Density & Font Size Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Monitor size={14} /> {t('settings_appearance_density')}
          </h3>
          <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setDensity('comfortable')} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${density === 'comfortable' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Laptop size={16}/> {t('settings_appearance_density_comfortable')}
            </button>
            <button 
              onClick={() => setDensity('compact')} 
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all ${density === 'compact' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Smartphone size={16}/> {t('settings_appearance_density_compact')}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
            <Type size={14} /> {t('settings_appearance_fontSize')}
          </h3>
          <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            {['sm', 'md', 'lg'].map(size => (
              <button 
                key={size}
                onClick={() => setFontSize(size as any)} 
                className={`flex-1 flex items-center justify-center py-3 rounded-xl text-sm font-black uppercase transition-all ${fontSize === size ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {size}
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* Regional Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Globe2 size={14} /> {t('settings_regional_title')}
        </h3>
        <Card>
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl">
                  <Globe2 size={24} />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{t('settings_profile_language')}</p>
                  <p className="text-xs text-slate-500">Choose your preferred interface language.</p>
                </div>
              </div>
              
              <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                <button 
                  type="button" 
                  onClick={() => setLanguage('en')} 
                  className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all ${language === 'en' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  ENGLISH
                </button>
                <button 
                  type="button" 
                  onClick={() => setLanguage('ar')} 
                  className={`flex-1 md:flex-none px-6 py-2 rounded-xl text-xs font-black transition-all ${language === 'ar' ? 'bg-white dark:bg-slate-800 text-primary-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                >
                  العربية
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-50 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="p-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-2xl">
                  <Clock size={24} />
                </div>
                <div className="flex-1">
                  <Select 
                    label={t('settings_profile_timezone')} 
                    defaultValue="UTC+3"
                  >
                    <option value="UTC+0">{t('settings_timezone_utc')}</option>
                    <option value="UTC+2">{t('settings_timezone_utc2')}</option>
                    <option value="UTC+3">{t('settings_timezone_utc3')}</option>
                    <option value="UTC+4">{t('settings_timezone_utc4')}</option>
                  </Select>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider px-1">
                <Clock size={10} className="inline mr-1 mb-0.5" /> This timezone affects scheduling and audit trail logging.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <div className="flex justify-end pt-4">
         <Button onClick={() => showMessage('success', t('settings_toast_profile_success'))} icon={Check}>
            Save All Preferences
         </Button>
      </div>
    </div>
  );
};
