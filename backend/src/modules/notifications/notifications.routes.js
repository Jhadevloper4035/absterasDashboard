import { Router } from 'express';
import { listUnreadNotifications, markNotificationsRead } from './controllers/notification.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(asyncHandler(authenticate), authorizeAppModule('notifications'));
notificationRouter.get('/unread', asyncHandler(listUnreadNotifications));
notificationRouter.post('/read', authorizeAppModule('notifications', 'manage'), asyncHandler(markNotificationsRead));
