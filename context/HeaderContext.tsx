
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';

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

  const setHeader = useCallback((t: string, s: string, a: ReactNode = null) => {
    setTitle(prev => (prev !== t ? t : prev));
    setSubtitle(prev => (prev !== s ? s : prev));
    setActions(prev => (prev !== a ? a : prev));
  }, []);

  const clearHeader = useCallback(() => {
    setTitle('');
    setSubtitle('');
    setActions(null);
  }, []);

  const value = useMemo(() => ({
    title, subtitle, actions, setHeader, clearHeader
  }), [title, subtitle, actions, setHeader, clearHeader]);

  return (
    <HeaderContext.Provider value={value}>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, actions, context.setHeader]);

  return context;
};
