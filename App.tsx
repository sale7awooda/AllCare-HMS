import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Appointments } from './pages/Appointments';
import { Billing } from './pages/Billing';
import { Staff } from './pages/Staff'; 
import { Admissions } from './pages/Admissions';
import { Laboratory } from './pages/Laboratory';
import { Operations } from './pages/Operations';
import { Configuration } from './pages/Configuration';
import { Settings } from './pages/Settings'; 
import { Reports } from './pages/Reports'; 
import { Records } from './pages/Records'; // New Import
import { Login } from './pages/Login';
import { User } from './types'; 
import { api } from './services/api';
import { useTranslation } from './context/TranslationContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await api.me();
          setUser(userData);
        } catch (e) {
          console.error("Auth check failed:", e);
          localStorage.removeItem('token');
        }
      }
      setIsAuthChecking(false);
    };
    checkAuth();
  }, []);

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 bg-slate-50 dark:bg-slate-950">{t('app_loading')}</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={() => { localStorage.removeItem('token'); setUser(null); }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/admissions" element={<Admissions />} /> 
          <Route path="/laboratory" element={<Laboratory />} /> 
          <Route path="/operations" element={<Operations />} /> 
          <Route path="/billing" element={<Billing />} />
          <Route path="/hr" element={<Staff />} /> 
          <Route path="/reports" element={<Reports />} /> 
          <Route path="/records" element={<Records />} /> 
          <Route path="/settings" element={<Settings />} /> 
          <Route path="/configuration" element={<Configuration />} /> 
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}