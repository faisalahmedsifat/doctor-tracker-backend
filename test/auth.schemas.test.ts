import { describe, expect, it } from 'vitest';
import { loginBodySchema } from '../src/modules/auth/auth.schemas.js';

describe('login request schema', () => {
  it('normalizes email addresses', () => {
    expect(loginBodySchema.parse({ email: '  ADMIN@Example.com ', password: 'secret' }).email)
      .toBe('admin@example.com');
  });

  it('rejects malformed email addresses', () => {
    expect(loginBodySchema.safeParse({ email: 'not-an-email', password: 'secret' }).success).toBe(false);
  });

  it('rejects unexpected fields', () => {
    expect(loginBodySchema.safeParse({
      email: 'admin@example.com',
      password: 'secret',
      role: 'superadmin',
    }).success).toBe(false);
  });

  it('rejects empty and excessively long passwords', () => {
    expect(loginBodySchema.safeParse({ email: 'admin@example.com', password: '' }).success).toBe(false);
    expect(loginBodySchema.safeParse({ email: 'admin@example.com', password: 'x'.repeat(129) }).success).toBe(false);
  });
});
