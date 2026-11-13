import { createServer } from 'node:http';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';
import { connectRedis, disconnectRedis } from './database/redis.js';

async function start(): Promise<void> {
  const app = buildApp();
  const server = createServer(app);
  try {
    await connectDatabase();
    await connectRedis();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(env.PORT, env.HOST, () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
    console.info({ port: env.PORT, host: env.HOST }, 'Doctor Tracker API is listening');
  } catch (error) {
    console.error('Failed to start API', error);
    server.close();
    await disconnectRedis().catch(() => undefined);
    await disconnectDatabase().catch(() => undefined);
    process.exitCode = 1;
    return;
  }

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info({ signal }, 'Shutting down gracefully');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectRedis();
    await disconnectDatabase();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
void start();
