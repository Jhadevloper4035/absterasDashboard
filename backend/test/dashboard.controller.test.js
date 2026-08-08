import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csvValue } from '../src/controllers/dashboard.controller.js';

test('dashboard CSV values cannot become spreadsheet formulas', () => {
  assert.equal(csvValue('=HYPERLINK("https://evil.example")'), "'=HYPERLINK(\"https://evil.example\")");
  assert.equal(csvValue('Normal lead'), 'Normal lead');
});
