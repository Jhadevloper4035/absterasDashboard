import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { architectRouter } from './modules/leads/architects.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientRouter } from './modules/clients/clients.routes.js';
import { challanRouter } from './modules/challans/challans.routes.js';
import { invoiceRouter } from './modules/invoices/invoices.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { designerRouter } from './modules/designer/designer.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { hrPermissionRouter } from './modules/hr/permissions.routes.js';
import { hrRouter } from './modules/hr/hr.routes.js';
import { inventoryPermissionRouter } from './modules/inventory/permissions.routes.js';
import { inventoryRouter } from './modules/inventory/inventory.routes.js';
import { laserCutRouter } from './modules/lasercut/lasercut.routes.js';
import { powderCoatingRouter } from './modules/powdercoating/powdercoating.routes.js';
import { returnRouter } from './modules/returns/returns.routes.js';
import { leadRouter } from './modules/leads/leads.routes.js';
import { notificationRouter } from './modules/notifications/notifications.routes.js';
import { taskRouter } from './modules/tasks/tasks.routes.js';
import { todoRouter } from './modules/tasks/todos.routes.js';
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
app.use('/api/hr/permissions', hrPermissionRouter);
app.use('/api/hr', hrRouter);
app.use('/api/inventory/permissions', inventoryPermissionRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/laser-cut-management', laserCutRouter);
app.use('/api/powder-coating-management', powderCoatingRouter);
app.use('/api/returns', returnRouter);
app.use('/api/auth', authRouter);
app.use('/api/architects', architectRouter);
app.use('/api/clients', clientRouter);
app.use('/api/challans', challanRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/designer', designerRouter);
app.use('/api/leads', leadRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/tasks', taskRouter);
app.use('/api/todos', todoRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/users', userRouter);

app.use(notFound);
app.use(errorHandler);
