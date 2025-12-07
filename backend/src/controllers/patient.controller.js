const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const patients = db.prepare('SELECT id, patient_id as patientId, full_name as fullName, phone, address, age, gender, type, created_at as createdAt FROM patients ORDER BY created_at DESC').all();
  res.json(patients);
};

exports.create = (req, res) => {
  const { fullName, phone, address, age, gender, type } = req.body;
  const patientId = `PAT-${new Date().getFullYear()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  try {
    const info = db.prepare(`
      INSERT INTO patients (patient_id, full_name, phone, address, age, gender, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(patientId, fullName, phone, address, age, gender, type);
    
    res.status(201).json({ id: info.lastInsertRowid, patientId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getOne = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
};