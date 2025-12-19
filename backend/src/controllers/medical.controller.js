
const { db } = require('../config/database');

// --- OPERATIONS ---

exports.createOperation = (req, res) => {
    const { patientId, operationName, doctorId, notes } = req.body;
    try {
        const info = db.prepare(`
            INSERT INTO operations (patient_id, operation_name, doctor_id, notes, status, created_at)
            VALUES (?, ?, ?, ?, 'requested', datetime('now'))
        `).run(patientId, operationName, doctorId, notes);
        res.json({ id: info.lastInsertRowid, success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.processOperationRequest = (req, res) => {
    const { id } = req.params;
    const { details, totalCost } = req.body; // details is costForm from frontend
    
    const tx = db.transaction(() => {
        const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!op) throw new Error('Operation not found');

        // Create Bill
        const billNum = Math.floor(10000000 + Math.random() * 90000000).toString();
        const bill = db.prepare(`
            INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
            VALUES (?, ?, ?, 'pending', datetime('now'))
        `).run(billNum, op.patient_id, totalCost);

        const billId = bill.lastInsertRowid;

        // Add bill items
        const itemsStmt = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
        
        // Surgeon Fee
        if (details.surgeonFee > 0) itemsStmt.run(billId, `Surgeon Fee: ${op.operation_name}`, details.surgeonFee);
        // Theater Fee
        if (details.theaterFee > 0) itemsStmt.run(billId, `Theater Fee: ${op.operation_name}`, details.theaterFee);
        // Consumables Summary
        const consTotal = details.consumables?.reduce((s, i) => s + i.cost, 0) || 0;
        if (consTotal > 0) itemsStmt.run(billId, `Surgical Consumables`, consTotal);
        // Equipment Summary
        const eqTotal = details.equipment?.reduce((s, i) => s + i.cost, 0) || 0;
        if (eqTotal > 0) itemsStmt.run(billId, `Equipment Usage`, eqTotal);
        
        // Update Operation
        db.prepare(`
            UPDATE operations 
            SET status = 'pending_payment', 
                projected_cost = ?, 
                bill_id = ?, 
                cost_details = ? 
            WHERE id = ?
        `).run(totalCost, billId, JSON.stringify(details), id);
    });

    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.confirmOperation = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE operations SET status = 'confirmed' WHERE id = ?").run(id);
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

exports.payOperationShare = (req, res) => {
    const { id } = req.params;
    const { targetType, targetIndex, amount, method, notes } = req.body; 
    
    const tx = db.transaction(() => {
        const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
        if (!op) throw new Error('Operation not found');

        let details = {};
        try { details = JSON.parse(op.cost_details); } catch(e) { throw new Error('Invalid cost details'); }

        let payeeName = '';
        let description = '';

        if (targetType === 'surgeon') {
            if (details.surgeonPaid) throw new Error('Surgeon fee already paid');
            details.surgeonPaid = true;
            details.surgeonPaidDate = new Date().toISOString();
            payeeName = 'Lead Surgeon'; 
            
            const doctor = db.prepare('SELECT full_name FROM medical_staff WHERE id = ?').get(op.doctor_id);
            if(doctor) payeeName = doctor.full_name;

            description = `Surgeon Fee Payout: ${op.operation_name} - ${payeeName}`;
        } else if (targetType === 'participant') {
            if (!details.participants || !details.participants[targetIndex]) throw new Error('Participant not found');
            if (details.participants[targetIndex].isPaid) throw new Error('Participant already paid');
            
            details.participants[targetIndex].isPaid = true;
            details.participants[targetIndex].paidDate = new Date().toISOString();
            payeeName = details.participants[targetIndex].name;
            description = `Surgical Team Payout (${details.participants[targetIndex].role}): ${payeeName} - ${op.operation_name}`;
        } else {
            throw new Error('Invalid target type');
        }

        db.prepare('UPDATE operations SET cost_details = ? WHERE id = ?').run(JSON.stringify(details), id);

        db.prepare(`
            INSERT INTO transactions (type, category, amount, method, reference_id, date, description)
            VALUES ('expense', 'Operation Payout', ?, ?, ?, datetime('now'), ?)
        `).run(amount, method, id, description);
    });

    try {
        tx();
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

// --- ADMISSIONS ---

exports.getActiveAdmissions = (req, res) => {
  try {
    const admissions = db.prepare(`
      SELECT 
        a.id, a.patient_id as patientId, a.bed_id as bedId, 
        a.entry_date, a.status, a.projected_cost,
        p.full_name as patientName, p.patient_id as patientCode, p.gender, p.age,
        b.room_number as roomNumber, b.type as bedType,
        m.full_name as doctorName,
        bill.status as billStatus
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      LEFT JOIN billing bill ON a.bill_id = bill.id
      WHERE a.status IN ('active', 'reserved')
    `).all();
    res.json(admissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAdmission = (req, res) => {
  const { patientId, bedId, doctorId, entryDate, deposit, notes } = req.body;
  
  const tx = db.transaction(() => {
    // 1. Create Deposit Bill
    const billNum = Math.floor(10000000 + Math.random() * 90000000).toString();
    const bill = db.prepare(`
        INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
        VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run(billNum, patientId, deposit);
    
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, 'Admission Deposit', deposit);

    // 2. Create Admission Record
    const info = db.prepare(`
      INSERT INTO admissions (
        patient_id, bed_id, doctor_id, entry_date, status, 
        projected_cost, bill_id, notes
      ) VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
    `).run(patientId, bedId, doctorId, entryDate, deposit, bill.lastInsertRowid, notes);

    // 3. Update Bed Status
    db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ?").run(bedId);

    return { id: info.lastInsertRowid };
  });

  try {
    const result = tx();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getAdmissionHistory = (req, res) => {
  try {
    const history = db.prepare(`
      SELECT 
        a.*, 
        p.full_name as patientName, p.patient_id as patientCode,
        b.room_number as roomNumber, b.type as bedType,
        m.full_name as doctorName
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      ORDER BY a.entry_date DESC
    `).all();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInpatientDetails = (req, res) => {
  const { id } = req.params;
  try {
    const admission = db.prepare(`
      SELECT 
        a.*, 
        p.full_name as patientName, p.age, p.gender, p.blood_group as bloodGroup,
        b.room_number as roomNumber, b.cost_per_day as costPerDay,
        m.full_name as doctorName, m.id as doctorId
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      WHERE a.id = ?
    `).get(id);

    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    const start = new Date(admission.entry_date);
    const end = admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : new Date();
    const diffTime = Math.abs(end - start);
    const daysStayed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    const notes = db.prepare(`
      SELECT n.*, m.full_name as doctorName 
      FROM inpatient_notes n
      LEFT JOIN medical_staff m ON n.doctor_id = m.id
      WHERE n.admission_id = ?
      ORDER BY n.created_at DESC
    `).all(id).map(n => ({...n, vitals: JSON.parse(n.vitals || '{}')}));

    const unpaidBills = db.prepare(`
        SELECT * FROM billing 
        WHERE patient_id = ? AND status IN ('pending', 'partial')
    `).all(admission.patient_id);
    
    const billsWithItems = unpaidBills.map(b => {
        const items = db.prepare('SELECT * FROM billing_items WHERE billing_id = ?').all(b.id);
        return { ...b, items };
    });

    res.json({ ...admission, daysStayed, notes, unpaidBills: billsWithItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.dischargePatient = (req, res) => {
  const { id } = req.params;
  const { dischargeNotes, dischargeStatus } = req.body;

  const tx = db.transaction(() => {
    const adm = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
    if (!adm) throw new Error('Admission not found');

    const bed = db.prepare('SELECT * FROM beds WHERE id = ?').get(adm.bed_id);
    const start = new Date(adm.entry_date);
    const end = new Date();
    const days = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)) || 1;
    const accommodationCost = days * bed.cost_per_day;

    const billNum = Math.floor(10000000 + Math.random() * 90000000).toString();
    const bill = db.prepare(`
        INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date, is_settlement_bill, settlement_for_patient_id)
        VALUES (?, ?, ?, 'pending', datetime('now'), 1, ?)
    `).run(billNum, adm.patient_id, accommodationCost, adm.patient_id);
    
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(
        bill.lastInsertRowid, 
        `Accommodation: ${bed.room_number} (${days} days @ $${bed.cost_per_day})`, 
        accommodationCost
    );

    db.prepare(`
        UPDATE admissions 
        SET status = 'discharged', 
            actual_discharge_date = datetime('now'),
            discharge_notes = ?,
            discharge_status = ?
        WHERE id = ?
    `).run(dischargeNotes, dischargeStatus, id);

    db.prepare("UPDATE beds SET status = 'cleaning' WHERE id = ?").run(adm.bed_id);
    db.prepare("UPDATE patients SET type = 'outpatient' WHERE id = ?").run(adm.patient_id);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.confirmAdmissionDeposit = (req, res) => {
    const { id } = req.params;
    const tx = db.transaction(() => {
        const adm = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
        if(!adm) throw new Error('Admission not found');
        
        const bill = db.prepare('SELECT status, paid_amount, total_amount FROM billing WHERE id = ?').get(adm.bill_id);
        if (bill.status !== 'paid' && bill.paid_amount < bill.total_amount) {
            throw new Error('Deposit bill is not paid yet.');
        }

        db.prepare("UPDATE admissions SET status = 'active' WHERE id = ?").run(id);
        db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(adm.bed_id);
        db.prepare("UPDATE patients SET type = 'inpatient' WHERE id = ?").run(adm.patient_id);
    });

    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
};

exports.cancelAdmission = (req, res) => {
    const { id } = req.params;
    const tx = db.transaction(() => {
        const adm = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
        if(!adm) throw new Error('Admission not found');

        db.prepare("UPDATE admissions SET status = 'cancelled' WHERE id = ?").run(id);
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(adm.bed_id);
        db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ?").run(adm.bill_id);
    });

    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(400).json({ error: e.message });
    }
};
