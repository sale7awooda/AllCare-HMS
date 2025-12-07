const { db } = require('../config/database');

// --- GETTERS ---
exports.getLabTests = (req, res) => {
  const tests = db.prepare('SELECT * FROM lab_tests ORDER BY category, name').all();
  res.json(tests);
};

exports.getNurseServices = (req, res) => {
  const services = db.prepare('SELECT * FROM nurse_services ORDER BY name').all();
  res.json(services);
};

exports.getBeds = (req, res) => {
  const beds = db.prepare('SELECT id, room_number as roomNumber, type, status, cost_per_day as costPerDay FROM beds ORDER BY room_number').all();
  res.json(beds);
};

exports.getOperations = (req, res) => {
  const ops = db.prepare('SELECT * FROM operations_catalog ORDER BY name').all();
  res.json(ops);
};

// --- ACTION HANDLERS ---

exports.createLabRequest = (req, res) => {
  const { patientId, patientName, testIds, totalCost } = req.body;
  
  // 1. Create Lab Record
  const info = db.prepare('INSERT INTO lab_requests (patient_id, test_ids) VALUES (?, ?)').run(patientId, JSON.stringify(testIds));

  // 2. Create Bill
  const billNumber = `INV-LAB-${Date.now()}`;
  const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, totalCost, 'pending');
  db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Lab Request #${info.lastInsertRowid}`, totalCost);

  res.json({ success: true });
};

exports.createNurseService = (req, res) => {
  const { patientId, serviceName, cost, notes } = req.body;

  // 1. Create Appointment Record (as requested)
  // We need a generic 'nurse' staff ID or just assign 0/null if allowed, but schema enforces FK.
  // Ideally frontend sends a staffId. If not, we pick the first nurse or system default.
  // For now we assume frontend handles appointment creation logic, but prompt said "Nurse Service... will create records in appointments".
  // Let's assume the frontend calls the APPOINTMENT endpoint for this, OR we handle it here.
  // To keep it clean: We will use the existing Appointment Controller for the record, but this controller can handle the Billing wrapper.
  // However, simplicity: This endpoint handles BOTH appointment insert and billing.
  
  // Find a nurse (any nurse) if not provided? Prompt: "nurse service form: remove date and time... load list of nurse services". 
  // It implies no staff selection? Or maybe just service selection. We'll assign to "Unassigned" or a placeholder if needed.
  // But foreign key constraint exists. Let's find first nurse.
  const nurse = db.prepare("SELECT id FROM medical_staff WHERE type='nurse' LIMIT 1").get();
  const staffId = nurse ? nurse.id : 1; 

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
};

exports.createAdmission = (req, res) => {
  const { patientId, bedId, doctorId, entryDate, dischargeDate, deposit } = req.body;

  // 1. Update Bed
  db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(bedId);

  // 2. Create Admission Record
  db.prepare(`
    INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, discharge_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(patientId, bedId, doctorId, entryDate, dischargeDate || null);

  // 3. Create Bill (Deposit)
  const billNumber = `INV-ADM-${Date.now()}`;
  const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, deposit, 'pending');
  db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Admission Deposit (Bed Charge)`, deposit);

  res.json({ success: true });
};

exports.createOperation = (req, res) => {
  const { patientId, operationName, doctorId, notes, optionalFields } = req.body;

  // 1. Create Operation Record
  // optionalFields can be stored in notes or a specific column if schema allowed, putting in notes for now
  const fullNotes = `${notes || ''} \nDetails: ${JSON.stringify(optionalFields)}`;
  
  db.prepare(`
    INSERT INTO operations (patient_id, operation_name, doctor_id, notes)
    VALUES (?, ?, ?, ?)
  `).run(patientId, operationName, doctorId || null, fullNotes);

  // 2. Create Bill (Pending, 0 amount)
  const billNumber = `INV-OP-${Date.now()}`;
  const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, 0, 'pending');
  db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Operation: ${operationName} (Pending Final Calculation)`, 0);

  res.json({ success: true });
};