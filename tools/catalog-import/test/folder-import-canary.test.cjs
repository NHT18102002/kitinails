const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET,
  buildCanaryProductSetVariables,
  deterministicFilename,
  validateCanaryGuard,
  validateCanaryQa,
  validatePostCanaryDryRun,
} = require('../src/folder-import/canary.cjs');

const contract = {
  sourceKey: 'folder-import:3d:1',
  requestHash: 'request-hash',
  product: {
    sourceKey: 'folder-import:3d:1',
    proposedHandle: 'folder-import-3d-01',
    title: '3D 01',
    pairSha256: 'pair-hash',
    media: [
      { role: 'primary', path: 'products/3d/3d/1.jpg', sha256: 'a'.repeat(64) },
      { role: 'secondary', path: 'products/3d/3d/1.1.jpg', sha256: 'b'.repeat(64) },
    ],
  },
  collection: { gid: 'gid://shopify/Collection/1', handle: '3d', title: '3D' },
};

function metafields() {
  return {
    externalId: { value: contract.sourceKey },
    publisherId: { value: 'ersa-folder-importer-v1' },
    requestHash: { value: contract.requestHash },
    pairHash: { value: contract.product.pairSha256 },
  };
}

test('canary productSet payload is DRAFT, custom-ID upserted, and limited to two files and one collection', () => {
  const variables = buildCanaryProductSetVariables({
    contract,
    fileGids: ['gid://shopify/MediaImage/1', 'gid://shopify/MediaImage/2'],
  });
  assert.equal(variables.input.status, 'DRAFT');
  assert.deepEqual(variables.input.collections, ['gid://shopify/Collection/1']);
  assert.equal(variables.input.files.length, 2);
  assert.equal(variables.identifier.customId.value, contract.sourceKey);
  const externalId = variables.input.metafields.find((item) => item.key === 'external_id');
  assert.equal(externalId.value, contract.sourceKey);
  assert.equal(externalId.type, undefined);
  assert.equal(/publishablePublish|productDelete|customer/i.test(MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET), false);
});

test('canary guard blocks foreign handle collisions and accepts an exact owned DRAFT retry', () => {
  const base = {
    shop: { myshopifyDomain: 'target.myshopify.com' },
    appInstallation: {
      accessScopes: ['read_products', 'write_products', 'read_files', 'write_files'].map((handle) => ({ handle })),
    },
  };
  const foreign = validateCanaryGuard({
    data: {
      ...base,
      byExternalId: null,
      byHandle: { nodes: [{ id: 'gid://shopify/Product/9', handle: contract.product.proposedHandle }] },
    },
    contract,
    expectedStoreDomain: 'target.myshopify.com',
  });
  assert.equal(foreign.gate, 'BLOCKED');

  const owned = {
    id: 'gid://shopify/Product/1',
    handle: contract.product.proposedHandle,
    title: contract.product.title,
    status: 'DRAFT',
    ...metafields(),
  };
  const retry = validateCanaryGuard({
    data: { ...base, byExternalId: owned, byHandle: { nodes: [owned] } },
    contract,
    expectedStoreDomain: 'target.myshopify.com',
  });
  assert.equal(retry.gate, 'PASS');
});

test('canary QA requires DRAFT, exact ownership, two READY images, and one approved collection', () => {
  const product = {
    id: 'gid://shopify/Product/1',
    handle: contract.product.proposedHandle,
    title: contract.product.title,
    status: 'DRAFT',
    ...metafields(),
    collections: { nodes: [{ id: contract.collection.gid, handle: '3d', title: '3D' }] },
    media: {
      nodes: [
        { id: 'gid://shopify/MediaImage/1', mediaContentType: 'IMAGE', status: 'READY' },
        { id: 'gid://shopify/MediaImage/2', mediaContentType: 'IMAGE', status: 'READY' },
      ],
    },
    variants: { nodes: [{ id: 'gid://shopify/ProductVariant/1', title: 'Default Title', price: '0.00' }] },
  };
  const result = validateCanaryQa(product, {
    contract,
    fileGids: ['gid://shopify/MediaImage/1', 'gid://shopify/MediaImage/2'],
  });
  assert.equal(result.gate, 'PASS');
  product.status = 'ACTIVE';
  assert.equal(validateCanaryQa(product, { contract, fileGids: ['gid://shopify/MediaImage/1', 'gid://shopify/MediaImage/2'] }).gate, 'BLOCKED');
});

test('post-canary dry-run unlocks only when one item becomes unchanged and 87 remain creates', () => {
  const report = {
    gate: 'PASS',
    summary: {
      inputProductCount: 88,
      createCount: 87,
      updateCount: 0,
      skipUnchangedCount: 1,
      blockedProductCount: 0,
      globalBlockingErrorCount: 0,
    },
    items: [{ sourceKey: contract.sourceKey, decision: 'SKIP_UNCHANGED' }],
  };
  assert.equal(validatePostCanaryDryRun(report, contract).gate, 'PASS');
  report.summary.createCount = 88;
  assert.equal(validatePostCanaryDryRun(report, contract).gate, 'BLOCKED');
});

test('canary upload filenames are deterministic per image hash', () => {
  assert.equal(deterministicFilename(contract.product.media[0]), `ersa-folder-${'a'.repeat(20)}.jpg`);
});
