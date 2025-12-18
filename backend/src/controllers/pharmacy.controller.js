
const { db } = require('../config/database');

exports.getInventory = (req, res) => {
  try {
    const meds = db.prepare('SELECT id, name, category, stock, min_stock as minStock, unit_price as unitPrice, expiry_date as expiryDate, manufacturer, sku FROM pharmacy_stock ORDER BY name ASC').all();
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMedicine = (req, res) => {
  const { name, category, stock, minStock, unitPrice, expiryDate, manufacturer, sku } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO pharmacy_stock (name, category, stock, min_stock, unit_price, expiry_date, manufacturer, sku)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, category, stock || 0, minStock || 10, unitPrice || 0, expiryDate, manufacturer, sku);
    res.status(201).json({ id: info.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateMedicine = (req, res) => {
  const { id } = req.params;
  const { name, category, stock, minStock, unitPrice, expiryDate, manufacturer, sku } = req.body;
  try {
    db.prepare(`
      UPDATE pharmacy_stock SET 
        name = ?, category = ?, stock = ?, min_stock = ?, unit_price = ?, expiry_date = ?, manufacturer = ?, sku = ?
      WHERE id = ?
    `).run(name, category, stock, minStock, unitPrice, expiryDate, manufacturer, sku, id);
    res.json({ message: 'Medicine updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.dispense = (req, res) => {
  const { patientId, items, pharmacistId } = req.body; // items: [{ medicineId, quantity }]
  
  const tx = db.transaction(() => {
    let totalBill = 0;
    const billItems = [];
    const patient = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(patientId);

    for (const item of items) {
      const med = db.prepare('SELECT name, unit_price, stock FROM pharmacy_stock WHERE id = ?').get(item.medicineId);
      if (!med || med.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${med?.name || 'item'}`);
      }

      const cost = med.unit_price * item.quantity;
      totalBill += cost;
      billItems.push({ description: `Medication: ${med.name} (Qty: ${item.quantity})`, amount: cost });

      // Update Stock
      db.prepare('UPDATE pharmacy_stock SET stock = stock - ? WHERE id = ?').run(item.quantity, item.medicineId);

      // Record Transaction
      db.prepare(`
        INSERT INTO pharmacy_transactions (patient_id, medicine_id, quantity, total_price, pharmacist_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(patientId, item.medicineId, item.quantity, cost, pharmacistId);
    }

    // Generate Invoice
    const billNumber = `PHARM-${Math.floor(Math.random() * 90000) + 10000}`;
    const billInfo = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date)
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run(billNumber, patientId, totalBill);
    
    const insertBillItem = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
    for (const bItem of billItems) {
      insertBillItem.run(billInfo.lastInsertRowid, bItem.description, bItem.amount);
    }
  });

  try {
    tx();
    res.json({ success: true, message: 'Medications dispensed and billed.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getTransactions = (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT pt.*, p.full_name as patientName, s.name as medicineName, u.full_name as pharmacistName
            FROM pharmacy_transactions pt
            JOIN patients p ON pt.patient_id = p.id
            JOIN pharmacy_stock s ON pt.medicine_id = s.id
            JOIN users u ON pt.pharmacist_id = u.id
            ORDER BY pt.dispensed_at DESC
        `).all();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
