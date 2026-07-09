const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyExistingProduct,
  explainExistingProductDecision,
  findMissingScopes,
  mapApprovedCollectionIds,
  requiredProductMetafieldDefinitions,
  selectImportLocation,
  summarizeProductChecks,
} = require('../src/shopify-preflight.cjs');

test('classifyExistingProduct updates only when source_url matches', () => {
  assert.equal(
    classifyExistingProduct({
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: 'https://ersanails.com/products/seafoam',
      adoptExisting: false,
    }),
    'update'
  );
});

test('classifyExistingProduct skips existing product with blank or different source unless adopted', () => {
  assert.equal(
    classifyExistingProduct({
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: '',
      adoptExisting: false,
    }),
    'skip_conflict'
  );
  assert.equal(
    classifyExistingProduct({
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: 'https://other.example/products/seafoam',
      adoptExisting: true,
    }),
    'adopt'
  );
});

test('classifyExistingProduct adopts only exact allowlisted conflicts by handle and product id', () => {
  const conflictResolutionByHandle = new Map([
    [
      'seafoam',
      {
        handle: 'seafoam',
        existingProductId: 'gid://shopify/Product/9650366644375',
        sourceUrl: 'https://ersanails.com/products/seafoam',
        action: 'adopt_existing',
      },
    ],
  ]);

  assert.equal(
    classifyExistingProduct({
      handle: 'seafoam',
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: '',
      existingProductId: 'gid://shopify/Product/9650366644375',
      conflictResolutionByHandle,
    }),
    'adopt'
  );

  assert.equal(
    classifyExistingProduct({
      handle: 'seafoam',
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: '',
      existingProductId: 'gid://shopify/Product/9999999999999',
      conflictResolutionByHandle,
    }),
    'skip_conflict'
  );
});

test('explainExistingProductDecision distinguishes allowlist adopts from broad adopt flag', () => {
  const conflictResolutionByHandle = new Map([
    [
      'seafoam',
      {
        handle: 'seafoam',
        existingProductId: 'gid://shopify/Product/9650366644375',
        sourceUrl: 'https://ersanails.com/products/seafoam',
        action: 'adopt_existing',
      },
    ],
  ]);

  assert.deepEqual(
    explainExistingProductDecision({
      handle: 'seafoam',
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: '',
      existingProductId: 'gid://shopify/Product/9650366644375',
      conflictResolutionByHandle,
    }),
    { decision: 'adopt', reason: 'allowlisted_conflict' }
  );

  assert.deepEqual(
    explainExistingProductDecision({
      handle: 'other-product',
      sourceUrl: 'https://ersanails.com/products/other-product',
      existingSourceUrl: '',
      existingProductId: 'gid://shopify/Product/111',
      adoptExisting: true,
      conflictResolutionByHandle,
    }),
    { decision: 'adopt', reason: 'adopt_existing_flag' }
  );
});

test('summarizeProductChecks reports approved policies separately from live adopt matches', () => {
  const summary = summarizeProductChecks({
    normalizedCount: 4,
    approvedAdoptPolicyCount: 9,
    productChecks: [
      { decision: 'create', decisionReason: 'not_found' },
      { decision: 'update', decisionReason: 'source_url_match' },
      { decision: 'adopt', decisionReason: 'allowlisted_conflict' },
      { decision: 'skip_conflict', decisionReason: 'source_url_conflict' },
    ],
  });

  assert.equal(summary.normalizedCount, 4);
  assert.equal(summary.createCandidateCount, 1);
  assert.equal(summary.updateCandidateCount, 1);
  assert.equal(summary.adoptCandidateCount, 1);
  assert.equal(summary.conflictCount, 1);
  assert.equal(summary.approvedAdoptPolicyCount, 9);
  assert.equal(summary.allowlistedAdoptMatchCount, 1);
  assert.equal(summary.flaggedAdoptCount, 0);
});

test('mapApprovedCollectionIds returns only resolved approved collections', () => {
  const result = mapApprovedCollectionIds({
    approvedCollections: [{ handle: 'all' }, { handle: 'almond' }],
    resolvedByHandle: new Map([['all', 'gid://shopify/Collection/1']]),
  });

  assert.deepEqual(result.collectionIds, ['gid://shopify/Collection/1']);
  assert.deepEqual(result.missingHandles, ['almond']);
});

test('requiredProductMetafieldDefinitions includes import and taxonomy fields', () => {
  const definitions = requiredProductMetafieldDefinitions();
  assert.equal(definitions.find((item) => item.key === 'source_url').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'demo_inventory').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'nail_color_values').type, 'list.single_line_text_field');
  assert.equal(definitions.find((item) => item.key === 'nail_shape_values').type, 'list.single_line_text_field');
  assert.equal(definitions.find((item) => item.key === 'nail_length_values').type, 'list.single_line_text_field');
  assert.equal(definitions.find((item) => item.key === 'nail_style_values').type, 'list.single_line_text_field');
  assert.equal(definitions.find((item) => item.key === 'nail_shape').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'nail_length').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'finish_style').type, 'list.single_line_text_field');
});

test('findMissingScopes returns required scopes that were not granted', () => {
  assert.deepEqual(
    findMissingScopes(['read_products', 'write_products', 'read_files']),
    ['write_files', 'read_inventory', 'write_inventory', 'read_locations']
  );
});

test('selectImportLocation uses explicit location id or first active location', () => {
  const locations = [
    { id: 'gid://shopify/Location/1', name: 'Inactive', isActive: false },
    { id: 'gid://shopify/Location/2', name: 'Active', isActive: true },
  ];

  assert.equal(selectImportLocation(locations, '').id, 'gid://shopify/Location/2');
  assert.equal(selectImportLocation(locations, 'gid://shopify/Location/1').id, 'gid://shopify/Location/1');
});
