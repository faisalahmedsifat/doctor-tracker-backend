import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('authentication HTTP boundary', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not expose an administrator registration endpoint', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/register' });
    expect(response.statusCode).toBe(404);
  });

  it('rejects access to the current-admin endpoint without a token', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed or unsigned access cookie', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      cookies: { doctor_tracker_access: 'not-a-valid-token' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows logout without a session and clears the cookie', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('doctor_tracker_access=');
  });

  it('rejects state-changing requests from an untrusted browser origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: 'https://attacker.example' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('allows the configured frontend origin', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(response.statusCode).toBe(200);
  });

  it('validates login payloads and rate-limits repeated attempts', async () => {
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'not-an-email', password: 'x' },
    });
    expect(first.statusCode).toBe(400);

    let lastResponse = first;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      lastResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'not-an-email', password: 'x' },
      });
    }

    expect(lastResponse.statusCode).toBe(429);
    expect(lastResponse.json().error.code).toBe('RATE_LIMITED');
  });
});
