import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import mongoose from 'mongoose';
import { getRedis } from '../../database/redis.js';

const readinessSchema = z.object({
  status: z.literal('not_ready'),
  database: z.enum(['connected', 'disconnected']),
  replicaSet: z.enum(['connected', 'disconnected']),
  redis: z.enum(['connected', 'disconnected']),
});

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
      summary: 'Readiness probe including scheduling dependencies',
      response: {
        200: z.object({
          status: z.literal('ready'),
          database: z.literal('connected'),
          replicaSet: z.literal('connected'),
          redis: z.literal('connected'),
        }),
        503: readinessSchema,
      },
    },
  }, async (_request, reply) => {
    let database: 'connected' | 'disconnected' = 'disconnected';
    let replicaSet: 'connected' | 'disconnected' = 'disconnected';
    let redis: 'connected' | 'disconnected' = 'disconnected';

    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      database = 'connected';
      try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        if (typeof hello.setName === 'string' && hello.setName.length > 0) replicaSet = 'connected';
      } catch {
        replicaSet = 'disconnected';
      }
    }

    try {
      if (await getRedis().ping() === 'PONG') redis = 'connected';
    } catch {
      redis = 'disconnected';
    }

    if (database === 'connected' && replicaSet === 'connected' && redis === 'connected') {
      return { status: 'ready' as const, database, replicaSet, redis };
    }
    return reply.code(503).send({ status: 'not_ready' as const, database, replicaSet, redis });
  });
};
