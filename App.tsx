
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
import { Settings } from './pages/Settings'; // Import real Settings page
import { Reports } from './pages/Reports'; // Import real Reports page
import { User, Role } from './types'; 
import { api } from './services/api';
import { AlertCircle } from 'lucide-react';

// Login Component
const Login = ({ onLogin }: { onLogin: (u: User) => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Login failed. Please check your credentials or connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = (role: Role) => { 
    setUsername(role);
    setPassword(`${role}123`); 
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-600">AllCare HMS</h1>
          <p className="text-gray-500">Hospital Management System</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input 
              type="text" 
              required
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border text-gray-900 bg-white placeholder-gray-400"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. admin"
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
             <input 
               type="password" 
               required
               className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border text-gray-900 bg-white placeholder-gray-400"
               placeholder="••••••••"
               value={password}
               onChange={e => setPassword(e.target.value)}
             />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-center text-gray-400 mb-3">Developer Login Helper</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => handleDevLogin('admin')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Admin</button>
            <button type="button" onClick={() => handleDevLogin('manager')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Manager</button>
            <button type="button" onClick={() => handleDevLogin('receptionist')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Receptionist</button>
            <button type="button" onClick={() => handleDevLogin('accountant')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Accountant</button>
            <button type="button" onClick={() => handleDevLogin('technician')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Lab Tech</button>
            <button type="button" onClick={() => handleDevLogin('doctor')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Doctor</button>
            <button type="button" onClick={() => handleDevLogin('nurse')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Nurse</button>
            <button type="button" onClick={() => handleDevLogin('pharmacist')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">Pharmacist</button>
            <button type="button" onClick={() => handleDevLogin('hr')} className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded border border-gray-200">HR</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

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
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
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
          <Route path="/settings" element={<Settings />} /> 
          <Route path="/configuration" element={<Configuration />} /> 
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}
