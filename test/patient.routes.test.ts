import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('patient HTTP boundary', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires an authenticated administrator for every patient operation', async () => {
    const validPatient = {
      firstName: 'Test',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
      gender: 'prefer_not_to_say',
      phone: '+8801700000000',
    };
    const requests = [
      { method: 'GET' as const, url: '/api/v1/patients' },
      { method: 'GET' as const, url: '/api/v1/patients/507f1f77bcf86cd799439011' },
      { method: 'POST' as const, url: '/api/v1/patients', payload: validPatient },
      {
        method: 'PATCH' as const,
        url: '/api/v1/patients/507f1f77bcf86cd799439011',
        payload: { status: 'inactive' },
      },
      { method: 'DELETE' as const, url: '/api/v1/patients/507f1f77bcf86cd799439011' },
    ];

    for (const request of requests) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHENTICATED');
    }
  });
});
