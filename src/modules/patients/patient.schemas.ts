import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const phone = z.string().trim().min(7).max(30);
const email = z
  .string()
  .trim()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const dateOfBirth = z
  .string()
  .date()
  .refine(
    (value) => value <= new Date().toISOString().slice(0, 10),
    'Date of birth cannot be in the future.',
  );
const gender = z.enum(['female', 'male', 'other', 'prefer_not_to_say']);
const bloodGroup = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
const status = z.enum(['active', 'inactive']);
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const patientInputSchema = z
  .object({
    firstName: name,
    lastName: name,
    dateOfBirth,
    gender,
    phone,
    email: email.nullable().optional(),
    address: optionalText(300).optional(),
    bloodGroup: bloodGroup.nullable().optional(),
    emergencyContactName: optionalText(120).optional(),
    emergencyContactPhone: phone.nullable().optional(),
    assignedDoctorId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .nullable()
      .optional(),
    status: status.default('active'),
  })
  .strict();

export const patientUpdateSchema = z
  .object({
    firstName: name.optional(),
    lastName: name.optional(),
    dateOfBirth: dateOfBirth.optional(),
    gender: gender.optional(),
    phone: phone.optional(),
    email: email.nullable().optional(),
    address: optionalText(300).optional(),
    bloodGroup: bloodGroup.nullable().optional(),
    emergencyContactName: optionalText(120).optional(),
    emergencyContactPhone: phone.nullable().optional(),
    assignedDoctorId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .nullable()
      .optional(),
    status: status.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const patientIdParamsSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid patient ID.'),
});
export const patientListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: status.optional(),
  assignedDoctorId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional(),
  sortBy: z.enum(['name', 'createdAt', 'dateOfBirth']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const patientResponseSchema = z.object({
  id: z.string(),
  patientNumber: z.string(),
  firstName: name,
  lastName: name,
  dateOfBirth: z.string(),
  gender,
  phone,
  email: z.string().email().nullable(),
  address: z.string().nullable(),
  bloodGroup: bloodGroup.nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  assignedDoctor: z
    .object({ id: z.string(), fullName: z.string(), specialty: z.string() })
    .nullable(),
  status,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const patientListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    patients: z.array(patientResponseSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  }),
});
export const patientSingleResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ patient: patientResponseSchema }),
});
export type PatientInput = z.infer<typeof patientInputSchema>;
export type PatientUpdate = z.infer<typeof patientUpdateSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
