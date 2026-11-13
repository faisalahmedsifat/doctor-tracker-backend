import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6381'),
  REDIS_LOCK_TTL_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  REDIS_LOCK_WAIT_MS: z.coerce.number().int().min(100).max(10000).default(3000),
  FRONTEND_ORIGIN: z.string().url().transform((value) => new URL(value).origin),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  JWT_ACCESS_SECRET: z.string().min(32),
  COOKIE_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
