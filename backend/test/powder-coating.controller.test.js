import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedItems, readyItemsFor, remainingItemsFor, remainingLaserCutTransferItems, remainingProducedLaserCutTransferItems, transactionUnsupported } from '../src/modules/powdercoating/powdercoating.controller.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { Supplier } from '../src/modules/inventory/models/supplier.model.js';
import { LaserCutStock, LaserCutVendor } from '../src/modules/lasercut/models.js';

test('powder-coating falls back only when MongoDB explicitly rejects transactions', () => {
  assert.equal(transactionUnsupported(new Error('Only servers in a sharded cluster can start a new transaction')), true);
  assert.equal(transactionUnsupported(new Error('Insufficient laser-cut stock')), false);
});

test('powder-coating challan snapshots the selected product shade and supplier', async () => {
  const originalItemFind = InventoryItem.find;
  const originalSupplierFind = Supplier.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439011', name: 'Aluminium Sheet', hsnCode: '7606', unit: 'sheet', shadeName: 'Pure white', shadeCode: 'RAL 9016', shadeImage: { key: 'shade.png' }, supplier: '507f1f77bcf86cd799439012' }] });
  Supplier.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439012', name: 'Aluminium Supplier', address: 'Supplier address' }] });
  try {
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439011', quantity: 4 }]);
    assert.deepEqual(line, { inventoryItemRef: '507f1f77bcf86cd799439011', itemName: 'Aluminium Sheet', hsnCode: '7606', unit: 'sheet', quantity: 4, shadeName: 'Pure white', shadeCode: 'RAL 9016', shadeImage: { key: 'shade.png' }, source: 'INVENTORY', laserCutStockRef: undefined, pickupSupplierRef: '507f1f77bcf86cd799439012', pickupSupplierName: 'Aluminium Supplier', pickupAddressSnapshot: 'Supplier address' });
  } finally {
    InventoryItem.find = originalItemFind;
    Supplier.find = originalSupplierFind;
  }
});

