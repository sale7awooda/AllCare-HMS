
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  try {
    const patients = db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
    
    // Manual mapping to ensure camelCase and handle potential missing columns gracefully
    const mapped = patients.map(p => ({
      id: p.id,
      patientId: p.patient_id,
      fullName: p.full_name,
      phone: p.phone,
      address: p.address,
      age: p.age,
      gender: p.gender,
      type: p.type,
      hasInsurance: !!p.has_insurance,
      createdAt: p.created_at,
      symptoms: p.symptoms,
      medicalHistory: p.medical_history,
      allergies: p.allergies,
      bloodGroup: p.blood_group,
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching patients:', err);
    res.status(500).json({ error: 'Failed to fetch patients list' });
  }
};

exports.create = (req, res) => {
  const { 
    fullName, phone, address, age, gender, type,
    symptoms, medicalHistory, allergies, bloodGroup,
    emergencyContact, hasInsurance, insuranceDetails
  } = req.body;

  const patientId = `PAT-${new Date().getFullYear()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
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
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { 
    fullName, phone, address, age, gender, type,
    symptoms, medicalHistory, allergies, bloodGroup,
    emergencyContact, hasInsurance, insuranceDetails
  } = req.body;

  const emergencyJson = emergencyContact ? JSON.stringify(emergencyContact) : null;
  const insuranceJson = insuranceDetails ? JSON.stringify(insuranceDetails) : null;
  const hasInsuranceInt = hasInsurance ? 1 : 0;

  try {
    const stmt = db.prepare(`
      UPDATE patients SET
        full_name = ?, phone = ?, address = ?, age = ?, gender = ?, type = ?,
        symptoms = ?, medical_history = ?, allergies = ?, blood_group = ?,
        emergency_contacts = ?, has_insurance = ?, insurance_details = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(
      fullName, phone, address, age, gender, type,
      symptoms, medicalHistory, allergies, bloodGroup,
      emergencyJson, hasInsuranceInt, insuranceJson,
      id
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Patient not found' });
    res.json({ message: 'Updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

exports.getOne = (req, res) => {
  try {
    const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    
    let emergencyContact;
    try {
      emergencyContact = patient.emergency_contacts ? JSON.parse(patient.emergency_contacts) : undefined;
    } catch (e) {
      console.error(`Error parsing emergency contacts for patient ${patient.id}:`, e);
      emergencyContact = undefined; 
    }

    let insuranceDetails;
    try {
      insuranceDetails = patient.insurance_details ? JSON.parse(patient.insurance_details) : undefined;
    } catch (e) {
      console.error(`Error parsing insurance details for patient ${patient.id}:`, e);
      insuranceDetails = undefined;
    }

    const formatted = {
      id: patient.id,
      patientId: patient.patient_id,
      fullName: patient.full_name,
      phone: patient.phone,
      address: patient.address,
      age: patient.age,
      gender: patient.gender,
      type: patient.type,
      symptoms: patient.symptoms,
      medicalHistory: patient.medical_history,
      allergies: patient.allergies,
      bloodGroup: patient.blood_group,
      createdAt: patient.created_at,
      hasInsurance: !!patient.has_insurance,
      emergencyContact: emergencyContact,
      insuranceDetails: insuranceDetails,
    };

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
};
