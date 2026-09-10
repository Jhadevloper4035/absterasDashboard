import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { createChallan, createUsage, deleteOrder, listOrders, materialKey, normalizedItems, orderStatus, productionOutputs } from '../src/modules/lasercut/lasercut.controller.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { Supplier } from '../src/modules/inventory/models/supplier.model.js';
import { StockTransaction } from '../src/modules/inventory/models/transaction.model.js';
import { LaserCutAudit, LaserCutChallan, LaserCutOrder, LaserCutStock, LaserCutUsage, LaserCutVendor } from '../src/modules/lasercut/models.js';
import { Client } from '../src/modules/clients/models/client.model.js';

test('laser-cut order status clamps over-delivery and keeps each material outstanding', () => {
  assert.deepEqual(orderStatus({ expected: { sheets: 32, tubes: 14 }, sent: { sheets: 35, tubes: 9 } }), { remainingSheets: 0, remainingTubes: 5, status: 'PARTIAL' });
  assert.deepEqual(orderStatus({ expected: { sheets: 32, tubes: 14 }, sent: { sheets: 32, tubes: 14 } }), { remainingSheets: 0, remainingTubes: 0, status: 'COMPLETE' });
});

test('laser-cut stock keys keep same-size products separate', () => {
  assert.notEqual(materialKey('TUBE', { lengthFt: 12 }, '507f1f77bcf86cd799439010'), materialKey('TUBE', { lengthFt: 12 }, '507f1f77bcf86cd799439011'));
});

test('laser-cut production batches keep each planned smaller output partial until ready', () => {
  const challans = [{ _id: '507f1f77bcf86cd799439001', challanNo: 'LC-1', vendorRef: '507f1f77bcf86cd799439002', type: 'OUT', status: 'DISPATCHED', items: [
    { itemName: 'Sheet', inventoryItemRef: '507f1f77bcf86cd799439003', materialType: 'SHEET', dimensions: { heightFt: 8, widthFt: 4 }, cutOutputs: [{ quantity: 4, dimensions: { heightFt: 4, widthFt: 4 } }] },
    { itemName: 'Tube', inventoryItemRef: '507f1f77bcf86cd799439004', materialType: 'TUBE', dimensions: { lengthFt: 10 }, cutOutputs: [{ quantity: 2, dimensions: { lengthFt: 5 } }] },
  ] }];
  const usages = [{ challanRef: challans[0]._id, sourceLineIndex: 0, outputs: [{ quantity: 2, plannedOutputIndex: 0, dimensions: { heightFt: 4, widthFt: 4 } }] }];
  const outputs = productionOutputs(challans, usages);
  assert.equal(outputs[0].remainingQuantity, 2);
  assert.equal(outputs[1].remainingQuantity, 2);
  assert.equal(orderStatus({ planned: { sheets: 4, tubes: 2 }, ready: { sheets: 0, tubes: 0 } }).status, 'PENDING');
  assert.equal(orderStatus({ planned: { sheets: 4, tubes: 2 }, ready: { sheets: 2, tubes: 0 } }).status, 'PARTIAL');
  assert.equal(orderStatus({ planned: { sheets: 4, tubes: 2 }, ready: { sheets: 4, tubes: 2 } }).status, 'COMPLETE');
});

