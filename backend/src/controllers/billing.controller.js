
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const bills = db.prepare(`
    SELECT 
      b.id, b.bill_number as billNumber, b.total_amount as totalAmount, 
      b.paid_amount as paidAmount, b.status, b.bill_date as date,
      p.full_name as patientName, p.id as patientId, p.phone as patientPhone,
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
  const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

  const createTransaction = db.transaction(() => {
    // Explicitly set bill_date to avoid any potential NULLs
    const info = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run(billNumber, patientId, totalAmount);

    const billId = info.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
    for (const item of items) {
      insertItem.run(billId, item.description, item.amount);
    }
    return { id: billId, billNumber, ...req.body, date: new Date().toISOString() };
  });

  try {
    const result = createTransaction();
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.recordPayment = (req, res) => {
  const { amount, method, details, date } = req.body;
  const { id } = req.params;

  const bill = db.prepare('SELECT total_amount, paid_amount, bill_number FROM billing WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const newPaid = bill.paid_amount + amount;
  const newStatus = newPaid >= bill.total_amount - 0.01 ? 'paid' : 'partial';

  const tx = db.transaction(() => {
    db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);

    db.prepare(`
      INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description)
      VALUES ('income', 'Bill Payment', ?, ?, ?, ?, ?, ?)
    `).run(amount, method, id, JSON.stringify(details || {}), date || new Date().toISOString(), `Payment for Bill #${bill.bill_number}`);

    if (newStatus === 'paid') {
      db.prepare("UPDATE appointments SET billing_status = 'paid' WHERE bill_id = ?").run(id);
      db.prepare("UPDATE appointments SET status = 'confirmed' WHERE bill_id = ? AND status = 'pending'").run(id);
      db.prepare("UPDATE lab_requests SET status = 'confirmed' WHERE bill_id = ?").run(id);
      db.prepare("UPDATE operations SET status = 'confirmed' WHERE bill_id = ?").run(id);
      const adm = db.prepare("SELECT * FROM admissions WHERE bill_id = ?").get(id);
      if (adm) {
        db.prepare("UPDATE admissions SET status = 'active' WHERE id = ?").run(adm.id);
        db.prepare("UPDATE beds SET status = 'occupied' WHERE id = ?").run(adm.bed_id);
        db.prepare("UPDATE patients SET type = 'inpatient' WHERE id = ?").run(adm.patient_id);
      }
      const paidBillDetails = db.prepare("SELECT is_settlement_bill, settlement_for_patient_id FROM billing WHERE id = ?").get(id);
      if (paidBillDetails && paidBillDetails.is_settlement_bill) {
          const patientId = paidBillDetails.settlement_for_patient_id;
          db.prepare(`UPDATE billing SET status = 'paid', paid_amount = total_amount WHERE patient_id = ? AND id != ? AND status IN ('pending', 'partial')`).run(patientId, id);
      }
    }
  });

  try {
    tx();
    res.json({ status: newStatus, paidAmount: newPaid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.cancelService = (req, res) => {
  const { id } = req.params;
  const tx = db.transaction(() => {
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE bill_id = ?").run(id);
    db.prepare("UPDATE lab_requests SET status = 'cancelled' WHERE bill_id = ?").run(id);
    
    // Ensure the bill status is also updated to cancelled
    db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ?").run(id);
    
    const op = db.prepare("SELECT id FROM operations WHERE bill_id = ?").get(id);
    if (op) {
        db.prepare("UPDATE operations SET status = 'cancelled' WHERE id = ?").run(op.id);
        // Decline linked 'extra' adjustments
        db.prepare("UPDATE hr_financials SET status = 'declined' WHERE reference_id = ? AND type = 'extra'").run(op.id);
    }

    const adm = db.prepare("SELECT * FROM admissions WHERE bill_id = ?").get(id);
    if (adm) {
        db.prepare("UPDATE admissions SET status = 'cancelled' WHERE id = ?").run(adm.id);
        db.prepare("UPDATE beds SET status = 'available' WHERE id = ?").run(adm.bed_id);
    }
  });
  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.processRefund = (req, res) => {
  const { id } = req.params;
  const { amount, reason, date, method } = req.body;
  const tx = db.transaction(() => {
    const bill = db.prepare('SELECT * FROM billing WHERE id = ?').get(id);
    if (!bill) throw new Error('Bill not found');
    if (amount > bill.paid_amount) throw new Error('Refund amount exceeds paid amount');
    const newPaid = bill.paid_amount - amount;
    let newStatus = 'partial';
    if (newPaid <= 0) newStatus = 'refunded'; 
    else if (newPaid >= bill.total_amount) newStatus = 'paid';
    db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);
    db.prepare(`INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description) VALUES ('expense', 'Refund', ?, ?, ?, ?, ?, ?)`).run(amount, method || 'Cash', id, JSON.stringify({ reason }), date || new Date().toISOString(), `Refund for Bill #${bill.bill_number}: ${reason}`);
  });
  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getTransactions = (req, res) => {
  try {
    const transactions = db.prepare('SELECT * FROM transactions ORDER BY date DESC').all();
    res.json(transactions.map(t => {
      let details = {};
      try { details = JSON.parse(t.details); } catch(e) {}
      return { ...t, details };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addExpense = (req, res) => {
  const { category, amount, method, description, date } = req.body;
  try {
    const info = db.prepare(`INSERT INTO transactions (type, category, amount, method, date, description) VALUES ('expense', ?, ?, ?, ?, ?)`).run(category, amount, method, date || new Date().toISOString(), description);
    res.json({ id: info.lastInsertRowid, success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.updateExpense = (req, res) => {
  const { id } = req.params;
  const { category, amount, method, description, date } = req.body;
  try {
    const result = db.prepare(`UPDATE transactions SET category = ?, amount = ?, method = ?, date = ?, description = ? WHERE id = ? AND type = 'expense'`).run(category, amount, method, date, description, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Expense record not found or not editable' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
};