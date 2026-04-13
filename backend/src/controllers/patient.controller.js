
const { getDb } = require('../config/database');

exports.getAll = (req, res) => {
  try {
    const db = getDb();
    console.log('[PatientController] Fetching all patients...');
    const patients = db.prepare('SELECT * FROM patients ORDER BY created_at DESC').all();
    console.log(`[PatientController] Found ${patients.length} patients.`);
    
    // Manual mapping to ensure camelCase and handle potential missing columns gracefully
    const mapped = patients.map(p => {
      let emergencyContact, insuranceDetails;
      try { emergencyContact = p.emergency_contacts ? JSON.parse(p.emergency_contacts) : undefined; } catch(e) {}
      try { insuranceDetails = p.insurance_details ? JSON.parse(p.insurance_details) : undefined; } catch(e) {}
      
      return {
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
        emergencyContact,
        insuranceDetails
      };
    });

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

  try {
    const db = getDb();

    // 1. Generate ID Format: P + YY + MM + Incremental
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `P${yy}${mm}`;

    const emergencyJson = emergencyContact ? JSON.stringify(emergencyContact) : null;
    const insuranceJson = insuranceDetails ? JSON.stringify(insuranceDetails) : null;
    const hasInsuranceInt = hasInsurance ? 1 : 0;

    let patientId = '';
    let insertedId = 0;

    const createPatient = db.transaction(() => {
      // Find the latest patient ID that matches the current month's prefix
      const latestPatient = db.prepare(`
        SELECT patient_id 
        FROM patients 
        WHERE patient_id LIKE ? 
        ORDER BY length(patient_id) DESC, patient_id DESC 
        LIMIT 1
      `).get(`${prefix}%`);

      let sequence = 1;
      if (latestPatient && latestPatient.patient_id) {
        // Extract the numeric part after the prefix (P + YY + MM = 5 chars)
        const currentNumPart = latestPatient.patient_id.substring(5);
        const currentSeq = parseInt(currentNumPart, 10);
        if (!isNaN(currentSeq)) {
          sequence = currentSeq + 1;
        }
      }

      // Pad sequence to at least 2 digits (e.g., 01, 05, 10, 100)
      patientId = `${prefix}${String(sequence).padStart(2, '0')}`;
      
      const result = db.prepare(`
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

      insertedId = result.lastInsertRowid;
    });

    createPatient();

    console.log(`[PatientController] Patient created with ID: ${insertedId}, PatientID: ${patientId}`);
    res.status(201).json({ id: insertedId, patientId, ...req.body });
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
    const db = getDb();
    const result = db.prepare(`
      UPDATE patients SET
        full_name = ?, phone = ?, address = ?, age = ?, gender = ?, type = ?,
        symptoms = ?, medical_history = ?, allergies = ?, blood_group = ?,
        emergency_contacts = ?, has_insurance = ?, insurance_details = ?
      WHERE id = ?
    `).run(
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
    const db = getDb();
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
