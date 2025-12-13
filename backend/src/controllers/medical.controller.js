const { db } = require('../config/database');

// --- LAB ---
exports.getLabRequests = (req, res) => {
  try {
    const requests = db.prepare(`
      SELECT 
        lr.id, lr.patient_id, lr.status, lr.projected_cost, lr.created_at, lr.test_ids,
        p.full_name as patientName
      FROM lab_requests lr
      JOIN patients p ON lr.patient_id = p.id
      ORDER BY lr.created_at DESC
    `).all();

    // Enrich with test names (parsing JSON test_ids)
    const enriched = requests.map(r => {
        let testNames = '';
        try {
            const ids = JSON.parse(r.test_ids); // e.g. [1, 3]
            if (Array.isArray(ids) && ids.length > 0) {
                const placeholders = ids.map(() => '?').join(',');
                const tests = db.prepare(`SELECT name_en FROM lab_tests WHERE id IN (${placeholders})`).all(...ids);
                testNames = tests.map(t => t.name_en).join(', ');
            }
        } catch(e) {
            // Fallback if test_ids is not valid JSON
        }
        return { ...r, testNames };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLabRequest = (req, res) => {
  const { patientId, testIds, totalCost } = req.body; // testIds is array
  
  // Create Bill
  const tx = db.transaction(() => {
      const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
      const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, totalCost, 'pending');
      
      // Add simplified bill item
      db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Lab Tests (Qty: ${testIds.length})`, totalCost);

      db.prepare(`
        INSERT INTO lab_requests (patient_id, test_ids, projected_cost, status, bill_id)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(patientId, JSON.stringify(testIds), totalCost, bill.lastInsertRowid);
  });

  try {
    tx();
    res.status(201).json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.completeLabRequest = (req, res) => {
    const { id } = req.params;
    const { results, notes } = req.body; // In a real app, store these
    try {
        // Store results (Assuming we add a results column or just update status for now)
        // db.prepare("UPDATE lab_requests SET status = 'completed', results = ? WHERE id = ?").run(JSON.stringify({results, notes}), id);
        // For current schema which might not have results col, we just mark completed
        db.prepare("UPDATE lab_requests SET status = 'completed' WHERE id = ?").run(id);
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.confirmLabRequest = (req, res) => {
    const { id } = req.params;
    try {
        db.prepare("UPDATE lab_requests SET status = 'confirmed' WHERE id = ?").run(id);
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
            INSERT INTO nurse_requests (patient_id, staff_id, service_name, cost, notes, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `).run(patientId, staffId, serviceName, cost, notes);
        res.status(201).json({ success: true });
    } catch(e) { res.status(400).json({ error: e.message }); }
};

// --- ADMISSIONS & OPS (Keep existing) ---
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
    
    // Parse JSON details if they exist
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
    const info = db.prepare(`
      INSERT INTO operations (patient_id, operation_name, doctor_id, notes, status)
      VALUES (?, ?, ?, ?, 'requested')
    `).run(patientId, operationName, doctorId, notes);
    res.status(201).json({ id: info.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.processOperationRequest = (req, res) => {
  const { id } = req.params;
  const { details, totalCost } = req.body;
  
  const tx = db.transaction(() => {
    // 1. Update Operation
    db.prepare(`
      UPDATE operations 
      SET cost_details = ?, projected_cost = ?, status = 'pending_payment'
      WHERE id = ?
    `).run(JSON.stringify(details), totalCost, id);

    // 2. Generate Bill (Optional: Could be done now or later. Here we create a pending bill)
    const op = db.prepare('SELECT * FROM operations WHERE id = ?').get(id);
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    
    const billInfo = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status)
      VALUES (?, ?, ?, 'pending')
    `).run(billNumber, op.patient_id, totalCost);
    
    db.prepare(`
      INSERT INTO billing_items (billing_id, description, amount)
      VALUES (?, ?, ?)
    `).run(billInfo.lastInsertRowid, `Surgery: ${op.operation_name}`, totalCost);

    // Link bill to operation
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
        db.prepare("UPDATE operations SET status = 'confirmed' WHERE id = ?").run(id);
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
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

// --- Lab & Admission Helpers ---

exports.getActiveAdmissions = (req, res) => {
  try {
    const admissions = db.prepare(`
      SELECT 
        a.id, a.patient_id, a.bed_id, a.doctor_id, a.entry_date, a.status, a.projected_cost,
        p.full_name as patientName,
        b.room_number as roomNumber,
        m.full_name as doctorName
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN beds b ON a.bed_id = b.id
      JOIN medical_staff m ON a.doctor_id = m.id
      WHERE a.status IN ('active', 'reserved')
    `).all();
    
    // Map status 'reserved' -> 'reserved' and 'active' -> 'occupied' for frontend bed logic if needed,
    // but cleaner to keep database status and let frontend interpret.
    res.json(admissions.map(a => ({
        ...a,
        bedId: a.bed_id,
        // Calculate estimated stay days if needed
        stayDuration: Math.ceil((Date.now() - new Date(a.entry_date).getTime()) / (1000 * 60 * 60 * 24))
    })));
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
            p.full_name as patientName, p.patient_id as patientCode, p.age, p.gender, p.blood_group as bloodGroup,
            b.room_number as roomNumber, b.cost_per_day as costPerDay,
            m.full_name as doctorName
        FROM admissions a
        JOIN patients p ON a.patient_id = p.id
        JOIN beds b ON a.bed_id = b.id
        JOIN medical_staff m ON a.doctor_id = m.id
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

    // --- Corrected Financial Preview Logic ---
    const daysStayed = Math.ceil((Date.now() - new Date(admission.entry_date).getTime()) / (1000 * 60 * 60 * 24)) || 1;
    const estimatedAccommodationCost = daysStayed * admission.costPerDay;

    let depositPaid = 0;
    if (admission.bill_id) {
      const admissionBill = db.prepare("SELECT paid_amount FROM billing WHERE id = ?").get(admission.bill_id);
      if (admissionBill) {
        depositPaid = admissionBill.paid_amount || 0;
      }
    }

    // Return the full list of unpaid bills for a detailed breakdown on the frontend.
    const unpaidBills = db.prepare(`
      SELECT id, bill_number, total_amount, paid_amount, bill_date
      FROM billing 
      WHERE patient_id = ? AND status IN ('pending', 'partial') AND id != ?
    `).all(admission.patient_id, admission.bill_id || -1);

    const outstandingBalance = unpaidBills.reduce((acc, b) => acc + (b.total_amount - b.paid_amount), 0);

    res.json({
      ...admission,
      notes: notes.map(n => ({...n, vitals: JSON.parse(n.vitals || '{}')})),
      daysStayed,
      estimatedBill: estimatedAccommodationCost,
      depositPaid: depositPaid,
      outstandingBalance: outstandingBalance,
      unpaidBills: unpaidBills, // NEW: Pass the detailed list
    });
    
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch inpatient details' });
  }
};

exports.createAdmission = (req, res) => {
    const { patientId, bedId, doctorId, entryDate, deposit, notes } = req.body;

    const tx = db.transaction(() => {
        // 1. Check if bed is available
        const bed = db.prepare("SELECT status FROM beds WHERE id = ?").get(bedId);
        if (bed.status !== 'available' && bed.status !== 'cleaning') throw new Error('Bed is not available');
        
        const patient = db.prepare("SELECT full_name FROM patients WHERE id = ?").get(patientId);
        if (!patient) throw new Error('Patient not found');

        // 2. Create Deposit Bill
        const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
        const billInfo = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, deposit, 'pending');
        const billId = billInfo.lastInsertRowid;
        db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(billId, `Admission Deposit for ${patient.full_name}`, deposit);

        // 3. Create Admission (Status: Reserved) and link the bill
        const admissionInfo = db.prepare(`
          INSERT INTO admissions (patient_id, bed_id, doctor_id, entry_date, status, projected_cost, notes, bill_id)
          VALUES (?, ?, ?, ?, 'reserved', ?, ?, ?)
        `).run(patientId, bedId, doctorId, entryDate, deposit, notes, billId);

        // 4. Mark Bed as Reserved
        db.prepare("UPDATE beds SET status = 'reserved' WHERE id = ?").run(bedId);
        
        return { admissionId: admissionInfo.lastInsertRowid };
    });

    try {
        const result = tx();
        res.status(201).json({ success: true, ...result });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

exports.cancelAdmission = (req, res) => {
    const { id } = req.params; // admission id

    const tx = db.transaction(() => {
        const admission = db.prepare("SELECT * FROM admissions WHERE id = ?").get(id);
        if (!admission) throw new Error('Admission not found.');
        if (admission.status !== 'reserved') throw new Error('Only reserved admissions can be cancelled.');

        // Update admission status
        db.prepare("UPDATE admissions SET status = 'cancelled' WHERE id = ?").run(id);

        // Make bed available again
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(admission.bed_id);

        // Cancel the associated bill if it exists and is pending
        if (admission.bill_id) {
            db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ? AND status = 'pending'").run(admission.bill_id);
        }
    });

    try {
        tx();
        res.json({ success: true, message: 'Admission cancelled.' });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
};

exports.confirmAdmission = (req, res) => {
    const { id } = req.params;
    try {
        // Activate admission
        const info = db.prepare("UPDATE admissions SET status = 'active' WHERE id = ? AND status = 'reserved' RETURNING bed_id, patient_id").get(id);
        if(info) {
            db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(info.bed_id);
            db.prepare("UPDATE patients SET type = 'inpatient' WHERE id = ?").run(info.patient_id);
        } else {
          throw new Error('Admission not found or not in reserved state.');
        }
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.addInpatientNote = (req, res) => {
    const { id } = req.params; // admission_id
    const { doctorId, note, vitals } = req.body;
    try {
        db.prepare("INSERT INTO inpatient_notes (admission_id, doctor_id, note, vitals) VALUES (?, ?, ?, ?)").run(id, doctorId, note, JSON.stringify(vitals));
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};

exports.generateSettlementBill = (req, res) => {
    const { id } = req.params; // admissionId

    const tx = db.transaction(() => {
        const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
        if (!admission || admission.status !== 'active') throw new Error('Active admission not found.');

        const patientId = admission.patient_id;
        const patient = db.prepare("SELECT full_name FROM patients WHERE id = ?").get(patientId);
        if (!patient) throw new Error('Patient not found');

        const bed = db.prepare('SELECT cost_per_day FROM beds WHERE id = ?').get(admission.bed_id);
        const entryDate = new Date(admission.entry_date);
        const now = new Date();
        const daysStayed = Math.ceil((now.getTime() - entryDate.getTime()) / (1000 * 3600 * 24)) || 1;
        const accommodationCost = daysStayed * bed.cost_per_day;

        if (admission.bill_id) {
            db.prepare("DELETE FROM billing_items WHERE billing_id = ? AND description LIKE 'Admission Deposit%'").run(admission.bill_id);
            db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)").run(admission.bill_id, `Accommodation (${daysStayed} days)`, accommodationCost);
            
            const items = db.prepare("SELECT SUM(amount) as total FROM billing_items WHERE billing_id = ?").get(admission.bill_id);
            db.prepare("UPDATE billing SET total_amount = ? WHERE id = ?").run(items.total, admission.bill_id);
        }

        const allBills = db.prepare("SELECT total_amount, paid_amount FROM billing WHERE patient_id = ? AND status IN ('pending', 'partial')").all(patientId);
        const totalDebt = allBills.reduce((sum, bill) => sum + (bill.total_amount - bill.paid_amount), 0);

        if (totalDebt <= 0.01) {
            return { success: false, message: 'No outstanding balance found. Proceed with direct discharge.' };
        }

        const billNumber = `SETTLE-${Math.floor(10000 + Math.random() * 90000)}`;
        const billInfo = db.prepare(`
            INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date, is_settlement_bill, settlement_for_patient_id)
            VALUES (?, ?, ?, 'pending', ?, 1, ?)
        `).run(billNumber, patientId, totalDebt, new Date().toISOString(), patientId);
        const billId = billInfo.lastInsertRowid;

        db.prepare("INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)").run(billId, 'Settlement of all outstanding dues', totalDebt);

        return { success: true, message: 'Settlement bill generated successfully.' };
    });

    try {
        const result = tx();
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }
        res.json(result);
    } catch (err) {
        console.error('Error generating settlement bill:', err);
        res.status(500).json({ error: err.message });
    }
};

exports.dischargePatient = (req, res) => {
  const { id } = req.params;
  const { dischargeNotes, dischargeStatus } = req.body;
  
  const tx = db.transaction(() => {
    const admission = db.prepare('SELECT * FROM admissions WHERE id = ?').get(id);
    if (!admission || admission.status !== 'active') throw new Error('Active admission not found or not in a dischargeable state.');

    const balanceInfo = db.prepare(`
        SELECT SUM(total_amount - paid_amount) as due 
        FROM billing 
        WHERE patient_id = ? AND status IN ('pending', 'partial')
    `).get(admission.patient_id);
    
    if (balanceInfo && balanceInfo.due > 0.01) {
        throw new Error(`Cannot discharge patient with an outstanding balance of $${balanceInfo.due.toFixed(2)}.`);
    }
    
    db.prepare(`
      UPDATE admissions 
      SET status = 'discharged', actual_discharge_date = ?, discharge_notes = ?, discharge_status = ?
      WHERE id = ?
    `).run(new Date().toISOString(), dischargeNotes, dischargeStatus, id);

    db.prepare("UPDATE beds SET status = 'cleaning' WHERE id = ?").run(admission.bed_id);
    db.prepare("UPDATE patients SET type = 'outpatient' WHERE id = ?").run(admission.patient_id);
  });

  try {
    tx();
    res.json({ success: true, message: 'Patient discharged. Bed set to cleaning.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.settleAndDischarge = (req, res) => {
    const { id } = req.params; // admissionId
    const { paymentData, dischargeData } = req.body;

    const tx = db.transaction(() => {
        // This function is now deprecated in favor of the two-step process.
        // Keeping it to prevent crashes but it should not be used.
        // For a robust implementation, this would either be removed or refactored
        // to call the new logic, but for now we'll throw an error.
        throw new Error('This endpoint is deprecated. Please use the new generate-settlement workflow.');
    });

    try {
        tx();
        res.json({ success: true, message: 'Patient debts settled and discharged successfully.' });
    } catch (err) {
        console.error('Settle & Discharge Error:', err);
        res.status(500).json({ error: err.message });
    }
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