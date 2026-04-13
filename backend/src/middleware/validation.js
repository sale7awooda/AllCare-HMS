const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    const parsed = schema.parse(req.body);
    req.body = parsed;
    next();
  } catch (err) {
    return res.status(400).json({ 
      error: 'Validation Error', 
      details: err.errors.map(e => ({ path: e.path.join('.'), message: e.message })) 
    });
  }
};

// Common Schemas
const schemas = {
  login: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required')
  }),

  createUser: z.object({
    username: z.string().min(3, 'Username must be at least 3 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name is required'),
    role: z.string().min(1, 'Role is required'),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
  }),

  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  }),

  createPatient: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(3),
    age: z.number().or(z.string().transform(v => parseInt(v))),
    gender: z.enum(['male', 'female', 'other']),
    type: z.enum(['inpatient', 'outpatient', 'emergency']),
    address: z.string().max(2000).optional(),
    symptoms: z.string().max(2000).optional().nullable(),
    medicalHistory: z.string().max(2000).optional().nullable(),
    allergies: z.string().max(2000).optional().nullable(),
    bloodGroup: z.string().max(10).optional().nullable(),
    hasInsurance: z.boolean().optional(),
    emergencyContact: z.any().optional(), // Relaxed for JSON objects
    insuranceDetails: z.any().optional()
  }),

  createStaff: z.object({
    fullName: z.string().min(2),
    type: z.string(),
    department: z.string().optional().nullable(),
    specialization: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive', 'dismissed']).optional(),
    baseSalary: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().max(2000).optional().nullable(),
    joinDate: z.string().optional().nullable(),
    consultationFee: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    consultationFeeFollowup: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    consultationFeeEmergency: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    availableDays: z.array(z.string()).optional().nullable(),
    availableTimeStart: z.string().optional().nullable(),
    availableTimeEnd: z.string().optional().nullable()
  }),

  updateStaff: z.object({
    fullName: z.string().min(2).optional(),
    type: z.string().optional(),
    department: z.string().optional().nullable(),
    specialization: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive', 'dismissed']).optional(),
    baseSalary: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().max(2000).optional().nullable(),
    joinDate: z.string().optional().nullable(),
    consultationFee: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    consultationFeeFollowup: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    consultationFeeEmergency: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    availableDays: z.array(z.string()).optional().nullable(),
    availableTimeStart: z.string().optional().nullable(),
    availableTimeEnd: z.string().optional().nullable()
  }),

  // Medical — Lab
  createLabRequest: z.object({
    patientId: z.number().int().positive(),
    testIds: z.array(z.number().int().positive()).min(1),
    totalCost: z.number().nonnegative()
  }),

  completeLabRequest: z.object({
    results: z.record(z.string(), z.object({
      value: z.string().max(500),
      status: z.enum(['normal', 'abnormal', 'critical']).optional()
    })).optional(),
    notes: z.string().max(2000).optional()
  }).passthrough(), // allow extra result fields

  // Medical — Nurse
  createNurseRequest: z.object({
    patientId: z.number().int().positive(),
    staffId: z.number().int().positive().optional().nullable(),
    serviceName: z.string().min(1).max(200),
    cost: z.number().nonnegative(),
    notes: z.string().max(2000).optional().nullable()
  }),

  // Medical — Operations
  createOperation: z.object({
    patientId: z.number().int().positive(),
    operationName: z.string().min(1).max(200),
    doctorId: z.number().int().positive(),
    notes: z.string().max(2000).optional().nullable()
  }),

  // Medical — Admissions
  createAdmission: z.object({
    patientId: z.number().int().positive(),
    bedId: z.number().int().positive(),
    doctorId: z.number().int().positive(),
    entryDate: z.string().min(1),
    deposit: z.number().nonnegative(),
    notes: z.string().max(2000).optional().nullable()
  }),

  addInpatientNote: z.object({
    doctorId: z.number().int().positive(),
    note: z.string().min(1).max(2000),
    vitals: z.object({
      bp: z.string().max(20).optional(),
      temp: z.string().max(20).optional(),
      pulse: z.string().max(20).optional(),
      spo2: z.string().max(20).optional()
    }).optional()
  })
};

module.exports = { validate, schemas };
