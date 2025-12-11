
const staffSchemaBase = z.object({
  fullName: z.string().min(2),
  type: z.string(),
  department: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'dismissed']).optional(),
  baseSalary: z.number().min(0).optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
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
