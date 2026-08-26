import { Router } from 'express';
import { createLead, deleteLead, getLead, listLeadAssignees, listLeads, updateLead } from './controllers/lead.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const leadRouter = Router();
leadRouter.use(asyncHandler(authenticate), authorizeAppModule('leads'));
leadRouter.get('/', asyncHandler(listLeads));
leadRouter.get('/assignees', asyncHandler(listLeadAssignees));
leadRouter.post('/', authorizeAppModule('leads', 'manage'), asyncHandler(createLead));
leadRouter.get('/:id', asyncHandler(getLead));
leadRouter.patch('/:id', authorizeAppModule('leads', 'manage'), asyncHandler(updateLead));
leadRouter.delete('/:id', authorizeAppModule('leads', 'manage'), asyncHandler(deleteLead));
