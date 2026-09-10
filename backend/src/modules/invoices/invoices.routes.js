import { Router } from 'express';
import { createInvoice, downloadInvoicePdf, getInvoice, listInvoiceClients, listInvoices, updateInvoice } from './controllers/invoice.controller.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { authenticate, authorizeAppModule } from '../auth/middleware/auth.middleware.js';

export const invoiceRouter = Router();
invoiceRouter.use(asyncHandler(authenticate), authorizeAppModule('invoices'));
invoiceRouter.get('/', asyncHandler(listInvoices));
invoiceRouter.get('/client-options', asyncHandler(listInvoiceClients));
invoiceRouter.post('/', authorizeAppModule('invoices', 'manage'), asyncHandler(createInvoice));
invoiceRouter.get('/:id/pdf', asyncHandler(downloadInvoicePdf));
invoiceRouter.get('/:id', asyncHandler(getInvoice));
invoiceRouter.patch('/:id', authorizeAppModule('invoices', 'manage'), asyncHandler(updateInvoice));
