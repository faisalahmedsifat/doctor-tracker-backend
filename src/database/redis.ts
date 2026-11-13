import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { AppError } from '../common/errors.js';

let client: Redis | undefined;

export async function connectRedis(): Promise<void> {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 5_000,
      retryStrategy: (attempt) => Math.min(attempt * 100, 1_000),
    });
    client.on('error', () => {
      // The connection state is checked by operations; do not log credentials or URLs.
    });
  }
  if (client.status === 'wait' || client.status === 'end') await client.connect();
  const pong = await client.ping();
  if (pong !== 'PONG') throw new Error('Redis health check failed.');
}

export function getRedis(): Redis {
  if (!client || client.status !== 'ready') {
    throw new AppError(503, 'SCHEDULING_COORDINATOR_UNAVAILABLE', 'Appointment scheduling is temporarily unavailable. Please try again.');
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    const current = client;
    client = undefined;
    if (current.status === 'ready') await current.quit();
    else current.disconnect();
  }
}
