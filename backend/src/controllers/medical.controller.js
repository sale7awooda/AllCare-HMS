const { db } = require('../config/database');
const notificationController = require('./notification.controller');

// --- LAB ---
exports.getLabRequests = (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT 
        lr.id, lr.patient_id, lr.status, lr.projected_cost, lr.created_at, lr.test_ids, lr.results_json, lr.notes,
        p.full_name as patientName
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id = p.id
      ORDER BY lr.created_at DESC
    `).all();

    const enriched = requests.map(r => {
        let testNames = '';
        let testDetails = [];
        try {
            const ids = JSON.parse(r.test_ids);
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                const tests = db.prepare(`SELECT id, name_en, name_ar, normal_range FROM lab_tests WHERE id IN (${placeholders})`).all(...ids);
                testNames = tests.map(t => t.name_en).join(', ');
                testDetails = tests;
            }
        } catch(e) {}
        
        let results = null;
        try { if(r.results_json) results = JSON.parse(r.results_json); } catch(e) {}

        return { ...r, testNames, testDetails, results };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLabRequest = (req, res) => {
  const { patientId, testIds, totalCost } = req.body;
  
  const tx = db.transaction(() => {
      const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
      const bill = db.prepare(`
        INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date) 
        VALUES (?, ?, ?, 'pending', datetime('now'))
      `).run(billNumber, patientId, totalCost);
      
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Lab Tests (Qty: ${testIds.length})`, totalCost);

      db.prepare(`
        INSERT INTO lab_requests (patient_id, test_ids, projected_cost, status, bill_id)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(patientId, JSON.stringify(testIds), totalCost, bill.lastInsertRowid);

      const patient = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(patientId);
      notificationController.notifyRole('technician', 'New Lab Request', `New lab tests ordered for ${patient.full_name}`);
      notificationController.notifyRole('admin', 'Lab Request', `Patient ${patient.full_name} needs lab tests ($${totalCost})`);
  });

  try {
    tx();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.confirmLabRequest = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE lab_requests SET status = 'confirmed' WHERE id = ? AND status = 'pending'").run(id);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.completeLabRequest = (req, res) => {
    const { id } = req.params;
    const { results_json, notes } = req.body;
    try {
        db.prepare("UPDATE lab_requests SET status = 'completed', results_json = ?, notes = ? WHERE id = ?").run(
            results_json ? JSON.stringify(results_json) : null,
            notes || null,
            id
        );
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

// --- NURSE ---
exports.getNurseRequests = (req, res) => {
    try {
        const reqs = db.prepare(`
            SELECT nr.*, p.full_name as patientName, m.full_name as nurseName
            FROM nurse_requests nr
            JOIN patients p ON nr.patient_id = p.id
            LEFT JOIN medical_staff m ON nr.staff_id = m.id
            ORDER BY nr.created_at DESC
        `).all();
        res.json(reqs);
    } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.createNurseRequest = (req, res) => {
    const { patientId, staffId, serviceName, cost, notes } = req.body;
    try {
        db.prepare(`
            INSERT INTO nurse_requests (patient_id, staff_id, service_name, cost, notes, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `).run(patientId, staffId, serviceName, cost, notes);
        res.status(201).json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
};

// --- OPERATIONS ---
exports.getScheduledOperations = (req, res) => {
  try {
    const ops = db.prepare(`
      SELECT 
        o.id, o.operation_name, o.status, o.created_at, o.projected_cost, o.notes,
        p.full_name as patientName, p.id as patientId,
        m.full_name as doctorName, m.id as doctor_id,
        o.cost_details
      FROM operations o
      JOIN patients p ON o.patient_id = p.id
      LEFT JOIN medical_staff m ON o.doctor_id = m.id
      ORDER BY o.created_at DESC
    `).all();
    
    const mapped = ops.map(op => ({
      ...op,
      costDetails: op.cost_details ? JSON.parse(op.cost_details) : null
    }));
    
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOperation = (req, res) => {
  const { patientId, operationName, doctorId, notes } = req.body;
  try {
    db.prepare(`
      INSERT INTO operations (patient_id, operation_name, doctor_id, notes, status, created_at)
      VALUES (?, ?, ?, ?, 'requested', datetime('now'))
    `).run(patientId, operationName, doctorId, notes);
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.processOperationRequest = (req, res) => {
  const { id } = req.params;
  const { details, totalCost } = req.body;
  
  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE operations 
      SET cost_details = ?, projected_cost = ?, status = 'pending_payment'
      WHERE id = ?
    `).run(JSON.stringify(details), totalCost, id);

    const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    const billInfo = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run(billNumber, op.patient_id, totalCost);
    
    db.prepare(`
      INSERT INTO billing_items (billing_id, description, amount)
      VALUES (?, ?, ?)
    `).run(billInfo.lastInsertRowid, `Surgery: ${op.operation_name}`, totalCost);

    db.prepare('UPDATE operations SET bill_id = ? WHERE id = ?').run(billInfo.lastInsertRowid, id);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.confirmOperation = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE operations SET status = 'confirmed' WHERE id = ? AND status = 'pending_payment'").run(id);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.completeOperation = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE operations SET status = 'completed' WHERE id = ?").run(id);
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

