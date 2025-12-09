
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  const appointments = db.prepare(`
    SELECT 
      a.id, a.appointment_number as appointmentNumber, a.appointment_datetime as datetime, 
      a.type, a.status, a.billing_status as billingStatus,
      p.full_name as patientName, p.id as patientId,
      m.full_name as staffName, m.id as staffId,
      m.consultation_fee as consultationFee
    FROM appointments a
    JOIN patients p ON a.patient_id = p.id
    JOIN medical_staff m ON a.medical_staff_id = m.id
    ORDER BY a.appointment_datetime DESC
  `).all();
  res.json(appointments);
};

exports.create = (req, res) => {
  const { patientId, staffId, datetime, type } = req.body;
  
  // Conflict Check REMOVED to allow queue-based booking (multiple patients per day per doctor)
  // Since we removed specific time slots from the UI, we assume a daily queue.
  /*
  const conflict = db.prepare(`
    SELECT id FROM appointments 
    WHERE medical_staff_id = ? AND appointment_datetime = ? AND status != 'cancelled'
  `).get(staffId, datetime);

  if (conflict) {
    return res.status(409).json({ error: 'Doctor is not available at this time' });
  }
  */

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
  const { id } = req.params;

  try {
    // Update status
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);

    // If confirmed, generate bill (2-step process)
    if (status === 'confirmed') {
      const appt = db.prepare(`
        SELECT a.*, m.consultation_fee, m.full_name as staffName 
        FROM appointments a 
        JOIN medical_staff m ON a.medical_staff_id = m.id 
        WHERE a.id = ?
      `).get(id);

      if (appt && appt.billing_status !== 'billed') {
        let cost = appt.consultation_fee;
        if (appt.type === 'Follow-up') cost *= 0.5;
        if (appt.type === 'Emergency') cost *= 1.5;

        if (cost > 0) {
          const billNumber = `INV-APT-${Date.now()}`;
          const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, appt.patient_id, cost, 'pending');
          db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, `Appointment: ${appt.type} with ${appt.staffName}`, cost);
          
          db.prepare("UPDATE appointments SET billing_status = 'billed' WHERE id = ?").run(id);
        }
      }
    }

    res.sendStatus(200);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
