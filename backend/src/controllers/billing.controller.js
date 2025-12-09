
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

  const tx = db.transaction(() => {
    db.prepare('UPDATE billing SET paid_amount = ?, status = ? WHERE id = ?').run(newPaid, newStatus, id);

    if (newStatus === 'paid') {
      // 1. Confirm Appointments
      db.prepare("UPDATE appointments SET status = 'confirmed', billing_status = 'paid' WHERE bill_id = ?").run(id);

      // 2. Confirm Lab Requests
      db.prepare("UPDATE lab_requests SET status = 'confirmed' WHERE bill_id = ?").run(id);

      // 3. Confirm Operations
      db.prepare("UPDATE operations SET status = 'confirmed' WHERE bill_id = ?").run(id);

      // 4. Confirm Admissions (Activate)
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