test('laser-cut order list includes the latest dispatched client site address', async () => {
  const originals = { orderFind: LaserCutOrder.find, clientFind: Client.find, challanFind: LaserCutChallan.find };
  const orderId = '507f1f77bcf86cd799439030';
  const clientId = '507f1f77bcf86cd799439031';
  try {
    LaserCutOrder.find = () => ({ sort: () => ({ lean: async () => [{ _id: orderId, customerRef: clientId, expected: { sheets: 1, tubes: 0 }, sent: { sheets: 1, tubes: 0 } }] }) });
    Client.find = () => ({ select: () => ({ lean: async () => [{ _id: clientId, name: 'Nexa Retail Group', shippingAddress: 'Parent address' }] }) });
    LaserCutChallan.find = () => ({ sort: () => ({ lean: async () => [{ orderRef: orderId, clientSiteName: 'Nexa Showroom', clientSiteAddressSnapshot: 'Nexa Showroom, Gurugram' }] }) });
    let response;
    await listOrders({}, { json: (body) => { response = body; } });
    assert.deepEqual(response.data[0].clientAddress, 'Nexa Showroom, Gurugram');
    assert.deepEqual(response.data[0].clientSiteName, 'Nexa Showroom');
  } finally {
    LaserCutOrder.find = originals.orderFind;
    Client.find = originals.clientFind;
    LaserCutChallan.find = originals.challanFind;
  }
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

test('laser-cut challan stores smaller sheet and tube cut outputs', async () => {
  const originalFind = InventoryItem.find;
  InventoryItem.find = () => ({ lean: async () => [
    { _id: '507f1f77bcf86cd799439014', name: 'Sheet', status: 'active', materialType: 'SHEET', defaultDimensions: { heightFt: 8, widthFt: 4 }, unit: 'sheet', hsnCode: '4411' },
    { _id: '507f1f77bcf86cd799439015', name: 'Tube', status: 'active', materialType: 'TUBE', defaultDimensions: { lengthFt: 8 }, unit: 'tube', hsnCode: '7306' },
  ] });
  try {
    const [sheet, tube] = await normalizedItems([
      { inventoryItemRef: '507f1f77bcf86cd799439014', quantity: 8, cutOutputs: [{ quantity: 8, dimensions: { heightFt: 4, widthFt: 4 } }, { quantity: 8, dimensions: { heightFt: 2, widthFt: 4 } }] },
      { inventoryItemRef: '507f1f77bcf86cd799439015', quantity: 2, cutOutputs: [{ quantity: 4, dimensions: { lengthFt: 4 } }] },
    ]);
    assert.deepEqual(sheet.cutOutputs, [{ quantity: 8, dimensions: { heightFt: 4, widthFt: 4 } }, { quantity: 8, dimensions: { heightFt: 2, widthFt: 4 } }]);
    assert.deepEqual(tube.cutOutputs, [{ quantity: 4, dimensions: { lengthFt: 4 } }]);
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

test('laser-cut usage turns large sheets into smaller sheet stock', async () => {
  const originals = { startSession: mongoose.startSession, orderFindById: LaserCutOrder.findById, stockUpdate: LaserCutStock.findOneAndUpdate, usageCreate: LaserCutUsage.create, auditCreate: LaserCutAudit.create };
  const ids = { vendor: '507f1f77bcf86cd799439050', order: '507f1f77bcf86cd799439051', large: '507f1f77bcf86cd799439052', small: '507f1f77bcf86cd799439053', usage: '507f1f77bcf86cd799439054', item: '507f1f77bcf86cd799439055' };
  const updates = [];
  try {
    mongoose.startSession = async () => ({ withTransaction: async (work) => work(), endSession: async () => {} });
    LaserCutOrder.findById = () => ({ session: async () => ({ _id: ids.order }) });
    LaserCutStock.findOneAndUpdate = async (_query, update) => {
      updates.push(update);
      return updates.length === 1
        ? { _id: ids.large, vendorRef: ids.vendor, vendorName: 'Laser Works', inventoryItemRef: ids.item, itemName: 'Aluminium Sheet', hsnCode: '7606', unit: 'sheet' }
        : { _id: ids.small, toObject: () => ({ _id: ids.small }) };
    };
    LaserCutUsage.create = async ([entry]) => [{ _id: ids.usage, ...entry }];
    LaserCutAudit.create = async () => [];
    let response;
    await createUsage(
      { body: { vendorRef: ids.vendor, orderRef: ids.order, materialType: 'SHEET', quantityConsumed: 8, panelsProduced: 16, dimensions: { heightFt: 8, widthFt: 4 }, outputDimensions: { heightFt: 4, widthFt: 4 } }, user: { _id: ids.usage } },
      { status: () => ({ json: (body) => { response = body; } }) },
    );
    assert.equal(updates[1].$inc.quantityAvailable, 16);
    assert.deepEqual(updates[1].$setOnInsert.dimensions, { heightFt: 4, widthFt: 4 });
    assert.equal(String(response.data.outputStockRef), ids.small);
  } finally {
    mongoose.startSession = originals.startSession;
    LaserCutOrder.findById = originals.orderFindById;
    LaserCutStock.findOneAndUpdate = originals.stockUpdate;
    LaserCutUsage.create = originals.usageCreate;
    LaserCutAudit.create = originals.auditCreate;
  }
});

test('laser-cut usage rejects produced sheets larger than the consumed sheet area', async () => {
  await assert.rejects(
    createUsage({ body: { vendorRef: '507f1f77bcf86cd799439056', orderRef: '507f1f77bcf86cd799439057', materialType: 'SHEET', quantityConsumed: 8, panelsProduced: 16, dimensions: { heightFt: 8, widthFt: 4 }, outputDimensions: { heightFt: 8, widthFt: 4 } } }, {}),
    /Produced sheet area cannot exceed consumed sheet area/,
  );
});

test('laser-cut usage rejects produced tubes longer than the consumed tubes', async () => {
  await assert.rejects(
    createUsage({ body: { vendorRef: '507f1f77bcf86cd799439058', orderRef: '507f1f77bcf86cd799439059', materialType: 'TUBE', quantityConsumed: 2, panelsProduced: 4, dimensions: { lengthFt: 8 }, outputDimensions: { lengthFt: 5 } } }, {}),
    /Produced tube length cannot exceed consumed tube length/,
  );
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

test('laser-cut challan stores the selected Laser-cut vendor address as the drop location', async () => {
  const originals = { itemFind: InventoryItem.find, vendorFindOne: LaserCutVendor.findOne, challanCreate: LaserCutChallan.create, auditCreate: LaserCutAudit.create };
  const vendorId = '507f1f77bcf86cd799439023';
  const itemId = '507f1f77bcf86cd799439024';
  let saved;
  try {
    InventoryItem.find = () => ({ lean: async () => [{ _id: itemId, name: 'Bracket', status: 'active', materialType: 'OTHER', unit: 'pcs', hsnCode: '8302' }] });
    LaserCutVendor.findOne = () => ({ lean: async () => ({ _id: vendorId, name: 'Laser Works', address: 'Laser Works, Gurugram' }) });
    LaserCutChallan.create = async (challan) => { saved = challan; return { _id: '507f1f77bcf86cd799439025', ...challan }; };
    LaserCutAudit.create = async () => [];
    let response;
    await createChallan(
      { body: { type: 'IN', vendorRef: vendorId, items: [{ inventoryItemRef: itemId, quantity: 1 }] }, user: { _id: '507f1f77bcf86cd799439026' } },
      { status: () => ({ json: (body) => { response = body; } }) },
    );
    assert.equal(saved.deliveryAddress, 'Laser Works, Gurugram');
    assert.equal(saved.vendorAddressSnapshot, 'Laser Works, Gurugram');
    assert.equal(response.data.deliveryAddress, 'Laser Works, Gurugram');
  } finally {
    InventoryItem.find = originals.itemFind;
    LaserCutVendor.findOne = originals.vendorFindOne;
    LaserCutChallan.create = originals.challanCreate;
    LaserCutAudit.create = originals.auditCreate;
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
