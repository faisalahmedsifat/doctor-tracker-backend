import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const email = z.string().trim().email().max(254).transform((v) => v.toLowerCase());
const phone = z.string().trim().min(7).max(30);
const specialty = z.string().trim().min(2).max(100);
const hospital = z.string().trim().min(2).max(160);
const workingHours = z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).refine((v) => v.startTime < v.endTime, 'End time must be after start time.')).max(7).refine((v) => new Set(v.map(x => x.dayOfWeek)).size === v.length, 'Each weekday can only be configured once.');
const licenseNumber = z.string().trim().min(2).max(50).transform((v) => v.toUpperCase());
const yearsOfExperience = z.number().int().min(0).max(70);
const consultationFee = z.number().min(0).max(1000000);
const status = z.enum(['active', 'inactive']);

export const doctorInputSchema = z.object({
  firstName: name, lastName: name, email, phone, specialty, hospital: hospital.default("Not specified"), workingHours: workingHours.default([]), licenseNumber,
  yearsOfExperience, consultationFee, status: status.default('active'),
}).strict();

export const doctorUpdateSchema = z.object({
  firstName: name.optional(), lastName: name.optional(), email: email.optional(),
  phone: phone.optional(), specialty: specialty.optional(), hospital: hospital.optional(), workingHours: workingHours.optional(), licenseNumber: licenseNumber.optional(),
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
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
}).refine((v) => !v.dateFrom || !v.dateTo || v.dateFrom <= v.dateTo, { message: 'dateFrom must be on or before dateTo.', path: ['dateTo'] });

export const doctorResponseSchema = z.object({
  id: z.string(), firstName: name, lastName: name, email: z.string().email(), phone, specialty, hospital, workingHours,
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
