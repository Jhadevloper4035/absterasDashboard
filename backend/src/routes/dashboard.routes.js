import { Router } from 'express';
import { dashboardSummary, dashboardSummaryCsv } from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';
import { USER_ROLES } from '../models/user.model.js';

export const dashboardRouter = Router();

dashboardRouter.use(asyncHandler(authenticate), authorizeRoles(...USER_ROLES));
dashboardRouter.get('/summary', asyncHandler(dashboardSummary));
dashboardRouter.get('/summary.csv', asyncHandler(dashboardSummaryCsv));
