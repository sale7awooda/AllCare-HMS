
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  try {
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
  } catch (err) {
    console.error("Error fetching appointments:", err);
    res.status(500).json({ error: "Failed to fetch appointments", details: err.message });
  }
};

exports.create = (req, res) => {
  const { patientId, staffId, datetime, type, reason, customFee } = req.body;
  const apptNumber = `APT-${Math.floor(Math.random() * 100000)}`;

  const tx = db.transaction(() => {
    // 1. Fetch Staff Fee or use Custom Fee
    const staff = db.prepare('SELECT * FROM medical_staff WHERE id = ?').get(staffId);
    let fee = 0;

    if (customFee !== undefined && customFee !== null) {
      fee = parseFloat(customFee);
    } else if (staff) {
      if (type === 'Follow-up') fee = staff.consultation_fee_followup || 0;
      else if (type === 'Emergency') fee = staff.consultation_fee_emergency || 0;
      else fee = staff.consultation_fee || 0; // Default/Consultation
    }

    // 2. Generate Bill
    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 digits
    const bill = db.prepare('INSERT INTO billing (bill_number, patient_id, total_amount, status) VALUES (?, ?, ?, ?)').run(billNumber, patientId, fee, 'pending');
    
    // Description logic
    const desc = customFee ? `Service: ${reason || type}` : `Appointment: ${type} with ${staff?.full_name || 'Doctor'}`;
    
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, desc, fee);

    // 3. Create Appointment with Bill Link
    const info = db.prepare(`
      INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type, reason, status, billing_status, bill_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(apptNumber, patientId, staffId, datetime, type, reason || null, 'pending', 'billed', bill.lastInsertRowid);
    
    return { id: info.lastInsertRowid, appointmentNumber: apptNumber, ...req.body };
  });

  try {
    const result = tx();
    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// Deprecated or Admin use only
exports.updateStatus = (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, id);
    res.sendStatus(200);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
};
