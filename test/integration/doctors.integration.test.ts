import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { Admin } from '../../src/modules/auth/admin.model.js';
import { Doctor } from '../../src/modules/doctors/doctor.model.js';

describe('doctor API + MongoDB integration', () => {
  let app: FastifyInstance;
  const suffix = randomUUID();
  const email = `doctor-test-${suffix}@example.com`;
  const adminEmail = `admin-test-${suffix}@example.com`;
  const password = 'Integration-Test-Password-2026!';
  let adminId = '';

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await Promise.all([Admin.createIndexes(), Doctor.createIndexes()]);
    const admin = await Admin.create({
      email: adminEmail,
      passwordHash: await bcrypt.hash(password, 4),
      role: 'admin',
    });
    adminId = admin.id;
    app = await buildApp();
    await app.ready();
  }, 15000);

  afterAll(async () => {
    if (app) await app.close();
    await Doctor.deleteMany({ email });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await mongoose.disconnect();
  });

  async function loginCookie() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: adminEmail, password },
    });
    expect(response.statusCode).toBe(200);
    const setCookie = response.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!rawCookie) throw new Error('Login response did not set an access cookie.');
    return rawCookie.split(';')[0];
  }

  it('persists a doctor through create, read, filter, update and delete', async () => {
    const cookie = await loginCookie();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/doctors',
      headers: { cookie },
      payload: {
        firstName: 'Integration',
        lastName: 'Doctor',
        email: `  ${email.toUpperCase()}  `,
        phone: '+8801700000000',
        specialty: 'Cardiology',
        licenseNumber: ` test-${suffix} `,
        yearsOfExperience: 12,
        consultationFee: 1500,
        status: 'active',
      },
    });
    expect(created.statusCode).toBe(201);
    const doctor = created.json().data.doctor;
    expect(doctor.email).toBe(email);
    expect(doctor.licenseNumber).toBe(`TEST-${suffix.toUpperCase()}`);
    expect(await Doctor.countDocuments({ email })).toBe(1);

    const fetched = await app.inject({
      method: 'GET',
      url: `/api/v1/doctors/${doctor.id}`,
      headers: { cookie },
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.doctor.id).toBe(doctor.id);

    const filtered = await app.inject({
      method: 'GET',
      url: '/api/v1/doctors?search=Integration&status=active&page=1&limit=5',
      headers: { cookie },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.doctors.map((item: { id: string }) => item.id)).toContain(
      doctor.id,
    );

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/doctors/${doctor.id}`,
      headers: { cookie },
      payload: { specialty: 'Neurology', status: 'inactive', consultationFee: 1800 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.doctor.specialty).toBe('Neurology');
    expect(updated.json().data.doctor.status).toBe('inactive');
    expect((await Doctor.findById(doctor.id))?.consultationFee).toBe(1800);

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/doctors',
      headers: { cookie },
      payload: {
        firstName: 'Duplicate',
        lastName: 'Doctor',
        email,
        phone: '+8801700000001',
        specialty: 'Cardiology',
        licenseNumber: `OTHER-${suffix}`,
        yearsOfExperience: 2,
        consultationFee: 500,
        status: 'active',
      },
    });
    expect(duplicate.statusCode).toBe(409);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/doctors/${doctor.id}`,
      headers: { cookie },
    });
    expect(deleted.statusCode).toBe(200);
    expect(await Doctor.findById(doctor.id)).toBeNull();

    const missing = await app.inject({
      method: 'GET',
      url: `/api/v1/doctors/${doctor.id}`,
      headers: { cookie },
    });
    expect(missing.statusCode).toBe(404);
  });
});
