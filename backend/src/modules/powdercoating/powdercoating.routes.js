import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeInventoryModule } from '../auth/middleware/auth.middleware.js';
import * as controller from './powdercoating.controller.js';

export const powderCoatingRouter = Router();
powderCoatingRouter.use(asyncHandler(authenticate), authorizeInventoryModule('items'));
powderCoatingRouter.get('/summary', asyncHandler(controller.summary));
powderCoatingRouter.get('/vendors', asyncHandler(controller.listVendors));
powderCoatingRouter.post('/vendors', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.createVendor));
powderCoatingRouter.patch('/vendors/:id', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.updateVendor));
powderCoatingRouter.delete('/vendors/:id', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.deleteVendor));
powderCoatingRouter.get('/orders', asyncHandler(controller.listOrders));
powderCoatingRouter.get('/orders/:id', asyncHandler(controller.getOrder));
powderCoatingRouter.post('/orders', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.createOrder));
powderCoatingRouter.post('/orders/:id/receive', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.receiveOrder));
powderCoatingRouter.post('/orders/:id/dispatch-to-site', authorizeInventoryModule('items', 'manage'), asyncHandler(controller.dispatchToSite));
powderCoatingRouter.get('/challans', asyncHandler(controller.listChallans));
