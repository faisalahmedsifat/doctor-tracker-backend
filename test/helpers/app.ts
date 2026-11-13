import type { Express } from 'express';
import request from 'supertest';

interface TestRequestOptions {
  method?: string;
  url: string;
  headers?: Record<string, string>;
  payload?: unknown;
  cookies?: Record<string, string>;
}

export interface TestClient {
  request(options: TestRequestOptions): Promise<{
    statusCode: number;
    // Supertest exposes heterogeneous Node header values.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers: any;
    // The integration suite asserts endpoint-specific JSON response shapes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json(): any;
  }>;
}

export function createTestClient(app: Express): TestClient {
  return {
    async request(options) {
      const agent = request(app);
      const method = (options.method ?? 'GET').toUpperCase();
      let call = method === 'POST' ? agent.post(options.url) : method === 'PATCH' ? agent.patch(options.url) : method === 'DELETE' ? agent.delete(options.url) : method === 'PUT' ? agent.put(options.url) : agent.get(options.url);
      if (options.headers) call = call.set(options.headers);
      if (options.cookies) {
        const cookieHeader = Object.entries(options.cookies).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('; ');
        call = call.set('Cookie', cookieHeader);
      }
      if (options.payload !== undefined) call = call.type('json').send(options.payload as object);
      const response = await call;
      return {
        statusCode: response.status,
        headers: { ...response.headers, 'set-cookie': Array.isArray(response.headers['set-cookie']) ? response.headers['set-cookie'].join('; ') : response.headers['set-cookie'] },
        json: () => response.body,
      };
    },
  };
}
