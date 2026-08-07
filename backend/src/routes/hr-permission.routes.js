import { Router } from 'express';
import { getHrPermissions, getMyHrAccess, updateHrPermissions } from '../controllers/hr-permission.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const hrPermissionRouter = Router();

hrPermissionRouter.get('/me', asyncHandler(authenticate), asyncHandler(getMyHrAccess));
hrPermissionRouter.get('/:userId', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(getHrPermissions));
hrPermissionRouter.put('/:userId', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(updateHrPermissions));
