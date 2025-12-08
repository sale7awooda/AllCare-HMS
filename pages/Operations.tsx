import React from 'react';
import { Card } from '../components/UI';
import { Activity } from 'lucide-react';

export const Operations = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Operations Scheduling</h1>
      <Card title="Surgical Operations Management">
        <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
          <Activity size={48} className="mb-4 text-slate-300" />
          <p className="text-lg font-semibold">Operations module is under construction.</p>
          <p className="text-sm mt-2">Soon you'll be able to schedule surgeries, assign teams, and track post-op care here.</p>
        </div>
      </Card>
    </div>
  );
};