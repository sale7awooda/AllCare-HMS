const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const patients = db.prepare('SELECT id, patient_id as patientId, full_name as fullName, phone, address, age, gender, type, has_insurance as hasInsurance, created_at as createdAt FROM patients ORDER BY created_at DESC').all();
  // Convert 1/0 to boolean for hasInsurance
  res.json(patients.map(p => ({ ...p, hasInsurance: !!p.hasInsurance })));
};

exports.create = (req, res) => {
  const { 
    fullName, phone, address, age, gender, type,
    symptoms, medicalHistory, allergies, bloodGroup,
    emergencyContact, hasInsurance, insuranceDetails
  } = req.body;

  const patientId = `PAT-${new Date().getFullYear()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // Serialize complex objects to JSON for SQLite storage
  const emergencyJson = emergencyContact ? JSON.stringify(emergencyContact) : null;
  const insuranceJson = insuranceDetails ? JSON.stringify(insuranceDetails) : null;
  const hasInsuranceInt = hasInsurance ? 1 : 0;

  try {
    const info = db.prepare(`
      INSERT INTO patients (
        patient_id, full_name, phone, address, age, gender, type,
        symptoms, medical_history, allergies, blood_group,
        emergency_contacts, has_insurance, insurance_details
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      patientId, fullName, phone, address, age, gender, type,
      symptoms || null, medicalHistory || null, allergies || null, bloodGroup || null,
      emergencyJson, hasInsuranceInt, insuranceJson
    );
    
    res.status(201).json({ id: info.lastInsertRowid, patientId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getOne = (req, res) => {
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  
  // Parse JSON fields
  try {
    patient.emergency_contacts = JSON.parse(patient.emergency_contacts);
    patient.insurance_details = JSON.parse(patient.insurance_details);
    patient.has_insurance = !!patient.has_insurance;
  } catch (e) {
    // Ignore parsing errors
  }

  res.json(patient);
};