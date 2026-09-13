import mongoose from 'mongoose';
import { Client } from '../clients/models/client.model.js';
import { auditEvent } from '../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../services/upload.service.js';
import { SEND_SAMPLE_CATEGORY, SITE_EXPENSE_STATUSES, SiteExpense } from './models/site-expense.model.js';
import { SiteExpenseCategory } from './models/site-expense-category.model.js';

const validId = (value) => mongoose.isValidObjectId(value);
const message = (statusCode, text) => Object.assign(new Error(text), { statusCode });
const cleanText = (value, limit) => String(value || '').trim().slice(0, limit);

async function siteFor(clientId, siteId) {
  if (!validId(clientId) || !validId(siteId)) throw message(400, 'Choose a valid client and site address');
  const site = await Client.findOne({ _id: siteId, parentClient: clientId });
  if (!site) throw message(400, 'Choose a site address belonging to the selected client');
}

function screenshot(value) {
  const file = trustedAttachment(value);
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.contentType)) throw message(400, 'Upload one valid payment screenshot image');
  return file;
}

async function expenseData(expense) {
  const data = expense.toObject ? expense.toObject() : expense;
  data.paymentScreenshot = (await signAttachmentUrls([data.paymentScreenshot]))[0];
  return data;
}

function expenseQuery(req) {
  const query = {};
  if (validId(req.query.client)) query.client = req.query.client;
  if (validId(req.query.site)) query.clientSite = req.query.site;
  return query;
}

const populate = (query) => query.populate([
  { path: 'client', select: 'name' },
  { path: 'clientSite', select: 'name siteName siteAddress' },
  { path: 'createdBy', select: 'name email' },
]);

export async function listSiteExpenses(req, res) {
  const expenses = await populate(SiteExpense.find(expenseQuery(req)).sort({ createdAt: -1 }));
  return res.json({ data: await Promise.all(expenses.map(expenseData)) });
}

export async function listSiteExpenseCategories(req, res) {
  const categories = await SiteExpenseCategory.find().select('name createdAt').sort({ name: 1 }).lean();
  return res.json({ data: [{ _id: 'send-sample', name: SEND_SAMPLE_CATEGORY, builtIn: true }, ...categories.filter((category) => category.name !== SEND_SAMPLE_CATEGORY)] });
}

export async function createSiteExpenseCategory(req, res) {
  const name = cleanText(req.body?.name, 80);
  if (!name) throw message(400, 'Category name is required');
  if (name === SEND_SAMPLE_CATEGORY || await SiteExpenseCategory.exists({ name })) throw message(409, 'This category already exists');
  const category = await SiteExpenseCategory.create({ name, createdBy: req.user._id });
  await auditEvent(req, { action: 'site-expense-category.create', entity: 'site-expense-category', entityId: category._id, after: { name } });
  return res.status(201).json({ data: category });
}

export async function createSiteExpense(req, res) {
  const category = cleanText(req.body?.category, 80);
  const title = cleanText(req.body?.title, 160);
  const remark = cleanText(req.body?.remark, 2000);
  const amount = Number(req.body?.amount);
  const status = cleanText(req.body?.status, 20).toLowerCase() || 'pending';
  const isSample = category === SEND_SAMPLE_CATEGORY;
  const hasClient = Boolean(req.body?.client);
  const hasSite = Boolean(req.body?.clientSite);
  if (!category || !(isSample || await SiteExpenseCategory.exists({ name: category }))) throw message(400, 'Choose a valid expense category');
  if ((!isSample && (!hasClient || !hasSite)) || hasClient !== hasSite) throw message(400, 'Choose both a client and site address, or leave both blank for Send Sample');
  if (hasClient) await siteFor(req.body.client, req.body.clientSite);
  if (!title) throw message(400, 'Expense title is required');
  if (!remark) throw message(400, 'Payment remark is required');
  if (!Number.isFinite(amount) || amount <= 0) throw message(400, 'Enter a valid payment amount');
  if (!SITE_EXPENSE_STATUSES.includes(status)) throw message(400, 'Choose a valid payment status');
  const expense = await SiteExpense.create({
    client: req.body.client || undefined,
    clientSite: req.body.clientSite || undefined,
    category,
    status,
    title,
    remark,
    amount,
    paymentScreenshot: screenshot(req.body?.paymentScreenshot),
    createdBy: req.user._id,
  });
  await auditEvent(req, { action: 'site-expense.create', entity: 'site-expense', entityId: expense._id, after: { amount, title, status } });
  return res.status(201).json({ data: await expenseData(await populate(SiteExpense.findById(expense._id))) });
}

export async function updateSiteExpense(req, res) {
  if (!validId(req.params.id)) throw message(400, 'Choose a valid expense');
  const existing = await SiteExpense.findById(req.params.id);
  if (!existing) throw message(404, 'Expense not found');
  if (existing.status === 'done') throw message(409, 'Done expenses cannot be edited');
  const title = cleanText(req.body?.title, 160);
  const remark = cleanText(req.body?.remark, 2000);
  const amount = Number(req.body?.amount);
  const status = cleanText(req.body?.status, 20).toLowerCase();
  if (!title) throw message(400, 'Expense title is required');
  if (!remark) throw message(400, 'Payment remark is required');
  if (!Number.isFinite(amount) || amount <= 0) throw message(400, 'Enter a valid payment amount');
  if (!SITE_EXPENSE_STATUSES.includes(status)) throw message(400, 'Choose a valid payment status');
  const expense = await SiteExpense.findOneAndUpdate(
    { _id: existing._id, status: { $ne: 'done' } },
    { $set: { title, remark, amount, status, paymentScreenshot: req.body?.paymentScreenshot ? screenshot(req.body.paymentScreenshot) : existing.paymentScreenshot } },
    { new: true, runValidators: true },
  );
  if (!expense) throw message(409, 'Done expenses cannot be edited');
  await auditEvent(req, { action: 'site-expense.update', entity: 'site-expense', entityId: expense._id, before: { amount: existing.amount, status: existing.status }, after: { amount, status } });
  return res.json({ data: await expenseData(await populate(SiteExpense.findById(expense._id))) });
}
