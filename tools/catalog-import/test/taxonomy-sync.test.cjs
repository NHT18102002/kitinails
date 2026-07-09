const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTaxonomyMetafieldsInput,
  buildTaxonomySyncRecord,
  normalizeTaxonomyForSync,
  resolveExistingProduct,
} = require('../src/taxonomy-sync.cjs');

test('normalizeTaxonomyForSync collapses compound shapes, derives lengths, and keeps merchant input flags only for unresolved fields', () => {
  const normalized = normalizeTaxonomyForSync({
    categoryHint: 'press_on_nails',
    merchantInputRequired: ['color', 'shape', 'length', 'style'],
    taxonomy: {
      color: [],
      shape: ['Medium Almond', 'Short Almond'],
      length: ['20MM'],
      style: [' Ombré ', 'Rhine Stone', 'French Tip', 'french tip'],
    },
  });

  assert.deepEqual(normalized, {
    color: [],
    shape: ['Almond'],
    length: ['Med', 'Short'],
    style: ['Ombre', 'Rhinestone', 'French Tip'],
    merchantInputRequired: ['color'],
  });
});

test('normalizeTaxonomyForSync leaves non-nail accessories without merchant input requirements', () => {
  const normalized = normalizeTaxonomyForSync({
    categoryHint: 'tool_accessory',
    merchantInputRequired: ['color', 'shape', 'length', 'style'],
    taxonomy: {
      color: [],
      shape: [],
      length: [],
      style: [],
    },
  });

  assert.deepEqual(normalized, {
    color: [],
    shape: [],
    length: [],
    style: [],
    merchantInputRequired: [],
  });
});

test('buildTaxonomyMetafieldsInput serializes list metafields and legacy single-value fields', () => {
  const metafields = buildTaxonomyMetafieldsInput({
    productId: 'gid://shopify/Product/1',
    taxonomy: {
      color: ['Nude', 'Red'],
      shape: ['Almond'],
      length: ['Short'],
      style: ['3D', 'French Tip'],
      merchantInputRequired: [],
    },
  });

  assert.deepEqual(metafields, [
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_shape',
      type: 'single_line_text_field',
      value: 'Almond',
    },
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_length',
      type: 'single_line_text_field',
      value: 'Short',
    },
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_color_values',
      type: 'list.single_line_text_field',
      value: JSON.stringify(['Nude', 'Red']),
    },
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_shape_values',
      type: 'list.single_line_text_field',
      value: JSON.stringify(['Almond']),
    },
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_length_values',
      type: 'list.single_line_text_field',
      value: JSON.stringify(['Short']),
    },
    {
      ownerId: 'gid://shopify/Product/1',
      namespace: 'custom',
      key: 'nail_style_values',
      type: 'list.single_line_text_field',
      value: JSON.stringify(['3D', 'French Tip']),
    },
  ]);
});

test('buildTaxonomySyncRecord marks unchanged products without scheduling a mutation', () => {
  const record = buildTaxonomySyncRecord({
    product: {
      handle: 'fairy-garden',
      title: 'Fairy Garden',
      categoryHint: 'press_on_nails',
      merchantInputRequired: [],
      taxonomy: {
        color: ['Pink'],
        shape: ['Short Almond'],
        length: [],
        style: ['French Tip'],
      },
    },
    existing: {
      id: 'gid://shopify/Product/1',
      handle: 'fairy-garden',
      title: 'Fairy Garden',
      colorValues: { value: JSON.stringify(['Pink']) },
      shapeValues: { value: JSON.stringify(['Almond']) },
      lengthValues: { value: JSON.stringify(['Short']) },
      styleValues: { value: JSON.stringify(['French Tip']) },
      shape: { value: 'Almond' },
      length: { value: 'Short' },
    },
  });

  assert.equal(record.decision, 'skipped_unchanged');
  assert.equal(record.metafields.length, 0);
  assert.deepEqual(record.merchantInputRequired, []);
  assert.deepEqual(record.normalizedTaxonomy, {
    color: ['Pink'],
    shape: ['Almond'],
    length: ['Short'],
    style: ['French Tip'],
    merchantInputRequired: [],
  });
});

test('buildTaxonomySyncRecord reports missing source values while still updating known taxonomy fields', () => {
  const record = buildTaxonomySyncRecord({
    product: {
      handle: 'celestial-star',
      title: 'Celestial Star',
      categoryHint: 'press_on_nails',
      merchantInputRequired: ['color', 'shape', 'length', 'style'],
      taxonomy: {
        color: [],
        shape: ['Medium Almond'],
        length: ['20MM'],
        style: ['French Tip'],
      },
    },
    existing: {
      id: 'gid://shopify/Product/2',
      handle: 'celestial-star',
      title: 'Celestial Star',
      colorValues: null,
      shapeValues: { value: JSON.stringify(['Medium Almond']) },
      lengthValues: { value: JSON.stringify(['Med']) },
      styleValues: { value: JSON.stringify(['French Tip']) },
      shape: { value: 'Medium Almond' },
      length: { value: 'Med' },
    },
  });

  assert.equal(record.decision, 'update');
  assert.deepEqual(record.merchantInputRequired, ['color']);
  assert.deepEqual(
    record.metafields.map((item) => item.key),
    ['nail_shape', 'nail_shape_values']
  );
});

test('resolveExistingProduct retries transient fetch failures before returning the exact handle match', async () => {
  let calls = 0;

  const result = await resolveExistingProduct({
    handle: 'fairy-garden',
    graphql: async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError('fetch failed');
      }

      return {
        products: {
          nodes: [
            { id: 'gid://shopify/Product/1', handle: 'other' },
            { id: 'gid://shopify/Product/2', handle: 'fairy-garden', title: 'Fairy Garden' },
          ],
        },
      };
    },
  });

  assert.equal(calls, 2);
  assert.equal(result.id, 'gid://shopify/Product/2');
});
