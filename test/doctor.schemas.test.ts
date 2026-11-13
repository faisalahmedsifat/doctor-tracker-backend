import { describe, expect, it } from 'vitest';
import {
  doctorInputSchema, doctorListQuerySchema, doctorUpdateSchema,
} from '../src/modules/doctors/doctor.schemas.js';

const validDoctor = {
  firstName: 'Sarah', lastName: 'Ahmed', email: ' SARAH@EXAMPLE.COM ',
  phone: '+8801712345678', specialty: 'Cardiology', hospital: 'Square Hospital', licenseNumber: ' bm-12345 ',
  yearsOfExperience: 8, consultationFee: 1200, status: 'active',
};

describe('doctor schemas', () => {
  it('normalizes email and license number', () => {
    const parsed = doctorInputSchema.parse(validDoctor);
    expect(parsed.email).toBe('sarah@example.com');
    expect(parsed.licenseNumber).toBe('BM-12345');
  });
  it('defaults new doctors to active', () => {
    const input = { ...validDoctor };
    delete (input as Partial<typeof validDoctor>).status;
    expect(doctorInputSchema.parse(input).status).toBe('active');
  });
  it('rejects malformed email, negative fees and unknown fields', () => {
    expect(doctorInputSchema.safeParse({ ...validDoctor, email: 'invalid' }).success).toBe(false);
    expect(doctorInputSchema.safeParse({ ...validDoctor, consultationFee: -1 }).success).toBe(false);
    expect(doctorInputSchema.safeParse({ ...validDoctor, isAdmin: true }).success).toBe(false);
  });
  it('requires at least one field for updates', () => {
    expect(doctorUpdateSchema.safeParse({}).success).toBe(false);
    expect(doctorUpdateSchema.safeParse({ status: 'inactive' }).success).toBe(true);
  });
  it('validates weekly working hours and rejects duplicate weekdays', () => {
    const workingHours = [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }];
    expect(doctorInputSchema.safeParse({ ...validDoctor, workingHours }).success).toBe(true);
    expect(doctorInputSchema.safeParse({ ...validDoctor, workingHours: [...workingHours, ...workingHours] }).success).toBe(false);
    expect(doctorInputSchema.safeParse({ ...validDoctor, workingHours: [{ dayOfWeek: 1, startTime: '17:00', endTime: '09:00' }] }).success).toBe(false);
  });
  it('bounds pagination and normalizes query defaults', () => {
    expect(doctorListQuerySchema.parse({}).limit).toBe(10);
    expect(doctorListQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(doctorListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
