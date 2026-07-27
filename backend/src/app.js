import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { userRouter } from './routes/user.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/leads', leadRouter);
app.use('/api/users', userRouter);

app.use(notFound);
app.use(errorHandler);
