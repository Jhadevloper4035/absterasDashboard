import { Router } from 'express';
import {
  createLead,
  deleteLead,
  getLead,
  listLeads,
  updateLead,
} from '../controllers/lead.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware.js';

export const leadRouter = Router();

leadRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'sales'));
leadRouter.get('/', asyncHandler(listLeads));
leadRouter.post('/', asyncHandler(createLead));
leadRouter.get('/:id', asyncHandler(getLead));
leadRouter.patch('/:id', asyncHandler(updateLead));
leadRouter.delete('/:id', asyncHandler(deleteLead));
