
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
const bankDetailsSchema = z.object({
  bankName: z.string().optional().nullable(),
  bankAccount: z.string().optional().nullable()
}).optional().nullable();

const schemas = {
  login: z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  }),

  createPatient: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(3),
    age: z.number().or(z.string().transform(v => parseInt(v))),
    gender: z.enum(['male', 'female', 'other']),
    type: z.enum(['inpatient', 'outpatient', 'emergency']),
    address: z.string().optional(),
    symptoms: z.string().optional().nullable(),
    medicalHistory: z.string().optional().nullable(),
    allergies: z.string().optional().nullable(),
    bloodGroup: z.string().optional().nullable(),
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
    address: z.string().optional().nullable(),
    joinDate: z.string().optional().nullable(),
    bankDetails: bankDetailsSchema,
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
    baseSalary: z.number().or(z.string().transform(v => parseFloat(v) || 0)).optional(),
    bankDetails: bankDetailsSchema,
    // Add other fields as optional for updates
  }).passthrough() // Allow other fields to pass through for updates
};

module.exports = { validate, schemas };
