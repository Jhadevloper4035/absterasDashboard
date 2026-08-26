import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';
import { getInventoryPermissions, getMyInventoryAccess, updateInventoryPermissions } from './controllers/permissions.controller.js';
export const inventoryPermissionRouter = Router();
inventoryPermissionRouter.get('/me', asyncHandler(authenticate), asyncHandler(getMyInventoryAccess));
inventoryPermissionRouter.get('/:userId', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(getInventoryPermissions));
inventoryPermissionRouter.put('/:userId', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(updateInventoryPermissions));
