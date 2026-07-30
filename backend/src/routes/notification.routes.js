import { Router } from 'express';
import { listUnreadNotifications, markNotificationsRead } from '../controllers/notification.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'sales'));
notificationRouter.get('/unread', asyncHandler(listUnreadNotifications));
notificationRouter.post('/read', asyncHandler(markNotificationsRead));
