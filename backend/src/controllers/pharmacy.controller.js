
const { db } = require('../config/database');

exports.getInventory = (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM pharmacy_inventory ORDER BY name').all();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addInventory = (req, res) => {
  const { name, genericName, category, stock, unitPrice, expiryDate, batch } = req.body;
  try {
    const info = db.prepare(`
      INSERT INTO pharmacy_inventory (name, generic_name, category, stock_level, unit_price, expiry_date, batch_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, genericName, category, stock, unitPrice, expiryDate, batch);
    res.status(201).json({ id: info.lastInsertRowid, success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateInventory = (req, res) => {
  const { id } = req.params;
  const { name, genericName, category, stock, unitPrice, expiryDate, batch } = req.body;
  try {
    db.prepare(`
      UPDATE pharmacy_inventory 
      SET name = ?, generic_name = ?, category = ?, stock_level = ?, unit_price = ?, expiry_date = ?, batch_number = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, genericName, category, stock, unitPrice, expiryDate, batch, id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteInventory = (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM pharmacy_inventory WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.dispense = (req, res) => {
  const { patientId, items, paymentMethod } = req.body; // items: [{id, quantity, price}]
  
  const tx = db.transaction(() => {
    // 1. Validate Stock & Calculate Total
    let totalAmount = 0;
    const billItems = [];

    for (const item of items) {
        const drug = db.prepare('SELECT * FROM pharmacy_inventory WHERE id = ?').get(item.id);
        if (!drug) throw new Error(`Drug ID ${item.id} not found.`);
        if (drug.stock_level < item.quantity) throw new Error(`Insufficient stock for ${drug.name}.`);
        
        // Deduct Stock
        db.prepare('UPDATE pharmacy_inventory SET stock_level = stock_level - ? WHERE id = ?').run(item.quantity, item.id);
        
        const lineTotal = drug.unit_price * item.quantity;
        totalAmount += lineTotal;
        billItems.push({ description: `${drug.name} x${item.quantity}`, amount: lineTotal });
    }

    // 2. Create Bill
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    const billStatus = paymentMethod ? 'paid' : 'pending';
    const paidAmount = paymentMethod ? totalAmount : 0;

    const billInfo = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, paid_amount, status, bill_date)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(billNumber, patientId, totalAmount, paidAmount, billStatus);

    const billId = billInfo.lastInsertRowid;

    const itemStmt = db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)');
    for (const bi of billItems) {
        itemStmt.run(billId, bi.description, bi.amount);
    }

    // 3. Record Transaction if paid
    if (paymentMethod) {
        db.prepare(`
            INSERT INTO transactions (type, category, amount, method, reference_id, date, description)
            VALUES ('income', 'Pharmacy Sales', ?, ?, ?, datetime('now'), ?)
        `).run(totalAmount, paymentMethod, billId, `Pharmacy Sale - Bill #${billNumber}`);
    }

    return { billId, billNumber, totalAmount };
  });

  try {
    const result = tx();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
