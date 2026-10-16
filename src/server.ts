import type { Server } from 'node:http';
import { loadEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { initModels } from './models';
import { createApp } from './app';

async function shutdown(server: Server, signal: string): Promise<void> {
  console.log(`${signal} received, shutting down gracefully`);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDatabase();
  console.log('Shutdown complete');
  process.exit(0);
}

async function main(): Promise<void> {
  const env = loadEnv();
  await connectDatabase(env.MONGODB_URI);
  await initModels();
  const server = createApp().listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void shutdown(server, signal);
    });
  }
}

main().catch((err: unknown) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
