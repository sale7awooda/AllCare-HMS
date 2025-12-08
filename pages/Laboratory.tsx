import React from 'react';
import { Card } from '../components/UI';
import { FlaskConical } from 'lucide-react';

export const Laboratory = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Laboratory Services</h1>
      <Card title="Lab Test Ordering & Results">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <FlaskConical size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Laboratory module is under construction.</p>
          <p className="text-sm mt-2">Soon you'll be able to order lab tests, view results, and manage lab inventory here.</p>
        </div>
      </Card>
    </div>
  );
};