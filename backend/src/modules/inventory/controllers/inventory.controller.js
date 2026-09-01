import mongoose from 'mongoose';
import { CategoryDefinition } from '../models/category-definition.model.js';
import { DEFAULT_HSN_CODE, InventoryItem, laserCutMaterialDetails } from '../models/item.model.js';
import { StockTransaction } from '../models/transaction.model.js';
import { Supplier } from '../models/supplier.model.js';
import { validateSpecs } from '../services/validate-specs.service.js';
import { auditEvent } from '../../../services/audit.service.js';
import { signAttachmentUrls, trustedAttachment } from '../../../services/upload.service.js';

const categoryFields = ['slug', 'label', 'fields'];
const itemFields = ['sku', 'productCode', 'category', 'name', 'description', 'hsnCode', 'unit', 'materialType', 'defaultDimensions', 'quantityInStock', 'minStockLevel', 'location', 'supplier', 'shadeName', 'shadeCode', 'unitCost', 'status', 'productImage', 'shadeImage', 'specs'];
const pick = (body, fields) => Object.fromEntries(fields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));
const invalid = (res, id) => !mongoose.isObjectIdOrHexString(id) && (res.status(400).json({ error: { message: 'Invalid id' } }), true);
const pageParams = (query) => ({ page: Math.max(Number.parseInt(query.page, 10) || 1, 1), limit: Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), 100) });
const supplierFields = ['name', 'contactPerson', 'phone', 'email', 'address', 'taxId', 'notes', 'serviceTypes', 'status'];
export function validateMaterialDimensions(materialType, dimensions = {}) {
  const height = Number(dimensions.heightFt); const width = Number(dimensions.widthFt); const length = Number(dimensions.lengthFt);
  if (materialType === 'SHEET' && (!Number.isFinite(height) || height <= 0 || !Number.isFinite(width) || width <= 0)) throw Object.assign(new Error('Sheet height and width must be greater than zero'), { statusCode: 400 });
  if (materialType === 'TUBE' && (!Number.isFinite(length) || length <= 0)) throw Object.assign(new Error('Tube length must be greater than zero'), { statusCode: 400 });
}

