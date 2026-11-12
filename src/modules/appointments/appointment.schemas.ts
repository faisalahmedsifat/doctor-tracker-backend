import { z } from 'zod';
import { appointmentStatuses } from './appointment.model.js';

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier.');
const status = z.enum(appointmentStatuses);
const startAt = z.string().datetime({ offset: true }).refine((value) => !Number.isNaN(Date.parse(value)));
const durationMinutes = z.number().int().min(5).max(480);

export const appointmentInputSchema = z.object({
  patientId: objectId,
  doctorId: objectId,
  startAt,
  durationMinutes: durationMinutes.default(30),
  reason: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: status.default('scheduled'),
}).strict();

export const appointmentUpdateSchema = z.object({
  patientId: objectId.optional(),
  doctorId: objectId.optional(),
  startAt: startAt.optional(),
  durationMinutes: durationMinutes.optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: status.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one field must be provided.');

export const appointmentIdParamsSchema = z.object({ id: objectId });
export const appointmentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  status: status.optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
}).refine((value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo, {
  message: 'dateFrom must be on or before dateTo.',
  path: ['dateTo'],
});

export const appointmentResponseSchema = z.object({
  id: z.string(),
  patient: z.object({ id: z.string(), fullName: z.string(), patientNumber: z.string() }),
  doctor: z.object({ id: z.string(), fullName: z.string(), specialty: z.string() }),
  startAt: z.string(),
  endAt: z.string(),
  durationMinutes: z.number(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  status,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const appointmentListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    appointments: z.array(appointmentResponseSchema),
    pagination: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
  }),
});
export const appointmentSingleResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ appointment: appointmentResponseSchema }),
});
export type AppointmentInput = z.infer<typeof appointmentInputSchema>;
export type AppointmentUpdate = z.infer<typeof appointmentUpdateSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
