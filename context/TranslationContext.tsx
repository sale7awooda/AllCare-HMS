
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../locales/dictionary';

type Language = 'en' | 'ar';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };
  
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    // Access the dictionary directly
    // @ts-ignore
    let text = translations[language][key] || key;
    if (options && typeof text === 'string') {
      for (const [k, v] of Object.entries(options)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return text;
  }, [language]);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
