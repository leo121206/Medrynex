import { z } from 'zod';

const roleEnum = z.preprocess(
  (val) => (typeof val === 'string' ? val.toUpperCase() : val),
  z.enum(['PATIENT', 'DOCTOR', 'ADMIN'])
);

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters long'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters long'),
    role: roleEnum.default('PATIENT'),
    phone: z.string().optional(),
    avatarUrl: z.string().url().optional().or(z.literal('')),

    // Patient-specific fields
    patientId: z.string().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    bloodGroup: z.string().optional(),

    // Doctor-specific fields
    doctorId: z.string().optional(),
    licenseId: z.string().optional(),
    specialization: z.string().optional(),
    hospital: z.string().optional(),

    // Admin-specific fields
    adminId: z.string().optional(),
    department: z.string().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
    role: roleEnum.optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
