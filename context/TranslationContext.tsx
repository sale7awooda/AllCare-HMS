import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Language = 'en' | 'ar';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

// Define a type for our translation files
type Translations = Record<string, string>;

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    const loadTranslations = async () => {
      try {
        const response = await fetch(`/locales/${language}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load ${language}.json`);
        }
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error('Error loading translation file:', error);
        // Fallback to English if loading fails
        if (language !== 'en') {
          try {
            const enResponse = await fetch(`/locales/en.json`);
            const enData = await enResponse.json();
            setTranslations(enData);
          } catch (e) {
            console.error('Failed to load fallback English translations', e);
          }
        }
      }
    };
    loadTranslations();
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };
  
  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    let text = translations[key] || key;
    if (options && typeof text === 'string') {
      for (const [k, v] of Object.entries(options)) {
        text = text.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }
    }
    return text;
  }, [translations]);

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
