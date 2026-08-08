import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { startEmailWorker } from './services/email-queue.service.js';

async function start() {
  await connectDatabase();
  const worker = startEmailWorker();
  const stop = async () => {
    await worker.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

start().catch((error) => {
  console.error('Failed to start email worker', error);
  process.exit(1);
});
