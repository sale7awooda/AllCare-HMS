const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const appointments = db.prepare(`
    SELECT 
      a.id, a.appointment_number as appointmentNumber, a.appointment_datetime as datetime, 
      a.type, a.status, a.billing_status as billingStatus,
      p.full_name as patientName, p.id as patientId,
      m.full_name as staffName, m.id as staffId
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN medical_staff m ON a.medical_staff_id = m.id
    ORDER BY a.appointment_datetime DESC
  `).all();
  res.json(appointments);
};

exports.create = (req, res) => {
  const { patientId, staffId, datetime, type } = req.body;
  
  // Conflict Check
  const conflict = db.prepare(`
    SELECT id FROM appointments 
    WHERE medical_staff_id = ? AND appointment_datetime = ? AND status != 'cancelled'
  `).get(staffId, datetime);

  if (conflict) {
    return res.status(409).json({ error: 'Doctor is not available at this time' });
  }

  const apptNumber = `APT-${Math.floor(Math.random() * 100000)}`;

  try {
    const info = db.prepare(`
      INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(apptNumber, patientId, staffId, datetime, type);
    res.status(201).json({ id: info.lastInsertRowid, appointmentNumber: apptNumber, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateStatus = (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
  res.sendStatus(200);
};