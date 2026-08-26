import { Router } from 'express';
import { createClient, getClient, listClients, updateClient } from './controllers/client.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const clientRouter = Router();
clientRouter.use(asyncHandler(authenticate), authorizeAppModule('clients'));
clientRouter.get('/', asyncHandler(listClients));
clientRouter.post('/', authorizeAppModule('clients', 'manage'), asyncHandler(createClient));
clientRouter.get('/:id', asyncHandler(getClient));
clientRouter.patch('/:id', authorizeAppModule('clients', 'manage'), asyncHandler(updateClient));
