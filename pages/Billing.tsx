import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge } from '../components/UI';
import { Plus, Printer, DollarSign, Download, X } from 'lucide-react';
import { api } from '../services/api';
import { Bill, Patient, Appointment } from '../types';

export const Billing = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Form
  const [formData, setFormData] = useState({
    patientId: '',
    amount: '',
    description: ''
  });

  const loadData = async () => {
    const [b, p, a] = await Promise.all([api.getBills(), api.getPatients(), api.getAppointments()]);
    setBills(b);
    setPatients(p);
    setAppointments(a);
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
    await api.recordPayment(billId, 50); // Simulating partial payment
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
          <p className="text-sm text-gray-500">billing@allcare.com</p>
        </div>
      </div>

      <div className="mb-8">
        <p className="text-gray-500 text-sm uppercase tracking-wide">Bill To</p>
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
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>${bill.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
             <span>Paid</span>
             <span>-${bill.paidAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Balance Due</span>
            <span className={bill.status === 'paid' ? 'text-green-600' : 'text-red-600'}>
              ${(bill.totalAmount - bill.paidAmount).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
        <Button onClick={() => setIsModalOpen(true)} icon={Plus}>Generate Bill</Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top">{bill.billNumber}</td>
                  <td className="px-6 py-4 align-top">
                     <div className="text-sm text-gray-900 break-words">{bill.patientName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">{bill.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 align-top">${bill.totalAmount}</td>
                  <td className="px-6 py-4 whitespace-nowrap align-top">
                    <Badge color={bill.status === 'paid' ? 'green' : bill.status === 'pending' ? 'yellow' : 'red'}>
                      {bill.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm align-top">
                     <button 
                       onClick={() => setSelectedBill(bill)}
                       className="text-gray-400 hover:text-gray-600 mr-3"
                     >
                       <Printer size={18} />
                     </button>
                     {bill.status !== 'paid' && (
                       <button onClick={() => handlePay(bill.id)} className="text-green-600 hover:text-green-800 font-medium">Record Pay</button>
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

      {/* Invoice Viewer Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
             <div className="flex justify-between items-center p-4 border-b bg-gray-50">
               <h3 className="font-semibold">Invoice Preview</h3>
               <div className="flex gap-2">
                 <Button size="sm" icon={Download}>PDF</Button>
                 <button onClick={() => setSelectedBill(null)}><X className="text-gray-500" /></button>
               </div>
             </div>
             <InvoiceView bill={selectedBill} />
          </div>
        </div>
      )}
    </div>
  );
};