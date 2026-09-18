import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresShadeDetails, validateHardwareSpecs, vendorLocation } from '../src/modules/inventory/controllers/inventory.controller.js';

test('raw sheets, tubes, profiles, and hardware do not require shade details', () => {
  assert.equal(requiresShadeDetails('SHEET'), false);
  assert.equal(requiresShadeDetails('TUBE'), false);
  assert.equal(requiresShadeDetails('OTHER', 'sheet'), false);
  assert.equal(requiresShadeDetails('OTHER', 'tube'), false);
  assert.equal(requiresShadeDetails('OTHER', 'profile'), false);
  assert.equal(requiresShadeDetails('OTHER', 'hardware'), false);
  assert.equal(requiresShadeDetails('OTHER'), true);
});

test('vendor address becomes the material storage location', () => {
  assert.equal(vendorLocation({ address: '  Vendor warehouse  ' }), 'Vendor warehouse');
  assert.equal(vendorLocation({}), '');
});

test('colour spray hardware requires a color name and bottle quantity', () => {
  assert.throws(() => validateHardwareSpecs('hardware', { hardwareType: 'colour_spray' }), /Color name is required/);
  assert.throws(() => validateHardwareSpecs('hardware', { hardwareType: 'colour_spray', colorName: 'Matte Black' }), /Bottle quantity must be greater than zero/);
  assert.doesNotThrow(() => validateHardwareSpecs('hardware', { hardwareType: 'colour_spray', colorName: 'Matte Black', bottleQuantity: 400 }));
});
