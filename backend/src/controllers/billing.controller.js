
const { getDb } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const db = getDb();
    const bills = await db.all(`
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
    `);

    const billsWithItems = await Promise.all(bills.map(async (bill) => {
      const items = await db.all('SELECT description, amount FROM billing_items WHERE billing_id = ?', [bill.id]);
      return { ...bill, items };
    }));

    res.json(billsWithItems);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req, res) => {
  const { patientId, totalAmount, items } = req.body;
  const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    
    // Explicitly set bill_date to avoid any potential NULLs
    const result = await db.run(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `, [billNumber, patientId, totalAmount]);

    const billId = result.lastID;
    for (const item of items) {
      await db.run('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)', [billId, item.description, item.amount]);
    }
    
    await db.exec('COMMIT');
    res.status(201).json({ id: billId, billNumber, ...req.body, date: new Date().toISOString() });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
};

exports.recordPayment = async (req, res) => {
  const { amount, method, details, date } = req.body;
  const { id } = req.params;

  try {
    const db = getDb();
    const bill = await db.get('SELECT total_amount, paid_amount, bill_number FROM billing WHERE id = ?', [id]);
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const newPaid = bill.paid_amount + amount;
    const newStatus = newPaid >= bill.total_amount - 0.01 ? 'paid' : 'partial';

    await db.exec('BEGIN TRANSACTION');
    await db.run('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, id]);

    await db.run(`
      INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description)
      VALUES ('income', 'Bill Payment', ?, ?, ?, ?, ?, ?)
    `, [amount, method, id, JSON.stringify(details || {}), date || new Date().toISOString(), `Payment for Bill #${bill.bill_number}`]);

    if (newStatus === 'paid') {
      await db.run("UPDATE appointments SET billing_status = 'paid' WHERE bill_id = ?", [id]);
      await db.run("UPDATE appointments SET status = 'confirmed' WHERE bill_id = ? AND status = 'pending'", [id]);
      await db.run("UPDATE lab_requests SET status = 'confirmed' WHERE bill_id = ?", [id]);
      await db.run("UPDATE operations SET status = 'confirmed' WHERE bill_id = ?", [id]);
      const adm = await db.get("SELECT * FROM admissions WHERE bill_id = ?", [id]);
      if (adm) {
        await db.run("UPDATE admissions SET status = 'active' WHERE id = ?", [adm.id]);
        await db.run("UPDATE beds SET status = 'occupied' WHERE id = ?", [adm.bed_id]);
        await db.run("UPDATE patients SET type = 'inpatient' WHERE id = ?", [adm.patient_id]);
      }
      const paidBillDetails = await db.get("SELECT is_settlement_bill, settlement_for_patient_id FROM billing WHERE id = ?", [id]);
      if (paidBillDetails && paidBillDetails.is_settlement_bill) {
          const patientId = paidBillDetails.settlement_for_patient_id;
          await db.run(`UPDATE billing SET status = 'paid', paid_amount = total_amount WHERE patient_id = ? AND id != ? AND status IN ('pending', 'partial')`, [patientId, id]);
      }
    }
    await db.exec('COMMIT');
    res.json({ status: newStatus, paidAmount: newPaid });
  } catch(e) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
};

exports.cancelService = async (req, res) => {
  const { id } = req.params;
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    await db.run("UPDATE appointments SET status = 'cancelled' WHERE bill_id = ?", [id]);
    await db.run("UPDATE lab_requests SET status = 'cancelled' WHERE bill_id = ?", [id]);
    
    // Ensure the bill status is also updated to cancelled
    await db.run("UPDATE billing SET status = 'cancelled' WHERE id = ?", [id]);
    
    const op = await db.get("SELECT id FROM operations WHERE bill_id = ?", [id]);
    if (op) {
        await db.run("UPDATE operations SET status = 'cancelled' WHERE id = ?", [op.id]);
        // Decline linked 'extra' adjustments
        await db.run("UPDATE hr_financials SET status = 'declined' WHERE reference_id = ? AND type = 'extra'", [op.id]);
    }

    const adm = await db.get("SELECT * FROM admissions WHERE bill_id = ?", [id]);
    if (adm) {
        await db.run("UPDATE admissions SET status = 'cancelled' WHERE id = ?", [adm.id]);
        await db.run("UPDATE beds SET status = 'available' WHERE id = ?", [adm.bed_id]);
    }
    await db.exec('COMMIT');
    res.json({ success: true });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};

exports.processRefund = async (req, res) => {
  const { id } = req.params;
  const { amount, reason, date, method } = req.body;
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    const bill = await db.get('SELECT * FROM billing WHERE id = ?', [id]);
    if (!bill) throw new Error('Bill not found');
    if (amount > bill.paid_amount) throw new Error('Refund amount exceeds paid amount');
    const newPaid = bill.paid_amount - amount;
    let newStatus = 'partial';
    if (newPaid <= 0) newStatus = 'refunded'; 
    else if (newPaid >= bill.total_amount) newStatus = 'paid';
    await db.run('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, id]);
    await db.run(`INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description) VALUES ('expense', 'Refund', ?, ?, ?, ?, ?, ?)`, [amount, method || 'Cash', id, JSON.stringify({ reason }), date || new Date().toISOString(), `Refund for Bill #${bill.bill_number}: ${reason}`]);
    await db.exec('COMMIT');
    res.json({ success: true });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(400).json({ error: err.message });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const db = getDb();
    const transactions = await db.all('SELECT * FROM transactions ORDER BY date DESC');
    res.json(transactions.map(t => {
      let details = {};
      try { details = JSON.parse(t.details); } catch(e) {}
      return { ...t, details };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addExpense = async (req, res) => {
  const { category, amount, method, description, date } = req.body;
  try {
    const db = getDb();
    const result = await db.run(`INSERT INTO transactions (type, category, amount, method, date, description) VALUES ('expense', ?, ?, ?, ?, ?)`, [category, amount, method, date || new Date().toISOString(), description]);
    res.json({ id: result.lastID, success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
};

exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { category, amount, method, description, date } = req.body;
  try {
    const db = getDb();
    const result = await db.run(`UPDATE transactions SET category = ?, amount = ?, method = ?, date = ?, description = ? WHERE id = ? AND type = 'expense'`, [category, amount, method, date, description, id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Expense record not found or not editable' });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
};
