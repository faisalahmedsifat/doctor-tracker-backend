import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type { TestClient } from '../helpers/app.js';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { createTestClient } from '../helpers/app.js';
import { env } from '../../src/config/env.js';
import { Admin } from '../../src/modules/auth/admin.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { Patient } from '../../src/modules/patients/patient.model.js';

describe('dashboard overview MongoDB integration', () => {
  let app: TestClient;
  let adminId = '';
  let doctorId = '';
  const patientIds: string[] = [];
  const suffix = randomUUID();
  const email = `dashboard-admin-${suffix}@example.com`;
  const password = 'Dashboard-Integration-Password-2026!';

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes()]);
    const admin = await Admin.create({
      email,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'admin',
    });
    adminId = admin._id.toString();
    const doctor = await Doctor.create({
      firstName: 'Dashboard',
      lastName: 'Doctor',
      email: `dashboard-doctor-${suffix}@example.com`,
      phone: '+8801700000300',
      specialty: 'Family Medicine',
      licenseNumber: `DB-${suffix}`,
      yearsOfExperience: 12,
      consultationFee: 1200,
      status: 'active',
    });
    doctorId = doctor._id.toString();
    const fixtures = Array.from({ length: 5 }, (_, index) => ({
      patientNumber: `PT-${suffix.slice(0, 8).toUpperCase()}${String(index + 1).padStart(2, '0')}`,
      firstName: 'Recent',
      lastName: `Patient${index + 1}`,
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
      gender: index % 2 === 0 ? 'female' : 'male',
      phone: `+88017000003${String(11 + index).padStart(2, '0')}`,
      assignedDoctor: doctorId,
      status: index === 1 ? 'inactive' : 'active',
    }));
    const records = await Patient.insertMany(fixtures);
    patientIds.push(...records.map((record) => record._id.toString()));
    app = createTestClient(buildApp());
  }, 15000);

  afterAll(async () => {
    if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
    if (doctorId) await Doctor.deleteOne({ _id: doctorId });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await mongoose.disconnect();
  });

  it('returns database-backed metrics, seven monthly buckets, doctor distribution and recent patients', async () => {
    const login = await app.request({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!rawCookie) throw new Error('Login response did not set an access cookie.');
    const response = await app.request({
      method: 'GET',
      url: '/api/v1/dashboard/overview',
      headers: { cookie: rawCookie.split(';')[0] },
    });
    expect(response.statusCode).toBe(200);
    const { metrics, patientGrowth, patientsByDoctor, recentPatients } = response.json().data;
    expect(metrics.totalDoctors).toBeGreaterThanOrEqual(1);
    expect(metrics.activeDoctors).toBeGreaterThanOrEqual(1);
    expect(metrics.totalPatients).toBeGreaterThanOrEqual(2);
    expect(metrics.activePatients).toBeGreaterThanOrEqual(1);
    expect(metrics.newPatientsThisMonth).toBeGreaterThanOrEqual(2);
    expect(metrics.averagePatientsPerActiveDoctor).toBeGreaterThan(0);
    expect(patientGrowth).toHaveLength(7);
    expect(
      patientGrowth.reduce((sum: number, month: { patients: number }) => sum + month.patients, 0),
    ).toBeGreaterThanOrEqual(2);
    expect(patientsByDoctor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Dr. Dashboard Doctor', patients: 5 }),
      ]),
    );
    expect(recentPatients).toHaveLength(5);
    expect(recentPatients.some((patient: { id: string }) => patientIds.includes(patient.id))).toBe(true);
  });
});
