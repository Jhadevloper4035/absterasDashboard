import { Router } from 'express';
import { createChallan, deleteChallan, downloadChallanPdf, getChallan, listChallans, updateChallan } from './controllers/challan.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const challanRouter = Router();
challanRouter.use(asyncHandler(authenticate), authorizeAppModule('clients'));
challanRouter.get('/', asyncHandler(listChallans));
challanRouter.post('/', authorizeAppModule('clients', 'manage'), asyncHandler(createChallan));
challanRouter.get('/:id/pdf', asyncHandler(downloadChallanPdf));
challanRouter.get('/:id', asyncHandler(getChallan));
challanRouter.patch('/:id', authorizeAppModule('clients', 'manage'), asyncHandler(updateChallan));
challanRouter.delete('/:id', authorizeAppModule('clients', 'manage'), asyncHandler(deleteChallan));
