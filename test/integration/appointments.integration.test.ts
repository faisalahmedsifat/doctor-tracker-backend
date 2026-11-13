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
import { Appointment } from '../../src/modules/appointments/appointment.model.js';
import { connectRedis, disconnectRedis, getRedis } from '../../src/database/redis.js';

describe('appointments MongoDB integration', () => {
  let app: FastifyInstance;
  let adminId = '';
  let doctorId = '';
  let secondDoctorId = '';
  let patientId = '';
  const appointmentIds: string[] = [];
  const suffix = randomUUID();
  const email = `appointments-admin-${suffix}@example.com`;
  const password = 'Appointments-Integration-Password-2026!';
  let cookie = '';

  beforeAll(async () => {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await connectRedis();
    await Promise.all([Admin.createIndexes(), Doctor.createIndexes(), Patient.createIndexes(), Appointment.createIndexes()]);
    const admin = await Admin.create({ email, passwordHash: await bcrypt.hash(password, 4), role: 'admin' });
    adminId = admin._id.toString();
    const doctor = await Doctor.create({
      firstName: 'Appointment', lastName: 'Doctor', email: `appointment-doctor-${suffix}@example.com`,
      phone: '+8801700000410', specialty: 'General Medicine', licenseNumber: `AP-${suffix}`,
      yearsOfExperience: 8, consultationFee: 1000, status: 'active',
    });
    doctorId = doctor._id.toString();
    const secondDoctor = await Doctor.create({
      firstName: 'Independent', lastName: 'Doctor', email: `independent-doctor-${suffix}@example.com`,
      phone: '+8801700000412', specialty: 'Cardiology', licenseNumber: `AP2-${suffix}`,
      yearsOfExperience: 12, consultationFee: 1500, status: 'active',
    });
    secondDoctorId = secondDoctor._id.toString();
    const patient = await Patient.create({
      patientNumber: `PT-${suffix.slice(0, 10).toUpperCase()}`, firstName: 'Appointment', lastName: 'Patient',
      dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'female', phone: '+8801700000411', status: 'active',
    });
    patientId = patient._id.toString();
    app = await buildApp();
    await app.ready();
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { email, password } });
    expect(login.statusCode).toBe(200);
    const setCookie = login.headers['set-cookie'];
    const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    if (!rawCookie) throw new Error('Login did not set a session cookie.');
    cookie = rawCookie.split(';')[0]!;
  }, 15000);

  afterAll(async () => {
    if (app) await app.close();
    if (appointmentIds.length) await Appointment.deleteMany({ _id: { $in: appointmentIds } });
    if (patientId) await Patient.deleteOne({ _id: patientId });
    if (doctorId) await Doctor.deleteOne({ _id: doctorId });
    if (secondDoctorId) await Doctor.deleteOne({ _id: secondDoctorId });
    if (adminId) await Admin.deleteOne({ _id: adminId });
    await disconnectRedis();
    await mongoose.disconnect();
  });

  it('reports readiness only when MongoDB replica set and Redis are healthy', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ready', database: 'connected', replicaSet: 'connected', redis: 'connected',
    });
  });

  it('requires administrator authentication', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/appointments' });
    expect(response.statusCode).toBe(401);
  });

  it('creates, lists, prevents overlaps, updates status and deletes persisted appointments', async () => {
    const startAt = new Date(Date.now() + 5 * 86_400_000);
    startAt.setUTCHours(10, 0, 0, 0);
    const payload = { patientId, doctorId, startAt: startAt.toISOString(), durationMinutes: 30, reason: 'Integration check' };
    const create = await app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload });
    expect(create.statusCode).toBe(201);
    const appointment = create.json().data.appointment;
    appointmentIds.push(appointment.id);
    expect(appointment.patient.fullName).toBe('Appointment Patient');
    expect(await Appointment.findById(appointment.id)).not.toBeNull();

    const list = await app.inject({ method: 'GET', url: '/api/v1/appointments?status=scheduled', headers: { cookie } });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.appointments.some((item: { id: string }) => item.id === appointment.id)).toBe(true);

    const conflict = await app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('APPOINTMENT_CONFLICT');

    // Two simultaneous requests for the same doctor and slot must not both commit.
    const concurrentStart = new Date(startAt.getTime() + 2 * 60 * 60_000).toISOString();
    const concurrentPayload = { ...payload, startAt: concurrentStart };
    const simultaneous = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload: concurrentPayload }),
      app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload: concurrentPayload }),
    ]);
    expect(simultaneous.filter((response) => response.statusCode === 201)).toHaveLength(1);
    expect(simultaneous.filter((response) => response.statusCode === 409)).toHaveLength(1);
    const simultaneousCreated = simultaneous.find((response) => response.statusCode === 201);
    if (simultaneousCreated) appointmentIds.push(simultaneousCreated.json().data.appointment.id);

    // Different doctors have independent schedules and may accept the same slot.
    const independentStart = new Date(startAt.getTime() + 4 * 60 * 60_000).toISOString();
    const independent = await Promise.all([
      app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload: { ...payload, startAt: independentStart } }),
      app.inject({ method: 'POST', url: '/api/v1/appointments', headers: { cookie }, payload: { ...payload, doctorId: secondDoctorId, startAt: independentStart } }),
    ]);
    expect(independent.map((response) => response.statusCode).sort()).toEqual([201, 201]);
    for (const response of independent) appointmentIds.push(response.json().data.appointment.id);

    // A reschedule must re-run conflict detection under the same doctor lock.
    const movableStart = new Date(startAt.getTime() + 60 * 60_000).toISOString();
    const movable = await app.inject({
      method: 'POST', url: '/api/v1/appointments', headers: { cookie },
      payload: { ...payload, startAt: movableStart },
    });
    expect(movable.statusCode).toBe(201);
    const movableId = movable.json().data.appointment.id;
    appointmentIds.push(movableId);
    const moveIntoConflict = await app.inject({
      method: 'PATCH', url: `/api/v1/appointments/${movableId}`, headers: { cookie },
      payload: { startAt: new Date(startAt.getTime() + 15 * 60_000).toISOString() },
    });
    expect(moveIntoConflict.statusCode).toBe(409);
    expect((await Appointment.findById(movableId).lean())?.startAt.toISOString()).toBe(movableStart);

    const update = await app.inject({ method: 'PATCH', url: `/api/v1/appointments/${appointment.id}`, headers: { cookie }, payload: { status: 'confirmed' } });
    expect(update.statusCode).toBe(200);
    expect(update.json().data.appointment.status).toBe('confirmed');

    const protectedPatientDelete = await app.inject({ method: 'DELETE', url: `/api/v1/patients/${patientId}`, headers: { cookie } });
    expect(protectedPatientDelete.statusCode).toBe(409);
    const protectedDoctorDelete = await app.inject({ method: 'DELETE', url: `/api/v1/doctors/${doctorId}`, headers: { cookie } });
    expect(protectedDoctorDelete.statusCode).toBe(409);

    const remove = await app.inject({ method: 'DELETE', url: `/api/v1/appointments/${appointment.id}`, headers: { cookie } });
    expect(remove.statusCode).toBe(200);
    expect(await Appointment.findById(appointment.id)).toBeNull();
  });

  it('does not steal or release a lock owned by another request', async () => {
    const key = `doctor-tracker:appointment-lock:doctor:${doctorId}`;
    const token = `external-owner-${suffix}`;
    const redis = getRedis();
    await redis.set(key, token, 'PX', 15000, 'NX');
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers: { cookie },
      payload: {
        patientId, doctorId,
        startAt: new Date(Date.now() + 9 * 86_400_000).toISOString(),
        durationMinutes: 30,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('APPOINTMENT_SCHEDULING_BUSY');
    expect(await redis.get(key)).toBe(token);
    await redis.del(key);
  });

  it('fails closed when Redis is unavailable', async () => {
    await disconnectRedis();
    const startAt = new Date(Date.now() + 8 * 86_400_000).toISOString();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/appointments',
      headers: { cookie },
      payload: { patientId, doctorId, startAt, durationMinutes: 30, reason: 'Redis outage check' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('SCHEDULING_COORDINATOR_UNAVAILABLE');
    await connectRedis();
  });
});
