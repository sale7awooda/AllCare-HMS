const { db } = require('../config/database');

// --- GETTERS ---
exports.getLabTests = (req, res) => {
  try {
    const tests = db.prepare('SELECT * FROM lab_tests ORDER BY category, name').all();
    res.json(tests);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// --- ACTION HANDLERS ---

exports.createLabRequest = (req, res) => {
  const { patientId, patientName, testIds, totalCost } = req.body;
  try {
    const info = db.prepare('INSERT INTO lab_requests (patient_id, test_ids) VALUES (?, ?)').run(patientId, JSON.stringify(testIds));
    const billNumber = `INV-LAB-${Date.now()}`;
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, totalCost, 'pending');
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Lab Request #${info.lastInsertRowid}`, totalCost);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createNurseService = (req, res) => {
  const { patientId, serviceName, cost, notes } = req.body;
  try {
    // 1. Find a valid staff member for FK constraint
    let nurse = db.prepare("SELECT id FROM medical_staff WHERE type='nurse' LIMIT 1").get();
    
    // Fallback: If no nurse, try any doctor or staff to avoid crash
    if (!nurse) {
       nurse = db.prepare("SELECT id FROM medical_staff LIMIT 1").get();
    }

    if (!nurse) {
      return res.status(400).json({ error: "System Error: No medical staff found to assign to this request. Please add staff first." });
    }

    const staffId = nurse.id;

    const apptNum = `NUR-${Date.now()}`;
    db.prepare(`
      INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(apptNum, patientId, staffId, new Date().toISOString(), 'Nurse Service', `${serviceName}: ${notes || ''}`, 'confirmed');

    // 2. Create Bill
    const billNumber = `INV-NUR-${Date.now()}`;
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, cost, 'pending');
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Nurse Service: ${serviceName}`, cost);

    res.json({ success: true });
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: err.message }); 
  }
};

exports.createAdmission = (req, res) => {
  const { patientId, bedId, doctorId, entryDate, dischargeDate, deposit } = req.body;
  try {
    db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(bedId);
    db.prepare(`
      INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, discharge_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(patientId, bedId, doctorId, entryDate, dischargeDate || null);

    const billNumber = `INV-ADM-${Date.now()}`;
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, deposit, 'pending');
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Admission Deposit (Bed Charge)`, deposit);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createOperation = (req, res) => {
  const { patientId, operationName, doctorId, notes, optionalFields } = req.body;
  try {
    const fullNotes = `${notes || ''} \nDetails: ${JSON.stringify(optionalFields)}`;
    db.prepare(`
      INSERT INTO operations (patient_id, operation_name, doctor_id, notes)
      VALUES (?, ?, ?, ?)
    `).run(patientId, operationName, doctorId || null, fullNotes);

    const billNumber = `INV-OP-${Date.now()}`;
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, 0, 'pending');
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Operation: ${operationName} (Pending Final Calculation)`, 0);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};