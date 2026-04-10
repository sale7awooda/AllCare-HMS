
const { db } = require('../config/database');

// --- LAB ---
exports.getLabRequests = async (req, res) => {
  try {
    const db = getDb();
    const requests = await db.all(`
      SELECT 
        lr.id, lr.patient_id, lr.status, lr.projected_cost, lr.created_at, lr.test_ids, lr.results_json,
        p.full_name as patientName, p.age as patientAge, p.gender as patientGender, p.phone, p.patient_id as patientCode
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id = p.id
      ORDER BY lr.created_at DESC
    `);

    const enriched = await Promise.all(requests.map(async (r) => {
        let testNames = '';
        let testDetails = [];
        try {
            const ids = JSON.parse(r.test_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                const tests = await db.all(`SELECT id, name_en, name_ar, normal_range, category_en FROM lab_tests WHERE id IN (${placeholders})`, ...ids);
                testNames = tests.map(t => t.name_en).join(', ');
                testDetails = tests;
            }
        } catch(e) {}
        
        let results = null;
        try { if(r.results_json) results = JSON.parse(r.results_json); } catch(e) {}

        return { ...r, testNames, testDetails, results };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLabRequest = async (req, res) => {
  const { patientId, testIds, totalCost } = req.body;
  
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    const bill = await db.run(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date) 
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `, [billNumber, patientId, totalCost]);
    
    await db.run('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)', [bill.lastID, `Lab Tests (Qty: ${testIds.length})`, totalCost]);

    await db.run(`
      INSERT INTO lab_requests (patient_id, test_ids, projected_cost, status, bill_id, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now'))
    `, [patientId, JSON.stringify(testIds), totalCost, bill.lastID]);
    
    await db.exec('COMMIT');
    res.status(201).json({ success: true });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
};

exports.confirmLabRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.run("UPDATE lab_requests SET status = 'confirmed' WHERE id = ? AND status = 'pending'", [id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.completeLabRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.run("UPDATE lab_requests SET status = 'completed', results_json = ? WHERE id = ?", [
            JSON.stringify(req.body),
            id
        ]);
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.reopenLabRequest = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.run("UPDATE lab_requests SET status = 'confirmed' WHERE id = ?", [id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

// --- NURSE ---
exports.getNurseRequests = async (req, res) => {
    try {
        const db = getDb();
        const reqs = await db.all(`
            SELECT nr.*, p.full_name as patientName, m.full_name as nurseName
            FROM nurse_requests nr
            JOIN patients p ON nr.patient_id = p.id
            LEFT JOIN medical_staff m ON nr.staff_id = m.id
            ORDER BY nr.created_at DESC
        `);
        res.json(reqs);
    } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.createNurseRequest = async (req, res) => {
    const { patientId, staffId, serviceName, cost, notes } = req.body;
    try {
        const db = getDb();
        await db.run(`
            INSERT INTO nurse_requests (patient_id, staff_id, service_name, cost, notes, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `, [patientId, staffId, serviceName, cost, notes]);
        res.status(201).json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
};

// --- OPERATIONS ---
exports.getScheduledOperations = async (req, res) => {
  try {
    const db = getDb();
    const ops = await db.all(`
      SELECT 
        o.id, o.operation_name, o.status, o.created_at, o.projected_cost, o.notes,
        p.full_name as patientName, p.id as patientId,
        m.full_name as doctorName, m.id as doctor_id,
        o.cost_details
      FROM operations o
      JOIN patients p ON o.patient_id = p.id
      LEFT JOIN medical_staff m ON o.doctor_id = m.id
      ORDER BY o.created_at DESC
    `);
    
    const mapped = ops.map(op => ({
      ...op,
      costDetails: op.cost_details ? JSON.parse(op.cost_details) : null
    }));
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOperation = async (req, res) => {
  const { patientId, operationName, doctorId, notes } = req.body;
  try {
    const db = getDb();
    await db.run(`
      INSERT INTO operations (patient_id, operation_name, doctor_id, notes, status, created_at)
      VALUES (?, ?, ?, ?, 'requested', datetime('now'))
    `, [patientId, operationName, doctorId, notes]);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.processOperationRequest = async (req, res) => {
  const { id } = req.params;
  const { details, totalCost } = req.body;
  
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');

    await db.run(`
      UPDATE operations 
      SET cost_details = ?, projected_cost = ?, status = 'pending_payment'
      WHERE id = ?
    `, [JSON.stringify(details), totalCost, id]);

    const op = await db.get('SELECT * FROM operations WHERE id = ?', [id]);
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    const billInfo = await db.run(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `, [billNumber, op.patient_id, totalCost]);
    
    await db.run(`
      INSERT INTO billing_items (billing_id, description, amount)
      VALUES (?, ?, ?)
    `, [billInfo.lastID, `Surgery: ${op.operation_name}`, totalCost]);

    await db.run('UPDATE operations SET bill_id = ? WHERE id = ?', [billInfo.lastID, id]);

    // Add 'extra' adjustments for participants
    if (details.participants && Array.isArray(details.participants)) {
      for (const p of details.participants) {
        if (p.staffId) {
          const reason = `Operation participation: ${op.operation_name} (Role: ${p.role})`;
          await db.run(`
            INSERT INTO hr_financials (staff_id, type, amount, reason, date, status, reference_id)
            VALUES (?, 'extra', ?, ?, date('now'), 'pending', ?)
          `, [p.staffId, p.fee, reason, id]);
        }
      }
    }
    await db.exec('COMMIT');
    res.json({ success: true });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};

exports.confirmOperation = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.run("UPDATE operations SET status = 'confirmed' WHERE id = ? AND status = 'pending_payment'", [id]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.completeOperation = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        await db.run("UPDATE operations SET status = 'completed' WHERE id = ?", [id]);
        // Automatically approve linked 'extra' adjustments
        await db.run("UPDATE hr_financials SET status = 'approved' WHERE reference_id = ? AND type = 'extra'", [id]);
        await db.exec('COMMIT');
        res.json({success: true});
    } catch(e) {
        const db = getDb();
        await db.exec('ROLLBACK');
        res.status(500).json({error: e.message});
    }
};

// --- ADMISSIONS ---
exports.getActiveAdmissions = async (req, res) => {
  try {
    const db = getDb();
    const admissions = await db.all(`
      SELECT 
        a.id, a.patient_id, a.bed_id, a.doctor_id, a.entry_date, a.status, a.projected_cost,
        p.full_name as patientName,
        b.room_number as roomNumber,
        m.full_name as doctorName,
        bill.status as billStatus
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      JOIN medical_staff m ON a.doctor_id = m.id
      LEFT JOIN billing bill ON a.bill_id = b.id
      WHERE a.status IN ('active', 'reserved')
    `);
    
    res.json(admissions.map(a => ({
        ...a,
        bedId: a.bed_id,
        stayDuration: Math.ceil((Date.now() - new Date(a.entry_date).getTime()) / (1000 * 60 * 60 * 24))
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdmissionsHistory = async (req, res) => {
  try {
    const db = getDb();
    const admissions = await db.all(`
      SELECT 
        a.id, a.patient_id, a.bed_id, a.doctor_id, a.entry_date, a.discharge_date, a.actual_discharge_date, a.status, a.projected_cost, a.discharge_status,
        p.full_name as patientName, p.patient_id as patientCode,
        b.room_number as roomNumber,
        m.full_name as doctorName
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      ORDER BY a.entry_date DESC
    `);
    
    res.json(admissions.map(a => ({
        ...a,
        stayDuration: a.actual_discharge_date 
            ? Math.ceil((new Date(a.actual_discharge_date).getTime() - new Date(a.entry_date).getTime()) / (1000 * 60 * 60 * 24)) 
            : Math.ceil((Date.now() - new Date(a.entry_date).getTime()) / (1000 * 60 * 60 * 24))
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAdmission = async (req, res) => {
    const { patientId, bedId, doctorId, entryDate, deposit, notes } = req.body;

    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        
        const bed = await db.get("SELECT status FROM beds WHERE id = ?", [bedId]);
        if (bed.status !== 'available' && bed.status !== 'cleaning') throw new Error('Bed is not available');
        
        const patient = await db.get("SELECT full_name FROM patients WHERE id = ?", [patientId]);
        if (!patient) throw new Error('Patient not found');

        const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
        const billInfo = await db.run(`
          INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date) 
          VALUES (?, ?, ?, 'pending', datetime('now'))
        `, [billNumber, patientId, deposit]);
        
        const billId = billInfo.lastID;
        await db.run('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)', [billId, `Admission Deposit for ${patient.full_name}`, deposit]);

        await db.run(`
          INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, status, projected_cost, notes, bill_id)
          VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
        `, [patientId, bedId, doctorId, entryDate, deposit, notes, billId]);

        await db.run("UPDATE beds SET status = 'reserved' WHERE id = ?", [bedId]);
        
        await db.exec('COMMIT');
        res.status(201).json({ success: true });
    } catch (e) {
        const db = getDb();
        await db.exec('ROLLBACK');
        res.status(400).json({ error: e.message });
    }
};

exports.confirmAdmission = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        const adm = await db.get("SELECT * FROM admissions WHERE id = ?", [id]);
        if (!adm) throw new Error('Admission not found');
        
        await db.run("UPDATE admissions SET status = 'active' WHERE id = ?", [id]);
        await db.run("UPDATE beds SET status = 'occupied' WHERE id = ?", [adm.bed_id]);
        await db.run("UPDATE patients SET type = 'inpatient' WHERE id = ?", [adm.patient_id]);
        
        await db.exec('COMMIT');
        res.json({ success: true });
    } catch(e) {
        const db = getDb();
        await db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
};

exports.cancelAdmission = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        const adm = await db.get("SELECT * FROM admissions WHERE id = ?", [id]);
        if (!adm) throw new Error('Admission not found');
        
        await db.run("UPDATE admissions SET status = 'cancelled' WHERE id = ?", [id]);
        await db.run("UPDATE beds SET status = 'available' WHERE id = ?", [adm.bed_id]);
        if (adm.bill_id) {
            await db.run("UPDATE billing SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [adm.bill_id]);
        }
        
        await db.exec('COMMIT');
        res.json({ success: true });
    } catch(e) {
        const db = getDb();
        await db.exec('ROLLBACK');
        res.status(500).json({ error: e.message });
    }
};

exports.getInpatientDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    const admission = await db.get(`
        SELECT a.*, p.full_name as patientName, p.patient_id as patientCode, p.age, p.gender, p.blood_group as bloodGroup, b.room_number as roomNumber, b.cost_per_day as costPerDay, m.full_name as doctorName
        FROM admissions a
        JOIN patients p ON a.patient_id = p.id
        JOIN beds b ON a.bed_id = b.id
        JOIN medical_staff m ON a.doctor_id = m.id
        WHERE a.id = ?
    `, [id]);

    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    const notes = await db.all(`SELECT n.*, m.full_name as doctorName FROM inpatient_notes n LEFT JOIN medical_staff m ON n.doctor_id = m.id WHERE n.admission_id = ? ORDER BY n.created_at DESC`, [id]);
    const endDate = admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : new Date();
    const daysStayed = Math.ceil((endDate.getTime() - new Date(admission.entry_date).getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const estimatedAccommodationCost = daysStayed * admission.costPerDay;

    let depositPaid = 0;
    if (admission.bill_id) {
      const admissionBill = await db.get("SELECT paid_amount FROM billing WHERE id = ?", [admission.bill_id]);
      if (admissionBill) depositPaid = admissionBill.paid_amount || 0;
    }

    const unpaidBills = await db.all(`SELECT id, bill_number, total_amount, paid_amount, bill_date FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`, [admission.patient_id]);
    
    // Enrich unpaid bills with their line items
    const billsWithItems = await Promise.all(unpaidBills.map(async (bill) => {
        const items = await db.all('SELECT description, amount FROM billing_items WHERE billing_id = ?', [bill.id]);
        return { ...bill, items };
    }));

    res.json({
      ...admission,
      notes: notes.map(n => ({...n, vitals: JSON.parse(n.vitals || '{}')})),
      daysStayed,
      estimatedBill: estimatedAccommodationCost,
      depositPaid: depositPaid,
      unpaidBills: billsWithItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inpatient details' });
  }
};

exports.addInpatientNote = async (req, res) => {
    const { id } = req.params;
    const { doctorId, note, vitals } = req.body;
    try {
        const db = getDb();
        await db.run(`
            INSERT INTO inpatient_notes (admission_id, doctor_id, note, vitals)
            VALUES (?, ?, ?, ?)
        `, [id, doctorId, note, JSON.stringify(vitals || {})]);
        res.status(201).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.generateSettlementBill = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        
        const admission = await db.get('SELECT * FROM admissions WHERE id = ?', [id]);
        if (!admission || admission.status !== 'active') throw new Error('Active admission not found.');
        const patientId = admission.patient_id;
        
        const allPendingBills = await db.all(`SELECT id, bill_number, (total_amount - paid_amount) as due, (SELECT GROUP_CONCAT(description, '; ') FROM billing_items WHERE billing_id = billing.id) as description FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`, [patientId]);
        const totalPendingDebt = allPendingBills.reduce((sum, bill) => sum + bill.due, 0);

        if (totalPendingDebt <= 0.01) {
            await db.exec('ROLLBACK');
            return res.status(400).json({ error: 'No outstanding balance found.' });
        }

        await db.run(`UPDATE billing SET status = 'cancelled' WHERE patient_id = ? AND status IN ('pending', 'partial')`, [patientId]);

        const billNumber = `SETTLE-${Math.floor(Math.random()*90000)+10000}`;
        const billInfo = await db.run(`
            INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date, is_settlement_bill, settlement_for_patient_id)
            VALUES (?, ?, ?, 'pending', datetime('now'), 1, ?)
        `, [billNumber, patientId, totalPendingDebt, patientId]);
        
        const billId = billInfo.lastID;
        for (const bill of allPendingBills) {
            await db.run('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)', [billId, `Consolidated: Bill #${bill.bill_number} (${bill.description})`, bill.due]);
        }
        
        await db.exec('COMMIT');
        res.json({ success: true });
    } catch (err) {
        const db = getDb();
        await db.exec('ROLLBACK');
        res.status(500).json({ error: err.message });
    }
};

exports.dischargePatient = async (req, res) => {
  const { id } = req.params;
  const { dischargeNotes, dischargeStatus } = req.body;
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    
    const admission = await db.get('SELECT * FROM admissions WHERE id = ?', [id]);
    if (!admission || admission.status !== 'active') throw new Error('Active admission not found.');
    
    const balanceInfo = await db.get(`SELECT SUM(total_amount - paid_amount) as due FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`, [admission.patient_id]);
    if (balanceInfo && balanceInfo.due > 0.01) throw new Error(`Cannot discharge with balance: $${balanceInfo.due.toFixed(2)}.`);
    
    await db.run(`UPDATE admissions SET status = 'discharged', actual_discharge_date = datetime('now'), discharge_notes = ?, discharge_status = ? WHERE id = ?`, [dischargeNotes, dischargeStatus, id]);
    await db.run("UPDATE beds SET status = 'cleaning' WHERE id = ?", [admission.bed_id]);
    await db.run("UPDATE patients SET type = 'outpatient' WHERE id = ?", [admission.patient_id]);
    
    await db.exec('COMMIT');
    res.json({ success: true });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
};

exports.settleAndDischarge = (req, res) => {
    // This is a legacy endpoint, usually handled via generateSettlementBill + dischargePatient
    res.status(501).json({ error: 'Endpoint deprecated. Use final settlement workflow.' });
};

exports.markBedClean = async (req, res) => {
    const { id } = req.params;
    try {
        const db = getDb();
        await db.run("UPDATE beds SET status = 'available' WHERE id = ?", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
