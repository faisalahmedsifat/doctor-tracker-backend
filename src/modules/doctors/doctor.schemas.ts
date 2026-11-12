import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const email = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const phone = z.string().trim().min(7).max(30);
const specialty = z.string().trim().min(2).max(100);
const licenseNumber = z.string().trim().min(2).max(50).transform((v) => v.toUpperCase());
const yearsOfExperience = z.number().int().min(0).max(70);
const consultationFee = z.number().min(0).max(1000000);
const status = z.enum(['active', 'inactive']);

export const doctorInputSchema = z.object({
  firstName: name, lastName: name, email, phone, specialty, licenseNumber,
  yearsOfExperience, consultationFee, status: status.default('active'),
}).strict();

export const doctorUpdateSchema = z.object({
  firstName: name.optional(), lastName: name.optional(), email: email.optional(),
  phone: phone.optional(), specialty: specialty.optional(), licenseNumber: licenseNumber.optional(),
  yearsOfExperience: yearsOfExperience.optional(), consultationFee: consultationFee.optional(),
  status: status.optional(),
}).strict().refine(
  (value) => Object.keys(value).length > 0, 'At least one field must be provided.',
);

export const doctorIdParamsSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid doctor ID.') });

export const doctorListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  specialty: z.string().trim().max(100).optional(),
  status: status.optional(),
  sortBy: z.enum(['name', 'specialty', 'email', 'createdAt', 'consultationFee']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const doctorResponseSchema = z.object({
  id: z.string(), firstName: name, lastName: name, email: z.string().email(), phone, specialty,
  licenseNumber: z.string(), yearsOfExperience, consultationFee, status,
  createdAt: z.string(), updatedAt: z.string(),
});
export const doctorListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    doctors: z.array(doctorResponseSchema),
    pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
  }),
});
export const doctorSingleResponseSchema = z.object({
  success: z.literal(true), data: z.object({ doctor: doctorResponseSchema }),
});
export type DoctorInput = z.infer<typeof doctorInputSchema>;
export type DoctorUpdate = z.infer<typeof doctorUpdateSchema>;
export type DoctorListQuery = z.infer<typeof doctorListQuerySchema>;