export async function listCategories(req, res) { return res.json({ data: await CategoryDefinition.find().sort({ label: 1 }).lean() }); }
export async function createCategory(req, res) {
  const category = await CategoryDefinition.create(pick(req.body, categoryFields));
  await auditEvent(req, { action: 'inventory.category.create', entity: 'inventory_category', entityId: category._id, after: category.toObject() });
  return res.status(201).json({ data: category });
}
export async function updateCategory(req, res) {
  if (invalid(res, req.params.id)) return;
  const category = await CategoryDefinition.findByIdAndUpdate(req.params.id, pick(req.body, ['label', 'fields']), { new: true, runValidators: true });
  if (!category) return res.status(404).json({ error: { message: 'Category not found' } });
  await auditEvent(req, { action: 'inventory.category.update', entity: 'inventory_category', entityId: category._id, after: category.toObject() });
  return res.json({ data: category });
}
export async function deleteCategory(req, res) {
  if (invalid(res, req.params.id)) return;
  const category = await CategoryDefinition.findById(req.params.id);
  if (!category) return res.status(404).json({ error: { message: 'Category not found' } });
  if (await InventoryItem.exists({ category: category.slug })) return res.status(409).json({ error: { message: 'Categories with items cannot be deleted' } });
  await category.deleteOne();
  await auditEvent(req, { action: 'inventory.category.delete', entity: 'inventory_category', entityId: category._id, before: category.toObject() });
  return res.status(204).end();
}
export async function listSuppliers(req, res) {
  const filter = req.query.status ? { status: req.query.status } : {};
  if (req.query.serviceType) {
    if (!['laser_cut', 'powder_coating'].includes(req.query.serviceType)) return res.status(400).json({ error: { message: 'Invalid supplier service type' } });
    filter.serviceTypes = req.query.serviceType;
  }
  return res.json({ data: await Supplier.find(filter).sort({ name: 1 }).lean() });
}
export async function createSupplier(req, res) { const supplier = await Supplier.create(pick(req.body, supplierFields)); await auditEvent(req, { action: 'inventory.supplier.create', entity: 'inventory_supplier', entityId: supplier._id, after: supplier.toObject() }); return res.status(201).json({ data: supplier }); }
export async function updateSupplier(req, res) { if (invalid(res, req.params.id)) return; const supplier = await Supplier.findByIdAndUpdate(req.params.id, pick(req.body, supplierFields), { new: true, runValidators: true }); return supplier ? res.json({ data: supplier }) : res.status(404).json({ error: { message: 'Supplier not found' } }); }
export async function listItems(req, res) {
  const { page, limit } = pageParams(req.query);
  const filter = {};
  if (req.query.category) filter.category = String(req.query.category).toLowerCase();
  if (req.query.status) filter.status = req.query.status;
  else filter.status = { $ne: 'inactive' };
  if (req.query.lowStock === 'true') filter.$expr = { $lte: ['$quantityInStock', '$minStockLevel'] };
  if (req.query.q?.trim()) filter.$or = [{ sku: { $regex: req.query.q.trim(), $options: 'i' } }, { productCode: { $regex: req.query.q.trim(), $options: 'i' } }, { name: { $regex: req.query.q.trim(), $options: 'i' } }];
  const [data, total] = await Promise.all([InventoryItem.find(filter).populate('supplier', 'name contactPerson phone address').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), InventoryItem.countDocuments(filter)]);
  const items = await Promise.all(data.map(async (item) => ({ ...item, hsnCode: item.hsnCode || DEFAULT_HSN_CODE, ...laserCutMaterialDetails(item), shadeImage: item.shadeImage ? (await signAttachmentUrls([item.shadeImage]))[0] : undefined })));
  return res.json({ data: items, meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}
export async function lowStockReport(req, res) {
  const data = await InventoryItem.find({ status: 'active', $expr: { $lte: ['$quantityInStock', '$minStockLevel'] } }).sort({ quantityInStock: 1, name: 1 }).lean();
  return res.json({ data });
}
export async function getItem(req, res) {
  if (invalid(res, req.params.id)) return;
  const item = await InventoryItem.findById(req.params.id).populate('supplier', 'name contactPerson phone email address').lean();
  if (!item) return res.status(404).json({ error: { message: 'Item not found' } });
  return res.json({ data: { ...item, hsnCode: item.hsnCode || DEFAULT_HSN_CODE, ...laserCutMaterialDetails(item), productImage: item.productImage ? (await signAttachmentUrls([item.productImage]))[0] : undefined, shadeImage: item.shadeImage ? (await signAttachmentUrls([item.shadeImage]))[0] : undefined } });
}
export async function createItem(req, res) {
  const input = pick(req.body, itemFields);
  if (!input.sku || !input.category || !input.name) return res.status(400).json({ error: { message: 'SKU, category, and name are required' } });
  input.hsnCode = String(input.hsnCode || '').trim() || DEFAULT_HSN_CODE;
  input.shadeName = String(input.shadeName || '').trim();
  input.shadeCode = String(input.shadeCode || '').trim().toUpperCase();
  if (!input.shadeName || !input.shadeCode) return res.status(400).json({ error: { message: 'Shade name and shade code are required' } });
  validateMaterialDimensions(input.materialType, input.defaultDimensions);
  for (const key of ['productImage', 'shadeImage']) if (input[key] && !(input[key] = trustedAttachment(input[key]))) return res.status(400).json({ error: { message: `Invalid ${key}` } });
  await validateSpecs(input.category, input.specs || {});
  const item = await InventoryItem.create(input);
  await auditEvent(req, { action: 'inventory.item.create', entity: 'inventory_item', entityId: item._id, after: item.toObject() });
  return res.status(201).json({ data: item });
}
export async function updateItem(req, res) {
  if (invalid(res, req.params.id)) return;
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: { message: 'Item not found' } });
  const input = pick(req.body, itemFields.filter((field) => !['quantityInStock', 'minStockLevel'].includes(field)));
  if (input.hsnCode !== undefined) input.hsnCode = String(input.hsnCode || '').trim() || DEFAULT_HSN_CODE;
  if (input.shadeName !== undefined) input.shadeName = String(input.shadeName || '').trim();
  if (input.shadeCode !== undefined) input.shadeCode = String(input.shadeCode || '').trim().toUpperCase();
  for (const key of ['productImage', 'shadeImage']) if (input[key] && !(input[key] = trustedAttachment(input[key]))) return res.status(400).json({ error: { message: `Invalid ${key}` } });
  const category = input.category || item.category;
  validateMaterialDimensions(input.materialType || item.materialType, input.defaultDimensions === undefined ? item.defaultDimensions : input.defaultDimensions);
  if (input.specs !== undefined || input.category !== undefined) await validateSpecs(category, input.specs === undefined ? item.specs.toObject() : input.specs);
  Object.assign(item, input); await item.save();
  await auditEvent(req, { action: 'inventory.item.update', entity: 'inventory_item', entityId: item._id, after: item.toObject() });
  return res.json({ data: item });
}
export async function deleteItem(req, res) {
  if (invalid(res, req.params.id)) return;
  const item = await InventoryItem.findById(req.params.id);
  if (!item) return res.status(404).json({ error: { message: 'Item not found' } });
  const before = item.toObject();
  item.status = 'inactive'; await item.save();
  await auditEvent(req, { action: 'inventory.item.delete', entity: 'inventory_item', entityId: item._id, before, after: item.toObject() });
  return res.status(204).end();
}
export async function listTransactions(req, res) {
  if (invalid(res, req.params.id)) return;
  const { page, limit } = pageParams(req.query);
  const [data, total] = await Promise.all([StockTransaction.find({ item: req.params.id }).populate('performedBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), StockTransaction.countDocuments({ item: req.params.id })]);
  return res.json({ data: await Promise.all(data.map(async (entry) => ({ ...entry, bill: entry.bill ? (await signAttachmentUrls([entry.bill]))[0] : undefined }))), meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) } });
}
export async function listPurchases(req, res) {
  const data = await StockTransaction.find({ type: 'in' }).populate({ path: 'item', select: 'name sku unit supplier', populate: { path: 'supplier', select: 'name contactPerson phone email address' } }).populate('performedBy', 'name').sort({ purchaseDate: -1, createdAt: -1 }).lean();
  return res.json({ data: await Promise.all(data.map(async (entry) => ({ ...entry, bill: entry.bill ? (await signAttachmentUrls([entry.bill]))[0] : undefined }))) });
}
export async function createTransaction(req, res) {
  if (invalid(res, req.params.id)) return;
  const { type, quantity, reference, note, purchaseDate } = req.body;
  const bill = req.body.bill && trustedAttachment(req.body.bill);
  if (req.body.bill && !bill) return res.status(400).json({ error: { message: 'Invalid bill attachment' } });
  const amount = Number(quantity);
  if (type !== 'in' || !Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: { message: 'Manual stock entries must be stock-in quantities' } });
  const delta = amount;
  const filter = { _id: req.params.id, ...(delta < 0 ? { quantityInStock: { $gte: -delta } } : {}) };
  const item = await InventoryItem.findOneAndUpdate(filter, { $inc: { quantityInStock: delta } }, { new: true });
  if (!item) return res.status(409).json({ error: { message: 'Item not found or insufficient stock' } });
  try {
    const transaction = await StockTransaction.create({ item: item._id, type, quantity: amount, reference, note, purchaseDate: purchaseDate || undefined, bill, performedBy: req.user._id });
    await auditEvent(req, { action: 'inventory.transaction.create', entity: 'stock_transaction', entityId: transaction._id, after: transaction.toObject() });
    return res.status(201).json({ data: { transaction, item } });
  } catch (error) {
    await InventoryItem.findByIdAndUpdate(item._id, { $inc: { quantityInStock: -delta } });
    throw error;
  }
}
