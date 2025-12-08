import React from 'react';
import { Card } from '../components/UI';
import { Settings as SettingsIcon } from 'lucide-react';

export const Settings = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Application Settings</h1>
      <Card title="General System Settings">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <SettingsIcon size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Settings module is under construction.</p>
          <p className="text-sm mt-2">Manage user profiles, notifications, and other application preferences here.</p>
        </div>
      </Card>
    </div>
  );
};