
const { db } = require('../config/database');

// --- SYSTEM SETTINGS ---
exports.getSettings = (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM system_settings').all();
    // Convert array of key-values to a single object
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

// --- DEPARTMENTS ---
exports.getDepartments = (req, res) => {
  try {
    const depts = db.prepare('SELECT * FROM departments ORDER BY name').all();
    res.json(depts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addDepartment = (req, res) => {
  const { name, description } = req.body;
  try {
    const info = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(name, description || '');
    res.status(201).json({ id: info.lastInsertRowid, name, description });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteDepartment = (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
    res.sendStatus(200);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- CATALOG MANAGEMENT (Generic handlers) ---

// Lab Tests
exports.addLabTest = (req, res) => {
  const { name, category, cost } = req.body;
  try {
    const info = db.prepare('INSERT INTO lab_tests (name, category, cost) VALUES (?, ?, ?)').run(name, category, cost);
    res.status(201).json({ id: info.lastInsertRowid, name, category, cost });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteLabTest = (req, res) => {
  try { db.prepare('DELETE FROM lab_tests WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// Nurse Services
exports.addNurseService = (req, res) => {
  const { name, description, cost } = req.body;
  try {
    const info = db.prepare('INSERT INTO nurse_services (name, description, cost) VALUES (?, ?, ?)').run(name, description, cost);
    res.status(201).json({ id: info.lastInsertRowid, name, description, cost });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteNurseService = (req, res) => {
  try { db.prepare('DELETE FROM nurse_services WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// Operations
exports.addOperation = (req, res) => {
  const { name, baseCost } = req.body;
  try {
    const info = db.prepare('INSERT INTO operations_catalog (name, base_cost) VALUES (?, ?)').run(name, baseCost);
    res.status(201).json({ id: info.lastInsertRowid, name, baseCost });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteOperation = (req, res) => {
  try { db.prepare('DELETE FROM operations_catalog WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
