import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { architectRouter } from './routes/architect.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { taskRouter } from './routes/task.routes.js';
import { todoRouter } from './routes/todo.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { userRouter } from './routes/user.routes.js';

export const app = express();

export function createTrustProxySetting() {
  if (process.env.TRUST_PROXY === 'true') return true;
  if (process.env.TRUST_PROXY === 'false') return false;
  if (process.env.TRUST_PROXY) return Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY;
  return env.isProduction ? 1 : false;
}

export function createCorsOptions() {
  const corsOrigins = env.corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean);

  if (env.isProduction && corsOrigins.includes('*')) {
    throw new Error('CORS_ORIGIN must list explicit origins in production');
  }

  return { origin: corsOrigins.includes('*') ? true : corsOrigins, credentials: true };
}

app.set('trust proxy', createTrustProxySetting());
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/architects', architectRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/leads', leadRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/todos', todoRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/users', userRouter);

app.use(notFound);
app.use(errorHandler);
