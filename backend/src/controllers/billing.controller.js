
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  // Join with service tables to get the status of the related service (Appointment, Lab, etc.)
  const bills = db.prepare(`
    SELECT 
      b.id, b.bill_number as billNumber, b.total_amount as totalAmount, 
      b.paid_amount as paidAmount, b.status, b.bill_date as date,
      p.full_name as patientName, p.id as patientId,
      COALESCE(a.status, l.status, o.status, adm.status) as serviceStatus
    FROM billing b
    JOIN patients p ON b.patient_id = p.id
    LEFT JOIN appointments a ON a.bill_id = b.id
    LEFT JOIN lab_requests l ON l.bill_id = b.id
    LEFT JOIN operations o ON o.bill_id = b.id
    LEFT JOIN admissions adm ON adm.bill_id = b.id
    ORDER BY b.bill_date DESC
  `).all();

  const billsWithItems = bills.map(bill => {
    const items = db.prepare('SELECT description, amount FROM billing_items WHERE billing_id = ?').all(bill.id);
    return { ...bill, items };
  });

  res.json(billsWithItems);
};

exports.create = (req, res) => {
  const { patientId, totalAmount, items } = req.body;
  const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits

  const createTransaction = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount)
      VALUES (?, ?, ?)
    `).run(billNumber, patientId, totalAmount);

    const billId = info.lastInsertRowid;

    const insertItem = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
    for (const item of items) {
      insertItem.run(billId, item.description, item.amount);
    }
    return { id: billId, billNumber, ...req.body };
  });

  try {
    const result = createTransaction();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.recordPayment = (req, res) => {
  const { amount, method, details, date } = req.body; // details is JSON object (insurance info, trans ID, etc)
  const { id } = req.params;

  const bill = db.prepare('SELECT total_amount, paid_amount, bill_number FROM billing WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const newPaid = bill.paid_amount + amount;
  const newStatus = newPaid >= bill.total_amount ? 'paid' : 'partial';

  const tx = db.transaction(() => {
    // 1. Update Bill
    db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);

    // 2. Insert into Treasury (Transactions)
    db.prepare(`
      INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description)
      VALUES ('income', 'Bill Payment', ?, ?, ?, ?, ?, ?)
    `).run(amount, method, id, JSON.stringify(details || {}), date || new Date().toISOString(), `Payment for Bill #${bill.bill_number}`);

    // 3. Status Propagation
    if (newStatus === 'paid') {
      // Confirm Appointments
      db.prepare("UPDATE appointments SET status = 'confirmed', billing_status = 'paid' WHERE bill_id = ?").run(id);
      // Confirm Lab Requests
      db.prepare("UPDATE lab_requests SET status = 'confirmed' WHERE bill_id = ?").run(id);
      // Confirm Operations
      db.prepare("UPDATE operations SET status = 'confirmed' WHERE bill_id = ?").run(id);
      // Confirm Admissions (Activate)
      const adm = db.prepare("SELECT * FROM admissions WHERE bill_id = ?").get(id);
      if (adm) {
        db.prepare("UPDATE admissions SET status = 'active' WHERE id = ?").run(adm.id);
        db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(adm.bed_id);
        db.prepare("UPDATE patients SET type = 'inpatient' WHERE id = ?").run(adm.patient_id);
      }
    }
  });

  try {
    tx();
    res.json({ status: newStatus, paidAmount: newPaid });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

exports.processRefund = (req, res) => {
  const { id } = req.params;
  const { amount, reason, date } = req.body;

  const tx = db.transaction(() => {
    const bill = db.prepare('SELECT * FROM billing WHERE id = ?').get(id);
    if (!bill) throw new Error('Bill not found');
    
    if (amount > bill.paid_amount) throw new Error('Refund amount cannot exceed paid amount');

    const newPaid = bill.paid_amount - amount;
    // Determine status: if paid becomes < total, it's partial. If 0, it's pending.
    let newStatus = 'partial';
    if (newPaid <= 0) newStatus = 'pending';
    else if (newPaid >= bill.total_amount) newStatus = 'paid';

    db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);

    db.prepare(`
      INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description)
      VALUES ('expense', 'Refund', ?, 'Cash', ?, ?, ?, ?)
    `).run(amount, id, JSON.stringify({ reason }), date || new Date().toISOString(), `Refund for Bill #${bill.bill_number}: ${reason}`);
  });

  try {
    tx();
    res.json({ success: true, message: 'Refund processed successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// --- TREASURY ---

exports.getTransactions = (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    const mapped = transactions.map(t => {
      let details = {};
      try { details = JSON.parse(t.details); } catch(e) {}
      return { ...t, details };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addExpense = (req, res) => {
  const { category, amount, method, description, date } = req.body;
  
  try {
    const info = db.prepare(`
      INSERT INTO transactions (type, category, amount, method, date, description)
      VALUES ('expense', ?, ?, ?, ?, ?)
    `).run(category, amount, method, date || new Date().toISOString(), description);
    res.json({ id: info.lastInsertRowid, success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
