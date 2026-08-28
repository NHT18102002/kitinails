const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQaSummary,
  compareImportedProduct,
} = require('../src/product-import-qa.cjs');

test('compareImportedProduct reports mismatches across status, tags, metafields, media, variants, and inventory', () => {
  const result = compareImportedProduct({
    expectedRequest: {
      identifier: { handle: 'fairy-garden' },
      input: {
        status: 'DRAFT',
        tags: ['Press On Nails', 'SrcCollection_fairy'],
        files: [{ id: 'gid://shopify/MediaImage/1' }],
        metafields: [
          { key: 'source_url', value: 'https://ersanails.com/products/fairy-garden' },
          { key: 'demo_inventory', value: 'true' },
        ],
        variants: [
          {
            sku: 'FG-XS',
            price: '49.99',
            compareAtPrice: '59.99',
            inventoryQuantities: [{ locationId: 'gid://shopify/Location/2', quantity: 50 }],
          },
        ],
      },
    },
    importedProduct: {
      handle: 'fairy-garden',
      status: 'ACTIVE',
      tags: ['Press On Nails'],
      mediaCount: 0,
      sourceUrl: 'https://wrong.example/product',
      metafields: { demo_inventory: 'false' },
      variants: [
        {
          sku: 'FG-XS',
          price: '49.99',
          compareAtPrice: '55.99',
          inventoryByLocation: { 'gid://shopify/Location/2': 40 },
        },
      ],
    },
  });

  assert.equal(result.mismatches.includes('status'), true);
  assert.equal(result.mismatches.includes('sourceUrl'), true);
  assert.equal(result.mismatches.includes('tags'), true);
  assert.equal(result.mismatches.includes('mediaCount'), true);
  assert.equal(result.mismatches.includes('metafields'), true);
  assert.equal(result.mismatches.includes('variantCompareAtPrice'), true);
  assert.equal(result.mismatches.includes('inventoryQuantities'), true);
});

test('compareImportedProduct does not fail on Admin-managed inventory during updates', () => {
  const result = compareImportedProduct({
    preserveInventory: true,
    expectedRequest: {
      identifier: { handle: 'fairy-garden' },
      input: {
        status: 'DRAFT',
        tags: [],
        files: [],
        metafields: [],
        variants: [
          {
            sku: 'FG-XS',
            price: '49.99',
            compareAtPrice: null,
            inventoryQuantities: [{ locationId: 'gid://shopify/Location/2', quantity: 50 }],
          },
        ],
      },
    },
    importedProduct: {
      handle: 'fairy-garden',
      status: 'DRAFT',
      tags: [],
      mediaCount: 0,
      sourceUrl: '',
      metafields: {},
      variants: [
        {
          sku: 'FG-XS',
          price: '49.99',
          compareAtPrice: '',
          inventoryByLocation: { 'gid://shopify/Location/2': 7 },
        },
      ],
    },
  });

  assert.equal(result.mismatches.includes('inventoryQuantities'), false);
  assert.deepEqual(result.mismatches, []);
});

test('buildQaSummary counts matched, mismatched, and missing products', () => {
  const summary = buildQaSummary([
    { handle: 'a', missing: false, mismatches: [] },
    { handle: 'b', missing: false, mismatches: ['tags'] },
    { handle: 'c', missing: true, mismatches: [] },
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.matched, 1);
  assert.equal(summary.mismatched, 1);
  assert.equal(summary.missing, 1);
});
