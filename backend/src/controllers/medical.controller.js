
const { db } = require('../config/database');

// --- OPERATIONS ---

exports.createOperation = (req, res) => {
    const { patientId, operationName, doctorId, notes } = req.body;
    try {
        const op = db.prepare(`
            INSERT INTO operations (patient_id, operation_name, doctor_id, notes, status, projected_cost, created_at)
            VALUES (?, ?, ?, ?, 'requested', 0, datetime('now'))
        `).run(patientId, operationName, doctorId, notes);
        res.json({ id: op.lastInsertRowid, success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.processOperationRequest = (req, res) => {
    const { id } = req.params;
    const { details, totalCost } = req.body;
    
    const tx = db.transaction(() => {
        // Create Bill for Operation
        const op = db.prepare('SELECT patient_id FROM operations WHERE id = ?').get(id);
        if (!op) throw new Error('Operation not found');

        const billNum = Math.floor(10000000 + Math.random() * 90000000).toString();
        const bill = db.prepare("INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, 'pending')").run(billNum, op.patient_id, totalCost);
        
        db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)").run(bill.lastInsertRowid, 'Surgeon Fee', details.surgeonFee);
        db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)").run(bill.lastInsertRowid, 'Theater Fee', details.theaterFee);
        
        // Update Operation
        db.prepare(`
            UPDATE operations 
            SET status = 'pending_payment', 
                projected_cost = ?, 
                cost_details = ?, 
                bill_id = ? 
            WHERE id = ?
        `).run(totalCost, JSON.stringify(details), bill.lastInsertRowid, id);
    });

    try {
        tx();
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.confirmOperation = (req, res) => {
    try {
        db.prepare("UPDATE operations SET status = 'confirmed' WHERE id = ?").run(req.params.id);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
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
    // targetType: 'surgeon' | 'participant'
    // targetIndex: index in participants array (if targetType is participant)

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
            
            // Try to resolve surgeon name
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

        // 1. Update Operation JSON
        db.prepare('UPDATE operations SET cost_details = ? WHERE id = ?').run(JSON.stringify(details), id);

        // 2. Create Expense Transaction
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
    const rows = db.prepare(`
      SELECT a.*, p.full_name as patientName, p.patient_id as patientCode,
             b.room_number as roomNumber, b.type as bedType, b.cost_per_day,
             m.full_name as doctorName,
             bill.status as billStatus
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      LEFT JOIN medical_staff m ON a.doctor_id = m.id
      LEFT JOIN billing bill ON a.bill_id = bill.id
      WHERE a.status IN ('active', 'reserved')
      ORDER BY a.entry_date DESC
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createAdmission = (req, res) => {
  const { patientId, bedId, doctorId, entryDate, deposit, notes } = req.body;
  
  const tx = db.transaction(() => {
    const bed = db.prepare('SELECT status FROM beds WHERE id = ?').get(bedId);
    if (bed.status !== 'available') throw new Error('Bed is not available');

    // Create Deposit Bill
    const billNum = Math.floor(10000000 + Math.random() * 90000000).toString();
    const bill = db.prepare("INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, 'pending')").run(billNum, patientId, deposit);
    db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)").run(bill.lastInsertRowid, 'Admission Deposit', deposit);

    // Reserve Bed
    db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ?").run(bedId);

    // Create Admission Record
    db.prepare(`
      INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, status, notes, projected_cost, bill_id)
      VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
    `).run(patientId, bedId, doctorId, entryDate, notes, deposit, bill.lastInsertRowid);
  });

  try {
    tx();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.confirmAdmissionDeposit = (req, res) => {
  const { id } = req.params; // Admission ID
  const tx = db.transaction(() => {
    const adm = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
    if (!adm) throw new Error('Admission not found');
    
    // Verify Bill Payment
    const bill = db.prepare('SELECT status, paid_amount, total_amount FROM billing WHERE id = ?').get(adm.bill_id);
    if (bill.status !== 'paid' && bill.paid_amount < bill.total_amount) {
        throw new Error('Deposit not paid. Cannot activate admission.');
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

exports.getInpatientDetails = (req, res) => {
    try {
        const adm = db.prepare(`
            SELECT a.*, p.full_name as patientName, p.age, p.gender, p.blood_group as bloodGroup,
                   b.room_number as roomNumber, b.type as bedType, b.cost_per_day as costPerDay,
                   m.full_name as doctorName
            FROM admissions a
            JOIN patients p ON a.patient_id = p.id
            JOIN beds b ON a.bed_id = b.id
            LEFT JOIN medical_staff m ON a.doctor_id = m.id
            WHERE a.id = ?
        `).get(req.params.id);

        if (!adm) return res.status(404).json({error: 'Admission not found'});

        // Calculate days stayed
        const start = new Date(adm.entry_date);
        const end = adm.actual_discharge_date ? new Date(adm.actual_discharge_date) : new Date();
        const diffTime = Math.abs(end - start);
        const daysStayed = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

        // Get Unpaid Bills
        const unpaidBills = db.prepare(`
            SELECT * FROM billing 
            WHERE patient_id = ? AND status IN ('pending', 'partial')
        `).all(adm.patient_id);
        
        const billsWithItems = unpaidBills.map(bill => {
            const items = db.prepare('SELECT description, amount FROM billing_items WHERE billing_id = ?').all(bill.id);
            return { ...bill, items };
        });

        // Get Notes
        const notes = db.prepare(`
            SELECT n.*, m.full_name as doctorName 
            FROM inpatient_notes n
            LEFT JOIN medical_staff m ON n.doctor_id = m.id
            WHERE n.admission_id = ?
            ORDER BY n.created_at DESC
        `).all(adm.id);

        const notesParsed = notes.map(n => ({
            ...n,
            vitals: n.vitals ? JSON.parse(n.vitals) : {}
        }));

        res.json({
            ...adm,
            daysStayed,
            unpaidBills: billsWithItems,
            notes: notesParsed
        });
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.addInpatientNote = (req, res) => {
    const { id } = req.params; // Admission ID
    const { doctorId, note, vitals } = req.body;
    try {
        db.prepare(`
            INSERT INTO inpatient_notes (admission_id, doctor_id, note, vitals, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `).run(id, doctorId, note, JSON.stringify(vitals || {}));
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.dischargePatient = (req, res) => {
    const { id } = req.params; // Admission ID
    const { dischargeNotes, dischargeStatus } = req.body;
    
    const tx = db.transaction(() => {
        const adm = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
        if (!adm) throw new Error('Admission not found');

        // Verify all bills paid
        const pendingBills = db.prepare(`
            SELECT COUNT(*) as count FROM billing 
            WHERE patient_id = ? AND status IN ('pending', 'partial')
        `).get(adm.patient_id);
        
        if (pendingBills.count > 0) throw new Error('Cannot discharge. Outstanding bills found.');

        // Update Admission
        db.prepare(`
            UPDATE admissions 
            SET status = 'discharged', 
                discharge_date = datetime('now'),
                actual_discharge_date = datetime('now'),
                discharge_notes = ?,
                discharge_status = ?
            WHERE id = ?
        `).run(dischargeNotes, dischargeStatus, id);

        // Update Bed
        db.prepare("UPDATE beds SET status = 'cleaning' WHERE id = ?").run(adm.bed_id);
        
        // Update Patient Type
        db.prepare("UPDATE patients SET type = 'outpatient' WHERE id = ?").run(adm.patient_id);
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
        if (!adm) throw new Error('Admission not found');
        
        // Cancel Deposit Bill
        db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ?").run(adm.bill_id);
        
        // Free Bed
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(adm.bed_id);
        
        // Update Admission Status
        db.prepare("UPDATE admissions SET status = 'cancelled' WHERE id = ?").run(id);
    });
    
    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};

exports.getAdmissionHistory = (req, res) => {
    try {
        const history = db.prepare(`
            SELECT a.*, p.full_name as patientName, p.patient_id as patientCode,
                   b.room_number as roomNumber, b.type as bedType,
                   m.full_name as doctorName
            FROM admissions a
            JOIN patients p ON a.patient_id = p.id
            JOIN beds b ON a.bed_id = b.id
            LEFT JOIN medical_staff m ON a.doctor_id = m.id
            ORDER BY a.entry_date DESC
        `).all();
        res.json(history);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
};
