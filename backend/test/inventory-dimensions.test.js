import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMaterialDimensions } from '../src/modules/inventory/controllers/inventory.controller.js';

test('requires dimensions for sheet and tube inventory materials', () => {
  assert.doesNotThrow(() => validateMaterialDimensions('SHEET', { heightFt: 8, widthFt: 4 }));
  assert.throws(() => validateMaterialDimensions('SHEET', { heightFt: 8 }));
  assert.doesNotThrow(() => validateMaterialDimensions('TUBE', { lengthFt: 6 }));
});
