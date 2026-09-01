import assert from 'node:assert/strict';
import test from 'node:test';
import { deleteVendor as deleteLaserCutVendor } from '../src/modules/lasercut/lasercut.controller.js';
import { deleteVendor as deletePowderCoatVendor } from '../src/modules/powdercoating/powdercoating.controller.js';
import { LaserCutVendor } from '../src/modules/lasercut/models.js';
import { PowderCoatVendor } from '../src/modules/powdercoating/models.js';

test('laser-cut and powder-coating vendors use separate collections', async () => {
  assert.notEqual(LaserCutVendor.collection.name, PowderCoatVendor.collection.name);
  await new LaserCutVendor({ name: 'Laser vendor' }).validate();
  await new PowderCoatVendor({ name: 'Powder vendor' }).validate();
});

test('deleting a process vendor deactivates it instead of removing challan history', async () => {
  const originals = { laser: LaserCutVendor.findByIdAndUpdate, powder: PowderCoatVendor.findByIdAndUpdate };
  const id = '507f1f77bcf86cd799439011';
  const responses = [];
  try {
    LaserCutVendor.findByIdAndUpdate = async (vendorId, update) => ({ _id: vendorId, ...update });
    PowderCoatVendor.findByIdAndUpdate = async (vendorId, update) => ({ _id: vendorId, ...update });
    await deleteLaserCutVendor({ params: { id } }, { json: (body) => responses.push(body) });
    await deletePowderCoatVendor({ params: { id } }, { json: (body) => responses.push(body) });
    assert.deepEqual(responses, [{ data: { _id: id, status: 'inactive' } }, { data: { _id: id, status: 'inactive' } }]);
  } finally {
    LaserCutVendor.findByIdAndUpdate = originals.laser;
    PowderCoatVendor.findByIdAndUpdate = originals.powder;
  }
});
