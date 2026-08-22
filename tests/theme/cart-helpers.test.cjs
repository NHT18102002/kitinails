const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuantityConstraints } = require('../../assets/cart.helpers.js');

test('normalizeQuantityConstraints supports number inputs and select data attributes', () => {
  assert.deepEqual(normalizeQuantityConstraints({ min: '1', max: '9', step: '2' }), {
    min: 1,
    max: 9,
    step: 2,
  });
});

test('normalizeQuantityConstraints supplies safe defaults for optional select constraints', () => {
  assert.deepEqual(normalizeQuantityConstraints({ min: '1', max: undefined, step: undefined }), {
    min: 1,
    max: null,
    step: 1,
  });
});
