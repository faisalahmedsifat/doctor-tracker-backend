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

describe('patient API + MongoDB integration', () => {
  let app: FastifyInstance;
  let adminId = '';
  let doctorId = '';
  let patientId = '';
  const suffix = randomUUID();
  const adminEmail = `patient-admin-${suffix}@example.com`;
  const patientEmail = `patient-${suffix}@example.com`;
  const password = 'Patient-Integration-Password-2026!';

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes()]);
    const admin = await Admin.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'admin',
    });
    adminId = admin._id.toString();
    const doctor = await Doctor.create({
      firstName: 'Assigned',
      lastName: 'Doctor',
      email: `assigned-${suffix}@example.com`,
      phone: '+8801700000100',
      specialty: 'Family Medicine',
      licenseNumber: `PT-${suffix}`,
      yearsOfExperience: 10,
      consultationFee: 1000,
      status: 'active',
    });
    doctorId = doctor._id.toString();
    app = await buildApp();
    await app.ready();
  }, 15000);

  afterAll(async () => {
    if (app) await app.close();
    if (patientId) await Patient.deleteOne({ _id: patientId });
    if (doctorId) await Doctor.deleteOne({ _id: doctorId });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await mongoose.disconnect();
  });

  it('creates, assigns, searches, updates and deletes a patient record', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password },
    });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!rawCookie) throw new Error('Login response did not set an access cookie.');
    const cookie = rawCookie.split(';')[0];

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/patients',
      headers: { cookie },
      payload: {
        firstName: 'Patient',
        lastName: 'Integration',
        dateOfBirth: '1990-04-12',
        gender: 'female',
        phone: '+8801700000200',
        email: patientEmail,
        address: 'Dhaka',
        bloodGroup: 'B+',
        assignedDoctorId: doctorId,
        status: 'active',
      },
    });
    expect(created.statusCode).toBe(201);
    const patient = created.json().data.patient;
    patientId = patient.id;
    expect(patient.patientNumber).toMatch(/^PT-[A-F0-9]{10}$/);
    expect(patient.assignedDoctor.fullName).toBe('Dr. Assigned Doctor');
    expect(await Patient.countDocuments({ _id: patientId, assignedDoctor: doctorId })).toBe(1);
    const doctorDeleteBlocked = await app.inject({
      method: 'DELETE',
      url: `/api/v1/doctors/${doctorId}`,
      headers: { cookie },
    });
    expect(doctorDeleteBlocked.statusCode).toBe(409);
    expect(doctorDeleteBlocked.json().error.code).toBe('DOCTOR_HAS_PATIENTS');

    const listed = await app.inject({
      method: 'GET',
      url: `/api/v1/patients?search=${patientEmail}&assignedDoctorId=${doctorId}`,
      headers: { cookie },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.patients.map((item: { id: string }) => item.id)).toContain(patientId);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/patients/${patientId}`,
      headers: { cookie },
      payload: { status: 'inactive', bloodGroup: 'AB+' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.patient.status).toBe('inactive');
    expect((await Patient.findById(patientId))?.bloodGroup).toBe('AB+');

    const invalidDoctor = await app.inject({
      method: 'POST',
      url: '/api/v1/patients',
      headers: { cookie },
      payload: {
        firstName: 'Invalid',
        lastName: 'Assignment',
        dateOfBirth: '1992-01-01',
        gender: 'male',
        phone: '+8801700000201',
        assignedDoctorId: '507f1f77bcf86cd799439011',
      },
    });
    expect(invalidDoctor.statusCode).toBe(400);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/patients/${patientId}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(200);
    expect(await Patient.findById(patientId)).toBeNull();
  });
});
