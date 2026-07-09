const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MUTATION_COLLECTION_CREATE,
  MUTATION_METAFIELD_DEFINITION_CREATE,
  MUTATION_METAFIELDS_SET,
  MUTATION_PRODUCT_SET,
  QUERY_PRODUCT_TAXONOMY_BY_HANDLE,
  QUERY_PRODUCT_OPERATION,
} = require('../src/shopify-queries.cjs');

test('admin prep mutations request only supported UserError fields', () => {
  assert.equal(/\bcode\b/.test(MUTATION_COLLECTION_CREATE), false);
  assert.equal(/\bcode\b/.test(MUTATION_METAFIELD_DEFINITION_CREATE), false);
  assert.equal(MUTATION_COLLECTION_CREATE.includes('userErrors'), true);
  assert.equal(MUTATION_METAFIELD_DEFINITION_CREATE.includes('userErrors'), true);
});

test('productSet mutation sends identifier, input, and asynchronous flag', () => {
  assert.equal(MUTATION_PRODUCT_SET.includes('productSet(identifier: $identifier, synchronous: $synchronous, input: $input)'), true);
  assert.equal(MUTATION_PRODUCT_SET.includes('$identifier: ProductSetIdentifiers'), true);
  assert.equal(MUTATION_PRODUCT_SET.includes('userErrors'), true);
  assert.equal(MUTATION_PRODUCT_SET.includes('code'), true);
});

test('product operation query uses productOperation root field for polling', () => {
  assert.equal(QUERY_PRODUCT_OPERATION.includes('productOperation(id: $id)'), true);
  assert.equal(QUERY_PRODUCT_OPERATION.includes('... on ProductSetOperation'), true);
  assert.equal(QUERY_PRODUCT_OPERATION.includes('userErrors'), true);
});

test('taxonomy sync query reads the exact metafields needed for native collection filters', () => {
  assert.equal(QUERY_PRODUCT_TAXONOMY_BY_HANDLE.includes('nail_color_values'), true);
  assert.equal(QUERY_PRODUCT_TAXONOMY_BY_HANDLE.includes('nail_shape_values'), true);
  assert.equal(QUERY_PRODUCT_TAXONOMY_BY_HANDLE.includes('nail_length_values'), true);
  assert.equal(QUERY_PRODUCT_TAXONOMY_BY_HANDLE.includes('nail_style_values'), true);
});

test('metafieldsSet mutation sends taxonomy updates through Shopify Admin GraphQL', () => {
  assert.equal(MUTATION_METAFIELDS_SET.includes('metafieldsSet(metafields: $metafields)'), true);
  assert.equal(MUTATION_METAFIELDS_SET.includes('$metafields: [MetafieldsSetInput!]!'), true);
  assert.equal(MUTATION_METAFIELDS_SET.includes('userErrors'), true);
});
