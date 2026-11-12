import type { FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { env } from '../config/env.js';

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  await app.register(helmet);
  await app.register(cors, {
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(cookie, { secret: env.COOKIE_SECRET });
  await app.register(jwt, { secret: env.JWT_ACCESS_SECRET, sign: { expiresIn: env.ACCESS_TOKEN_TTL } });
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
}
