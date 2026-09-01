import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { deleteOrder, normalizedItems, orderStatus } from '../src/modules/lasercut/lasercut.controller.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { Supplier } from '../src/modules/inventory/models/supplier.model.js';
import { StockTransaction } from '../src/modules/inventory/models/transaction.model.js';
import { LaserCutAudit, LaserCutChallan, LaserCutOrder, LaserCutStock, LaserCutUsage } from '../src/modules/lasercut/models.js';

test('laser-cut order status clamps over-delivery and keeps each material outstanding', () => {
  assert.deepEqual(orderStatus({ expected: { sheets: 32, tubes: 14 }, sent: { sheets: 35, tubes: 9 } }), { remainingSheets: 0, remainingTubes: 5, status: 'PARTIAL' });
  assert.deepEqual(orderStatus({ expected: { sheets: 32, tubes: 14 }, sent: { sheets: 32, tubes: 14 } }), { remainingSheets: 0, remainingTubes: 0, status: 'COMPLETE' });
});

test('laser-cut challan uses the selected inventory product dimensions', async () => {
  const originalFind = InventoryItem.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439011', name: 'Sheet', status: 'active', materialType: 'SHEET', defaultDimensions: { heightFt: 8, widthFt: 4 }, unit: 'sheet', hsnCode: '4411' }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439011', quantity: 2, dimensions: { heightFt: 1, widthFt: 1 } }]);
    assert.deepEqual(line.dimensions, { heightFt: 8, widthFt: 4 });
  } finally {
    InventoryItem.find = originalFind;
  }
});

test('laser-cut challan accepts a selected inventory product without dimensions', async () => {
  const originalFind = InventoryItem.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439012', name: 'Bracket', status: 'active', materialType: 'OTHER', unit: 'pcs', hsnCode: '8302' }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439012', quantity: 2 }]);
    assert.equal(line.materialType, 'OTHER');
    assert.equal(line.dimensions, undefined);
  } finally {
    InventoryItem.find = originalFind;
  }
});

test('laser-cut challan defaults legacy products without a material type to OTHER', async () => {
  const originalFind = InventoryItem.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439013', name: 'Legacy product', status: 'active', unit: 'pcs', hsnCode: '0000' }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439013', quantity: 2 }]);
    assert.equal(line.materialType, 'OTHER');
  } finally {
    InventoryItem.find = originalFind;
  }
});

test('laser-cut challan converts legacy sheet specs from millimetres to feet', async () => {
  const originalFind = InventoryItem.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439020', name: 'Aluminium Sheet 1220x2440', status: 'active', unit: 'sheet', hsnCode: '0000', specs: { length: 2440, width: 1220 } }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439020', quantity: 14 }]);
    assert.equal(line.materialType, 'SHEET');
    assert.ok(Math.abs(line.dimensions.heightFt - 8.0052) < 0.001);
    assert.ok(Math.abs(line.dimensions.widthFt - 4.0026) < 0.001);
  } finally {
    InventoryItem.find = originalFind;
  }
});

test('laser-cut challan snapshots the selected product pickup supplier and address', async () => {
  const originalItemFind = InventoryItem.find;
  const originalSupplierFind = Supplier.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439021', name: 'Sheet', status: 'active', materialType: 'SHEET', defaultDimensions: { heightFt: 8, widthFt: 4 }, unit: 'sheet', hsnCode: '4411', supplier: '507f1f77bcf86cd799439022' }] });
  Supplier.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439022', name: 'Sheet Supplier', address: 'Supplier pickup address' }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439021', quantity: 2 }]);
    assert.equal(line.pickupSupplierName, 'Sheet Supplier');
    assert.equal(line.pickupAddressSnapshot, 'Supplier pickup address');
  } finally {
    InventoryItem.find = originalItemFind;
    Supplier.find = originalSupplierFind;
  }
});

test('deleting a dispatched laser-cut order restores its inventory product', async () => {
  const originals = {
    startSession: mongoose.startSession, orderFindById: LaserCutOrder.findById, challanFind: LaserCutChallan.find, challanDeleteMany: LaserCutChallan.deleteMany,
    usageExists: LaserCutUsage.exists, stockUpdate: LaserCutStock.findOneAndUpdate, itemUpdate: InventoryItem.findByIdAndUpdate,
    transactionCreate: StockTransaction.create, auditCreate: LaserCutAudit.create,
  };
  const session = { withTransaction: async (work) => work(), endSession: async () => {} };
  const order = { _id: '507f1f77bcf86cd799439014', orderName: 'LC-ORDER', deleteOne: async () => {} };
  const challan = { _id: '507f1f77bcf86cd799439015', orderRef: order._id, type: 'OUT', status: 'DISPATCHED', challanNo: 'LC-001', vendorRef: '507f1f77bcf86cd799439016', items: [{ inventoryItemRef: '507f1f77bcf86cd799439017', itemName: 'Sheet', materialType: 'OTHER', quantity: 2 }] };
  let inventoryIncrement = 0;
  try {
    mongoose.startSession = async () => session;
    LaserCutOrder.findById = () => ({ session: async () => order });
    LaserCutChallan.find = () => ({ session: async () => [challan] });
    LaserCutUsage.exists = () => ({ session: async () => null });
    LaserCutStock.findOneAndUpdate = async () => ({ _id: '507f1f77bcf86cd799439018' });
    InventoryItem.findByIdAndUpdate = async (_id, update) => { inventoryIncrement += update.$inc.quantityInStock; return { _id }; };
    StockTransaction.create = async () => [];
    LaserCutAudit.create = async () => [];
    LaserCutChallan.deleteMany = () => ({ session: async () => {} });
    let response;
    await deleteOrder({ params: { id: order._id }, user: { _id: '507f1f77bcf86cd799439019' } }, { json: (body) => { response = body; } });
    assert.equal(inventoryIncrement, 2);
    assert.deepEqual(response, { data: { restoredItems: 1 } });
  } finally {
    mongoose.startSession = originals.startSession;
    LaserCutOrder.findById = originals.orderFindById;
    LaserCutChallan.find = originals.challanFind;
    LaserCutChallan.deleteMany = originals.challanDeleteMany;
    LaserCutUsage.exists = originals.usageExists;
    LaserCutStock.findOneAndUpdate = originals.stockUpdate;
    InventoryItem.findByIdAndUpdate = originals.itemUpdate;
    StockTransaction.create = originals.transactionCreate;
    LaserCutAudit.create = originals.auditCreate;
  }
});
