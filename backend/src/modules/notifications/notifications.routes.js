import { Router } from 'express';
import { listUnreadNotifications, markNotificationsRead } from './controllers/notification.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';
import { USER_ROLES } from '../../models/user.model.js';

export const notificationRouter = Router();

notificationRouter.use(asyncHandler(authenticate), authorizeRoles(...USER_ROLES));
notificationRouter.get('/unread', asyncHandler(listUnreadNotifications));
notificationRouter.post('/read', asyncHandler(markNotificationsRead));
