
import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { Appointments } from './pages/Appointments';
import { Billing } from './pages/Billing';
import { Staff } from './pages/Staff';
import { User } from './types';
import { api } from './services/api';
import { ShieldCheck, UserCheck, Stethoscope, Calculator } from 'lucide-react';

// Simple Login Component
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
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = (role: string) => {
    const creds: Record<string, { u: string, p: string }> = {
      admin: { u: 'admin', p: 'admin123' },
      receptionist: { u: 'receptionist', p: 'receptionist123' },
      manager: { u: 'manager', p: 'manager123' },
      accountant: { u: 'accountant', p: 'accountant123' }
    };
    const c = creds[role];
    if (c) {
      setUsername(c.u);
      setPassword(c.p);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-600">AllCare HMS</h1>
          <p className="text-gray-500">Hospital Management System</p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input 
              type="text" 
              required
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
            />
          </div>
          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
             <input 
               type="password" 
               required
               className="w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border"
               value={password}
               onChange={e => setPassword(e.target.value)}
               placeholder="••••••••"
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
          <p className="text-xs text-center text-gray-400 mb-4 uppercase tracking-wider font-semibold">Dev Login Helper</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => handleDevLogin('admin')} className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 transition-colors">
              <ShieldCheck size={14} className="text-purple-500" /> Admin
            </button>
            <button onClick={() => handleDevLogin('receptionist')} className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 transition-colors">
              <UserCheck size={14} className="text-blue-500" /> Receptionist
            </button>
            <button onClick={() => handleDevLogin('manager')} className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 transition-colors">
              <Stethoscope size={14} className="text-green-500" /> Manager
            </button>
            <button onClick={() => handleDevLogin('accountant')} className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-xs text-gray-600 border border-gray-200 transition-colors">
              <Calculator size={14} className="text-orange-500" /> Accountant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  // Check for existing token on mount
  React.useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = await api.me();
          setUser(user);
        } catch (e) {
          localStorage.removeItem('token');
        }
      }
    };
    checkAuth();
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <Router>
      <Layout user={user} onLogout={() => setUser(null)}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
}