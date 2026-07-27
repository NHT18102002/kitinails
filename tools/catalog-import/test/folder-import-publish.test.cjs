const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRequestHash, PUBLISHER_ID } = require('../src/folder-import/dry-run.cjs');
const {
  QUERY_FOLDER_IMPORT_PUBLISH_STATE,
  buildFolderPublishPlanReport,
  publishPlanHash,
  runFolderPublishAll,
  runFolderPublishCanary,
  validateFolderPublishProduct,
  validatePublishApplyPreflight,
} = require('../src/folder-import/publish.cjs');

function fixture(index = 1) {
  const sourceKey = `folder-import:3d:${index}`;
  const productGid = `gid://shopify/Product/${index}`;
  const expected = {
    sourceKey,
    collectionFolder: '3d',
    pairSha256: `pair-${index}`,
    proposedHandle: `folder-import-3d-${String(index).padStart(2, '0')}`,
    title: `3D ${String(index).padStart(2, '0')}`,
    media: [{ sha256: `primary-${index}` }, { sha256: `secondary-${index}` }],
  };
  const collection = { folder: '3d', gid: 'gid://shopify/Collection/3', handle: '3d', title: 'Merchant title' };
  const verificationItem = { sourceKey, collectionFolder: '3d', productGid };
  const product = {
    __typename: 'Product',
    id: productGid,
    handle: expected.proposedHandle,
    title: expected.title,
    status: 'DRAFT',
    onlineStoreUrl: null,
    onlineStorePreviewUrl: null,
    publishedOnPublication: false,
    externalId: { value: sourceKey, type: 'id' },
    publisherId: { value: PUBLISHER_ID },
    requestHash: { value: buildRequestHash(expected, collection) },
    pairHash: { value: expected.pairSha256 },
    media: { nodes: [
      { id: `gid://shopify/MediaImage/${index}-1`, mediaContentType: 'IMAGE', status: 'READY' },
      { id: `gid://shopify/MediaImage/${index}-2`, mediaContentType: 'IMAGE', status: 'READY' },
    ] },
    collections: { nodes: [{ id: collection.gid, handle: collection.handle, title: collection.title }] },
    variants: { nodes: [{ id: `gid://shopify/ProductVariant/${index}`, title: 'Default Title', price: '44.99' }] },
  };
  return { collection, expected, product, verificationItem };
}

function buildFixturePlan() {
  const fixtures = Array.from({ length: 88 }, (_, index) => fixture(index + 1));
  const manifest = {
    schemaVersion: 'folder-product-manifest-v1',
    manifestSha256: 'manifest-sha',
    products: fixtures.map((item) => item.expected),
  };
  const finalVerification = {
    schemaVersion: 'folder-import-final-verification-v1',
    gate: 'PASS',
    sourceManifestSha256: 'manifest-sha',
    reportSha256: 'verification-sha',
    summary: { verifiedCount: 88 },
    items: fixtures.map((item) => item.verificationItem),
  };
  const pricingVerification = {
    schemaVersion: 'folder-import-pricing-plan-v1',
    gate: 'PASS',
    sourceManifestSha256: 'manifest-sha',
    reportSha256: 'pricing-sha',
    targetPrice: '44.99',
    summary: { itemCount: 88, updateCount: 0, skipUnchangedCount: 88, blockedCount: 0 },
  };
  const report = buildFolderPublishPlanReport({
    manifest,
    finalVerification,
    pricingVerification,
    mappings: [fixtures[0].collection],
    data: {
      shop: { name: 'Target', myshopifyDomain: 'target.myshopify.com', currencyCode: 'USD' },
      appInstallation: { accessScopes: [
        { handle: 'read_products' },
        { handle: 'write_products' },
        { handle: 'read_publications' },
        { handle: 'write_publications' },
      ] },
      nodes: fixtures.map((item) => item.product),
    },
    expectedStoreDomain: 'target.myshopify.com',
    targetPublication: {
      id: 'gid://shopify/Publication/1',
      channels: { nodes: [{ name: 'Online Store', handle: 'online_store' }] },
      catalog: { title: 'Online Store' },
    },
  });
  return { fixtures, manifest, report };
}

test('publish ownership guard requires exact identity, media, collection and price', () => {
  const item = fixture();
  assert.deepEqual(validateFolderPublishProduct(item.product, {
    expected: item.expected,
    verificationItem: item.verificationItem,
    collection: item.collection,
    targetPrice: '44.99',
    publicationId: 'gid://shopify/Publication/1',
  }), []);
  item.product.publisherId.value = 'foreign';
  item.product.collections.nodes = [];
  item.product.variants.nodes[0].price = '45.00';
  const errors = validateFolderPublishProduct(item.product, {
    expected: item.expected,
    verificationItem: item.verificationItem,
    collection: item.collection,
    targetPrice: '44.99',
    publicationId: 'gid://shopify/Publication/1',
  }).join(' ');
  assert.match(errors, /publisher marker mismatch/);
  assert.match(errors, /collection membership mismatch/);
  assert.match(errors, /price=45.00/);
});

test('publish plan covers exactly 88 owned products and has a stable approval hash', () => {
  const { report } = buildFixturePlan();
  assert.equal(report.gate, 'PASS');
  assert.deepEqual(report.summary, {
    expectedCount: 88,
    itemCount: 88,
    publishCount: 88,
    skipPublishedCount: 0,
    blockedCount: 0,
    activeCount: 0,
    publishedCount: 0,
  });
  assert.equal(report.reportSha256, publishPlanHash(report));
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
});

test('publish apply is pinned to explicit plan SHA, store and manifest', () => {
  const { manifest, report } = buildFixturePlan();
  assert.equal(validatePublishApplyPreflight({
    plan: report,
    state: null,
    manifest,
    expectedStoreDomain: 'target.myshopify.com',
    approvedPlanSha: report.reportSha256,
  }).gate, 'PASS');
  assert.equal(validatePublishApplyPreflight({
    plan: report,
    state: null,
    manifest,
    expectedStoreDomain: 'another.myshopify.com',
    approvedPlanSha: report.reportSha256,
  }).gate, 'BLOCKED');
});

test('publish commands require explicit mutation confirmation', async () => {
  await assert.rejects(runFolderPublishCanary({ confirmPublish: false }), /confirm-publish/);
  await assert.rejects(runFolderPublishAll({ confirmPublish: false }), /confirm-publish/);
});

test('publish state query is read-only and scoped to exact product IDs', () => {
  assert.doesNotMatch(QUERY_FOLDER_IMPORT_PUBLISH_STATE, /\bmutation\b/i);
  assert.match(QUERY_FOLDER_IMPORT_PUBLISH_STATE, /nodes\(ids:\s*\$ids\)/);
  assert.match(QUERY_FOLDER_IMPORT_PUBLISH_STATE, /publishedOnPublication/);
  assert.doesNotMatch(QUERY_FOLDER_IMPORT_PUBLISH_STATE, /customer|checkout|theme|payment/i);
});
