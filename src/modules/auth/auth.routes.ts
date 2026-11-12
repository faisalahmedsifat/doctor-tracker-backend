import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AppError } from '../../common/errors.js';
import { env } from '../../config/env.js';
import { ACCESS_COOKIE_NAME } from '../../plugins/security.js';
import { authenticateAdmin } from './auth.service.js';
import { authErrorSchema, authSuccessSchema, loginBodySchema } from './auth.schemas.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};

const errorResponse = z.object({
  success: z.literal(false),
  error: z.object({ code: z.string(), message: z.string() }),
});

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    schema: {
      tags: ['Auth'],
      summary: 'Sign in as an administrator',
      body: loginBodySchema,
      response: { 200: authSuccessSchema, 400: errorResponse, 401: authErrorSchema, 429: errorResponse },
    },
  }, async (request, reply) => {
    const admin = await authenticateAdmin(request.body.email, request.body.password);
    const token = app.jwt.sign({ sub: admin.id, email: admin.email, role: admin.role });
    reply.setCookie(ACCESS_COOKIE_NAME, token, {
      ...cookieOptions,
      signed: true,
      maxAge: 15 * 60,
    });
    return reply.send({ success: true as const, data: { admin } });
  });

  app.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Sign out the current administrator',
      response: { 200: z.object({ success: z.literal(true) }) },
    },
  }, async (_request, reply) => {
    reply.clearCookie(ACCESS_COOKIE_NAME, cookieOptions);
    return { success: true as const };
  });

  app.get('/me', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Auth'],
      summary: 'Get the current administrator',
      response: { 200: authSuccessSchema, 401: authErrorSchema },
    },
  }, async (request) => {
    if (!request.authAdmin) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.');
    return { success: true as const, data: { admin: request.authAdmin } };
  });
};
