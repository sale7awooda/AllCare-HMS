
const { db, initDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// --- SYSTEM HEALTH ---
exports.getSystemHealth = (req, res) => {
  try {
    const start = process.hrtime();
    const dbStatus = db.prepare('SELECT 1').get();
    const diff = process.hrtime(start);
    const dbLatency = (diff[0] * 1e9 + diff[1]) / 1e6; // ms

    const memory = process.memoryUsage();
    
    res.json({
      status: 'operational',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: !!dbStatus,
        latency: `${dbLatency.toFixed(2)}ms`,
        engine: 'SQLite3'
      },
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
      },
      version: '1.0.0'
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      database: { connected: false },
      error: err.message 
    });
  }
};

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

exports.getPublicSettings = (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM system_settings WHERE key IN ('hospitalName', 'hospitalAddress', 'hospitalPhone')").all();
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
    const users = db.prepare('SELECT id, username, full_name, role, email, is_active FROM users ORDER BY username').all();
    const mappedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      email: u.email || '',
      isActive: !!u.is_active, 
    }));
    res.json(mappedUsers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addUser = async (req, res) => {
  const { username, password, fullName, role, email, isActive } = req.body;
  if (!username || !password || !fullName || !role) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, full_name, role, email, is_active) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(username, hash, fullName, role, email || null, isActive ? 1 : 0);
    res.status(201).json({ id: info.lastInsertRowid, username, fullName, role, email });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Username already exists' });
    res.status(400).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, role, email, password, isActive } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
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

