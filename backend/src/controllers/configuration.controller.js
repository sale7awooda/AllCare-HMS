
const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// --- SYSTEM SETTINGS ---
exports.getSettings = (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM system_settings').all();
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateSettings = (req, res) => {
  const updates = req.body;
  const updateStmt = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');
  
  const dbTransaction = db.transaction(() => {
    Object.entries(updates).forEach(([key, value]) => {
      updateStmt.run(key, String(value));
    });
  });

  try {
    dbTransaction();
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- USER MANAGEMENT ---
exports.getUsers = (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, full_name, role, email, is_active, created_at FROM users ORDER BY full_name').all();
    res.json(users.map(u => ({ ...u, is_active: !!u.is_active })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addUser = (req, res) => {
  const { username, password, fullName, role, email, isActive } = req.body;
  if (!username || !password || !fullName || !role) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, full_name, role, email, is_active) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(username, hash, fullName, role, email || null, isActive ? 1 : 0);
    res.status(201).json({ id: info.lastInsertRowid, username, fullName, role, email });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Username already exists' });
    res.status(400).json({ error: err.message });
  }
};

exports.updateUser = (req, res) => {
  const { id } = req.params;
  const { fullName, role, email, password, isActive } = req.body;
  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET full_name = ?, role = ?, email = ?, is_active = ?, password = ? WHERE id = ?').run(fullName, role, email || null, isActive ? 1 : 0, hash, id);
    } else {
      db.prepare('UPDATE users SET full_name = ?, role = ?, email = ?, is_active = ? WHERE id = ?').run(fullName, role, email || null, isActive ? 1 : 0, id);
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteUser = (req, res) => {
  try { db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- FINANCIAL CONFIG (TAXES & PAYMENT METHODS) ---
exports.getTaxRates = (req, res) => {
  try { res.json(db.prepare('SELECT id, name, rate, is_active as isActive FROM tax_rates').all().map(t => ({...t, isActive: !!t.isActive}))); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addTaxRate = (req, res) => {
  const { name, rate, isActive } = req.body;
  try {
    const info = db.prepare('INSERT INTO tax_rates (name, rate, is_active) VALUES (?, ?, ?)').run(name, rate, isActive ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateTaxRate = (req, res) => {
  const { name, rate, isActive } = req.body;
  try {
    db.prepare('UPDATE tax_rates SET name = ?, rate = ?, is_active = ? WHERE id = ?').run(name, rate, isActive ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteTaxRate = (req, res) => {
  try { db.prepare('DELETE FROM tax_rates WHERE id = ?').run(req.params.id); res.sendStatus(200); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPaymentMethods = (req, res) => {
  try { res.json(db.prepare('SELECT id, name, is_active as isActive FROM payment_methods').all().map(p => ({...p, isActive: !!p.isActive}))); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addPaymentMethod = (req, res) => {
  const { name, isActive } = req.body;
  try {
    const info = db.prepare('INSERT INTO payment_methods (name, is_active) VALUES (?, ?)').run(name, isActive ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updatePaymentMethod = (req, res) => {
  const { name, isActive } = req.body;
  try {
    db.prepare('UPDATE payment_methods SET name = ?, is_active = ? WHERE id = ?').run(name, isActive ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deletePaymentMethod = (req, res) => {
  try { db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id); res.sendStatus(200); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- DEPARTMENTS ---
exports.getDepartments = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM departments ORDER BY name').all()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addDepartment = (req, res) => {
  const { name, description } = req.body;
  try {
    const info = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, description || '');
    res.status(201).json({ id: info.lastInsertRowid, name, description });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateDepartment = (req, res) => {
  const { name, description } = req.body;
  try {
    db.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?').run(name, description, req.params.id);
    res.json({ message: 'Department updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteDepartment = (req, res) => {
  try { db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- BEDS ---
exports.getBeds = (req, res) => {
  try { res.json(db.prepare('SELECT id, room_number as roomNumber, type, status, cost_per_day as costPerDay FROM beds ORDER BY room_number').all()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addBed = (req, res) => {
  const { roomNumber, type, costPerDay } = req.body;
  try {
    const info = db.prepare('INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, ?)').run(roomNumber, type, costPerDay, 'available');
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateBed = (req, res) => {
  const { roomNumber, type, costPerDay, status } = req.body;
  try {
    db.prepare('UPDATE beds SET room_number = ?, type = ?, cost_per_day = ?, status = ? WHERE id = ?').run(roomNumber, type, costPerDay, status, req.params.id);
    res.json({ message: 'Bed updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteBed = (req, res) => {
  try { db.prepare('DELETE FROM beds WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- CATALOG MANAGEMENT ---
exports.addLabTest = (req, res) => {
  const { name, category, cost, normalRange } = req.body;
  try {
    const info = db.prepare('INSERT INTO lab_tests (name, category, cost, normal_range) VALUES (?, ?, ?, ?)').run(name, category, cost, normalRange || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateLabTest = (req, res) => {
  const { name, category, cost, normalRange } = req.body;
  try {
    db.prepare('UPDATE lab_tests SET name = ?, category = ?, cost = ?, normal_range = ? WHERE id = ?').run(name, category, cost, normalRange || null, req.params.id);
    res.json({ message: 'Lab test updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteLabTest = (req, res) => {
  try { db.prepare('DELETE FROM lab_tests WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addNurseService = (req, res) => {
  const { name, description, cost } = req.body;
  try {
    const info = db.prepare('INSERT INTO nurse_services (name, description, cost) VALUES (?, ?, ?)').run(name, description, cost);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateNurseService = (req, res) => {
  const { name, description, cost } = req.body;
  try {
    db.prepare('UPDATE nurse_services SET name = ?, description = ?, cost = ? WHERE id = ?').run(name, description, cost, req.params.id);
    res.json({ message: 'Nurse service updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteNurseService = (req, res) => {
  try { db.prepare('DELETE FROM nurse_services WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addOperation = (req, res) => {
  const { name, baseCost } = req.body;
  try {
    const info = db.prepare('INSERT INTO operations_catalog (name, base_cost) VALUES (?, ?)').run(name, baseCost);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateOperation = (req, res) => {
  const { name, baseCost } = req.body;
  try {
    db.prepare('UPDATE operations_catalog SET name = ?, base_cost = ? WHERE id = ?').run(name, baseCost, req.params.id);
    res.json({ message: 'Operation updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteOperation = (req, res) => {
  try { db.prepare('DELETE FROM operations_catalog WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- DATA MANAGEMENT ---
exports.downloadBackup = (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  if (fs.existsSync(dbPath)) res.download(dbPath, `allcare-backup-${new Date().toISOString().split('T')[0]}.db`);
  else res.status(404).json({ error: 'Database file not found' });
};

exports.restoreBackup = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  try {
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Database restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
};
