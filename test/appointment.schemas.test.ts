import { describe, expect, it } from 'vitest';
import { appointmentInputSchema, appointmentListQuerySchema, appointmentUpdateSchema } from '../src/modules/appointments/appointment.schemas.js';

const valid = { patientId: '507f1f77bcf86cd799439011', doctorId: '507f1f77bcf86cd799439012', startAt: '2030-01-01T10:00:00.000Z', durationMinutes: 30 };
describe('appointment schemas', () => {
  it('applies default duration and status', () => {
    const parsed = appointmentInputSchema.parse({ patientId: valid.patientId, doctorId: valid.doctorId, startAt: valid.startAt });
    expect(parsed.durationMinutes).toBe(30);
    expect(parsed.status).toBe('scheduled');
  });
  it('rejects invalid identifiers, durations, statuses and extra properties', () => {
    expect(appointmentInputSchema.safeParse({ ...valid, patientId: 'bad' }).success).toBe(false);
    expect(appointmentInputSchema.safeParse({ ...valid, durationMinutes: 2 }).success).toBe(false);
    expect(appointmentInputSchema.safeParse({ ...valid, status: 'booked' }).success).toBe(false);
    expect(appointmentInputSchema.safeParse({ ...valid, isAdmin: true }).success).toBe(false);
  });
  it('requires a non-empty patch and validates date range filters', () => {
    expect(appointmentUpdateSchema.safeParse({}).success).toBe(false);
    expect(appointmentUpdateSchema.safeParse({ status: 'confirmed' }).success).toBe(true);
    expect(appointmentListQuerySchema.safeParse({ dateFrom: '2030-02-02', dateTo: '2030-01-01' }).success).toBe(false);
  });
});
