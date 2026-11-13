import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestClient } from './helpers/app.js';
import { buildApp } from '../src/app.js';
import { createTestClient } from './helpers/app.js';

describe('dashboard access control', () => {
  let app: TestClient;
  beforeAll(async () => {
    app = createTestClient(buildApp());
   ;
  });
  afterAll(async () => {
  });
  it('requires an authenticated administrator to read the overview', async () => {
    const response = await app.request({ method: 'GET', url: '/api/v1/dashboard/overview' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHENTICATED');
  });
});
