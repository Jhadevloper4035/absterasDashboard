import { Employee } from '../models/employee.model.js';
import { ExpenseClaim } from '../models/expense-claim.model.js';
import { auditEvent } from '../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../services/upload.service.js';

const ownEmployee = (user) => Employee.findOne({ user: user._id }).select('_id');
const monthRange = (value) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''))) return null;
  const [year, month] = value.split('-').map(Number);
  return { $gte: new Date(Date.UTC(year, month - 1, 1)), $lt: new Date(Date.UTC(year, month, 1)) };
};
const receipt = (file) => {
  const attachment = trustedAttachment(file);
  return attachment && attachment.contentType?.startsWith('image/') && attachment.key.includes('/image/') ? attachment : null;
};
async function claimData(claim) { const data = claim.toObject ? claim.toObject() : claim; return { ...data, receipts: await signAttachmentUrls(data.receipts || []) }; }

export async function listExpenseClaims(req, res) {
  const employee = req.hrAccess === 'manage' ? null : await ownEmployee(req.user);
  if (req.hrAccess !== 'manage' && !employee) return res.json({ data: [] });
  const query = req.hrAccess === 'manage' ? {} : { employee: employee._id };
  if (req.query.status) query.status = req.query.status;
  if (req.query.month) {
    const createdAt = monthRange(req.query.month);
    if (!createdAt) return res.status(400).json({ error: { message: 'Month must use YYYY-MM format' } });
    query.createdAt = createdAt;
  }
  const claims = await ExpenseClaim.find(query).populate({ path: 'employee', populate: { path: 'user', select: 'name email' } }).populate('approvedBy', 'name').sort({ createdAt: -1 });
  return res.json({ data: await Promise.all(claims.map(claimData)) });
}

export async function createExpenseClaim(req, res) {
  const employee = req.hrAccess === 'manage' && req.body?.employee ? await Employee.findOne({ _id: req.body.employee, status: 'active' }).select('_id') : await ownEmployee(req.user);
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note || '').trim();
  const receipts = (Array.isArray(req.body?.receipts) ? req.body.receipts : []).map(receipt).filter(Boolean).slice(0, 5);
  if (!employee || !String(req.body?.category || '').trim() || !note || !Number.isFinite(amount) || amount <= 0 || !receipts.length) return res.status(400).json({ error: { message: 'Category, amount, payment note, and at least one payment screenshot image are required' } });
  const claim = await ExpenseClaim.create({ employee: employee._id, category: String(req.body.category).trim(), amount, note, receipts });
  await auditEvent(req, { action: 'hr.expense.create', entity: 'expense_claim', entityId: claim._id, after: { amount, category: claim.category } });
  return res.status(201).json({ data: await claimData(claim) });
}

export async function decideExpenseClaim(req, res) {
  const claim = await ExpenseClaim.findById(req.params.id); const status = req.body?.status;
  if (!claim) return res.status(404).json({ error: { message: 'Expense claim not found' } });
  if (claim.status !== 'pending' || !['approved', 'rejected'].includes(status)) return res.status(400).json({ error: { message: 'Only pending claims can be approved or rejected' } });
  claim.status = status; claim.approvedBy = req.user._id; claim.decisionNote = String(req.body.decisionNote || '').trim(); await claim.save();
  await auditEvent(req, { action: `hr.expense.${status}`, entity: 'expense_claim', entityId: claim._id, after: { status } });
  return res.json({ data: await claimData(claim) });
}
