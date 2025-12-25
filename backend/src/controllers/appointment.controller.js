
const { db } = require('../config/database');
const notificationController = require('./notification.controller');

exports.getAll = (req, res) => {
  try {
    const appointments = db.prepare(`
      SELECT 
        a.id, a.appointment_number as appointmentNumber, a.appointment_datetime as datetime, 
        a.type, a.status, a.billing_status as billingStatus, a.reason, a.daily_token as dailyToken,
        p.full_name as patientName, p.id as patientId,
        m.full_name as staffName, m.id as staffId,
        b.id as billId, b.total_amount as totalAmount, b.paid_amount as paidAmount,
        b.bill_date as billDate
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN medical_staff m ON a.medical_staff_id = m.id
      LEFT JOIN billing b ON a.bill_id = b.id
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
    // ENFORCE: One-per-day rule for restricted clinical visit types
    const restrictedTypes = ['Consultation', 'Emergency', 'Follow-up'];
    
    if (restrictedTypes.includes(type)) {
        const existing = db.prepare(`
          SELECT id, type FROM appointments 
          WHERE patient_id = ? 
          AND medical_staff_id = ? 
          AND date(appointment_datetime) = date(?)
          AND type IN ('Consultation', 'Emergency', 'Follow-up')
          AND status != 'cancelled'
        `).get(patientId, staffId, datetime);

        if (existing) {
          throw new Error('DUPLICATE_RESTRICTED_APPOINTMENT');
        }
    }

    const staff = db.prepare('SELECT * FROM medical_staff WHERE id = ?').get(staffId);
    let fee = 0;

    if (customFee !== undefined && customFee !== null) {
      fee = parseFloat(customFee) || 0;
    } else if (staff) {
      if (type === 'Follow-up') fee = staff.consultation_fee_followup || 0;
      else if (type === 'Emergency') fee = staff.consultation_fee_emergency || 0;
      else fee = staff.consultation_fee || 0;
    }

    // Determine Daily Token (Sequential for the day)
    const tokenResult = db.prepare(`
        SELECT COUNT(*) as count FROM appointments 
        WHERE date(appointment_datetime) = date(?)
    `).get(datetime);
    const dailyToken = (tokenResult?.count || 0) + 1;

    const billNumber = Math.floor(10000000 + Math.random() * 90000000).toString();
    const bill = db.prepare(`
      INSERT INTO billing (bill_number, patient_id, total_amount, status, bill_date) 
      VALUES (?, ?, ?, 'pending', datetime('now'))
    `).run(billNumber, patientId, fee);
    
    const desc = customFee ? `${type}: ${reason || 'Medical Service'}` : `Appointment: ${type} with ${staff?.full_name || 'Doctor'}`;
    db.prepare('INSERT INTO billing_items (billing_id, description, amount) VALUES (?, ?, ?)').run(bill.lastInsertRowid, desc, fee);

    const info = db.prepare(`
      INSERT INTO appointments (appointment_number, patient_id, medical_staff_id, appointment_datetime, type, reason, status, billing_status, bill_id, daily_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(apptNumber, patientId, staffId, datetime, type, reason || null, 'pending', 'billed', bill.lastInsertRowid, dailyToken);
    
    const patient = db.prepare('SELECT full_name FROM patients WHERE id = ?').get(patientId);

    // Notify assigned staff if they have a system account
    const userAccount = db.prepare('SELECT id FROM users WHERE full_name = ?').get(staff?.full_name);
    if (userAccount) {
        notificationController.createInternal(
            userAccount.id, 
            'New Appointment Scheduled', 
            `${patient.full_name} has been scheduled for a ${type} at ${new Date(datetime).toLocaleTimeString()}`,
            'info'
        );
    }
    
    // Notify managers/admins
    notificationController.notifyRole('manager', 'New Appointment', `${patient.full_name} scheduled with Dr. ${staff?.full_name}`);

    return { id: info.lastInsertRowid, appointmentNumber: apptNumber, dailyToken, ...req.body };
  });

  try {
    const result = tx();
    res.status(201).json(result);
  } catch (err) {
    console.error("Appointment creation error:", err);
    let message = err.message;
    if (err.message === 'DUPLICATE_RESTRICTED_APPOINTMENT') {
        message = 'The patient already has a Consultation, Emergency, or Follow-up visit with this doctor today. Multiple procedures are allowed, but clinical visits are limited to one per day.';
    }
    res.status(400).json({ error: message, code: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { staffId, datetime, type, reason } = req.body;

  try {
    const result = db.prepare(`
      UPDATE appointments 
      SET medical_staff_id = ?, appointment_datetime = ?, type = ?, reason = ?
      WHERE id = ?
    `).run(staffId, datetime, type, reason || null, id);

    if (result.changes === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

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

exports.cancel = (req, res) => {
  const { id } = req.params;
  const tx = db.transaction(() => {
    const appt = db.prepare('SELECT bill_id FROM appointments WHERE id = ?').get(id);
    if (!appt) throw new Error('Appointment not found');
    db.prepare("UPDATE appointments SET status = 'cancelled' WHERE id = ?").run(id);
    if (appt.bill_id) {
      // Allow cancellation of the bill regardless of current status (pending or paid)
      // This ensures paid bills for cancelled appointments are marked as cancelled 
      // (making them eligible for refund in the Billing module)
      db.prepare("UPDATE billing SET status = 'cancelled' WHERE id = ?").run(appt.bill_id);
    }
  });
  try {
    tx();
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (err) {
    res.status(err.message === 'Appointment not found' ? 404 : 500).json({ error: err.message });
  }
};
