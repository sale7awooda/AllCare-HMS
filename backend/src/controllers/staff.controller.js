
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  try {
    const staff = db.prepare('SELECT * FROM medical_staff ORDER BY full_name').all();
    
    const mapped = staff.map(s => {
      let bankDetails = null;
      if (s.bank_details) {
        try {
          bankDetails = JSON.parse(s.bank_details);
        } catch (e) {
          bankDetails = s.bank_details;
        }
      }

      return {
        id: s.id,
        employeeId: s.employee_id,
        fullName: s.full_name,
        type: s.type,
        department: s.department,
        specialization: s.specialization,
        consultationFee: s.consultation_fee,
        consultationFeeFollowup: s.consultation_fee_followup || 0,
        consultationFeeEmergency: s.consultation_fee_emergency || 0,
        status: s.status,
        email: s.email,
        phone: s.phone,
        address: s.address || '',
        baseSalary: s.base_salary,
        joinDate: s.join_date,
        bankDetails: bankDetails,
        availableDays: s.available_days ? JSON.parse(s.available_days) : [],
        availableTimeStart: s.available_time_start,
        availableTimeEnd: s.available_time_end
      }
    });

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
};

exports.create = (req, res) => {
  const { 
    fullName, type, department, specialization, 
    consultationFee, consultationFeeFollowup, consultationFeeEmergency, 
    email, phone, address, baseSalary, joinDate, bankDetails,
    availableDays, availableTimeStart, availableTimeEnd, status
  } = req.body;

  const prefix = type === 'doctor' ? 'DOC' : type === 'nurse' ? 'NUR' : 'STF';
  const employeeId = `${prefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const daysJson = availableDays ? JSON.stringify(availableDays) : '[]';
  const bankDetailsJson = bankDetails ? JSON.stringify(bankDetails) : null;

  try {
    const info = db.prepare(`
      INSERT INTO medical_staff (
        employee_id, full_name, type, department, specialization, 
        consultation_fee, consultation_fee_followup, consultation_fee_emergency, 
        email, phone, address, base_salary, join_date, bank_details,
        available_days, available_time_start, available_time_end, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId, fullName, type, department, specialization, 
      consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0, 
      email, phone, address || null, baseSalary || 0, joinDate || new Date().toISOString().split('T')[0],
      bankDetailsJson,
      daysJson, availableTimeStart || null, availableTimeEnd || null, status || 'active'
    );
    res.status(201).json({ id: info.lastInsertRowid, employeeId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const { 
    fullName, type, department, specialization, 
    consultationFee, consultationFeeFollowup, consultationFeeEmergency, 
    email, phone, address, baseSalary, joinDate, bankDetails,
    availableDays, availableTimeStart, availableTimeEnd, status
  } = req.body;

  const daysJson = availableDays ? JSON.stringify(availableDays) : '[]';
  const bankDetailsJson = bankDetails ? JSON.stringify(bankDetails) : null;

  try {
    db.prepare(`
      UPDATE medical_staff SET
        full_name = ?, type = ?, department = ?, specialization = ?,
        consultation_fee = ?, consultation_fee_followup = ?, consultation_fee_emergency = ?,
        email = ?, phone = ?, address = ?, base_salary = ?, join_date = ?, bank_details = ?,
        available_days = ?, available_time_start = ?, available_time_end = ?, status = ?
      WHERE id = ?
    `).run(
      fullName, type, department, specialization,
      consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0,
      email, phone, address || null, baseSalary || 0, joinDate, bankDetailsJson,
      daysJson, availableTimeStart, availableTimeEnd, status,
      id
    );
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// --- ATTENDANCE ---
exports.getAttendance = (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  try {
    const records = db.prepare(`
      SELECT a.*, m.full_name as staffName 
      FROM hr_attendance a
      JOIN medical_staff m ON a.staff_id = m.id
      WHERE a.date = ?
    `).all(date);
    
    const mapped = records.map(r => ({
      id: r.id,
      staffId: r.staff_id,
      staffName: r.staffName,
      date: r.date,
      status: r.status,
      checkIn: r.check_in ? r.check_in.slice(0, 5) : '', 
      checkOut: r.check_out ? r.check_out.slice(0, 5) : ''
    }));
    res.json(mapped);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.markAttendance = (req, res) => {
  const { staffId, date, status, checkIn, checkOut } = req.body;
  
  try {
    const existing = db.prepare('SELECT id FROM hr_attendance WHERE staff_id = ? AND date = ?').get(staffId, date);
    
    if (existing) {
      let query = 'UPDATE hr_attendance SET status = ?';
      const params = [status];
      if (checkIn) { query += ', check_in = ?'; params.push(checkIn); }
      if (checkOut) { query += ', check_out = ?'; params.push(checkOut); }
      query += ' WHERE id = ?';
      params.push(existing.id);
      db.prepare(query).run(...params);
    } else {
      db.prepare(`
        INSERT INTO hr_attendance (staff_id, date, status, check_in, check_out)
        VALUES (?, ?, ?, ?, ?)
      `).run(staffId, date, status, checkIn || null, checkOut || null);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- LEAVES ---
exports.getLeaves = (req, res) => {
  try {
    const leaves = db.prepare(`
      SELECT l.*, m.full_name as staffName
      FROM hr_leaves l
      JOIN medical_staff m ON l.staff_id = m.id
      ORDER BY l.start_date DESC
    `).all();
    
    res.json(leaves.map(l => ({
      id: l.id,
      staffId: l.staff_id,
      staffName: l.staffName,
      type: l.type,
      startDate: l.start_date,
      endDate: l.end_date,
      reason: l.reason,
      status: l.status
    })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.requestLeave = (req, res) => {
  const { staffId, type, startDate, endDate, reason } = req.body;
  try {
    db.prepare(`
      INSERT INTO hr_leaves (staff_id, type, start_date, end_date, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `).run(staffId, type, startDate, endDate, reason);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateLeaveStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE hr_leaves SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- FINANCIALS (Adjustments) ---
exports.getFinancials = (req, res) => {
  try {
    const data = db.prepare(`
      SELECT f.*, m.full_name as staffName
      FROM hr_financials f
      JOIN medical_staff m ON f.staff_id = m.id
      ORDER BY f.date DESC
    `).all();
    
    res.json(data.map(f => ({
      id: f.id,
      staffId: f.staff_id,
      staffName: f.staffName,
      type: f.type,
      amount: f.amount,
      reason: f.reason,
      date: f.date,
      status: f.status
    })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.addAdjustment = (req, res) => {
  const { staffId, type, amount, reason, date } = req.body;
  try {
    db.prepare(`
      INSERT INTO hr_financials (staff_id, type, amount, reason, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(staffId, type, amount, reason, date);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- PAYROLL ---
exports.getPayroll = (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    const records = db.prepare(`
      SELECT p.*, m.full_name as staffName
      FROM hr_payroll p
      JOIN medical_staff m ON p.staff_id = m.id
      WHERE p.month = ?
      ORDER BY p.generated_at DESC
    `).all(month);
    
    res.json(records.map(p => ({
      id: p.id,
      staffId: p.staff_id,
      staffName: p.staffName,
      month: p.month,
      baseSalary: p.base_salary,
      totalBonuses: p.total_bonuses,
      totalFines: p.total_fines,
      netSalary: p.net_salary,
      status: p.status,
      generatedAt: p.generated_at,
      paymentMethod: p.payment_method,
      transactionRef: p.transaction_ref,
      paymentNotes: p.payment_notes,
      paymentDate: p.payment_date
    })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.generatePayroll = (req, res) => {
  const { month } = req.body; // YYYY-MM
  
  const tx = db.transaction(() => {
    // Logic Improvement:
    // 1. We no longer wipe all drafts. We keep existing paid records.
    // 2. We calculate what the current month totals SHOULD be.
    // 3. We create or update a delta draft for any difference between what's needed and what's already created.
    
    const staff = db.prepare("SELECT id, full_name, base_salary FROM medical_staff WHERE status = 'active'").all();
    
    for (const s of staff) {
      const baseSalary = s.base_salary || 0;
      const dailyRate = baseSalary / 30;

      // A. Calculate Adjustments (Bonuses/Fines/Loans)
      const adjustments = db.prepare(`
        SELECT type, amount FROM hr_financials 
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
      `).all(s.id, month);
      
      const currentBonuses = adjustments.filter(a => a.type === 'bonus').reduce((acc, a) => acc + a.amount, 0);
      const currentFinesAdjust = adjustments.filter(a => a.type === 'fine' || a.type === 'loan').reduce((acc, a) => acc + a.amount, 0);
      
      // B. Calculate Attendance-based Fines
      const leaves = db.prepare("SELECT start_date, end_date FROM hr_leaves WHERE staff_id = ? AND status = 'approved'").all(s.id);
      const isExcused = (dateStr) => {
          const d = new Date(dateStr);
          d.setHours(12,0,0,0);
          return leaves.some(l => {
              const start = new Date(l.start_date);
              const end = new Date(l.end_date);
              start.setHours(12,0,0,0);
              end.setHours(12,0,0,0);
              return d >= start && d <= end;
          });
      };

      const attendance = db.prepare(`
        SELECT status, date FROM hr_attendance 
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
      `).all(s.id, month);

      const unexcusedAbsences = attendance.filter(a => a.status === 'absent' && !isExcused(a.date)).length;
      const lateCount = attendance.filter(a => a.status === 'late').length;
      const currentAttendanceFines = (unexcusedAbsences * dailyRate) + (Math.floor(lateCount / 2) * (dailyRate * 0.5));

      // C. Target Monthly Total
      const totalDeservedFines = currentFinesAdjust + currentAttendanceFines;
      const totalDeservedBonuses = currentBonuses;
      const targetNet = Math.max(0, baseSalary + totalDeservedBonuses - totalDeservedFines);

      // D. Find what's already accounted for (Sum of all existing records for this month/staff)
      const existingRecords = db.prepare("SELECT SUM(net_salary) as totalNet, SUM(base_salary) as totalBase, SUM(total_bonuses) as totalBonuses, SUM(total_fines) as totalFines FROM hr_payroll WHERE staff_id = ? AND month = ?").get(s.id, month);
      
      const accountedNet = existingRecords.totalNet || 0;
      const accountedBase = existingRecords.totalBase || 0;
      const accountedBonuses = existingRecords.totalBonuses || 0;
      const accountedFines = existingRecords.totalFines || 0;

      const deltaNet = targetNet - accountedNet;
      const deltaBase = baseSalary - accountedBase;
      const deltaBonuses = totalDeservedBonuses - accountedBonuses;
      const deltaFines = totalDeservedFines - accountedFines;

      // If there is a delta, create or update a DRAFT record
      if (Math.abs(deltaNet) > 0.01) {
          const existingDraft = db.prepare("SELECT id FROM hr_payroll WHERE staff_id = ? AND month = ? AND status = 'draft'").get(s.id, month);
          
          if (existingDraft) {
            db.prepare(`
              UPDATE hr_payroll SET 
                base_salary = base_salary + ?, 
                total_bonuses = total_bonuses + ?, 
                total_fines = total_fines + ?, 
                net_salary = net_salary + ?,
                generated_at = datetime('now')
              WHERE id = ?
            `).run(deltaBase, deltaBonuses, deltaFines, deltaNet, existingDraft.id);
          } else {
            db.prepare(`
              INSERT INTO hr_payroll (staff_id, month, base_salary, total_bonuses, total_fines, net_salary, status, generated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'draft', datetime('now'))
            `).run(s.id, month, deltaBase, deltaBonuses, deltaFines, deltaNet);
          }
      }
    }
  });

  try {
    tx();
    res.json({ success: true, message: 'Payroll delta calculations completed.' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

exports.updatePayrollStatus = (req, res) => {
    const { id } = req.params;
    const { status, paymentMethod, transactionRef, notes } = req.body;
    
    const tx = db.transaction(() => {
        const record = db.prepare(`
            SELECT p.*, m.full_name as staffName 
            FROM hr_payroll p 
            JOIN medical_staff m ON p.staff_id = m.id 
            WHERE p.id = ?
        `).get(id);

        if (!record) throw new Error('Record not found.');

        // Update Payroll Table
        db.prepare(`
            UPDATE hr_payroll 
            SET status = ?, 
                payment_method = ?, 
                transaction_ref = ?, 
                payment_notes = ?, 
                payment_date = datetime('now') 
            WHERE id = ?
        `).run(status, paymentMethod || null, transactionRef || null, notes || null, id);

        // Sync with Treasury if marked as Paid
        if (status === 'paid') {
            db.prepare(`
                INSERT INTO transactions (type, category, amount, method, reference_id, date, description)
                VALUES ('expense', 'Staff Salaries', ?, ?, ?, datetime('now'), ?)
            `).run(
                record.net_salary, 
                paymentMethod || 'Cash', 
                id, 
                `Salary Disbursement for ${record.staffName} (${record.month})`
            );
        }
    });

    try {
        tx();
        res.json({ success: true });
    } catch(e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};
