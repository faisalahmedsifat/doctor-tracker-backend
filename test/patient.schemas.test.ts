import { describe, expect, it } from 'vitest';
import {
  patientInputSchema,
  patientUpdateSchema,
  patientListQuerySchema,
} from '../src/modules/patients/patient.schemas.js';

const validPatient = {
  firstName: 'Ayesha',
  lastName: 'Rahman',
  dateOfBirth: '1992-05-10',
  gender: 'female',
  phone: '+8801712345678',
  email: ' AYESHA@example.com ',
  status: 'active',
};

describe('patient schemas', () => {
  it('normalizes email and applies the active status default', () => {
    const parsed = patientInputSchema.parse({ ...validPatient, status: undefined });
    expect(parsed.email).toBe('ayesha@example.com');
    expect(parsed.status).toBe('active');
  });

  it('rejects future birth dates and malformed phone numbers', () => {
    expect(
      patientInputSchema.safeParse({ ...validPatient, dateOfBirth: '2999-01-01' }).success,
    ).toBe(false);
    expect(patientInputSchema.safeParse({ ...validPatient, phone: '123' }).success).toBe(false);
  });

  it('rejects unknown keys and invalid doctor identifiers', () => {
    expect(patientInputSchema.safeParse({ ...validPatient, admin: true }).success).toBe(false);
    expect(
      patientInputSchema.safeParse({ ...validPatient, assignedDoctorId: 'not-an-object-id' })
        .success,
    ).toBe(false);
  });

  it('requires a non-empty patch and validates list bounds', () => {
    expect(patientUpdateSchema.safeParse({}).success).toBe(false);
    expect(patientListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(patientListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
