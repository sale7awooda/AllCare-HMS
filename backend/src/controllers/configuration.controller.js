const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// --- SYSTEM HEALTH ---
exports.getSystemHealth = async (req, res) => {
  try {
    const db = getDb();
    const start = process.hrtime();
    await db.get('SELECT 1');
    const diff = process.hrtime(start);
    const dbLatency = (diff[0] * 1e9 + diff[1]) / 1e6; // ms

    const memory = process.memoryUsage();
    
    res.json({
      status: 'operational',
      serverTime: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        connected: true,
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
exports.getSettings = async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all('SELECT * FROM system_settings');
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPublicSettings = async (req, res) => {
  try {
    const db = getDb();
    const rows = await db.all("SELECT * FROM system_settings WHERE key IN ('hospitalName', 'hospitalAddress', 'hospitalPhone')");
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateSettings = async (req, res) => {
  const updates = req.body;
  
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    for (const [key, value] of Object.entries(updates)) {
      await db.run('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
    await db.exec('COMMIT');
    res.json({ message: 'Settings updated' });
  } catch (err) {
    const db = getDb();
    await db.exec('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
};

// --- USER MANAGEMENT ---
exports.getUsers = async (req, res) => {
  try {
    const db = getDb();
    const users = await db.all('SELECT id, username, full_name, role, email, is_active FROM users ORDER BY username');
    const mappedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      email: u.email || '',
      is_active: !!u.is_active, 
    }));
    res.json(mappedUsers);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addUser = async (req, res) => {
  const { username, password, fullName, role, email, isActive } = req.body;
  if (!username || !password || !fullName || !role) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const db = getDb();
    const hash = await bcrypt.hash(password, 10);
    const result = await db.run('INSERT INTO users (username, password, full_name, role, email, is_active) VALUES (?, ?, ?, ?, ?, ?)', [username, hash, fullName, role, email || null, isActive ? 1 : 0]);
    res.status(201).json({ id: result.lastID, username, fullName, role, email });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) return res.status(409).json({ error: 'Username already exists' });
    res.status(400).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { fullName, role, email, password, isActive } = req.body;
  try {
    const db = getDb();
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.run('UPDATE users SET full_name = ?, role = ?, email = ?, is_active = ?, password = ? WHERE id = ?', [fullName, role, email || null, isActive ? 1 : 0, hash, id]);
    } else {
      await db.run('UPDATE users SET full_name = ?, role = ?, email = ?, is_active = ? WHERE id = ?', [fullName, role, email || null, isActive ? 1 : 0, id]);
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.deleteUser = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- ROLE PERMISSIONS ---
exports.getRolePermissions = async (req, res) => {
  try {
    const db = getDb();
    const roles = await db.all('SELECT * FROM role_permissions');
    const permissionsMap = roles.reduce((acc, r) => {
      try { acc[r.role] = JSON.parse(r.permissions); } catch (e) { acc[r.role] = []; }
      return acc;
    }, {});
    res.json(permissionsMap);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateRolePermissions = async (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;
  try {
    const db = getDb();
    await db.run('INSERT OR REPLACE INTO role_permissions (role, permissions) VALUES (?, ?)', [role, JSON.stringify(permissions)]);
    res.json({ message: 'Permissions updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- DEPARTMENTS ---
exports.getDepartments = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT * FROM departments ORDER BY name_en'));
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addDepartment = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO departments (name_en, name_ar, description_en, description_ar) VALUES (?, ?, ?, ?)', [name_en, name_ar, description_en || '', description_ar || '']);
    res.status(201).json({ id: result.lastID, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateDepartment = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE departments SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ? WHERE id = ?', [name_en, name_ar, description_en, description_ar, req.params.id]);
    res.json({ message: 'Department updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteDepartment = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- SPECIALIZATIONS ---
exports.getSpecializations = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT * FROM specializations ORDER BY name_en'));
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addSpecialization = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar, related_role } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO specializations (name_en, name_ar, description_en, description_ar, related_role) VALUES (?, ?, ?, ?, ?)', [name_en, name_ar, description_en || '', description_ar || '', related_role || null]);
    res.status(201).json({ id: result.lastID, ...req.body });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateSpecialization = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar, related_role } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE specializations SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ?, related_role = ? WHERE id = ?', [name_en, name_ar, description_en, description_ar, related_role || null, req.params.id]);
    res.json({ message: 'Specialization updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteSpecialization = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM specializations WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- BEDS ---
exports.getBeds = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT id, room_number as roomNumber, type, status, cost_per_day as costPerDay FROM beds ORDER BY room_number'));
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addBed = async (req, res) => {
  const { roomNumber, type, costPerDay } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO beds (room_number, type, cost_per_day, status) VALUES (?, ?, ?, ?)', [roomNumber, type, costPerDay, 'available']);
    res.status(201).json({ id: result.lastID });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateBed = async (req, res) => {
  const { roomNumber, type, costPerDay, status } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE beds SET room_number = ?, type = ?, cost_per_day = ?, status = ? WHERE id = ?', [roomNumber, type, costPerDay, status, req.params.id]);
    res.json({ message: 'Bed updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteBed = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM beds WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- CATALOGS ---
exports.getLabTests = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT * FROM lab_tests ORDER BY name_en'));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addLabTest = async (req, res) => {
  const { name_en, name_ar, category_en, category_ar, cost, normal_range } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO lab_tests (name_en, name_ar, category_en, category_ar, cost, normal_range) VALUES (?, ?, ?, ?, ?, ?)', [name_en, name_ar, category_en, category_ar, cost, normal_range || null]);
    res.status(201).json({ id: result.lastID });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateLabTest = async (req, res) => {
  const { name_en, name_ar, category_en, category_ar, cost, normal_range } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE lab_tests SET name_en = ?, name_ar = ?, category_en = ?, category_ar = ?, cost = ?, normal_range = ? WHERE id = ?', [name_en, name_ar, category_en, category_ar, cost, normal_range || null, req.params.id]);
    res.json({ message: 'Lab test updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteLabTest = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM lab_tests WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getNurseServices = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT * FROM nurse_services ORDER BY name_en'));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addNurseService = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar, cost } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO nurse_services (name_en, name_ar, description_en, description_ar, cost) VALUES (?, ?, ?, ?, ?)', [name_en, name_ar, description_en, description_ar, cost]);
    res.status(201).json({ id: result.lastID });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateNurseService = async (req, res) => {
  const { name_en, name_ar, description_en, description_ar, cost } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE nurse_services SET name_en = ?, name_ar = ?, description_en = ?, description_ar = ?, cost = ? WHERE id = ?', [name_en, name_ar, description_en, description_ar, cost, req.params.id]);
    res.json({ message: 'Nurse service updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteNurseService = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM nurse_services WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getOperations = async (req, res) => {
  try {
    const db = getDb();
    res.json(await db.all('SELECT * FROM operations_catalog ORDER BY name_en'));
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addOperation = async (req, res) => {
  const { name_en, name_ar, base_cost } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO operations_catalog (name_en, name_ar, base_cost) VALUES (?, ?, ?)', [name_en, name_ar, base_cost]);
    res.status(201).json({ id: result.lastID });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.updateOperation = async (req, res) => {
  const { name_en, name_ar, base_cost } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE operations_catalog SET name_en = ?, name_ar = ?, base_cost = ? WHERE id = ?', [name_en, name_ar, base_cost, req.params.id]);
    res.json({ message: 'Operation updated' });
  } catch (err) { res.status(400).json({ error: err.message }); }
};
exports.deleteOperation = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM operations_catalog WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getInsuranceProviders = async (req, res) => {
  try {
    const db = getDb();
    const providers = await db.all('SELECT id, name_en, name_ar, is_active as isActive FROM insurance_providers');
    res.json(providers.map(p => ({...p, isActive: !!p.isActive})));
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addInsuranceProvider = async (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO insurance_providers (name_en, name_ar, is_active) VALUES (?, ?, ?)', [name_en, name_ar, is_active ? 1 : 0]);
    res.json({ id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateInsuranceProvider = async (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE insurance_providers SET name_en = ?, name_ar = ?, is_active = ? WHERE id = ?', [name_en, name_ar, is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteInsuranceProvider = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM insurance_providers WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};

// --- FINANCIAL CONFIG (TAXES & PAYMENT METHODS) ---
exports.getTaxRates = async (req, res) => {
  try {
    const db = getDb();
    const rates = await db.all('SELECT id, name_en, name_ar, rate, is_active as isActive FROM tax_rates');
    res.json(rates.map(t => ({...t, isActive: !!t.isActive})));
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};
exports.addTaxRate = async (req, res) => {
  const { name_en, name_ar, rate, is_active } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO tax_rates (name_en, name_ar, rate, is_active) VALUES (?, ?, ?, ?)', [name_en, name_ar, rate, is_active ? 1 : 0]);
    res.json({ id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updateTaxRate = async (req, res) => {
  const { name_en, name_ar, rate, is_active } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE tax_rates SET name_en = ?, name_ar = ?, rate = ?, is_active = ? WHERE id = ?', [name_en, name_ar, rate, is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deleteTaxRate = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM tax_rates WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getPaymentMethods = async (req, res) => {
  try { 
    const db = getDb();
    const rows = await db.all('SELECT id, name_en, name_ar, is_active FROM payment_methods');
    res.json(rows.map(p => ({
      id: p.id,
      name_en: p.name_en,
      name_ar: p.name_ar,
      isActive: !!p.is_active
    }))); 
  } 
  catch (err) { res.status(500).json({ error: err.message }); }
};

exports.addPaymentMethod = async (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const db = getDb();
    const result = await db.run('INSERT INTO payment_methods (name_en, name_ar, is_active) VALUES (?, ?, ?)', [name_en, name_ar, is_active ? 1 : 0]);
    res.json({ id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.updatePaymentMethod = async (req, res) => {
  const { name_en, name_ar, is_active } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE payment_methods SET name_en = ?, name_ar = ?, is_active = ? WHERE id = ?', [name_en, name_ar, is_active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
exports.deletePaymentMethod = async (req, res) => {
  try {
    const db = getDb();
    await db.run('DELETE FROM payment_methods WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  }
  catch (err) { res.status(500).json({ error: err.message }); }
};


// --- DATA MANAGEMENT ---
exports.downloadBackup = (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  if (fs.existsSync(dbPath)) {
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="allcare-backup-${new Date().toISOString().split('T')[0]}.db"`);
    res.download(dbPath);
  } else {
    res.status(404).json({ error: 'Database file not found' });
  }
};

exports.restoreBackup = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  
  const validExtensions = ['.db', '.sqlite', '.sqlite3'];
  const ext = path.extname(req.file.originalname).toLowerCase();
  
  if (!validExtensions.includes(ext)) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
      return res.status(400).json({ error: 'Invalid file type. Only SQLite database files allowed.' });
  }

  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  
  try {
    // 1. Close current connection handle to release locks
    try { 
      const db = getDb();
      await db.close(); 
    } catch(e) {}
    
    // 2. Perform file overwrite
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlinkSync(req.file.path);
    
    // 3. Send success response before process exits
    res.json({ message: 'Database restored successfully. System is restarting...' });
    
    // 4. Force process exit to trigger automatic restart with fresh file handles
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
};

exports.resetDatabase = async (req, res) => {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../allcare.db');
  
  try {
    // 1. Close current connection handle to release locks
    try { 
      const db = getDb();
      await db.close(); 
    } catch(e) {}
    
    // 2. Delete the active database file
    if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
    }
    
    // 3. Respond
    res.json({ message: 'Database has been reset. System is restarting...' });
    
    // 4. Exit. initDB() in server.js will recreate the file on next boot
    setTimeout(() => process.exit(0), 500);
  } catch (err) {
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Failed to reset database.' });
  }
};
