import mongoose from 'mongoose';
import { connectDatabase } from './config/db.js';
import { startEmailWorker } from './services/email-queue.service.js';
import { startBirthdayNotifier } from './modules/hr/services/birthday-notification.service.js';

async function start() {
  await connectDatabase();
  const worker = startEmailWorker();
  const birthdayNotifier = startBirthdayNotifier();
  const stop = async () => {
    clearInterval(birthdayNotifier);
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
