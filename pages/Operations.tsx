
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../components/UI';
import { Activity, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const Operations = () => {
  const [ops, setOps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getScheduledOperations();
      setOps(data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleConfirm = async (id: number) => {
    if (confirm('Mark operation as completed and generate bill?')) {
      try {
        await api.confirmOperation(id);
        alert('Operation completed and billed.');
        loadData();
      } catch (e: any) { alert(e.response?.data?.error || 'Failed.'); }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Operations Management</h1>
      <Card title="Scheduled Operations">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Surgeon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr> : 
               ops.length === 0 ? <tr><td colSpan={6} className="text-center py-4 text-gray-500">No scheduled operations.</td></tr> :
               ops.map(op => (
                <tr key={op.id}>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{op.operation_name}</td>
                  <td className="px-4 py-3 text-sm">{op.patientName}</td>
                  <td className="px-4 py-3 text-sm">{op.doctorName || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-sm font-mono">${op.projected_cost}</td>
                  <td className="px-4 py-3"><Badge color="blue">Scheduled</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => handleConfirm(op.id)} icon={CheckCircle}>Complete & Bill</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
