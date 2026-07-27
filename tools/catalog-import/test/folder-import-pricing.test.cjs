const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MUTATION_FOLDER_IMPORT_PRICE_UPDATE,
  QUERY_FOLDER_IMPORT_PRICING,
  buildPricingPlanReport,
  createPricingState,
  normalizePrice,
  runFolderPricingApply,
  validatePricingApplyPreflight,
  validatePricingProduct,
} = require('../src/folder-import/pricing.cjs');

function fixture(index = 1, price = '0.00') {
  const sourceKey = `folder-import:3d:${index}`;
  const productGid = `gid://shopify/Product/${index}`;
  const expected = {
    sourceKey,
    pairSha256: `pair-${index}`,
    proposedHandle: `folder-import-3d-${String(index).padStart(2, '0')}`,
    title: `3D ${String(index).padStart(2, '0')}`,
  };
  const verificationItem = { sourceKey, collectionFolder: '3d', productGid };
  const product = {
    __typename: 'Product',
    id: productGid,
    handle: expected.proposedHandle,
    title: expected.title,
    status: 'DRAFT',
    externalId: { value: sourceKey, type: 'id' },
    publisherId: { value: 'ersa-folder-importer-v1' },
    requestHash: { value: `request-${index}` },
    pairHash: { value: expected.pairSha256 },
    variants: { nodes: [{ id: `gid://shopify/ProductVariant/${index}`, title: 'Default Title', price }] },
  };
  return { expected, verificationItem, product };
}

test('normalizePrice accepts safe positive money values and rejects ambiguous input', () => {
  assert.equal(normalizePrice('44.9'), '44.90');
  assert.equal(normalizePrice('44.99'), '44.99');
  assert.throws(() => normalizePrice('0'), /greater than 0/);
  assert.throws(() => normalizePrice('44,99'), /positive decimal/);
  assert.throws(() => normalizePrice('44.999'), /positive decimal/);
});

test('pricing ownership guard requires the exact DRAFT batch product and one variant', () => {
  const { expected, verificationItem, product } = fixture();
  assert.deepEqual(validatePricingProduct(product, { expected, verificationItem }), []);
  product.status = 'ACTIVE';
  product.publisherId.value = 'foreign-publisher';
  product.variants.nodes.push({ id: 'gid://shopify/ProductVariant/2', price: '0.00' });
  assert.match(validatePricingProduct(product, { expected, verificationItem }).join(' '), /status=ACTIVE/);
  assert.match(validatePricingProduct(product, { expected, verificationItem }).join(' '), /publisher marker mismatch/);
  assert.match(validatePricingProduct(product, { expected, verificationItem }).join(' '), /variant count=2/);
});

test('pricing plan covers exactly 88 owned DRAFT products without mutations', () => {
  const fixtures = Array.from({ length: 88 }, (_, index) => fixture(index + 1, index === 0 ? '44.99' : '0.00'));
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
  const report = buildPricingPlanReport({
    manifest,
    finalVerification,
    data: {
      shop: { name: 'Target', myshopifyDomain: 'target.myshopify.com', currencyCode: 'USD' },
      nodes: fixtures.map((item) => item.product),
    },
    expectedStoreDomain: 'target.myshopify.com',
    targetPrice: '44.99',
  });
  assert.equal(report.gate, 'PASS');
  assert.equal(report.summary.updateCount, 87);
  assert.equal(report.summary.skipUnchangedCount, 1);
  assert.equal(report.summary.blockedCount, 0);
  assert.equal(report.items.length, 88);
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
});

test('pricing apply is pinned to approved plan/store/manifest and requires explicit confirmation', async () => {
  const report = {
    gate: 'PASS',
    reportSha256: 'a'.repeat(64),
    sourceManifestSha256: 'manifest-sha',
    targetPrice: '44.99',
    summary: { blockedCount: 0, updateCount: 88 },
  };
  assert.equal(validatePricingApplyPreflight({
    report,
    state: null,
    expectedStoreDomain: 'target.myshopify.com',
    approvedPlanSha: report.reportSha256,
  }).gate, 'PASS');
  const state = createPricingState({ report, expectedStoreDomain: 'target.myshopify.com' });
  assert.equal(validatePricingApplyPreflight({
    report: { ...report, reportSha256: 'changed-after-progress' },
    state,
    expectedStoreDomain: 'target.myshopify.com',
    approvedPlanSha: report.reportSha256,
  }).gate, 'PASS');
  await assert.rejects(runFolderPricingApply({ confirmApply: false }), /confirm-price-update/);
});

test('pricing documents are narrowly scoped to read products and update variant prices', () => {
  assert.equal(/\bmutation\b/i.test(QUERY_FOLDER_IMPORT_PRICING), false);
  assert.match(MUTATION_FOLDER_IMPORT_PRICE_UPDATE, /productVariantsBulkUpdate/);
  assert.match(MUTATION_FOLDER_IMPORT_PRICE_UPDATE, /allowPartialUpdates:\s*false/);
  assert.doesNotMatch(MUTATION_FOLDER_IMPORT_PRICE_UPDATE, /publishablePublish|productCreate|productDelete|collection|customer/i);
});
