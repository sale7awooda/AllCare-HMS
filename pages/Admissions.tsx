
import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../components/UI';
import { Bed, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const Admissions = () => {
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getActiveAdmissions();
      setAdmissions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleConfirm = async (id: number) => {
    if (confirm('Confirm admission and generate deposit bill?')) {
      try {
        await api.confirmAdmissionDeposit(id);
        alert('Admission confirmed and billed.');
        loadData();
      } catch (e: any) {
        alert(e.response?.data?.error || 'Failed to confirm.');
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admissions Management</h1>
      <Card title="Active Admissions & Bed Requests">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Room</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entry Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deposit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? <tr><td colSpan={6} className="text-center py-4">Loading...</td></tr> : 
               admissions.length === 0 ? <tr><td colSpan={6} className="text-center py-4 text-gray-500">No active admissions found.</td></tr> :
               admissions.map(adm => (
                <tr key={adm.id}>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{adm.patientName}</td>
                  <td className="px-4 py-3 text-sm font-bold text-primary-600 bg-primary-50 rounded-lg w-fit block mt-1 text-center">{adm.roomNumber}</td>
                  <td className="px-4 py-3 text-sm">{new Date(adm.entry_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-mono">${adm.projected_cost}</td>
                  <td className="px-4 py-3"><Badge color="green">Active</Badge></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => handleConfirm(adm.id)} icon={CheckCircle}>Confirm & Bill</Button>
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
