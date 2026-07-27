import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { architectRouter } from './routes/architect.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { leadRouter } from './routes/lead.routes.js';
import { todoRouter } from './routes/todo.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { userRouter } from './routes/user.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/architects', architectRouter);
app.use('/api/leads', leadRouter);
app.use('/api/todos', todoRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/users', userRouter);

app.use(notFound);
app.use(errorHandler);
