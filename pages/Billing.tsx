import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Plus, Printer, Download, X, Lock } from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, Appointment } from '../types';
import { hasPermission } from '../utils/rbac';

export const Billing = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form
  const [formData, setFormData] = useState({
    patientId: '',
    amount: '',
    description: ''
  });

  const loadData = async () => {
    const [b, p, a, u] = await Promise.all([
      api.getBills(), 
      api.getPatients(), 
      api.getAppointments(),
      api.me()
    ]);
    setBills(b);
    setPatients(p);
    setAppointments(a);
    setCurrentUser(u);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = patients.find(p => p.id === parseInt(formData.patientId));
    if (patient) {
      await api.createBill({
        patientId: patient.id,
        patientName: patient.fullName,
        totalAmount: parseFloat(formData.amount),
        date: new Date().toISOString().split('T')[0],
        items: [{ description: formData.description, amount: parseFloat(formData.amount) }]
      });
      setIsModalOpen(false);
      loadData();
    }
  };

  const handlePay = async (billId: number) => {
    await api.recordPayment(billId, 50); 
    loadData();
  };

  const InvoiceView = ({ bill }: { bill: Bill }) => (
    <div className="p-8 bg-white" id="invoice-print">
      <div className="flex justify-between items-start mb-8 border-b pb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
          <p className="text-gray-500 mt-1">#{bill.billNumber}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-primary-600">AllCare Hospital</h2>
          <p className="text-sm text-gray-500">123 Health Ave, Med City</p>
        </div>
      </div>
      <div className="mb-8">
        <p className="font-bold text-lg">{bill.patientName}</p>
        <p className="text-gray-500">Date: {bill.date}</p>
      </div>
      <table className="w-full mb-8">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left py-3">Description</th>
            <th className="text-right py-3">Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-3 text-gray-700">{item.description}</td>
              <td className="py-3 text-right text-gray-900">${item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end">
        <div className="w-64 space-y-2">
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total</span>
            <span>${bill.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const canManageBilling = hasPermission(currentUser, 'MANAGE_BILLING');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        {canManageBilling ? (
          <Button onClick={() => setIsModalOpen(true)} icon={Plus}>Generate Bill</Button>
        ) : (
          <Button 
            disabled 
            className="opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200" 
            variant="secondary"
            icon={Lock}
          >
            Generate Bill
          </Button>
        )}
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Invoice #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 align-top">
                    <span className="font-mono text-xs text-slate-500">{bill.billNumber}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                     <div className="text-sm font-semibold text-gray-900 break-words leading-tight">{bill.patientName}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 align-top">{bill.date}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900 align-top">${bill.totalAmount}</td>
                  <td className="px-4 py-3 whitespace-nowrap align-top">
                    <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'pending' ? 'yellow' : 'red'}>
                      {bill.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm align-top">
                     <button 
                       onClick={() => setSelectedBill(bill)}
                       className="text-gray-400 hover:text-gray-600 mr-3 transition-colors"
                       title="Print Invoice"
                     >
                       <Printer size={18} />
                     </button>
                     {bill.status !== 'paid' && canManageBilling && (
                       <button onClick={() => handlePay(bill.id)} className="text-green-600 hover:text-green-800 font-medium transition-colors">Record Pay</button>
                     )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Invoice">
        <form onSubmit={handleCreate} className="space-y-4">
           <Select 
            label="Patient" 
            required
            value={formData.patientId}
            onChange={e => setFormData({...formData, patientId: e.target.value})}
          >
            <option value="">Select Patient</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
          </Select>
          <Input 
            label="Description" 
            placeholder="Consultation Fee" 
            required
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
          <Input 
            label="Amount ($)" 
            type="number" 
            required
            value={formData.amount}
            onChange={e => setFormData({...formData, amount: e.target.value})}
          />
          <div className="pt-4 flex justify-end gap-3">
             <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
             <Button type="submit">Generate</Button>
          </div>
        </form>
      </Modal>

      {selectedBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center p-4 border-b bg-gray-50 sticky top-0">
               <h3 className="font-semibold text-gray-800">Invoice Preview</h3>
               <div className="flex gap-2">
                 <Button size="sm" icon={Download}>PDF</Button>
                 <button onClick={() => setSelectedBill(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X className="text-gray-500" size={20} /></button>
               </div>
             </div>
             <InvoiceView bill={selectedBill} />
          </div>
        </div>
      )}
    </div>
  );
};