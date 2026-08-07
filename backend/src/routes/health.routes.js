import { Router } from 'express';
import { getHealth, getHealthStatus, sendHealthTestEmail } from '../controllers/health.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../modules/auth/middleware/auth.middleware.js';

export const healthRouter = Router();

healthRouter.get('/', asyncHandler(getHealth));
healthRouter.get('/status', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(getHealthStatus));
healthRouter.post('/email-test', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(sendHealthTestEmail));
