const test = require('node:test');
const assert = require('node:assert/strict');

const { createManifestHash } = require('../src/audit.cjs');

test('createManifestHash is stable for equivalent objects regardless of key order', () => {
  const left = { b: 2, a: { y: 2, x: 1 } };
  const right = { a: { x: 1, y: 2 }, b: 2 };

  assert.equal(createManifestHash(left), createManifestHash(right));
});
