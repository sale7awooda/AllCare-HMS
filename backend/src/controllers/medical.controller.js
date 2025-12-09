
const { db } = require('../config/database');

// --- GETTERS ---
exports.getLabTests = (req, res) => {
  try {
    const tests = db.prepare('SELECT id, name, category, cost, normal_range as normalRange FROM lab_tests ORDER BY category, name').all();
    res.json(tests);
  } catch (err) { 
    console.error("Error fetching lab tests:", err);
    res.status(500).json({ error: err.message }); 
  }
};

exports.getNurseServices = (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM nurse_services ORDER BY name').all();
    res.json(services);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getBeds = (req, res) => {
  try {
    const beds = db.prepare('SELECT id, room_number as roomNumber, type, status, cost_per_day as costPerDay FROM beds ORDER BY room_number').all();
    res.json(beds);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOperations = (req, res) => {
  try {
    const ops = db.prepare('SELECT * FROM operations_catalog ORDER BY name').all();
    res.json(ops);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- REQUEST LIST GETTERS ---
exports.getLabRequests = (req, res) => {
  try {
    const reqs = db.prepare(`
      SELECT r.*, p.full_name as patientName 
      FROM lab_requests r JOIN patients p ON r.patient_id = p.id 
      ORDER BY r.created_at DESC
    `).all();
    res.json(reqs);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAdmissions = (req, res) => {
  try {
    const adms = db.prepare(`
      SELECT a.*, 
             p.full_name as patientName, 
             b.room_number as roomNumber, b.id as bedId,
             m.full_name as doctorName
      FROM admissions a 
      JOIN patients p ON a.patient_id = p.id 
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      WHERE a.status IN ('active', 'reserved') ORDER BY a.created_at DESC
    `).all();
    res.json(adms);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getScheduledOperations = (req, res) => {
  try {
    const ops = db.prepare(`
      SELECT o.*, p.full_name as patientName, m.full_name as doctorName 
      FROM operations o 
      JOIN patients p ON o.patient_id = p.id 
      LEFT JOIN medical_staff m ON o.doctor_id = m.id
      ORDER BY o.created_at DESC
    `).all();
    res.json(ops);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- INPATIENT MANAGEMENT (NEW) ---
exports.getInpatientDetails = (req, res) => {
  const { id } = req.params; // Admission ID
  try {
    const admission = db.prepare(`
      SELECT a.*, 
             p.full_name as patientName, p.age, p.gender, p.blood_group as bloodGroup, p.patient_id as patientCode,
             b.room_number as roomNumber, b.type as bedType, b.cost_per_day as costPerDay,
             m.full_name as doctorName
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      WHERE a.id = ?
    `).get(id);

    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    const notes = db.prepare(`
      SELECT n.*, m.full_name as doctorName
      FROM inpatient_notes n
      JOIN medical_staff m ON n.doctor_id = m.id
      WHERE n.admission_id = ?
      ORDER BY n.created_at DESC
    `).all(id);

    // Calculate current estimated cost
    const entryDate = new Date(admission.entry_date);
    const now = new Date();
    const diffTime = Math.abs(now - entryDate);
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const currentBill = days * admission.costPerDay;

    res.json({
      ...admission,
      notes: notes.map(n => ({...n, vitals: JSON.parse(n.vitals || '{}')})),
      daysStayed: days,
      estimatedBill: currentBill
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addInpatientNote = (req, res) => {
  const { id } = req.params; // Admission ID
  const { doctorId, note, vitals } = req.body; // Vitals: { bp, temp, pulse, resp }
  try {
    db.prepare(`
      INSERT INTO inpatient_notes (admission_id, doctor_id, note, vitals)
      VALUES (?, ?, ?, ?)
    `).run(id, doctorId, note, JSON.stringify(vitals || {}));
    res.json({ success: true, message: 'Note added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.dischargePatient = (req, res) => {
  const { id } = req.params; // Admission ID
  const { dischargeNotes, dischargeStatus } = req.body;
  
  try {
    const admission = db.prepare('SELECT a.*, b.cost_per_day FROM admissions a JOIN beds b ON a.bed_id = b.id WHERE a.id = ?').get(id);
    if (!admission || admission.status !== 'active') return res.status(400).json({ error: 'Invalid admission record' });

    // Calculate Final Cost (minus deposit? Usually full stay bill, deposit handled in payments/refunds. Here simplified to full charge)
    const entryDate = new Date(admission.entry_date);
    const dischargeDate = new Date();
    const days = Math.ceil((dischargeDate - entryDate) / (1000 * 60 * 60 * 24)) || 1;
    const totalRoomCharge = days * admission.cost_per_day;

    // Transaction for Discharge
    const dischargeTx = db.transaction(() => {
      // 1. Generate Bill
      const billNumber = `INV-DIS-${Date.now()}`;
      const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, admission.patient_id, totalRoomCharge, 'pending');
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Inpatient Stay (${days} days)`, totalRoomCharge);

      // 2. Update Admission
      db.prepare(`
        UPDATE admissions 
        SET status = 'discharged', actual_discharge_date = ?, discharge_notes = ?, discharge_status = ? 
        WHERE id = ?
      `).run(dischargeDate.toISOString(), dischargeNotes, dischargeStatus, id);

      // 3. Free Bed
      db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(admission.bed_id);

      // 4. Update Patient Status
      db.prepare("UPDATE patients SET type = 'outpatient' WHERE id = ?").run(admission.patient_id);
    });

    dischargeTx();
    res.json({ success: true, message: 'Patient discharged and billed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- ACTION HANDLERS WITH AUTO-BILLING ---

exports.createLabRequest = (req, res) => {
  const { patientId, testIds, totalCost } = req.body; // testIds is array of IDs
  const tx = db.transaction(() => {
    // 1. Create Bill
    const billNumber = `INV-LAB-${Date.now()}`;
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, totalCost, 'pending');
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Lab Request (Total Tests: ${testIds.length})`, totalCost);

    // 2. Create Request linked to Bill
    db.prepare('INSERT INTO lab_requests (patient_id, test_ids, projected_cost, status, bill_id) VALUES (?, ?, ?, ?, ?)')
      .run(patientId, JSON.stringify(testIds), totalCost, 'pending', bill.lastInsertRowid);
  });

  try {
    tx();
    res.json({ success: true, message: 'Lab request created and billed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createNurseService = (req, res) => {
  const { patientId, serviceName, cost, notes, staffId } = req.body;
  try {
    let nurseId = staffId || db.prepare("SELECT id FROM medical_staff WHERE type='nurse' LIMIT 1").get()?.id;
    if (!nurseId) return res.status(400).json({ error: "No nurse available." });
    
    const tx = db.transaction(() => {
      // 1. Create Bill
      const billNumber = `INV-NUR-${Date.now()}`;
      const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, cost, 'pending');
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Nurse Service: ${serviceName}`, cost);

      // 2. Create Appointment (Nurse Service)
      const apptNum = `NUR-${Date.now()}`;
      db.prepare(`
        INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type, reason, status, billing_status, bill_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(apptNum, patientId, nurseId, new Date().toISOString(), 'Nurse Service', `${serviceName}: ${notes || ''}`, 'pending', 'billed', bill.lastInsertRowid);
    });
    
    tx();
    res.json({ success: true, message: 'Nurse service recorded and billed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createAdmission = (req, res) => {
  const { patientId, bedId, doctorId, entryDate, dischargeDate, deposit, notes } = req.body;
  try {
    const tx = db.transaction(() => {
      // 1. Mark Bed as Reserved
      db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ?").run(bedId);
      
      // 2. Create Bill (Deposit)
      const billNumber = `INV-ADM-${Date.now()}`;
      const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, deposit, 'pending');
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Admission Deposit (Room Reservation)`, deposit);

      // 3. Create Admission linked to Bill
      db.prepare(`
        INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, discharge_date, notes, projected_cost, status, bill_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, bedId, doctorId, entryDate, dischargeDate || null, notes || null, deposit, 'reserved', bill.lastInsertRowid);
    });

    tx();
    res.json({ success: true, message: 'Bed reserved. Bill generated.' });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
};

exports.createOperation = (req, res) => {
  const { patientId, operationName, doctorId, notes, optionalFields, totalCost } = req.body;
  try {
    const fullNotes = `${notes || ''} \nDetails: ${JSON.stringify(optionalFields)}`;
    const tx = db.transaction(() => {
      // 1. Create Bill
      const billNumber = `INV-OP-${Date.now()}`;
      const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, totalCost, 'pending');
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Operation: ${operationName}`, totalCost);

      // 2. Create Operation linked to Bill
      db.prepare(`
        INSERT INTO operations (patient_id, operation_name, doctor_id, notes, projected_cost, status, bill_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(patientId, operationName, doctorId || null, fullNotes, totalCost, 'scheduled', bill.lastInsertRowid);
    });

    tx();
    res.json({ success: true, message: 'Operation scheduled and billed.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- DEPRECATED MANUAL CONFIRMATIONS (Kept for compatibility but mostly replaced by Payment Hook) ---
exports.confirmLabRequest = (req, res) => {
   // Legacy manual confirm if needed
   res.json({success: true});
};

exports.confirmAdmission = (req, res) => {
    // Legacy manual confirm
    res.json({success: true});
};

exports.confirmOperation = (req, res) => {
    // Legacy manual confirm
    res.json({success: true});
};
