import { Router } from 'express';
import { login, me } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate } from '../middleware/auth.middleware.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(login));
authRouter.get('/me', asyncHandler(authenticate), me);
