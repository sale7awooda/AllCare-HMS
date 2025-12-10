
const { db } = require('../config/database');

exports.getAll = (req, res) => {
  try {
    const staff = db.prepare('SELECT * FROM medical_staff ORDER BY full_name').all();
    
    const mapped = staff.map(s => ({
      id: s.id,
      employeeId: s.employee_id,
      fullName: s.full_name,
      type: s.type,
      department: s.department,
      specialization: s.specialization,
      consultationFee: s.consultation_fee,
      consultationFeeFollowup: s.consultation_fee_followup || 0,
      consultationFeeEmergency: s.consultation_fee_emergency || 0,
      isAvailable: !!s.is_available,
      email: s.email,
      phone: s.phone,
      baseSalary: s.base_salary,
      joinDate: s.join_date,
      bankDetails: s.bank_details
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
};

exports.create = (req, res) => {
  const { fullName, type, department, specialization, consultationFee, consultationFeeFollowup, consultationFeeEmergency, email, phone, baseSalary, joinDate } = req.body;
  const prefix = type === 'doctor' ? 'DOC' : type === 'nurse' ? 'NUR' : 'STF';
  const employeeId = `${prefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  try {
    const info = db.prepare(`
      INSERT INTO medical_staff (employee_id, full_name, type, department, specialization, consultation_fee, consultation_fee_followup, consultation_fee_emergency, email, phone, base_salary, join_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(employeeId, fullName, type, department, specialization, consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0, email, phone, baseSalary || 0, joinDate || new Date().toISOString().split('T')[0]);
    res.status(201).json({ id: info.lastInsertRowid, employeeId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const updates = Object.keys(req.body);
  const allowed = ['isAvailable', 'fullName', 'phone', 'email', 'consultationFee', 'consultationFeeFollowup', 'consultationFeeEmergency', 'baseSalary', 'joinDate', 'bankDetails', 'department', 'specialization'];
  
  const isValid = updates.every(u => allowed.includes(u));
  if (!isValid) return res.status(400).json({ error: 'Invalid updates' });

  // Map camelCase to snake_case for specific fields
  const dbFields = {
    isAvailable: 'is_available',
    consultationFee: 'consultation_fee',
    consultationFeeFollowup: 'consultation_fee_followup',
    consultationFeeEmergency: 'consultation_fee_emergency',
    fullName: 'full_name',
    baseSalary: 'base_salary',
    joinDate: 'join_date',
    bankDetails: 'bank_details'
  };

  const setClause = updates.map(u => `${dbFields[u] || u} = ?`).join(', ');
  const values = updates.map(u => {
    if (u === 'isAvailable') return req.body[u] ? 1 : 0;
    return req.body[u];
  });

  try {
    db.prepare(`UPDATE medical_staff SET ${setClause} WHERE id = ?`).run(...values, id);
    res.sendStatus(200);
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
    // 1. Delete existing draft payroll for this month
    db.prepare("DELETE FROM hr_payroll WHERE month = ? AND status = 'draft'").run(month);
    
    // 2. Get all staff
    const allStaff = db.prepare("SELECT id, base_salary FROM medical_staff WHERE is_active = 1 OR is_available = 1").all();
    
    // 3. For each staff, calculate adjustments for the month
    // Simplified: Adjustments within the month date range
    const startOfMonth = `${month}-01`;
    const endOfMonth = `${month}-31`; // Loose date check for sqlite string comparison works roughly

    for (const staff of allStaff) {
       const adjustments = db.prepare(`
         SELECT type, amount FROM hr_adjustments 
         WHERE staff_id = ? AND date BETWEEN ? AND ?
       `).all(staff.id, startOfMonth, endOfMonth);
       
       let bonus = 0;
       let fine = 0;
       
       adjustments.forEach(adj => {
           if (adj.type === 'bonus') bonus += adj.amount;
           if (adj.type === 'fine' || adj.type === 'loan') fine += adj.amount; // Loans are deductions here
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
    const { type } = req.query; // 'loan', 'bonus', 'fine'
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
