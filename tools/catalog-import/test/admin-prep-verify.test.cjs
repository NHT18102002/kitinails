const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
  EXPECTED_PENDING_COLLECTION_HANDLES,
  inspectPrepareAdminCodeSurface,
  verifyAdminPrepState,
} = require('../src/admin-prep-verify.cjs');

test('verifyAdminPrepState reports pass_with_drift when policies exist but live adopt matches are gone', () => {
  const report = verifyAdminPrepState({
    preflight: {
      collections: {
        resolvedCount: 19,
        missingCount: 0,
        pendingCount: 4,
        pending: EXPECTED_PENDING_COLLECTION_HANDLES.map((handle) => ({ handle })),
      },
      metafieldDefinitions: {
        missing: [],
        typeMismatches: [],
      },
      products: {
        approvedAdoptPolicyCount: EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
        allowlistedAdoptMatchCount: 0,
        conflictCount: 0,
      },
    },
    collectionPrepReport: {
      conflicts: {
        approvedAdopts: Array.from({ length: EXPECTED_APPROVED_ADOPT_POLICY_COUNT }, (_, index) => ({
          handle: `product-${index + 1}`,
        })),
      },
      metafields: {
        missingAfterRun: [],
        typeMismatches: [],
      },
      collections: {
        unresolvedRuleBacked: [],
        pending: EXPECTED_PENDING_COLLECTION_HANDLES.map((handle) => ({ handle })),
      },
    },
    prepareAdminCodeSurface: {
      hasProductMutationImport: false,
      hasProductMutationUsage: false,
      routesPrepareAdminToRunPrepareAdmin: true,
    },
  });

  assert.equal(report.summary.status, 'pass_with_drift');
  assert.equal(report.checks.approvedAdoptPolicyConfigured.status, 'pass');
  assert.equal(report.checks.liveAllowlistedConflictMatches.status, 'drift');
  assert.equal(report.checks.requiredMetafieldsReady.status, 'pass');
  assert.equal(report.checks.ruleBackedCollectionsResolved.status, 'pass');
  assert.equal(report.checks.pendingCollectionsNonBlocking.status, 'pass');
  assert.equal(report.checks.prepareAdminProductMutationGuard.status, 'pass');
});

test('verifyAdminPrepState reports fail when pending collections drift or product mutation guard is broken', () => {
  const report = verifyAdminPrepState({
    preflight: {
      collections: {
        resolvedCount: 10,
        missingCount: 2,
        pendingCount: 1,
        pending: [{ handle: 'best-seller' }],
      },
      metafieldDefinitions: {
        missing: [{ namespace: 'custom', key: 'source_url' }],
        typeMismatches: [],
      },
      products: {
        approvedAdoptPolicyCount: 3,
        allowlistedAdoptMatchCount: 1,
        conflictCount: 2,
      },
    },
    collectionPrepReport: {
      conflicts: {
        approvedAdopts: [{ handle: 'seafoam' }],
      },
      metafields: {
        missingAfterRun: [{ namespace: 'custom', key: 'source_url' }],
        typeMismatches: [],
      },
      collections: {
        unresolvedRuleBacked: [{ handle: 'medium' }],
        pending: [{ handle: 'best-seller' }],
      },
    },
    prepareAdminCodeSurface: {
      hasProductMutationImport: true,
      hasProductMutationUsage: false,
      routesPrepareAdminToRunPrepareAdmin: false,
    },
  });

  assert.equal(report.summary.status, 'fail');
  assert.equal(report.checks.approvedAdoptPolicyConfigured.status, 'fail');
  assert.equal(report.checks.requiredMetafieldsReady.status, 'fail');
  assert.equal(report.checks.ruleBackedCollectionsResolved.status, 'fail');
  assert.equal(report.checks.pendingCollectionsNonBlocking.status, 'fail');
  assert.equal(report.checks.prepareAdminProductMutationGuard.status, 'fail');
});

test('inspectPrepareAdminCodeSurface spots product mutation strings and prepare-admin routing', () => {
  const surface = inspectPrepareAdminCodeSurface({
    runImportSource: "const { runPrepareAdmin } = require('./admin-prep.cjs');\nif (phase === 'prepare-admin') { await runPrepareAdmin({}); }",
    adminPrepSource: "const { MUTATION_COLLECTION_CREATE } = require('./shopify-queries.cjs');",
  });

  assert.equal(surface.hasProductMutationImport, false);
  assert.equal(surface.hasProductMutationUsage, false);
  assert.equal(surface.routesPrepareAdminToRunPrepareAdmin, true);

  const broken = inspectPrepareAdminCodeSurface({
    runImportSource: "if (phase === 'prepare-admin') { await runSomethingElse({}); }",
    adminPrepSource: "const query = 'productSet productCreate';",
  });

  assert.equal(broken.hasProductMutationUsage, true);
  assert.equal(broken.routesPrepareAdminToRunPrepareAdmin, false);
});
