
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
      isAvailable: !!s.is_available,
      email: s.email,
      phone: s.phone
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Error fetching staff:', err);
    res.status(500).json({ error: 'Failed to fetch staff list' });
  }
};

exports.create = (req, res) => {
  const { fullName, type, department, specialization, consultationFee, email, phone } = req.body;
  const prefix = type === 'doctor' ? 'DOC' : type === 'nurse' ? 'NUR' : 'STF';
  const employeeId = `${prefix}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  try {
    const info = db.prepare(`
      INSERT INTO medical_staff (employee_id, full_name, type, department, specialization, consultation_fee, email, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(employeeId, fullName, type, department, specialization, consultationFee, email, phone);
    res.status(201).json({ id: info.lastInsertRowid, employeeId, ...req.body });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = (req, res) => {
  const { id } = req.params;
  const updates = Object.keys(req.body);
  const allowed = ['isAvailable', 'fullName', 'phone', 'email', 'consultationFee'];
  
  const isValid = updates.every(u => allowed.includes(u));
  if (!isValid) return res.status(400).json({ error: 'Invalid updates' });

  // Map camelCase to snake_case for specific fields if needed
  const dbFields = {
    isAvailable: 'is_available',
    consultationFee: 'consultation_fee',
    fullName: 'full_name'
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
