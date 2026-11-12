import Fastify, { type FastifyError } from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { AppError } from './common/errors.js';
import { registerSecurity } from './plugins/security.js';
import { registerAuthentication } from './plugins/authentication.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { doctorRoutes } from './modules/doctors/doctor.routes.js';
import { patientRoutes } from './modules/patients/patient.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: env.NODE_ENV === 'production',
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await registerSecurity(app);
  await registerAuthentication(app);
  await registerOpenApi(app);

  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    }),
  );

  // Install the error handler before registering route plugins so that their
  // encapsulated contexts inherit the same response contract.
  app.setErrorHandler(async (error: FastifyError | AppError, request, reply) => {
    request.log.error({ err: error }, 'Request failed');

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      });
    }

    if ('statusCode' in error && error.statusCode === 429 && 'success' in error) {
      return reply.code(429).send(error);
    }

    const statusCode =
      error.statusCode && error.statusCode >= 400 && error.statusCode < 500
        ? error.statusCode
        : 500;
    return reply.code(statusCode).send({
      success: false,
      error: {
        code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
        message: statusCode >= 500 ? 'An unexpected error occurred.' : error.message,
      },
    });
  });

  // Reject cross-origin state-changing browser requests. Requests without an Origin
  // header (health checks, CLI clients, server-to-server calls) remain supported.
  app.addHook('onRequest', async (request) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
    const origin = request.headers.origin;
    if (origin && origin !== env.FRONTEND_ORIGIN) {
      throw new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.');
    }
  });

  app.get('/', async () => ({
    name: 'Doctor Tracker API',
    version: '1.0.0',
    documentation: '/documentation',
    health: '/api/v1/health/live',
  }));

  await app.register(healthRoutes, { prefix: '/api/v1/health' });
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(doctorRoutes, { prefix: '/api/v1/doctors' });
  await app.register(patientRoutes, { prefix: '/api/v1/patients' });

  return app;
}
