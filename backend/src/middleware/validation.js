const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
  try {
    // Use .strip() to remove unrecognized keys, matching the original intent.
    const parsedBody = schema.strip().parse(req.body);
    // Replace the original body with the validated and cleaned one
    req.body = parsedBody;
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

const staffSchemaBase = z.object({
  fullName: z.string().min(2),
  type: z.string(),
  department: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'dismissed']).optional(),
  baseSalary: z.number().min(0).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  joinDate: z.string().optional().nullable(),
  bankDetails: z.object({
      bankName: z.string().optional().nullable(),
      bankAccount: z.string().optional().nullable()
  }).optional().nullable(),
  consultationFee: z.number().min(0).optional().nullable(),
  consultationFeeFollowup: z.number().min(0).optional().nullable(),
  consultationFeeEmergency: z.number().min(0).optional().nullable(),
  availableDays: z.array(z.string()).optional().nullable(),
  availableTimeStart: z.string().optional().nullable(),
  availableTimeEnd: z.string().optional().nullable()
});

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
  createStaff: staffSchemaBase,
  updateStaff: staffSchemaBase.partial() // All fields are optional for updates
};

module.exports = { validate, schemas };