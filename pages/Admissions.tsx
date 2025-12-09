
import React, { useState, useEffect } from 'react';
import { Card, Button, Badge, Modal, Input, Textarea, Select } from '../components/UI';
import { Bed, User, Calendar, Activity, CheckCircle, FileText, AlertCircle, HeartPulse, Clock, LogOut, Plus, Search, Wrench, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';

export const Admissions = () => {
  const { accent } = useTheme();
  const [beds, setBeds] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<any[]>([]);
  
  // Patient Care Modal State (Manage Stay)
  const [selectedAdmission, setSelectedAdmission] = useState<any | null>(null);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);
  const [careTab, setCareTab] = useState<'overview' | 'notes' | 'discharge'>('overview');
  
  // Admit Patient Modal State
  const [isAdmitModalOpen, setIsAdmitModalOpen] = useState(false);
  const [selectedBedForAdmission, setSelectedBedForAdmission] = useState<any>(null);
  const [admitForm, setAdmitForm] = useState({ patientId: '', doctorId: '', entryDate: new Date().toISOString().split('T')[0], deposit: '', notes: '' });
  const [staff, setStaff] = useState<any[]>([]);

  // Care Forms State
  const [noteForm, setNoteForm] = useState({ note: '', bp: '', temp: '', pulse: '', resp: '' });
  const [dischargeForm, setDischargeForm] = useState({ notes: '', status: 'Recovered' });
  const [inpatientDetails, setInpatientDetails] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bedsData, admissionsData, patientsData, staffData] = await Promise.all([
        api.getBeds(),
        api.getActiveAdmissions(),
        api.getPatients(),
        api.getStaff()
      ]);
      setBeds(bedsData);
      setActiveAdmissions(admissionsData);
      setPatients(patientsData);
      setStaff(staffData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateDays = (dateString: string) => {
    const start = new Date(dateString);
    const now = new Date();
    const diff = Math.abs(now.getTime() - start.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleBedClick = async (bed: any) => {
    if (bed.status === 'occupied') {
      // RED CARD: Manage Stay
      const admission = activeAdmissions.find(a => a.bedId === bed.id);
      if (admission) {
        setSelectedAdmission(admission);
        try {
          const details = await api.getInpatientDetails(admission.id);
          setInpatientDetails(details);
          setCareTab('overview');
          setIsCareModalOpen(true);
        } catch (e) {
          console.error("Failed to load details", e);
        }
      }
    } else if (bed.status === 'available') {
      // GREEN CARD: Admit Patient
      setSelectedBedForAdmission(bed);
      setAdmitForm({ 
        patientId: '', 
        doctorId: '', 
        entryDate: new Date().toISOString().split('T')[0], 
        deposit: bed.costPerDay.toString(), 
        notes: '' 
      });
      setIsAdmitModalOpen(true);
    }
    // YELLOW CARD: Maintenance (Do nothing for now)
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBedForAdmission) return;
    try {
      await api.createAdmission({
        patientId: parseInt(admitForm.patientId),
        bedId: selectedBedForAdmission.id,
        doctorId: parseInt(admitForm.doctorId),
        entryDate: admitForm.entryDate,
        deposit: parseFloat(admitForm.deposit),
        notes: admitForm.notes
      });
      await api.updatePatient(parseInt(admitForm.patientId), { type: 'inpatient' });
      setIsAdmitModalOpen(false);
      loadData();
      alert('Patient admitted successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to admit patient.');
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inpatientDetails) return;
    try {
      const user = await api.me(); 
      await api.addInpatientNote(inpatientDetails.id, {
        doctorId: user.id, 
        note: noteForm.note,
        vitals: { bp: noteForm.bp, temp: noteForm.temp, pulse: noteForm.pulse, resp: noteForm.resp }
      });
      const details = await api.getInpatientDetails(inpatientDetails.id);
      setInpatientDetails(details);
      setNoteForm({ note: '', bp: '', temp: '', pulse: '', resp: '' });
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to add note');
    }
  };

  const handleDischarge = async () => {
    if (!confirm('Are you sure you want to discharge this patient? This will generate the final bill.')) return;
    try {
      await api.dischargePatient(inpatientDetails.id, {
        dischargeNotes: dischargeForm.notes,
        dischargeStatus: dischargeForm.status
      });
      setIsCareModalOpen(false);
      loadData();
      alert('Patient discharged successfully.');
    } catch (e: any) {
      alert(e.response?.data?.error || 'Discharge failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inpatient Ward</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Overview of bed occupancy and patient management.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm border border-green-100 dark:border-green-800">
            <div className="w-2 h-2 rounded-full bg-green-500"></div> Available
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm border border-red-100 dark:border-red-800">
            <div className="w-2 h-2 rounded-full bg-red-500"></div> Occupied
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 rounded-lg text-sm border border-yellow-100 dark:border-yellow-800">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div> Maintenance
          </div>
        </div>
      </div>

      {/* View A: Ward Dashboard (Bed Grid) */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {loading ? <p className="col-span-full text-center py-10 text-gray-500">Loading ward status...</p> : 
         beds.map(bed => {
           const admission = activeAdmissions.find(a => a.bedId === bed.id);
           const isOccupied = bed.status === 'occupied';
           const isMaintenance = bed.status === 'maintenance';
           
           // Doctor Name is now joined in backend query
           const doctorName = admission?.doctorName || 'Unassigned';

           return (
             <div 
               key={bed.id} 
               onClick={() => handleBedClick(bed)}
               className={`
                 relative p-4 rounded-xl border-2 transition-all cursor-pointer group flex flex-col justify-between h-40 shadow-sm hover:shadow-md
                 ${isOccupied 
                   ? 'bg-white dark:bg-slate-800 border-red-100 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-700' 
                   : isMaintenance 
                     ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 cursor-not-allowed' 
                     : 'bg-white dark:bg-slate-800 border-green-100 dark:border-green-900/50 hover:border-green-400 dark:hover:border-green-600'
                 }
               `}
             >
               {/* Header: Room Number */}
               <div className="flex justify-between items-start">
                 <span className={`text-xl font-bold ${isOccupied ? 'text-red-600' : isMaintenance ? 'text-yellow-600' : 'text-green-600'}`}>
                   {bed.roomNumber}
                 </span>
                 <Bed size={20} className={`${isOccupied ? 'text-red-400' : isMaintenance ? 'text-yellow-400' : 'text-green-400'}`} />
               </div>
               
               {/* Body: Status/Details */}
               <div className="flex-1 flex flex-col justify-center">
                 {isOccupied ? (
                   <div className="space-y-1">
                     <p className="text-sm font-bold text-gray-900 dark:text-white truncate" title={admission?.patientName}>{admission?.patientName}</p>
                     <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1"><User size={10}/> Dr. {doctorName.split(' ')[1] || doctorName}</p>
                     <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-bold mt-1">
                       <Clock size={10}/> {calculateDays(admission?.entry_date)} Days
                     </div>
                   </div>
                 ) : isMaintenance ? (
                   <p className="text-sm text-yellow-700 dark:text-yellow-500 font-medium text-center">Maintenance</p>
                 ) : (
                   <div className="text-center group-hover:scale-105 transition-transform">
                     <p className="text-sm text-green-600 dark:text-green-400 font-bold mb-1">Available</p>
                     <p className="text-xs text-green-500/70 uppercase tracking-wider font-semibold group-hover:text-green-600">Click to Admit</p>
                   </div>
                 )}
               </div>
               
               {/* Footer: Type */}
               <div className="mt-2 pt-2 border-t border-dashed border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 uppercase tracking-wide flex justify-between">
                 <span>{bed.type}</span>
                 {isOccupied && <span className="text-blue-500 font-bold">Manage &rarr;</span>}
               </div>
             </div>
           );
         })
        }
      </div>

      {/* Admit Patient Modal */}
      <Modal isOpen={isAdmitModalOpen} onClose={() => setIsAdmitModalOpen(false)} title={`Admit to Room ${selectedBedForAdmission?.roomNumber}`}>
        <form onSubmit={handleAdmitSubmit} className="space-y-4">
          <div className="bg-green-50 border border-green-100 p-3 rounded-lg text-sm text-green-800 flex items-center gap-2 mb-2">
            <CheckCircle size={16} />
            <span>Selected Bed: <strong>{selectedBedForAdmission?.roomNumber}</strong> ({selectedBedForAdmission?.type})</span>
          </div>

          <Select 
            label="Select Patient" 
            required 
            value={admitForm.patientId} 
            onChange={e => setAdmitForm({...admitForm, patientId: e.target.value})}
          >
            <option value="">Choose a patient...</option>
            {patients.filter(p => p.type !== 'inpatient').map(p => (
              <option key={p.id} value={p.id}>{p.fullName} ({p.patientId})</option>
            ))}
          </Select>

          <Select 
            label="Assign Doctor" 
            required 
            value={admitForm.doctorId} 
            onChange={e => setAdmitForm({...admitForm, doctorId: e.target.value})}
          >
            <option value="">Choose a doctor...</option>
            {staff.filter(s => s.type === 'doctor').map(s => (
              <option key={s.id} value={s.id}>{s.fullName} - {s.specialization}</option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Entry Date" type="date" required value={admitForm.entryDate} onChange={e => setAdmitForm({...admitForm, entryDate: e.target.value})} />
            <Input label="Initial Deposit ($)" type="number" required value={admitForm.deposit} onChange={e => setAdmitForm({...admitForm, deposit: e.target.value})} />
          </div>

          <Textarea label="Admission Notes" rows={2} value={admitForm.notes} onChange={e => setAdmitForm({...admitForm, notes: e.target.value})} />

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setIsAdmitModalOpen(false)}>Cancel</Button>
            <Button type="submit">Confirm Admission</Button>
          </div>
        </form>
      </Modal>

      {/* View B: Patient Care Modal */}
      {isCareModalOpen && inpatientDetails && (
        <Modal isOpen={isCareModalOpen} onClose={() => setIsCareModalOpen(false)} title="Patient Care & Management">
          <div className="space-y-6">
            
            {/* Header */}
            <div className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
              <div className="h-14 w-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-primary-600 font-bold text-xl shadow-sm border dark:border-slate-700">
                {inpatientDetails.patientName.charAt(0)}
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{inpatientDetails.patientName}</h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <span className="flex items-center gap-1"><User size={14}/> {inpatientDetails.age} yrs / {inpatientDetails.gender}</span>
                  <span className="flex items-center gap-1"><Bed size={14}/> Room {inpatientDetails.roomNumber}</span>
                  <span className="flex items-center gap-1 text-primary-600"><User size={14}/> Dr. {inpatientDetails.doctorName}</span>
                </div>
              </div>
              <div className="text-right">
                <Badge color="green">Active</Badge>
                <p className="text-xs text-gray-400 mt-1">ID: {inpatientDetails.patientCode}</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-slate-700">
              {['overview', 'notes', 'discharge'].map((t: any) => (
                <button 
                  key={t}
                  onClick={() => setCareTab(t)}
                  className={`px-6 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${careTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
              
              {/* OVERVIEW TAB */}
              {careTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Calendar size={18}/> Stay Details</h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3 text-sm">
                      <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                        <span className="text-gray-500">Admission Date</span>
                        <span className="font-medium">{new Date(inpatientDetails.entry_date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between border-b dark:border-slate-700 pb-2">
                        <span className="text-gray-500">Duration</span>
                        <span className="font-medium">{inpatientDetails.daysStayed} Days</span>
                      </div>
                      <div className="flex justify-between pb-2">
                        <span className="text-gray-500">Daily Rate</span>
                        <span className="font-medium">${inpatientDetails.costPerDay}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2"><Activity size={18}/> Clinical Info</h3>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Blood Group</span>
                        <span className="font-bold text-red-500">{inpatientDetails.bloodGroup || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block mb-1">Admission Note</span>
                        <p className="text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-900 p-2 rounded">{inpatientDetails.notes || 'No initial notes.'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CLINICAL NOTES TAB */}
              {careTab === 'notes' && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Add Note Form */}
                  <form onSubmit={handleAddNote} className="bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <h4 className="font-bold text-sm text-gray-800 dark:text-white mb-3 flex items-center gap-2"><Plus size={16}/> Add Clinical Note</h4>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <Input placeholder="BP (120/80)" value={noteForm.bp} onChange={e => setNoteForm({...noteForm, bp: e.target.value})} className="bg-white" />
                      <Input placeholder="Temp (°C)" value={noteForm.temp} onChange={e => setNoteForm({...noteForm, temp: e.target.value})} className="bg-white" />
                      <Input placeholder="Pulse (bpm)" value={noteForm.pulse} onChange={e => setNoteForm({...noteForm, pulse: e.target.value})} className="bg-white" />
                      <Input placeholder="Resp (rpm)" value={noteForm.resp} onChange={e => setNoteForm({...noteForm, resp: e.target.value})} className="bg-white" />
                    </div>
                    <Textarea placeholder="Clinical observations and progress..." value={noteForm.note} onChange={e => setNoteForm({...noteForm, note: e.target.value})} className="bg-white mb-3" rows={2} required />
                    <div className="flex justify-end">
                      <Button size="sm" type="submit">Save Note</Button>
                    </div>
                  </form>

                  {/* Notes Timeline */}
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {inpatientDetails.notes.length === 0 ? <p className="text-center text-gray-400 py-4">No notes recorded yet.</p> : 
                     inpatientDetails.notes.map((note: any) => (
                       <div key={note.id} className="relative pl-6 pb-4 border-l-2 border-gray-200 dark:border-slate-700 last:pb-0">
                         <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary-100 border-2 border-primary-500"></div>
                         <div className="flex justify-between items-start mb-1">
                           <span className="font-bold text-sm text-gray-800 dark:text-slate-200">{note.doctorName}</span>
                           <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12}/> {new Date(note.created_at).toLocaleString()}</span>
                         </div>
                         <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">{note.note}</p>
                         {/* Vitals Tags */}
                         {(note.vitals.bp || note.vitals.temp) && (
                           <div className="flex flex-wrap gap-2">
                             {note.vitals.bp && <span className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-100 font-mono">BP: {note.vitals.bp}</span>}
                             {note.vitals.temp && <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-xs rounded border border-orange-100 font-mono">T: {note.vitals.temp}°C</span>}
                             {note.vitals.pulse && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded border border-blue-100 font-mono">HR: {note.vitals.pulse}</span>}
                           </div>
                         )}
                       </div>
                     ))}
                  </div>
                </div>
              )}

              {/* DISCHARGE TAB */}
              {careTab === 'discharge' && (
                <div className="space-y-6 animate-in fade-in">
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/50 p-4 rounded-xl flex gap-3">
                    <AlertCircle className="text-yellow-600 shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-yellow-800 dark:text-yellow-500">Discharge Process</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-600/80">Discharging will calculate the final bill amount based on the room stay duration and release the bed for new patients.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                      <span className="text-gray-500 text-xs uppercase font-bold">Total Stay</span>
                      <p className="text-2xl font-bold text-gray-800 dark:text-white">{inpatientDetails.daysStayed} Days</p>
                    </div>
                    <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-100 dark:border-primary-800 text-center">
                      <span className="text-primary-600 text-xs uppercase font-bold">Estimated Bill</span>
                      <p className="text-2xl font-bold text-primary-700 dark:text-primary-400">${inpatientDetails.estimatedBill}</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <Select label="Discharge Status" value={dischargeForm.status} onChange={e => setDischargeForm({...dischargeForm, status: e.target.value})}>
                      <option value="Recovered">Recovered</option>
                      <option value="Transferred">Transferred</option>
                      <option value="AMA">Left Against Medical Advice</option>
                      <option value="Deceased">Deceased</option>
                    </Select>
                    <Textarea label="Discharge Summary / Notes" required rows={3} value={dischargeForm.notes} onChange={e => setDischargeForm({...dischargeForm, notes: e.target.value})} />
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                    <Button variant="danger" icon={LogOut} onClick={handleDischarge}>Finalize Discharge & Bill</Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
