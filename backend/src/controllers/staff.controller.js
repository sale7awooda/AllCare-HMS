

const { getDb } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const db = getDb();
    const staff = await db.all('SELECT * FROM medical_staff ORDER BY full_name');
    
    const mapped = staff.map(s => {
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

exports.create = async (req, res) => {
  const { 
    fullName, type, department, specialization, 
    consultationFee, consultationFeeFollowup, consultationFeeEmergency, 
    email, phone, address, baseSalary, joinDate,
    availableDays, availableTimeStart, availableTimeEnd, status
  } = req.body;

  const prefix = type === 'doctor' ? 'DOC' : type === 'nurse' ? 'NUR' : 'STF';
  const employeeId = `${prefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  const daysJson = availableDays ? JSON.stringify(availableDays) : '[]';

  try {
    const db = getDb();
    const result = await db.run(`
      INSERT INTO medical_staff (
        employee_id, full_name, type, department, specialization, 
        consultation_fee, consultation_fee_followup, consultation_fee_emergency, 
        email, phone, address, base_salary, join_date,
        available_days, available_time_start, available_time_end, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      employeeId, fullName, type, department, specialization, 
      consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0, 
      email, phone, address || null, baseSalary || 0, joinDate || new Date().toISOString().split('T')[0],
      daysJson, availableTimeStart || null, availableTimeEnd || null, status || 'active'
    ]);
    res.status(201).json({ id: result.lastID, employeeId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  const { id } = req.params;
  const { 
    fullName, type, department, specialization, 
    consultationFee, consultationFeeFollowup, consultationFeeEmergency, 
    email, phone, address, baseSalary, joinDate,
    availableDays, availableTimeStart, availableTimeEnd, status
  } = req.body;

  const daysJson = availableDays ? JSON.stringify(availableDays) : '[]';

  try {
    const db = getDb();
    await db.run(`
      UPDATE medical_staff SET
        full_name = ?, type = ?, department = ?, specialization = ?,
        consultation_fee = ?, consultation_fee_followup = ?, consultation_fee_emergency = ?,
        email = ?, phone = ?, address = ?, base_salary = ?, join_date = ?,
        available_days = ?, available_time_start = ?, available_time_end = ?, status = ?
      WHERE id = ?
    `, [
      fullName, type, department, specialization,
      consultationFee || 0, consultationFeeFollowup || 0, consultationFeeEmergency || 0,
      email, phone, address || null, baseSalary || 0, joinDate,
      daysJson, availableTimeStart, availableTimeEnd, status,
      id
    ]);
    res.json({ message: 'Staff updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
};

// --- ATTENDANCE ---
exports.getAttendance = async (req, res) => {
  const { date } = req.query; // YYYY-MM-DD
  try {
    const db = getDb();
    const records = await db.all(`
      SELECT a.*, m.full_name as staffName 
      FROM hr_attendance a
      JOIN medical_staff m ON a.staff_id = m.id
      WHERE a.date = ?
    `, [date]);
    
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

exports.markAttendance = async (req, res) => {
  const { staffId, date, status, checkIn, checkOut } = req.body;
  
  try {
    const db = getDb();
    const existing = await db.get('SELECT id FROM hr_attendance WHERE staff_id = ? AND date = ?', [staffId, date]);
    
    if (existing) {
      let query = 'UPDATE hr_attendance SET status = ?';
      const params = [status];
      if (checkIn) { query += ', check_in = ?'; params.push(checkIn); }
      if (checkOut) { query += ', check_out = ?'; params.push(checkOut); }
      query += ' WHERE id = ?';
      params.push(existing.id);
      await db.run(query, params);
    } else {
      await db.run(`
        INSERT INTO hr_attendance (staff_id, date, status, check_in, check_out)
        VALUES (?, ?, ?, ?, ?)
      `, [staffId, date, status, checkIn || null, checkOut || null]);
    }
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- LEAVES ---
exports.getLeaves = async (req, res) => {
  try {
    const db = getDb();
    const leaves = await db.all(`
      SELECT l.*, m.full_name as staffName
      FROM hr_leaves l
      JOIN medical_staff m ON l.staff_id = m.id
      ORDER BY l.start_date DESC
    `);
    
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

exports.requestLeave = async (req, res) => {
  const { staffId, type, startDate, endDate, reason } = req.body;
  try {
    const db = getDb();
    await db.run(`
      INSERT INTO hr_leaves (staff_id, type, start_date, end_date, reason, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `, [staffId, type, startDate, endDate, reason]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE hr_leaves SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- FINANCIALS (Adjustments) ---
exports.getFinancials = async (req, res) => {
  try {
    const db = getDb();
    const data = await db.all(`
      SELECT f.*, m.full_name as staffName
      FROM hr_financials f
      JOIN medical_staff m ON f.staff_id = m.id
      ORDER BY f.date DESC
    `);
    
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

exports.addAdjustment = async (req, res) => {
  const { staffId, type, amount, reason, date, status } = req.body;
  try {
    const db = getDb();
    await db.run(`
      INSERT INTO hr_financials (staff_id, type, amount, reason, date, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [staffId, type, amount, reason, date, status || 'pending']);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.updateFinancialStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const db = getDb();
    await db.run('UPDATE hr_financials SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

// --- PAYROLL ---
exports.getPayroll = async (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    const db = getDb();
    const records = await db.all(`
      SELECT p.*, m.full_name as staffName
      FROM hr_payroll p
      JOIN medical_staff m ON p.staff_id = m.id
      WHERE p.month = ?
      ORDER BY p.generated_at DESC
    `, [month]);

    // Fetch related financial adjustments for breakdown
    const adjustments = await db.all(`
      SELECT * FROM hr_financials 
      WHERE strftime('%Y-%m', date) = ?
      AND (
          type IN ('bonus', 'fine', 'loan') 
          OR (type = 'extra' AND status = 'approved')
      )
    `, [month]);
    
    res.json(records.map(p => {
      const staffAdjustments = adjustments.filter(a => a.staff_id === p.staff_id);
      return {
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
        paymentDate: p.payment_date,
        adjustments: staffAdjustments.map(a => ({
          id: a.id,
          staffId: a.staff_id,
          staffName: p.staffName,
          type: a.type,
          amount: a.amount,
          reason: a.reason,
          date: a.date,
          status: a.status
        }))
      };
    }));
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};

exports.generatePayroll = async (req, res) => {
  const { month } = req.body; // YYYY-MM
  
  try {
    const db = getDb();
    await db.exec('BEGIN TRANSACTION');
    const staff = await db.all("SELECT id, full_name, base_salary FROM medical_staff WHERE status = 'active'");
    
    for (const s of staff) {
      const baseSalary = s.base_salary || 0;
      const dailyRate = baseSalary / 30;

      // Filter: Only include 'bonus' or 'approved extra' adjustments
      const adjustments = await db.all(`
        SELECT type, amount FROM hr_financials 
        WHERE staff_id = ? 
        AND strftime('%Y-%m', date) = ?
        AND (
          type IN ('bonus', 'fine', 'loan') 
          OR (type = 'extra' AND status = 'approved')
        )
      `, [s.id, month]);
      
      const currentBonuses = adjustments.filter(a => a.type === 'bonus' || a.type === 'extra').reduce((acc, a) => acc + a.amount, 0);
      const currentFinesAdjust = adjustments.filter(a => a.type === 'fine' || a.type === 'loan').reduce((acc, a) => acc + a.amount, 0);
      
      const leaves = await db.all("SELECT start_date, end_date FROM hr_leaves WHERE staff_id = ? AND status = 'approved'", [s.id]);
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

      const attendance = await db.all(`
        SELECT status, date FROM hr_attendance 
        WHERE staff_id = ? AND strftime('%Y-%m', date) = ?
      `, [s.id, month]);

      const unexcusedAbsences = attendance.filter(a => a.status === 'absent' && !isExcused(a.date)).length;
      const lateCount = attendance.filter(a => a.status === 'late').length;
      const currentAttendanceFines = (unexcusedAbsences * dailyRate) + (Math.floor(lateCount / 2) * (dailyRate * 0.5));

      const totalDeservedFines = currentFinesAdjust + currentAttendanceFines;
      const totalDeservedBonuses = currentBonuses;
      const targetNet = baseSalary + totalDeservedBonuses - totalDeservedFines; 

      const existingRecords = await db.get("SELECT SUM(net_salary) as totalNet, SUM(base_salary) as totalBase, SUM(total_bonuses) as totalBonuses, SUM(total_fines) as totalFines FROM hr_payroll WHERE staff_id = ? AND month = ?", [s.id, month]);
      
      const accountedNet = existingRecords.totalNet || 0;
      const accountedBase = existingRecords.totalBase || 0;
      const accountedBonuses = existingRecords.totalBonuses || 0;
      const accountedFines = existingRecords.totalFines || 0;

      const deltaNet = targetNet - accountedNet;
      const deltaBase = baseSalary - accountedBase;
      const deltaBonuses = totalDeservedBonuses - accountedBonuses;
      const deltaFines = totalDeservedFines - accountedFines;

      if (Math.abs(deltaNet) > 0.01) {
          const existingDraft = await db.get("SELECT id FROM hr_payroll WHERE staff_id = ? AND month = ? AND status = 'draft'", [s.id, month]);
          
          if (existingDraft) {
            await db.run(`
              UPDATE hr_payroll SET 
                base_salary = base_salary + ?, 
                total_bonuses = total_bonuses + ?, 
                total_fines = total_fines + ?, 
                net_salary = net_salary + ?,
                generated_at = datetime('now')
              WHERE id = ?
            `, [deltaBase, deltaBonuses, deltaFines, deltaNet, existingDraft.id]);
          } else {
            await db.run(`
              INSERT INTO hr_payroll (staff_id, month, base_salary, total_bonuses, total_fines, net_salary, status, generated_at)
              VALUES (?, ?, ?, ?, ?, ?, 'draft', datetime('now'))
            `, [s.id, month, deltaBase, deltaBonuses, deltaFines, deltaNet]);
          }
      }
    }
    await db.exec('COMMIT');
    res.json({ success: true, message: 'Payroll delta calculations completed.' });
  } catch(e) {
    const db = getDb();
    await db.exec('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: e.message });
  }
};

exports.updatePayrollStatus = async (req, res) => {
    const { id } = req.params;
    const { status, paymentMethod, transactionRef, notes } = req.body;
    
    try {
        const db = getDb();
        await db.exec('BEGIN TRANSACTION');
        
        const record = await db.get(`
            SELECT p.*, m.full_name as staffName 
            FROM hr_payroll p 
            JOIN medical_staff m ON p.staff_id = m.id 
            WHERE p.id = ?
        `, [id]);

        if (!record) throw new Error('Record not found.');

        // Update Payroll Table
        await db.run(`
            UPDATE hr_payroll 
            SET status = ?, 
                payment_method = ?, 
                transaction_ref = ?, 
                payment_notes = ?, 
                payment_date = datetime('now') 
            WHERE id = ?
        `, [status, paymentMethod || null, transactionRef || null, notes || null, id]);

        // Sync with Treasury if marked as Paid
        if (status === 'paid') {
            await db.run(`
                INSERT INTO transactions (type, category, amount, method, reference_id, details, date, description)
                VALUES ('expense', 'Staff Salaries', ?, ?, ?, ?, datetime('now'), ?)
            `, [
                record.net_salary, 
                paymentMethod || 'Cash', 
                id,
                JSON.stringify({ month: record.month, transactionRef: transactionRef || 'N/A' }),
                `Salary Disbursement for ${record.staffName} (${record.month})`
            ]);
        }
        await db.exec('COMMIT');
        res.json({ success: true });
    } catch(e) {
        const db = getDb();
        await db.exec('ROLLBACK');
        console.error('Payroll status update error:', e);
        res.status(500).json({ error: e.message });
    }
};