// --- ADMISSIONS ---
exports.getActiveAdmissions = (req, res) => {
  try {
    const admissions = db.prepare(`
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
      LEFT JOIN billing bill ON a.bill_id = bill.id
      WHERE a.status IN ('active', 'reserved')
    `).all();
    
    res.json(admissions.map(a => ({
        ...a,
        bedId: a.bed_id,
        stayDuration: Math.ceil((Date.now() - new Date(a.entry_date).getTime()) / (1000 * 60 * 60 * 24)) || 1
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdmissionsHistory = (req, res) => {
  try {
    const admissions = db.prepare(`
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
    `).all();
    
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

exports.createAdmission = (req, res) => {
    const { patientId, bedId, doctorId, entryDate, deposit, notes } = req.body;

    const tx = db.transaction(() => {
        const bed = db.prepare("SELECT status FROM beds WHERE id = ?").get(bedId);
        if (bed.status !== 'available' && bed.status !== 'cleaning') throw new Error('Bed is not available');
        
        const patient = db.prepare("SELECT full_name FROM patients WHERE id = ?").get(patientId);
        if (!patient) throw new Error('Patient not found');

        const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
        const billInfo = db.prepare(`
          INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date) 
          VALUES (?, ?, ?, 'pending', datetime('now'))
        `).run(billNumber, patientId, deposit);
        
        const billId = billInfo.lastInsertRowid;
        db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(billId, `Admission Deposit for ${patient.full_name}`, deposit);

        db.prepare(`
          INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, status, projected_cost, notes, bill_id)
          VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
        `).run(patientId, bedId, doctorId, entryDate, deposit, notes, billId);

        db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ?").run(bedId);

        notificationController.notifyRole('manager', 'Admission Request', `Patient ${patient.full_name} needs admission to Room ${bed.room_number}`);
    });

    try {
        tx();
        res.status(201).json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

exports.confirmAdmission = (req, res) => {
    const { id } = req.params;
    const tx = db.transaction(() => {
        const adm = db.prepare("SELECT * FROM admissions WHERE id = ?").get(id);
        if (!adm) throw new Error('Admission not found');
        
        db.prepare("UPDATE admissions SET status = 'active' WHERE id = ?").run(id);
        db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(adm.bed_id);
        db.prepare("UPDATE patients SET type = 'inpatient' WHERE id = ?").run(adm.patient_id);
    });
    
    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.cancelAdmission = (req, res) => {
    const { id } = req.params;
    const tx = db.transaction(() => {
        const adm = db.prepare("SELECT * FROM admissions WHERE id = ?").get(id);
        if (!adm) throw new Error('Admission not found');
        
        db.prepare("UPDATE admissions SET status = 'cancelled' WHERE id = ?").run(id);
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(adm.bed_id);
        if (adm.bill_id) {
            db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(adm.bill_id);
        }
    });
    
    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getInpatientDetails = (req, res) => {
  const { id } = req.params;
  try {
    const admission = db.prepare(`
        SELECT a.*, p.full_name as patientName, p.patient_id as patientCode, p.age, p.gender, p.blood_group as bloodGroup, b.room_number as roomNumber, b.cost_per_day as costPerDay, m.full_name as doctorName
        FROM admissions a
        JOIN patients p ON a.patient_id = p.id
        JOIN beds b ON a.bed_id = b.id
        JOIN medical_staff m ON a.doctor_id = m.id
        WHERE a.id = ?
    `).get(id);

    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    // FIX: Using LEFT JOIN to ensure notes are returned even if doctor record has inconsistencies
    const notes = db.prepare(`SELECT n.*, m.full_name as doctorName FROM inpatient_notes n LEFT JOIN medical_staff m ON n.doctor_id = m.id WHERE n.admission_id = ? ORDER BY n.created_at DESC`).all(id);
    const endDate = admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : new Date();
    const daysStayed = Math.ceil((endDate.getTime() - new Date(admission.entry_date).getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const estimatedAccommodationCost = daysStayed * admission.costPerDay;

    let depositPaid = 0;
    if (admission.bill_id) {
      const admissionBill = db.prepare("SELECT paid_amount FROM billing WHERE id = ?").get(admission.bill_id);
      if (admissionBill) depositPaid = admissionBill.paid_amount || 0;
    }

    const unpaidBills = db.prepare(`SELECT id, bill_number, total_amount, paid_amount, bill_date FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`).all(admission.patient_id);
    
    // Enrich unpaid bills with their line items
    const billsWithItems = unpaidBills.map(bill => {
        const items = db.prepare('SELECT description, amount FROM billing_items WHERE billing_id = ?').all(bill.id);
        return { ...bill, items };
    });

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

exports.addInpatientNote = (req, res) => {
    const { id } = req.params;
    const { doctorId, note, vitals } = req.body;
    try {
        db.prepare(`
            INSERT INTO inpatient_notes (admission_id, doctor_id, note, vitals)
            VALUES (?, ?, ?, ?)
        `).run(id, doctorId, note, JSON.stringify(vitals || {}));
        res.status(201).json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.generateSettlementBill = (req, res) => {
    const { id } = req.params;
    const tx = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
        if (!admission || admission.status !== 'active') throw new Error('Active admission not found.');
        const patientId = admission.patient_id;
        
        const allPendingBills = db.prepare(`SELECT id, bill_number, (total_amount - paid_amount) as due, (SELECT GROUP_CONCAT(description, '; ') FROM billing_items WHERE billing_id = billing.id) as description FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`).all(patientId);
        const totalPendingDebt = allPendingBills.reduce((sum, bill) => sum + bill.due, 0);

        if (totalPendingDebt <= 0.01) return { success: false, message: 'No outstanding balance found.' };

        db.prepare(`UPDATE billing SET status = 'cancelled' WHERE patient_id = ? AND status IN ('pending', 'partial')`).run(patientId);

        const billNumber = `SETTLE-${Math.floor(Math.random()*90000)+10000}`;
        const billInfo = db.prepare(`
            INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date, is_settlement_bill, settlement_for_patient_id)
            VALUES (?, ?, ?, 'pending', datetime('now'), 1, ?)
        `).run(billNumber, patientId, totalPendingDebt, patientId);
        
        const billId = billInfo.lastInsertRowid;
        const insertItem = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
        allPendingBills.forEach(bill => {
            insertItem.run(billId, `Consolidated: Bill #${bill.bill_number} (${bill.description})`, bill.due);
        });
        return { success: true };
    });
    try {
        const result = tx();
        if (!result.success) return res.status(400).json({ error: result.message });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.dischargePatient = (req, res) => {
  const { id } = req.params;
  const { dischargeNotes, dischargeStatus } = req.body;
  const tx = db.transaction(() => {
    const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
    if (!admission || admission.status !== 'active') throw new Error('Active admission not found.');
    const balanceInfo = db.prepare(`SELECT SUM(total_amount - paid_amount) as due FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')`).get(admission.patient_id);
    if (balanceInfo && balanceInfo.due > 0.01) throw new Error(`Cannot discharge with balance: $${balanceInfo.due.toFixed(2)}.`);
    db.prepare(`UPDATE admissions SET status = 'discharged', actual_discharge_date = datetime('now'), discharge_notes = ?, discharge_status = ? WHERE id = ?`).run(dischargeNotes, dischargeStatus, id);
    db.prepare("UPDATE beds SET status = 'cleaning' WHERE id = ?").run(admission.bed_id);
    db.prepare("UPDATE patients SET type = 'outpatient' WHERE id = ?").run(admission.patient_id);
  });
  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.settleAndDischarge = (req, res) => {
    // This is a legacy endpoint, usually handled via generateSettlementBill + dischargePatient
    res.status(501).json({ error: 'Endpoint deprecated. Use final settlement workflow.' });
};

exports.markBedClean = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};