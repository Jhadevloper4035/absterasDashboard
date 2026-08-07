import { Router } from 'express';
import { createInvoice, downloadInvoicePdf, getInvoice, listInvoices, updateInvoice } from './controllers/invoice.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeRoles } from '../auth/middleware/auth.middleware.js';

export const invoiceRouter = Router();
invoiceRouter.use(asyncHandler(authenticate), authorizeRoles('superadmin', 'admin', 'operations'));
invoiceRouter.get('/', asyncHandler(listInvoices));
invoiceRouter.post('/', authorizeRoles('superadmin', 'admin'), asyncHandler(createInvoice));
invoiceRouter.get('/:id/pdf', asyncHandler(downloadInvoicePdf));
invoiceRouter.get('/:id', asyncHandler(getInvoice));
invoiceRouter.patch('/:id', asyncHandler(updateInvoice));