// --- ROLE PERMISSIONS ---
exports.getRolePermissions = (req, res) => {
  try {
    const roles = db.prepare('SELECT * FROM role_permissions').all();
    const permissionsMap = roles.reduce((acc, r) => {
      try { acc[r.role] = JSON.parse(r.permissions); } catch (e) { acc[r.role] = []; }
      return acc;
    }, {});
    res.json(permissionsMap);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateRolePermissions = (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;
  try {
    db.prepare('INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)').run(role, JSON.stringify(permissions));
    res.json({ message: 'Permissions updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- DEPARTMENTS ---
exports.getDepartments = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM departments ORDER BY name_en').all()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addDepartment = (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    const info = db.prepare('INSERT INTO departments (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)').run(name_en, name_ar, description_en || '', description_ar || '');
    res.status(201).json({ id: info.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateDepartment = (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    db.prepare('UPDATE departments SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ? WHERE id = ?').run(name_en, name_ar, description_en, description_ar, req.params.id);
    res.json({ message: 'Department updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteDepartment = (req, res) => {
  try { db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- SPECIALIZATIONS ---
exports.getSpecializations = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM specializations ORDER BY name_en').all()); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addSpecialization = (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    const info = db.prepare('INSERT INTO specializations (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)').run(name_en, name_ar, description_en || '', description_ar || '');
    res.status(201).json({ id: info.lastInsertRowid, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateSpecialization = (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    db.prepare('UPDATE specializations SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ? WHERE id = ?').run(name_en, name_ar, description_en, description_ar, req.params.id);
    res.json({ message: 'Specialization updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteSpecialization = (req, res) => {
  try { db.prepare('DELETE FROM specializations WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
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

// --- CATALOGS ---
exports.getLabTests = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM lab_tests ORDER BY name_en').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addLabTest = (req, res) => {
  const { name_en, name_ar, category_en, category_ar, cost, normal_range } = req.body;
  try {
    const info = db.prepare('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost, normal_range) VALUES (?, ?, ?, ?, ?, ?)').run(name_en, name_ar, category_en, category_ar, cost, normal_range || null);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateLabTest = (req, res) => {
  const { name_en, name_ar, category_en, category_ar, cost, normal_range } = req.body;
  try {
    db.prepare('UPDATE lab_tests SET name_en = ?, name_ar = ?, category_en = ?, category_ar = ?, cost = ?, normal_range = ? WHERE id = ?').run(name_en, name_ar, category_en, category_ar, cost, normal_range || null, req.params.id);
    res.json({ message: 'Lab test updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteLabTest = (req, res) => {
  try { db.prepare('DELETE FROM lab_tests WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getNurseServices = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM nurse_services ORDER BY name_en').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addNurseService = (req, res) => {
  const { name_en, name_ar, description_en, description_ar, cost } = req.body;
  try {
    const info = db.prepare('INSERT INTO nurse_services (name_en, name_ar, description_en, description_ar, cost) VALUES (?, ?, ?, ?, ?)').run(name_en, name_ar, description_en, description_ar, cost);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateNurseService = (req, res) => {
  const { name_en, name_ar, description_en, description_ar, cost } = req.body;
  try {
    db.prepare('UPDATE nurse_services SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ?, cost = ? WHERE id = ?').run(name_en, name_ar, description_en, description_ar, cost, req.params.id);
    res.json({ message: 'Nurse service updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteNurseService = (req, res) => {
  try { db.prepare('DELETE FROM nurse_services WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOperations = (req, res) => {
  try { res.json(db.prepare('SELECT * FROM operations_catalog ORDER BY name_en').all()); }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addOperation = (req, res) => {
  const { name_en, name_ar, base_cost } = req.body;
  try {
    const info = db.prepare('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)').run(name_en, name_ar, base_cost);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateOperation = (req, res) => {
  const { name_en, name_ar, base_cost } = req.body;
  try {
    db.prepare('UPDATE operations_catalog SET name_en = ?, name_ar = ?, base_cost = ? WHERE id = ?').run(name_en, name_ar, base_cost, req.params.id);
    res.json({ message: 'Operation updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteOperation = (req, res) => {
  try { db.prepare('DELETE FROM operations_catalog WHERE id = ?').run(req.params.id); res.sendStatus(200); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getInsuranceProviders = (req, res) => {
  try { res.json(db.prepare('SELECT id, name_en, name_ar, is_active as isActive FROM insurance_providers').all().map(p => ({...p, isActive: !!p.isActive}))); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addInsuranceProvider = (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const info = db.prepare('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, ?)').run(name_en, name_ar, is_active ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateInsuranceProvider = (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    db.prepare('UPDATE insurance_providers SET name_en = ?, name_ar = ?, is_active = ? WHERE id = ?').run(name_en, name_ar, is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteInsuranceProvider = (req, res) => {
  try { db.prepare('DELETE FROM insurance_providers WHERE id = ?').run(req.params.id); res.sendStatus(200); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- FINANCIAL CONFIG (TAXES & PAYMENT METHODS) ---
exports.getTaxRates = (req, res) => {
  try { res.json(db.prepare('SELECT id, name_en, name_ar, rate, is_active as isActive FROM tax_rates').all().map(t => ({...t, isActive: !!t.isActive}))); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addTaxRate = (req, res) => {
  const { name_en, name_ar, rate, is_active } = req.body;
  try {
    const info = db.prepare('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)').run(name_en, name_ar, rate, is_active ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateTaxRate = (req, res) => {
  const { name_en, name_ar, rate, is_active } = req.body;
  try {
    db.prepare('UPDATE tax_rates SET name_en = ?, name_ar = ?, rate = ?, is_active = ? WHERE id = ?').run(name_en, name_ar, rate, is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteTaxRate = (req, res) => {
  try { db.prepare('DELETE FROM tax_rates WHERE id = ?').run(req.params.id); res.sendStatus(200); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPaymentMethods = (req, res) => {
  try { res.json(db.prepare('SELECT id, name_en, name_ar, is_active as isActive FROM payment_methods').all().map(p => ({...p, isActive: !!p.isActive}))); } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addPaymentMethod = (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const info = db.prepare('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, ?)').run(name_en, name_ar, is_active ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updatePaymentMethod = (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    db.prepare('UPDATE payment_methods SET name_en = ?, name_ar = ?, is_active = ? WHERE id = ?').run(name_en, name_ar, is_active ? 1 : 0, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deletePaymentMethod = (req, res) => {
  try { db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id); res.sendStatus(200); }
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
  
  const validExtensions = ['.db', '.sqlite', '.sqlite3'];
  const ext = path.extname(req.file.originalname).toLowerCase();
  
  if (!validExtensions.includes(ext)) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ error: 'Invalid file type. Only SQLite database files allowed.' });
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  try {
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Database restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
};

exports.resetDatabase = (req, res) => {
  try {
    initDB(true); // Call with forceReset = true
    res.json({ message: 'Database has been reset to factory state.' });
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Failed to reset database.' });
  }
};
