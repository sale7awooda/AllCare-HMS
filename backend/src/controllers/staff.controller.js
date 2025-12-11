
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
