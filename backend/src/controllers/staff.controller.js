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
          // Backward compatibility for old string format
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
    email, phone, baseSalary, joinDate, bankDetails,
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
        email, phone, base_salary, join_date, bank_details,
        available_days, available_time_start, available_time_end, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      employeeId, fullName, type, department, specialization, 
      consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0, 
      email, phone, baseSalary || 0, joinDate || new Date().toISOString().split('T')[0],
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
  const updates = req.body; // Validated by middleware

  const snakeCaseUpdates = {};
  
  for (const key in updates) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      let value = updates[key];
      // Simple camel to snake case conversion
      let dbKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      
      // Handle special JSON or boolean cases
      if (key === 'availableDays' || key === 'bankDetails') {
        value = JSON.stringify(value);
      }

      snakeCaseUpdates[dbKey] = value;
    }
  }

  const setClause = Object.keys(snakeCaseUpdates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(snakeCaseUpdates);

  if (values.length === 0) {
      return res.status(400).json({ error: 'No update data provided.' });
  }

  try {
    const stmt = `UPDATE medical_staff SET ${setClause} WHERE id = ?`;
    db.prepare(stmt).run(...values, id);
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};


// --- HR: ATTENDANCE ---
exports.getAttendance = (req, res) => {
  const { date } = req.query;
  try {
    const attendance = db.prepare(`
      SELECT a.*, m.full_name as staffName 
      FROM hr_attendance a 
      JOIN medical_staff m ON a.staff_id = m.id
      WHERE a.date = ?
    `).all(date);
    res.json(attendance);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.markAttendance = (req, res) => {
  const { staffId, date, status, checkIn, checkOut } = req.body;
  try {
    const existing = db.prepare('SELECT id FROM hr_attendance WHERE staff_id = ? AND date = ?').get(staffId, date);
    if (existing) {
      db.prepare('UPDATE hr_attendance SET status = ?, check_in = ?, check_out = ? WHERE id = ?')
        .run(status, checkIn, checkOut, existing.id);
    } else {
      db.prepare('INSERT INTO hr_attendance (staff_id, date, status, check_in, check_out) VALUES (?, ?, ?, ?, ?)')
        .run(staffId, date, status, checkIn, checkOut);
    }
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// --- HR: LEAVES ---
exports.getLeaves = (req, res) => {
  try {
    const leaves = db.prepare(`
      SELECT l.*, m.full_name as staffName 
      FROM hr_leaves l
      JOIN medical_staff m ON l.staff_id = m.id
      ORDER BY l.created_at DESC
    `).all();
    
    // Map snake_case to camelCase
    const mapped = leaves.map(l => ({
        id: l.id,
        staffId: l.staff_id,
        staffName: l.staffName,
        type: l.type,
        startDate: l.start_date,
        endDate: l.end_date,
        reason: l.reason,
        status: l.status
    }));
    res.json(mapped);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.requestLeave = (req, res) => {
  const { staffId, type, startDate, endDate, reason } = req.body;
  try {
    db.prepare(`
      INSERT INTO hr_leaves (staff_id, type, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(staffId, type, startDate, endDate, reason);
    res.status(201).json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.updateLeaveStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    db.prepare('UPDATE hr_leaves SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

// --- HR: PAYROLL ---
exports.getPayroll = (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    const payroll = db.prepare(`
      SELECT p.*, m.full_name as staffName 
      FROM hr_payroll p
      JOIN medical_staff m ON p.staff_id = m.id
      WHERE p.month = ?
    `).all(month);
    
    const mapped = payroll.map(p => ({
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
    }));
    res.json(mapped);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.generatePayroll = (req, res) => {
  const { month } = req.body;
  
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM hr_payroll WHERE month = ? AND status = 'draft'").run(month);
    
    const allStaff = db.prepare("SELECT id, base_salary FROM medical_staff WHERE status = 'active'").all();
    
    const startOfMonth = `${month}-01`;
    const endOfMonth = `${month}-31`;

    for (const staff of allStaff) {
       const adjustments = db.prepare(`
         SELECT type, amount FROM hr_adjustments 
         WHERE staff_id = ? AND date BETWEEN ? AND ?
       `).all(staff.id, startOfMonth, endOfMonth);
       
       let bonus = 0;
       let fine = 0;
       
       adjustments.forEach(adj => {
           if (adj.type === 'bonus') bonus += adj.amount;
           if (adj.type === 'fine' || adj.type === 'loan') fine += adj.amount;
       });
       
       const net = (staff.base_salary || 0) + bonus - fine;
       
       db.prepare(`
         INSERT INTO hr_payroll (staff_id, month, base_salary, total_bonuses, total_fines, net_salary, status)
         VALUES (?, ?, ?, ?, ?, ?, 'draft')
       `).run(staff.id, month, staff.base_salary || 0, bonus, fine, net);
    }
  });

  try {
    tx();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- HR: FINANCIALS (Loans, Fines, Bonuses) ---
exports.getFinancials = (req, res) => {
    const { type } = req.query;
    try {
        let query = "SELECT a.*, m.full_name as staffName FROM hr_adjustments a JOIN medical_staff m ON a.staff_id = m.id";
        const params = [];
        if (type && type !== 'all') {
            query += " WHERE a.type = ?";
            params.push(type);
        }
        query += " ORDER BY a.date DESC";
        
        const data = db.prepare(query).all(...params);
        res.json(data.map(d => ({
            id: d.id,
            staffId: d.staff_id,
            staffName: d.staffName,
            type: d.type,
            amount: d.amount,
            reason: d.reason,
            date: d.date,
            status: d.status
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addAdjustment = (req, res) => {
    const { staffId, type, amount, reason, date } = req.body;
    try {
        db.prepare(`
            INSERT INTO hr_adjustments (staff_id, type, amount, reason, date)
            VALUES (?, ?, ?, ?, ?)
        `).run(staffId, type, amount, reason, date);
        res.status(201).json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
};