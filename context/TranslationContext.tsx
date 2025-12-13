
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Language = 'en' | 'ar';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, string | number>) => string;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };
  
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';

    // Fetch the translation file dynamically
    setIsLoading(true);
    fetch(`/locales/${language}.json`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load translation file for ${language}`);
        }
        return response.json();
      })
      .then(data => {
        setTranslations(data);
      })
      .catch(error => {
        console.error(error);
        setTranslations({}); // Fallback to empty on error
      })
      .finally(() => {
        setIsLoading(false);
      });

  }, [language]);

  const t = useCallback((key: string, options?: Record<string, string | number>): string => {
    // Return key if translations are still loading or not found
    const text = translations[key] || key;
    if (options && typeof text === 'string') {
      return Object.entries(options).reduce((acc, [k, v]) => {
        return acc.replace(new RegExp(`{${k}}`, 'g'), String(v));
      }, text);
    }
    return text;
  }, [language, translations, isLoading]);

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) throw new Error('useTranslation must be used within a TranslationProvider');
  return context;
};
