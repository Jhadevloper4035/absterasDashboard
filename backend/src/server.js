import mongoose from 'mongoose';
import { app } from './app.js';
import { connectDatabase } from './config/db.js';
import { env } from './config/env.js';

let shuttingDown = false;

async function start() {
  await connectDatabase();

  const server = app.listen(env.port, env.host, () => {
    console.log(`${env.appName} listening on http://${env.host}:${env.port}`);
  });

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down gracefully`);

    server.close(async () => {
      try {
        await mongoose.disconnect();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

start().catch((error) => {
  console.error('Failed to start API', error);
  process.exit(1);
});
