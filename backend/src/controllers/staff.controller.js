
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
        address: s.address,
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
      email, phone, address, baseSalary || 0, joinDate || new Date().toISOString().split('T')[0],
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
      email, phone, address, baseSalary || 0, joinDate, bankDetailsJson,
      daysJson, availableTimeStart, availableTimeEnd, status,
      id
    );
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
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
    
    // Map to frontend expectation
    const mapped = records.map(r => ({
      id: r.id,
      staffId: r.staff_id,
      staffName: r.staffName,
      date: r.date,
      status: r.status,
      checkIn: r.check_in ? r.check_in.slice(0, 5) : '', // HH:MM
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
      // Update
      let query = 'UPDATE hr_attendance SET status = ?';
      const params = [status];
      if (checkIn) { query += ', check_in = ?'; params.push(checkIn); }
      if (checkOut) { query += ', check_out = ?'; params.push(checkOut); }
      query += ' WHERE id = ?';
      params.push(existing.id);
      db.prepare(query).run(...params);
    } else {
      // Insert
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
      generatedAt: p.generated_at
    })));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.generatePayroll = (req, res) => {
  const { month } = req.body; // YYYY-MM
  
  const tx = db.transaction(() => {
    // 1. Clear existing draft payroll for this month
    db.prepare("DELETE FROM hr_payroll WHERE month = ? AND status = 'draft'").run(month);
    
    // 2. Get active staff
    const staff = db.prepare("SELECT id, base_salary FROM medical_staff WHERE status = 'active'").all();
    
    for (const s of staff) {
      const baseSalary = s.base_salary || 0;
      const dailyRate = baseSalary / 30; // Standard 30-day calculation

      // A. Calculate Manual Financial Adjustments (Loans, Manual Fines, Bonuses)
      const adjustments = db.prepare(`
        SELECT type, amount FROM hr_financials 
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
      `).all(s.id, month);
      
      const manualBonuses = adjustments.filter(a => a.type === 'bonus').reduce((acc, a) => acc + a.amount, 0);
      const manualFines = adjustments.filter(a => a.type === 'fine' || a.type === 'loan').reduce((acc, a) => acc + a.amount, 0);
      
      // B. Calculate Attendance-based Fines
      // Rules: 
      // 1. Absent = 1 day salary deduction
      // 2. Late = 2 lates equal 0.5 day salary deduction
      const attendance = db.prepare(`
        SELECT status FROM hr_attendance 
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
      `).all(s.id, month);

      const absentCount = attendance.filter(a => a.status === 'absent').length;
      const lateCount = attendance.filter(a => a.status === 'late').length;

      const absentDeduction = absentCount * dailyRate; 
      // 2 Lates = 0.5 day deduction
      const latePairs = Math.floor(lateCount / 2);
      const lateDeduction = latePairs * (dailyRate * 0.5); 
      
      const attendanceFines = absentDeduction + lateDeduction;

      // C. Totals
      const totalFines = manualFines + attendanceFines;
      const totalBonuses = manualBonuses;
      const netSalary = baseSalary + totalBonuses - totalFines;
      
      db.prepare(`
        INSERT INTO hr_payroll (staff_id, month, base_salary, total_bonuses, total_fines, net_salary, status)
        VALUES (?, ?, ?, ?, ?, ?, 'draft')
      `).run(s.id, month, baseSalary, totalBonuses, totalFines, netSalary);
    }
  });

  try {
    tx();
    res.json({ success: true, message: 'Payroll generated successfully with attendance fines calculated.' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};
