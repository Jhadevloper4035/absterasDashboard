import { Router } from 'express';
import { listArchitects } from '../controllers/architect.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const architectRouter = Router();

architectRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'));
architectRouter.get('/', asyncHandler(listArchitects));
