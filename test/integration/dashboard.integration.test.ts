import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { Admin } from '../../src/modules/auth/admin.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';
import { Patient } from '../../src/modules/patients/patient.model.js';

describe('dashboard overview MongoDB integration', () => {
  let app: FastifyInstance;
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
    const records = await Patient.create([
      {
        patientNumber: `PT-${suffix.slice(0, 8).toUpperCase()}01`,
        firstName: 'Recent',
        lastName: 'One',
        dateOfBirth: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'female',
        phone: '+8801700000311',
        assignedDoctor: doctorId,
        status: 'active',
      },
      {
        patientNumber: `PT-${suffix.slice(0, 8).toUpperCase()}02`,
        firstName: 'Recent',
        lastName: 'Two',
        dateOfBirth: new Date('1991-01-01T00:00:00.000Z'),
        gender: 'male',
        phone: '+8801700000312',
        assignedDoctor: doctorId,
        status: 'inactive',
      },
    ]);
    patientIds.push(...records.map((record) => record._id.toString()));
    app = await buildApp();
    await app.ready();
  }, 15000);

  afterAll(async () => {
    if (app) await app.close();
    if (patientIds.length) await Patient.deleteMany({ _id: { $in: patientIds } });
    if (doctorId) await Doctor.deleteOne({ _id: doctorId });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await mongoose.disconnect();
  });

  it('returns database-backed metrics, seven monthly buckets, doctor distribution and recent patients', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!rawCookie) throw new Error('Login response did not set an access cookie.');
    const response = await app.inject({
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
        expect.objectContaining({ name: 'Dr. Dashboard Doctor', patients: 2 }),
      ]),
    );
    expect(recentPatients.map((patient: { id: string }) => patient.id)).toEqual(
      expect.arrayContaining(patientIds),
    );
  });
});
