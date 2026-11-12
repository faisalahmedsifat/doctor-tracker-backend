import { buildApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './database/connection.js';

async function start(): Promise<void> {
  const app = await buildApp();
  try {
    await connectDatabase();
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info({ port: env.PORT }, 'Doctor Tracker API is listening');
  } catch (error) {
    app.log.error(error, 'Failed to start API');
    await app.close();
    process.exitCode = 1;
    return;
  }

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down gracefully');
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}
void start();
