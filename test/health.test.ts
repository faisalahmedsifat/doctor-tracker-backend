import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestClient } from './helpers/app.js';
import { buildApp } from '../src/app.js';
import { createTestClient } from './helpers/app.js';

describe('health endpoints', () => {
  let app: TestClient;

  beforeAll(async () => {
    app = createTestClient(buildApp());
   ;
  });

  afterAll(async () => {
  });

  it('reports liveness without depending on MongoDB', async () => {
    const response = await app.request({ method: 'GET', url: '/api/v1/health/live' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('reports not-ready when MongoDB is disconnected', async () => {
    const response = await app.request({ method: 'GET', url: '/api/v1/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'not_ready', database: 'disconnected', replicaSet: 'disconnected', redis: 'disconnected' });
  });

  it('exposes the API documentation', async () => {
    const response = await app.request({ method: 'GET', url: '/documentation/json' });
    expect(response.statusCode).toBe(200);
    expect(response.json().info.title).toBe('Doctor Tracker API');
  });
});
