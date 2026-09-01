import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedItems, remainingItemsFor } from '../src/modules/powdercoating/powdercoating.controller.js';
import { InventoryItem } from '../src/modules/inventory/models/item.model.js';
import { Supplier } from '../src/modules/inventory/models/supplier.model.js';
import { LaserCutStock, LaserCutVendor } from '../src/modules/lasercut/models.js';

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

test('powder-coating site dispatch leaves the undelivered product quantity at the vendor', () => {
  const [remaining] = remainingItemsFor(
    { items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', itemName: 'Panel', quantity: 10, unit: 'pcs' }] },
    [{ type: 'SITE_OUT', items: [{ inventoryItemRef: '507f1f77bcf86cd799439018', quantity: 4 }] }],
  );
  assert.equal(remaining.quantity, 6);
});
