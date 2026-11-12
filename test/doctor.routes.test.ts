import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('doctor HTTP boundary', () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = await buildApp(); await app.ready(); });
  afterAll(async () => { await app.close(); });

  it('requires an authenticated administrator for every doctor operation', async () => {
    const validDoctor = {
      firstName: 'Sarah', lastName: 'Ahmed', email: 'sarah@example.com',
      phone: '+8801712345678', specialty: 'Cardiology', licenseNumber: 'BM-12345',
      yearsOfExperience: 8, consultationFee: 1200, status: 'active',
    };
    const requests = [
      { method: 'GET' as const, url: '/api/v1/doctors' },
      { method: 'GET' as const, url: '/api/v1/doctors/507f1f77bcf86cd799439011' },
      { method: 'POST' as const, url: '/api/v1/doctors', payload: validDoctor },
      { method: 'PATCH' as const, url: '/api/v1/doctors/507f1f77bcf86cd799439011', payload: { status: 'inactive' } },
      { method: 'DELETE' as const, url: '/api/v1/doctors/507f1f77bcf86cd799439011' },
    ];
    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHENTICATED');
    }
  });
});
