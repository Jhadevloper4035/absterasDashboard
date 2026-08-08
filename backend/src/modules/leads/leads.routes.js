import { Router } from 'express';
import { createLead, deleteLead, getLead, listLeadAssignees, listLeads, updateLead } from './controllers/lead.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';
import { USER_ROLES } from '../../models/user.model.js';

export const leadRouter = Router();
leadRouter.use(asyncHandler(authenticate), authorizeRoles(...USER_ROLES));
leadRouter.get('/', asyncHandler(listLeads));
leadRouter.get('/assignees', asyncHandler(listLeadAssignees));
leadRouter.post('/', asyncHandler(createLead));
leadRouter.get('/:id', asyncHandler(getLead));
leadRouter.patch('/:id', asyncHandler(updateLead));
leadRouter.delete('/:id', asyncHandler(deleteLead));
