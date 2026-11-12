import Fastify, { type FastifyError } from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { env } from './config/env.js';
import { registerSecurity } from './plugins/security.js';
import { registerOpenApi } from './plugins/openapi.js';
import { healthRoutes } from './modules/health/health.routes.js';

export async function buildApp() {
  const app = Fastify({ logger: { level: env.LOG_LEVEL }, trustProxy: env.NODE_ENV === 'production' });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerSecurity(app);
  await registerOpenApi(app);
  app.get('/', async () => ({ name: 'Doctor Tracker API', version: '1.0.0', documentation: '/documentation', health: '/api/v1/health/live' }));
  await app.register(healthRoutes, { prefix: '/api/v1/health' });
  app.setNotFoundHandler(async (_request, reply) => reply.code(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'The requested resource was not found.' } }));
  app.setErrorHandler(async (error: FastifyError, request, reply) => {
    request.log.error({ err: error }, 'Request failed');
    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    return reply.code(statusCode).send({ success: false, error: { code: statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR', message: statusCode >= 500 ? 'An unexpected error occurred.' : error.message } });
  });
  return app;
}
