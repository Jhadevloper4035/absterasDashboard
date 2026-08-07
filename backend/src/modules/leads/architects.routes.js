import { Router } from 'express';
import { createArchitect, deleteArchitect, listArchitects } from './controllers/architect.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';

export const architectRouter = Router();

architectRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'));
architectRouter.get('/', asyncHandler(listArchitects));
architectRouter.post('/', asyncHandler(createArchitect));
architectRouter.delete('/:id', asyncHandler(deleteArchitect));
