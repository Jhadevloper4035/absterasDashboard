import { Router } from 'express';
import { login, logout, me, refresh } from '../controllers/auth.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rate-limit.middleware.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(rateLimit({ scope: 'login', limit: 10, windowMs: 15 * 60 * 1000 })), asyncHandler(login));
authRouter.post('/refresh', asyncHandler(rateLimit({ scope: 'refresh', limit: 60, windowMs: 15 * 60 * 1000 })), asyncHandler(refresh));
authRouter.post('/logout', asyncHandler(logout));
authRouter.get('/me', asyncHandler(authenticate), me);
