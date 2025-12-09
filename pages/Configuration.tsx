
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select, Modal, Badge, Textarea } from '../components/UI';
import { Wrench, Settings as SettingsIcon, Building, Database, Trash2, Plus, Save } from 'lucide-react';
import { api } from '../services/api';
import { LabTestCatalog, NurseServiceCatalog, OperationCatalog } from '../types';

export const Configuration = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'departments' | 'catalogs'>('general');
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [settings, setSettings] = useState({
    hospitalName: '',
    hospitalAddress: '',
    hospitalPhone: '',
    currency: '$'
  });

  // Departments State
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDept, setNewDept] = useState({ name: '', description: '' });

  // Catalogs State
  const [labTests, setLabTests] = useState<LabTestCatalog[]>([]);
  const [nurseServices, setNurseServices] = useState<NurseServiceCatalog[]>([]);
  const [operations, setOperations] = useState<OperationCatalog[]>([]);
  const [catalogTab, setCatalogTab] = useState<'lab' | 'nurse' | 'ops'>('lab');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItemData, setNewItemData] = useState<any>({});

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [s, d, l, n, o] = await Promise.all([
        api.getSystemSettings(),
        api.getDepartments(),
        api.getLabTests(),
        api.getNurseServices(),
        api.getOperations()
      ]);
      if (s) setSettings(s);
      setDepartments(Array.isArray(d) ? d : []);
      setLabTests(Array.isArray(l) ? l : []);
      setNurseServices(Array.isArray(n) ? n : []);
      setOperations(Array.isArray(o) ? o : []);
    } catch (e) {
      console.error("Failed to load config data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // --- Handlers ---

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateSystemSettings(settings);
      alert('Settings updated successfully!');
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to save settings'); }
  };

  const handleAddDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name) return;
    try {
      await api.addDepartment(newDept.name, newDept.description);
      setNewDept({ name: '', description: '' });
      loadAllData();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add department'); }
  };

  const handleDeleteDept = async (id: number) => {
    if (confirm('Are you sure? This may affect staff assignments.')) {
      try {
        await api.deleteDepartment(id);
        loadAllData();
      } catch (e: any) { alert(e.response?.data?.error || 'Failed to delete'); }
    }
  };

  const openAddItemModal = () => {
    setNewItemData({});
    setIsModalOpen(true);
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (catalogTab === 'lab') {
        await api.addLabTest(newItemData);
      } else if (catalogTab === 'nurse') {
        await api.addNurseService(newItemData);
      } else if (catalogTab === 'ops') {
        await api.addOperationCatalog({ name: newItemData.name, baseCost: parseFloat(newItemData.baseCost) });
      }
      setIsModalOpen(false);
      loadAllData();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add item'); }
  };

  const handleDeleteItem = async (id: number, type: 'lab' | 'nurse' | 'ops') => {
    if (!confirm('Delete this item?')) return;
    try {
      if (type === 'lab') await api.deleteLabTest(id);
      if (type === 'nurse') await api.deleteNurseService(id);
      if (type === 'ops') await api.deleteOperationCatalog(id);
      loadAllData();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to delete'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">System Configuration</h1>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2">
        <button onClick={() => setActiveTab('general')} className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <SettingsIcon size={18}/> General Settings
        </button>
        <button onClick={() => setActiveTab('departments')} className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'departments' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Building size={18}/> Departments
        </button>
        <button onClick={() => setActiveTab('catalogs')} className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'catalogs' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Database size={18}/> Medical Catalogs
        </button>
      </div>

      <div className="bg-white rounded-b-xl shadow-sm border border-t-0 border-gray-200 p-6 min-h-[400px]">
        {loading ? <div className="text-center py-10 text-gray-500">Loading configuration data...</div> : (
          <>
            {/* GENERAL SETTINGS TAB */}
            {activeTab === 'general' && (
              <form onSubmit={handleSaveSettings} className="max-w-xl space-y-5 animate-in fade-in">
                <Input label="Hospital Name" value={settings.hospitalName} onChange={e => setSettings({...settings, hospitalName: e.target.value})} />
                <Input label="Address" value={settings.hospitalAddress} onChange={e => setSettings({...settings, hospitalAddress: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Phone" value={settings.hospitalPhone} onChange={e => setSettings({...settings, hospitalPhone: e.target.value})} />
                  <Input label="Currency Symbol" value={settings.currency} onChange={e => setSettings({...settings, currency: e.target.value})} className="w-20" />
                </div>
                <div className="pt-2">
                  <Button type="submit" icon={Save}>Save Changes</Button>
                </div>
              </form>
            )}

            {/* DEPARTMENTS TAB */}
            {activeTab === 'departments' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in">
                <div className="lg:col-span-1 space-y-4 border-r border-gray-100 pr-6">
                  <h3 className="font-bold text-gray-800">Add Department</h3>
                  <form onSubmit={handleAddDept} className="space-y-4">
                    <Input label="Name" placeholder="e.g. Neurology" required value={newDept.name} onChange={e => setNewDept({...newDept, name: e.target.value})} />
                    <Textarea label="Description" rows={3} value={newDept.description} onChange={e => setNewDept({...newDept, description: e.target.value})} />
                    <Button type="submit" icon={Plus} className="w-full">Add Department</Button>
                  </form>
                </div>
                <div className="lg:col-span-2">
                  <h3 className="font-bold text-gray-800 mb-4">Existing Departments ({departments.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                    {departments.map(dept => (
                      <div key={dept.id} className="p-3 border rounded-lg flex justify-between items-start bg-gray-50 hover:bg-white hover:shadow-sm transition-all group">
                        <div>
                          <p className="font-bold text-gray-800">{dept.name}</p>
                          <p className="text-xs text-gray-500 mt-1">{dept.description || 'No description'}</p>
                        </div>
                        <button onClick={() => handleDeleteDept(dept.id)} className="text-gray-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MEDICAL CATALOGS TAB */}
            {activeTab === 'catalogs' && (
              <div className="animate-in fade-in">
                <div className="flex gap-2 mb-6 bg-gray-50 p-1 rounded-lg w-fit">
                  <button onClick={() => setCatalogTab('lab')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${catalogTab === 'lab' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>Lab Tests</button>
                  <button onClick={() => setCatalogTab('nurse')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${catalogTab === 'nurse' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>Nurse Services</button>
                  <button onClick={() => setCatalogTab('ops')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${catalogTab === 'ops' ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}>Operations</button>
                </div>

                <div className="flex justify-end mb-4">
                  <Button size="sm" icon={Plus} onClick={openAddItemModal}>Add Item</Button>
                </div>

                <div className="overflow-x-auto border rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                          {catalogTab === 'lab' ? 'Category' : catalogTab === 'nurse' ? 'Description' : 'Details'}
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Cost</th>
                        <th className="px-4 py-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {catalogTab === 'lab' && labTests.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.category}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right">${item.cost}</td>
                          <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteItem(item.id, 'lab')} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                      {catalogTab === 'nurse' && nurseServices.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{item.description}</td>
                          <td className="px-4 py-3 text-sm font-mono text-right">${item.cost}</td>
                          <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteItem(item.id, 'nurse')} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                      {catalogTab === 'ops' && operations.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">-</td>
                          <td className="px-4 py-3 text-sm font-mono text-right">${item.baseCost}</td>
                          <td className="px-4 py-3 text-right"><button onClick={() => handleDeleteItem(item.id, 'ops')} className="text-gray-400 hover:text-red-500"><Trash2 size={16}/></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={`Add ${catalogTab === 'lab' ? 'Lab Test' : catalogTab === 'nurse' ? 'Nurse Service' : 'Operation'}`}>
        <form onSubmit={handleAddItem} className="space-y-4">
          <Input label="Name" required value={newItemData.name || ''} onChange={e => setNewItemData({...newItemData, name: e.target.value})} />
          
          {catalogTab === 'lab' && (
            <Input label="Category" placeholder="e.g. Hematology" value={newItemData.category || ''} onChange={e => setNewItemData({...newItemData, category: e.target.value})} />
          )}
          
          {catalogTab === 'nurse' && (
            <Input label="Description" placeholder="Brief description" value={newItemData.description || ''} onChange={e => setNewItemData({...newItemData, description: e.target.value})} />
          )}

          <Input label="Cost ($)" type="number" step="0.01" required value={newItemData.cost || newItemData.baseCost || ''} onChange={e => setNewItemData({...newItemData, [catalogTab === 'ops' ? 'baseCost' : 'cost']: parseFloat(e.target.value)})} />

          <div className="flex justify-end pt-4 gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Add Item</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
