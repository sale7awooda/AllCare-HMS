import React from 'react';
import { Card } from '../components/UI';
import { ClipboardList } from 'lucide-react';

export const Reports = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
      <Card title="Financial, Patient & Operational Reports">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <ClipboardList size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Reports module is under construction.</p>
          <p className="text-sm mt-2">Soon you'll have access to comprehensive reports, analytics, and export options.</p>
        </div>
      </Card>
    </div>
  );
};