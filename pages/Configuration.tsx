import React from 'react';
import { Card } from '../components/UI';
import { Wrench } from 'lucide-react';

export const Configuration = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
      <Card title="Admin-level System Configuration">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <Wrench size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Configuration module is under construction.</p>
          <p className="text-sm mt-2">This screen is for administrators to manage user roles, permissions, departments, and system-wide settings.</p>
        </div>
      </Card>
    </div>
  );
};