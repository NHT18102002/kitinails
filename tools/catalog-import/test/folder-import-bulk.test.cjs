const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QUERY_FOLDER_IMPORT_BULK_VERIFY,
  calculateRolloutGateHash,
  createBulkState,
  validateBulkPreflight,
  validateFinalProduct,
} = require('../src/folder-import/bulk.cjs');

const dryRunSha = 'a'.repeat(64);
const manifest = { manifestSha256: 'manifest-hash', products: Array.from({ length: 88 }) };
const rolloutGate = {
  schemaVersion: 'folder-import-rollout-gate-v1',
  generatedAt: '2026-07-22T00:00:00Z',
  gate: 'PASS',
  shopDomain: 'target.myshopify.com',
  canarySourceKey: 'folder-import:3d:1',
  canaryQaHash: 'qa-hash',
  postCanaryDryRunSha256: dryRunSha,
  errors: [],
};
const dryRun = {
  gate: 'PASS',
  reportSha256: dryRunSha,
  summary: {
    inputProductCount: 88,
    createCount: 87,
    updateCount: 0,
    skipUnchangedCount: 1,
    blockedProductCount: 0,
    globalBlockingErrorCount: 0,
  },
  items: [{ sourceKey: 'folder-import:3d:1', decision: 'SKIP_UNCHANGED' }],
};

test('bulk preflight requires the exact post-canary gate and 87 create decisions', () => {
  const pass = validateBulkPreflight({
    manifest,
    dryRun,
    rolloutGate,
    state: null,
    expectedStoreDomain: 'target.myshopify.com',
    approvedDryRunSha: dryRunSha,
  });
  assert.equal(pass.gate, 'PASS');
  const blocked = validateBulkPreflight({
    manifest,
    dryRun: { ...dryRun, reportSha256: 'b'.repeat(64) },
    rolloutGate,
    state: null,
    expectedStoreDomain: 'target.myshopify.com',
    approvedDryRunSha: dryRunSha,
  });
  assert.equal(blocked.gate, 'BLOCKED');
});

test('bulk resume checkpoint is pinned to store, manifest, dry-run and rollout gate', () => {
  const contracts = [{ sourceKey: 'folder-import:3d:2' }];
  const state = createBulkState({
    manifest,
    expectedStoreDomain: 'target.myshopify.com',
    approvedDryRunSha: dryRunSha,
    rolloutGate,
    contracts,
  });
  const resumeDryRun = {
    ...dryRun,
    reportSha256: 'changed-after-progress',
    summary: { ...dryRun.summary, createCount: 86, skipUnchangedCount: 2 },
    items: [...dryRun.items, { sourceKey: 'folder-import:3d:2', decision: 'SKIP_UNCHANGED' }],
  };
  assert.equal(validateBulkPreflight({
    manifest,
    dryRun: resumeDryRun,
    rolloutGate,
    state,
    expectedStoreDomain: 'target.myshopify.com',
    approvedDryRunSha: dryRunSha,
  }).gate, 'PASS');
  assert.equal(calculateRolloutGateHash({ ...rolloutGate, generatedAt: 'later' }), state.rolloutGateHash);
});

test('final product verification requires exact DRAFT ownership, two READY images and one collection', () => {
  const expected = {
    sourceKey: 'folder-import:3d:2',
    proposedHandle: 'folder-import-3d-02',
    title: '3D 02',
    pairSha256: 'pair-hash',
  };
  const product = {
    __typename: 'Product',
    status: 'DRAFT',
    handle: expected.proposedHandle,
    title: expected.title,
    externalId: { value: expected.sourceKey, type: 'id' },
    publisherId: { value: 'ersa-folder-importer-v1' },
    requestHash: { value: 'request-hash' },
    pairHash: { value: expected.pairSha256 },
    media: { nodes: [
      { mediaContentType: 'IMAGE', status: 'READY' },
      { mediaContentType: 'IMAGE', status: 'READY' },
    ] },
    collections: { nodes: [{ id: 'gid://shopify/Collection/1' }] },
    variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1' }] },
  };
  assert.deepEqual(validateFinalProduct(product, {
    expected,
    collection: { gid: 'gid://shopify/Collection/1' },
    requestHash: 'request-hash',
  }), []);
  product.status = 'ACTIVE';
  assert.match(validateFinalProduct(product, {
    expected,
    collection: { gid: 'gid://shopify/Collection/1' },
    requestHash: 'request-hash',
  }).join(' '), /status=ACTIVE/);
});

test('bulk final verification GraphQL is query-only', () => {
  assert.equal(/\bmutation\b/i.test(QUERY_FOLDER_IMPORT_BULK_VERIFY), false);
});
