
import React, { useState } from 'react';
import { Card, Button, Select } from '../components/UI';
import { 
  Moon, Sun, Monitor, Laptop, Smartphone, Globe2, Clock, Check, Palette, Type, ShieldCheck, 
  Layout, Maximize
} from 'lucide-react';
import { useTheme, colorPalettes, AccentColor } from '../context/ThemeContext';
import { useTranslation } from '../context/TranslationContext';
import { useHeader } from '../context/HeaderContext';

export const Customizations = () => {
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { theme, setTheme, accent, setAccent, density, setDensity, fontSize, setFontSize } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  useHeader(t('settings_title'), t('settings_subtitle'));

  const ACCENT_COLORS: AccentColor[] = [
    'blue', 'indigo', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 
    'yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'purple', 
    'violet', 'slate', 'zinc', 'stone'
  ];

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10 animate-in fade-in duration-500">
      {message && (
        <div className={`fixed bottom-8 right-8 z-[100] p-3 px-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-800/50 dark:text-emerald-300' : 'bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-900/40 dark:border-rose-800/50 dark:text-rose-300'}`}>
          <div className={`p-1.5 rounded-full ${message.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
             <Check size={14} strokeWidth={3} />
          </div>
          <p className="text-xs font-bold">{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 space-y-5">
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Monitor size={12} /> {t('settings_appearance_title')}
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'light', label: t('settings_appearance_light'), icon: Sun },
                { id: 'dark', label: t('settings_appearance_dark'), icon: Moon },
                { id: 'system', label: t('settings_appearance_system'), icon: Layout }
              ].map((mode) => (
                <button 
                  key={mode.id} 
                  onClick={() => setTheme(mode.id as any)}
                  className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                    theme === mode.id 
                      ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-900/10 shadow-sm' 
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:border-slate-200 dark:hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${theme === mode.id ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                     <mode.icon size={18} />
                  </div>
                  <span className="font-bold text-[9px] uppercase tracking-wider">{mode.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Palette size={12} /> {t('settings_appearance_accent')}
            </h3>
            <Card className="!p-3.5 bg-white dark:bg-slate-900 shadow-sm">
               <p className="text-[11px] text-slate-500 mb-3 px-0.5">{t('settings_appearance_accent_desc')}</p>
               <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                 {ACCENT_COLORS.map(color => (
                   <button
                      key={color}
                      onClick={() => setAccent(color)}
                      className={`group relative w-full aspect-square rounded-lg transition-all duration-200 border-2 ${
                        accent === color ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-slate-950 scale-105 shadow-md border-white dark:border-slate-800' : 'hover:scale-105 border-transparent'
                      }`}
                      title={color}
                      style={{ backgroundColor: colorPalettes[color][500] }}
                   >
                     {accent === color && <Check className="absolute inset-0 m-auto text-white" size={12} strokeWidth={4} />}
                   </button>
                 ))}
               </div>
            </Card>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-5">
          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Maximize size={12} /> {t('settings_appearance_density')}
            </h3>
            <Card className="!p-3.5 bg-white dark:bg-slate-900 shadow-sm">
              <p className="text-[11px] text-slate-500 mb-3">{t('settings_appearance_density_desc')}</p>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <button 
                  onClick={() => setDensity('comfortable')} 
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${density === 'comfortable' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
                >
                  <Laptop size={12}/> {t('settings_appearance_density_comfortable')}
                </button>
                <button 
                  onClick={() => setDensity('compact')} 
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${density === 'compact' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
                >
                  <Smartphone size={12}/> {t('settings_appearance_density_compact')}
                </button>
              </div>
            </Card>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
              <Type size={12} /> {t('settings_appearance_fontSize')}
            </h3>
            <Card className="!p-3.5 bg-white dark:bg-slate-900 shadow-sm">
              <p className="text-[11px] text-slate-500 mb-3">{t('settings_appearance_font_desc')}</p>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                {['sm', 'md', 'lg'].map(size => (
                  <button 
                    key={size}
                    onClick={() => setFontSize(size as any)} 
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${fontSize === size ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Card>
          </section>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Globe2 size={12} /> {t('settings_regional_title')}
        </h3>
        <Card className="bg-white dark:bg-slate-900 !p-0 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x dark:divide-slate-800">
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg">
                  <Globe2 size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{t('settings_profile_language')}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Interface localization</p>
                </div>
              </div>
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                <button 
                  type="button" 
                  onClick={() => setLanguage('en')} 
                  className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${language === 'en' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  {t('settings_language_en').toUpperCase()}
                </button>
                <button 
                  type="button" 
                  onClick={() => setLanguage('ar')} 
                  className={`flex-1 px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${language === 'ar' ? 'bg-white dark:bg-slate-700 text-primary-600 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                >
                  {t('settings_language_ar').toUpperCase()}
                </button>
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 rounded-lg">
                  <Clock size={16} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-none">{t('settings_profile_timezone')}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">System clock sync</p>
                </div>
              </div>
              <Select 
                label="" 
                defaultValue="UTC+3"
                className="!py-1.5 !text-[11px] !rounded-xl !bg-slate-50 dark:!bg-slate-800/50"
              >
                <option value="UTC+0">{t('settings_timezone_utc')}</option>
                <option value="UTC+2">{t('settings_timezone_utc2')}</option>
                <option value="UTC+3">{t('settings_timezone_utc3')}</option>
                <option value="UTC+4">{t('settings_timezone_utc4')}</option>
              </Select>
            </div>
          </div>
        </Card>
      </section>

      <div className="flex justify-end pt-2">
         <Button 
           onClick={() => showMessage('success', t('settings_toast_profile_success'))} 
           icon={ShieldCheck} 
           className="shadow-lg shadow-primary-500/20 px-8 py-3"
         >
            {t('settings_profile_save_button')}
         </Button>
      </div>
    </div>
  );
};
