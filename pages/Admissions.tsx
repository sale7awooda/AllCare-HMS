import React from 'react';
import { Card } from '../components/UI';
import { Bed } from 'lucide-react';

export const Admissions = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admissions Management</h1>
      <Card title="Patient Admissions & Bed Management">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <Bed size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Admissions module is under construction.</p>
          <p className="text-sm mt-2">Soon you'll be able to manage patient admissions, assign beds, and track room availability here.</p>
        </div>
      </Card>
    </div>
  );
};