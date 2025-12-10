
const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation Error', 
        details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`) 
      });
    }
    next(err);
  }
};

const schemas = {
  login: z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
  }),
  createPatient: z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().min(3, "Phone number is required"),
    age: z.number().int().positive("Age must be a positive integer"),
    gender: z.enum(['male', 'female', 'other']),
    type: z.enum(['inpatient', 'outpatient', 'emergency']).optional(),
    address: z.string().optional(),
    // Allow optional fields to pass through without strict validation if not critical
    symptoms: z.string().optional(),
    medicalHistory: z.string().optional(),
    allergies: z.string().optional(),
    bloodGroup: z.string().optional(),
    hasInsurance: z.boolean().optional(),
    emergencyContact: z.object({
        name: z.string(),
        phone: z.string(),
        relation: z.string()
    }).optional().nullable(),
    insuranceDetails: z.object({
        provider: z.string(),
        policyNumber: z.string(),
        expiryDate: z.string(),
        notes: z.string().optional()
    }).optional().nullable()
  }),
  createStaff: z.object({
    fullName: z.string().min(2),
    type: z.string(),
    department: z.string().optional(),
    specialization: z.string().optional(),
    isAvailable: z.boolean().optional(),
    baseSalary: z.number().min(0).optional(),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    joinDate: z.string().optional(),
    bankDetails: z.string().optional(),
    consultationFee: z.number().min(0).optional(),
    consultationFeeFollowup: z.number().min(0).optional(),
    consultationFeeEmergency: z.number().min(0).optional(),
    availableDays: z.array(z.string()).optional(),
    availableTimeStart: z.string().optional(),
    availableTimeEnd: z.string().optional()
  })
};

module.exports = { validate, schemas };
