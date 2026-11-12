import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import mongoose from 'mongoose';

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      response: { 200: z.object({ status: z.literal('ok') }) },
    },
  }, async () => ({ status: 'ok' as const }));

  app.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      response: {
        200: z.object({ status: z.literal('ready'), database: z.literal('connected') }),
        503: z.object({ status: z.literal('not_ready'), database: z.literal('disconnected') }),
      },
    },
  }, async (_request, reply) => {
    if (mongoose.connection.readyState !== 1) {
      return reply.code(503).send({ status: 'not_ready' as const, database: 'disconnected' as const });
    }
    return { status: 'ready' as const, database: 'connected' as const };
  });
};
