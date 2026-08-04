import { Router } from 'express';
import {
  createUser,
  getUser,
  listLoginHistory,
  listUsers,
  logoutAllUsers,
  logoutUser,
  updateUser,
} from '../controllers/user.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  allowFirstSuperadminOrUserManager,
  authenticate,
  authorizeRoles,
} from '../middleware/auth.middleware.js';

export const userRouter = Router();

userRouter.get('/', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(listUsers));
userRouter.get('/login-history', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(listLoginHistory));
userRouter.post('/', asyncHandler(allowFirstSuperadminOrUserManager), asyncHandler(createUser));
userRouter.post('/logout-all', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(logoutAllUsers));
userRouter.post('/:id/logout', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(logoutUser));
userRouter.get('/:id', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(getUser));
userRouter.patch('/:id', asyncHandler(authenticate), authorizeRoles('superadmin', 'admin'), asyncHandler(updateUser));
