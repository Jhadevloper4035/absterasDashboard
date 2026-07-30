import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });

  if (mongoose.connection.readyState !== 1) {
    throw new Error(`MongoDB did not reach connected state: ${databaseHealth().state}`);
  }

  console.log(`MongoDB connected to ${mongoose.connection.name}`);
}

export function databaseHealth() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[mongoose.connection.readyState] || 'unknown',
    name: mongoose.connection.name || null,
  };
}
