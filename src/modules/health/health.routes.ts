import { Router, type Router as ExpressRouter } from 'express';
import mongoose from 'mongoose';
import { getRedis } from '../../database/redis.js';

export const healthRoutes: ExpressRouter = Router();

healthRoutes.get('/live', (_request, response) => response.json({ status: 'ok' }));

healthRoutes.get('/ready', async (_request, response) => {
  let database: 'connected' | 'disconnected' = 'disconnected';
  let replicaSet: 'connected' | 'disconnected' = 'disconnected';
  let redis: 'connected' | 'disconnected' = 'disconnected';

  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    database = 'connected';
    try {
      const hello = await mongoose.connection.db.admin().command({ hello: 1 });
      if (typeof hello.setName === 'string' && hello.setName.length > 0) replicaSet = 'connected';
    } catch { replicaSet = 'disconnected'; }
  }
  try {
    if (await getRedis().ping() === 'PONG') redis = 'connected';
  } catch { redis = 'disconnected'; }

  if (database === 'connected' && replicaSet === 'connected' && redis === 'connected') {
    response.json({ status: 'ready', database, replicaSet, redis });
  } else {
    response.status(503).json({ status: 'not_ready', database, replicaSet, redis });
  }
});
