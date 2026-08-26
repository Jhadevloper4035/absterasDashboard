import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';
import { createReturn, listReturnProducts, listReturns } from './controllers/return.controller.js';

export const returnRouter = Router();
returnRouter.use(asyncHandler(authenticate), authorizeAppModule('returns'));
returnRouter.get('/', asyncHandler(listReturns));
returnRouter.post('/', authorizeAppModule('returns', 'manage'), asyncHandler(createReturn));
returnRouter.get('/products', asyncHandler(listReturnProducts));
