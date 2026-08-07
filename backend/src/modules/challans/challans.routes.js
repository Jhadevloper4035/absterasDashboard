import { Router } from 'express';
import { createChallan, downloadChallanPdf, getChallan, listChallans, updateChallan } from './controllers/challan.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';

export const challanRouter = Router();
challanRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'operations'));
challanRouter.get('/', asyncHandler(listChallans));
challanRouter.post('/', authorizeRoles('superadmin', 'admin'), asyncHandler(createChallan));
challanRouter.get('/:id/pdf', asyncHandler(downloadChallanPdf));
challanRouter.get('/:id', asyncHandler(getChallan));
challanRouter.patch('/:id', asyncHandler(updateChallan));
