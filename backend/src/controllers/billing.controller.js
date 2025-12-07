const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const bills = db.prepare(`
    SELECT 
      b.id, b.bill_number as billNumber, b.total_amount as totalAmount, 
      b.paid_amount as paidAmount, b.status, b.bill_date as date,
      p.full_name as patientName, p.id as patientId
    FROM billing b
    JOIN patients p ON b.patient_id = p.id
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
  const billNumber = `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`;

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
  const { amount } = req.body;
  const { id } = req.params;

  const bill = db.prepare('SELECT total_amount, paid_amount FROM billing WHERE id = ?').get(id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const newPaid = bill.paid_amount + amount;
  const newStatus = newPaid >= bill.total_amount ? 'paid' : 'partial';

  db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);
  res.json({ status: newStatus, paidAmount: newPaid });
};