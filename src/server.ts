import { Server } from 'http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';

async function start(): Promise<void> {
  try {
    await connectDatabase(env.mongoUri);
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const server: Server = createApp().listen(env.port, () => {
    console.log(`Server listening on port ${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      disconnectDatabase()
        .catch((e) => console.error('Error during disconnect:', e))
        .finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void start();