test('powder-coating challan rejects products without shade details', async () => {
  const originalItemFind = InventoryItem.find;
  const originalSupplierFind = Supplier.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439013', name: 'Unshaded product', unit: 'pcs' }] });
  Supplier.find = () => ({ lean: async () => [] });
  try {
    await assert.rejects(normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439013', quantity: 1 }]), /shade name and shade code/);
  } finally {
    InventoryItem.find = originalItemFind;
    Supplier.find = originalSupplierFind;
  }
});

test('powder-coating challan rejects hardware', async () => {
  const originalItemFind = InventoryItem.find;
  const originalSupplierFind = Supplier.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439017', name: 'Screw', category: 'hardware', unit: 'pcs', shadeName: 'Black', shadeCode: 'RAL 9005' }] });
  Supplier.find = () => ({ lean: async () => [] });
  try {
    await assert.rejects(normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439017', quantity: 1 }]), /hardware/);
  } finally {
    InventoryItem.find = originalItemFind;
    Supplier.find = originalSupplierFind;
  }
});

test('powder-coating challan can take a partial laser-cut batch with its updated shade', async () => {
  const originalItemFind = InventoryItem.find;
  const originalSupplierFind = Supplier.find;
  const originalStockFind = LaserCutStock.find;
  const originalLaserVendorFind = LaserCutVendor.find;
  InventoryItem.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439014', name: 'Laser-cut panel', hsnCode: '7606', unit: 'pcs', supplier: '507f1f77bcf86cd799439015' }] });
  Supplier.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439015', name: 'Laser vendor', address: 'Laser vendor address' }] });
  LaserCutStock.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439016', inventoryItemRef: '507f1f77bcf86cd799439014', vendorRef: '507f1f77bcf86cd799439015', vendorName: 'Laser vendor', quantityAvailable: 5 }] });
  LaserCutVendor.find = () => ({ lean: async () => [{ _id: '507f1f77bcf86cd799439015', name: 'Laser vendor', address: 'Laser vendor address' }] });
  try {
    await assert.rejects(normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439014', laserCutStockRef: '507f1f77bcf86cd799439016', source: 'LASER_CUT', quantity: 2 }]), /needs a shade name and shade code/);
    const [line] = await normalizedItems([{ inventoryItemRef: '507f1f77bcf86cd799439014', laserCutStockRef: '507f1f77bcf86cd799439016', source: 'LASER_CUT', quantity: 2, shadeName: 'Matte black', shadeCode: 'RAL 9005' }]);
    assert.equal(line.source, 'LASER_CUT');
    assert.equal(String(line.laserCutStockRef), '507f1f77bcf86cd799439016');
    assert.equal(line.shadeName, 'Matte black');
    assert.equal(line.shadeCode, 'RAL 9005');
    assert.equal(line.pickupSupplierName, 'Laser vendor');
  } finally {
    InventoryItem.find = originalItemFind;
    Supplier.find = originalSupplierFind;
    LaserCutStock.find = originalStockFind;
    LaserCutVendor.find = originalLaserVendorFind;
  }
});

test('laser-cut transfers keep the selected order balance after partial powder-coating moves', () => {
  const [remaining] = remainingLaserCutTransferItems(
    [{ type: 'OUT', status: 'DISPATCHED', vendorRef: '507f1f77bcf86cd799439019', vendorName: 'Laser Works', items: [{ inventoryItemRef: '507f1f77bcf86cd799439020', itemName: 'Panel', quantity: 36 }] }],
    [{ items: [{ source: 'LASER_CUT', pickupSupplierRef: '507f1f77bcf86cd799439019', inventoryItemRef: '507f1f77bcf86cd799439020', quantity: 12 }] }],
  );
  assert.equal(remaining.quantity, 24);
});

test('laser-cut output sizes transfer separately to powder coating', () => {
  const remaining = remainingProducedLaserCutTransferItems(
    [
      { _id: '507f1f77bcf86cd799439040', inventoryItemRef: '507f1f77bcf86cd799439041', vendorRef: '507f1f77bcf86cd799439042', vendorName: 'Laser Works', itemName: 'Aluminium Sheet', dimensions: { heightFt: 4, widthFt: 4 } },
      { _id: '507f1f77bcf86cd799439043', inventoryItemRef: '507f1f77bcf86cd799439041', vendorRef: '507f1f77bcf86cd799439042', vendorName: 'Laser Works', itemName: 'Aluminium Sheet', dimensions: { heightFt: 2, widthFt: 4 } },
    ],
    [{ outputs: [{ outputStockRef: '507f1f77bcf86cd799439040', quantity: 16 }, { outputStockRef: '507f1f77bcf86cd799439043', quantity: 8 }] }],
    [{ items: [{ source: 'LASER_CUT', laserCutStockRef: '507f1f77bcf86cd799439040', quantity: 8 }] }],
  );
  assert.deepEqual(remaining.map((item) => [item.quantity, item.dimensions]), [[8, { heightFt: 4, widthFt: 4 }], [8, { heightFt: 2, widthFt: 4 }]]);
});

test('powder-coating site dispatch keeps different cut sizes separate', () => {
  const remaining = remainingItemsFor(
    { items: [
      { inventoryItemRef: '507f1f77bcf86cd799439018', laserCutStockRef: '507f1f77bcf86cd799439019', itemName: 'Panel', quantity: 10, unit: 'pcs', dimensions: { heightFt: 4, widthFt: 4 } },
      { inventoryItemRef: '507f1f77bcf86cd799439018', laserCutStockRef: '507f1f77bcf86cd799439020', itemName: 'Panel', quantity: 8, unit: 'pcs', dimensions: { heightFt: 2, widthFt: 4 } },
    ], coatingBatches: [{ items: [
      { inventoryItemRef: '507f1f77bcf86cd799439018', laserCutStockRef: '507f1f77bcf86cd799439019', quantity: 10 },
      { inventoryItemRef: '507f1f77bcf86cd799439018', laserCutStockRef: '507f1f77bcf86cd799439020', quantity: 8 },
    ] }] },
    [{ type: 'SITE_OUT', items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', laserCutStockRef: '507f1f77bcf86cd799439019', quantity: 4 }] }],
  );
  assert.deepEqual(remaining.map((item) => [item.quantity, item.dimensions]), [[6, { heightFt: 4, widthFt: 4 }], [8, { heightFt: 2, widthFt: 4 }]]);
});

test('only recorded coating batches are ready for client delivery', () => {
  const order = { items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', itemName: 'Panel', quantity: 4, unit: 'pcs' }], coatingBatches: [{ items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', quantity: 2 }] }] };
  assert.equal(readyItemsFor(order)[0].quantity, 2);
  assert.equal(remainingItemsFor(order, [])[0].quantity, 2);
  assert.equal(remainingItemsFor(order, [{ type: 'SITE_OUT', items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', quantity: 1 }] }])[0].quantity, 1);
});
