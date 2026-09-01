import assert from 'node:assert/strict';
import { test } from 'node:test';
import { laserCutMaterialDetails } from '../src/modules/inventory/models/item.model.js';

test('sheet dimensions remain in feet for inventory and laser-cut workflows', () => {
  assert.deepEqual(
    laserCutMaterialDetails({ name: 'Aluminium Sheet 4x8 ft', materialType: 'SHEET', defaultDimensions: { heightFt: 8, widthFt: 4 } }),
    { materialType: 'SHEET', defaultDimensions: { heightFt: 8, widthFt: 4 } },
  );
});

test('legacy millimetre sheet specifications are converted to feet', () => {
  assert.deepEqual(
    laserCutMaterialDetails({ name: 'Aluminium Sheet 1220x2440', specs: { length: 2440, width: 1220 } }),
    { materialType: 'SHEET', defaultDimensions: { heightFt: 2440 / 304.8, widthFt: 1220 / 304.8 } },
  );
});
