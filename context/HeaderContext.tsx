
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface HeaderContextType {
  title: string;
  subtitle: string;
  actions: ReactNode | null;
  setHeader: (title: string, subtitle: string, actions?: ReactNode) => void;
  clearHeader: () => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [actions, setActions] = useState<ReactNode | null>(null);

  const setHeader = (t: string, s: string, a: ReactNode = null) => {
    setTitle(t);
    setSubtitle(s);
    setActions(a);
  };

  const clearHeader = () => {
    setTitle('');
    setSubtitle('');
    setActions(null);
  };

  return (
    <HeaderContext.Provider value={{ title, subtitle, actions, setHeader, clearHeader }}>
      {children}
    </HeaderContext.Provider>
  );
};

export const useHeader = (title?: string, subtitle?: string, actions: ReactNode = null) => {
  const context = useContext(HeaderContext);
  if (!context) throw new Error('useHeader must be used within HeaderProvider');

  useEffect(() => {
    if (title !== undefined) {
      context.setHeader(title, subtitle || '', actions);
    }
    // Cleanup on unmount not strictly required here as next page will overwrite
  }, [title, subtitle, actions]);

  return context;
};
