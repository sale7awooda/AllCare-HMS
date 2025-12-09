
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge } from '../components/UI';
import { FlaskConical, CheckCircle } from 'lucide-react';
import { api } from '../services/api';

export const Laboratory = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingLabRequests();
      setRequests(data);
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Laboratory Services</h1>
      <Card title="Lab Requests">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? <tr><td colSpan={4} className="text-center py-4">Loading...</td></tr> : 
               requests.length === 0 ? <tr><td colSpan={4} className="text-center py-4 text-gray-500">No lab requests found.</td></tr> :
               requests.map(req => (
                <tr key={req.id}>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{req.patientName}</td>
                  <td className="px-4 py-3 text-sm">{new Date(req.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-mono">${req.projected_cost}</td>
                  <td className="px-4 py-3">
                    <Badge color={req.status === 'confirmed' ? 'green' : 'yellow'}>
                       {req.status === 'confirmed' ? 'Confirmed (Paid)' : 'Pending Payment'}
                    </Badge>
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
