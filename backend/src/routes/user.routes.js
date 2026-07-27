import { Router } from 'express';
import {
  createUser,
  getUser,
  listUsers,
  updateUser,
} from '../controllers/user.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import {
  allowFirstSuperadminOrSuperadmin,
  authenticate,
  authorizeRoles,
} from '../middleware/auth.middleware.js';

export const userRouter = Router();

userRouter.get('/', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(listUsers));
userRouter.post('/', asyncHandler(allowFirstSuperadminOrSuperadmin), asyncHandler(createUser));
userRouter.get('/:id', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(getUser));
userRouter.patch('/:id', asyncHandler(authenticate), authorizeRoles('superadmin'), asyncHandler(updateUser));
