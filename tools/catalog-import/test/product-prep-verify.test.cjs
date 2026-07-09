const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProductImportReadiness,
  summarizeMerchantInputRequired,
} = require('../src/product-prep-verify.cjs');

test('summarizeMerchantInputRequired groups missing fields by category hint and field', () => {
  const summary = summarizeMerchantInputRequired([
    {
      handle: 'tool-kit',
      categoryHint: 'tool_accessory',
      merchantInputRequired: ['color', 'shape'],
    },
    {
      handle: 'custom-design',
      categoryHint: 'service_or_custom',
      merchantInputRequired: ['color'],
    },
  ]);

  assert.equal(summary.totalProducts, 2);
  assert.equal(summary.byField.color, 2);
  assert.equal(summary.byCategory.tool_accessory, 1);
});

test('buildProductImportReadiness fails on blocking gaps and keeps merchant-input-required as warning', () => {
  const readiness = buildProductImportReadiness({
    approvedManifestSha256: 'approved',
    currentManifestSha256: 'current',
    preflight: {
      scopes: { missing: ['write_products'] },
      collections: { pendingCount: 1, missingHandles: ['medium'] },
      metafieldDefinitions: { missing: [{ key: 'source_url' }], typeMismatches: [] },
      products: { conflictCount: 2 },
    },
    adminPrepVerification: {
      summary: { failedChecks: ['pendingCollections'], driftChecks: [] },
      observed: {},
    },
    shopifyFiles: {
      uniqueAssetHashes: 10,
      readyFileCount: 9,
      failures: [],
    },
    collectionMembership: {
      sourceCollectionHandles: ['fairy'],
      missingSourceCollections: [],
    },
    populationForecast: {
      emptyApprovedCollections: ['fairy'],
    },
    productSetDryRun: {
      summary: {
        productCount: 590,
        variantCount: 2700,
        payloadStatus: 'DRAFT',
        buildErrors: [],
      },
    },
    normalizedProducts: [
      { categoryHint: 'tool_accessory', merchantInputRequired: ['color'] },
    ],
  });

  assert.equal(readiness.status, 'fail');
  assert.equal(readiness.blockers.includes('approvalHashMismatch'), true);
  assert.equal(readiness.warnings.includes('merchantInputRequired'), true);
});

test('buildProductImportReadiness passes when all blocking gates are clear', () => {
  const readiness = buildProductImportReadiness({
    approvedManifestSha256: 'same',
    currentManifestSha256: 'same',
    preflight: {
      scopes: { missing: [] },
      collections: { pendingCount: 0, missingHandles: [] },
      metafieldDefinitions: { missing: [], typeMismatches: [] },
      products: { conflictCount: 0, normalizedCount: 591 },
    },
    adminPrepVerification: {
      summary: { failedChecks: [], driftChecks: ['liveAllowlistedConflictMatches'] },
      observed: {},
    },
    shopifyFiles: {
      uniqueAssetHashes: 10,
      readyFileCount: 10,
      failures: [],
    },
    collectionMembership: {
      sourceCollectionHandles: ['fairy'],
      missingSourceCollections: [],
      unobservableSourceCollections: ['retrowave'],
    },
    populationForecast: {
      emptyApprovedCollections: ['retrowave'],
    },
    productSetDryRun: {
      summary: {
        productCount: 591,
        variantCount: 2700,
        payloadStatus: 'DRAFT',
        buildErrors: [],
      },
    },
    normalizedProducts: [
      ...Array.from({ length: 591 }, () => ({ categoryHint: 'tool_accessory', merchantInputRequired: ['color'] })),
    ],
  });

  assert.equal(readiness.status, 'pass');
  assert.equal(readiness.blockers.length, 0);
  assert.equal(readiness.warnings.includes('merchantInputRequired'), true);
  assert.equal(readiness.warnings.includes('adminPrepDrift'), true);
  assert.equal(readiness.warnings.includes('unobservableSourceCollections'), true);
});
