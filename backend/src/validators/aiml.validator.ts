import { z } from 'zod';

const FORBIDDEN_PHI_KEYS = [
  'patientName',
  'diagnosis',
  'clinicalNotes',
  'prescriptionText',
  'patientHistory',
  'ssn',
  'mrn',
  'notes',
  'rawRecord',
  'dek',
  'kek',
  'token',
  'privateKey',
];

export const aimlSimulationSchema = z.object({
  body: z
    .object({
      doctorSpecialty: z.string().min(1, 'Doctor specialty is required').max(64),
      recordType: z.string().min(1, 'Record type is required').max(64),
      purpose: z.string().min(1, 'Access purpose is required').max(64),
      hospital: z.string().max(64).optional(),
      requestsLast24h: z.number().int().min(0).max(10_000).optional(),
      requestsLast7d: z.number().int().min(0).max(100_000).optional(),
      requestsForRecordType: z.number().int().min(0).max(100_000).optional(),
      averageDailyRequests: z.number().min(0).max(10_000).optional(),
      requestHour: z.number().int().min(0).max(23).optional(),
      isEmergency: z.boolean().optional(),
    })
    .strict()
    .refine(
      (data) => {
        // Enforce Zero-PHI guarantee: No forbidden PHI keys present in body
        const keys = Object.keys(data);
        return !keys.some((k) => FORBIDDEN_PHI_KEYS.includes(k.toLowerCase()));
      },
      {
        message: 'Payload contains prohibited PHI or sensitive clinical text fields',
      }
    ),
});

export const aimlAnomalyQuerySchema = z.object({
  query: z.object({
    riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'ALL', 'low', 'moderate', 'high', 'all']).optional(),
    isFlagged: z
      .string()
      .transform((val) => val === 'true')
      .or(z.boolean())
      .optional(),
    doctorId: z.string().optional(),
    patientId: z.string().optional(),
    limit: z
      .string()
      .transform((v) => parseInt(v, 10))
      .or(z.number())
      .refine((v) => !v || (v > 0 && v <= 100), 'Limit must be between 1 and 100')
      .optional(),
    offset: z
      .string()
      .transform((v) => parseInt(v, 10))
      .or(z.number())
      .refine((v) => !v || v >= 0, 'Offset must be non-negative')
      .optional(),
  }),
});

export type AIMLSimulationInput = z.infer<typeof aimlSimulationSchema>['body'];
export type AIMLAnomalyQueryInput = z.infer<typeof aimlAnomalyQuerySchema>['query'];
