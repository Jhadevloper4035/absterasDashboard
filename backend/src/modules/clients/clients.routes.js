import { Router } from 'express';
import { createClient, getClient, listClients, updateClient } from './controllers/client.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';

export const clientRouter = Router();
clientRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'operations'));
clientRouter.get('/', asyncHandler(listClients));
clientRouter.post('/', authorizeRoles('superadmin', 'admin'), asyncHandler(createClient));
clientRouter.get('/:id', asyncHandler(getClient));
clientRouter.patch('/:id', asyncHandler(updateClient));
