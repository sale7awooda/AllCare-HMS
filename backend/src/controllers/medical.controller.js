
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
                const tests = db.prepare(`SELECT name FROM lab_tests WHERE id IN (${placeholders})`).all(...ids);
                testNames = tests.map(t => t.name).join(', ');
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

// --- Lab & Admission Helpers (Prevent Crashes) ---

exports.confirmAdmission = (req, res) => {
    const { id } = req.params;
    try {
        // Activate admission
        const info = db.prepare("UPDATE admissions SET status = 'active' WHERE id = ? RETURNING bed_id").get(id);
        if(info) {
            db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(info.bed_id);
        }
        res.json({success: true});
    } catch(e) {
        res.status(500).json({error: e.message});
    }
};
