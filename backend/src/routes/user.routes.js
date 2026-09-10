import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUser,
  approvePasswordResetRequest,
  listLoginHistory,
  listMyPasswordResetHistory,
  listPasswordResetRequests,
  listUsers,
  logoutAllUsers,
  logoutUser,
  requestPasswordReset,
  updateUser,
} from '../controllers/user.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  allowFirstSuperadminOrUserManager,
  authenticate,
  authorizeRoles,
} from '../modules/auth/middleware/auth.middleware.js';

export const userRouter = Router();

userRouter.get('/', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(listUsers));
userRouter.get('/login-history', asyncHandler(authenticate), asyncHandler(listLoginHistory));
userRouter.post('/password-reset-requests', asyncHandler(authenticate), asyncHandler(requestPasswordReset));
userRouter.get('/password-reset-requests/history', asyncHandler(authenticate), asyncHandler(listMyPasswordResetHistory));
userRouter.get('/password-reset-requests', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(listPasswordResetRequests));
userRouter.post('/password-reset-requests/:id/approve', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(approvePasswordResetRequest));
userRouter.post('/', asyncHandler(allowFirstSuperadminOrUserManager), asyncHandler(createUser));
userRouter.post('/logout-all', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(logoutAllUsers));
userRouter.post('/:id/logout', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(logoutUser));
userRouter.get('/:id', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(getUser));
userRouter.patch('/:id', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(updateUser));
userRouter.delete('/:id', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(deleteUser));
