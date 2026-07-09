const path = require('node:path');
const fs = require('node:fs/promises');

const { paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');

const EXPECTED_APPROVED_ADOPT_POLICY_COUNT = 9;
const EXPECTED_PENDING_COLLECTION_HANDLES = [];

async function runVerifyAdminPrep() {
  const [preflight, collectionPrepReport, runImportSource, adminPrepSource] = await Promise.all([
    readRequiredJson(path.join(paths.manifestsRoot, 'import-preflight.json')),
    readRequiredJson(path.join(paths.manifestsRoot, 'collection-prep-report.json')),
    fs.readFile(path.join(paths.toolingRoot, 'src', 'run-import.cjs'), 'utf8'),
    fs.readFile(path.join(paths.toolingRoot, 'src', 'admin-prep.cjs'), 'utf8'),
  ]);

  const report = verifyAdminPrepState({
    preflight,
    collectionPrepReport,
    prepareAdminCodeSurface: inspectPrepareAdminCodeSurface({
      runImportSource,
      adminPrepSource,
    }),
  });

  const reportPath = path.join(paths.manifestsRoot, 'admin-prep-verification.json');
  await writeJson(reportPath, report);
  return report;
}

function verifyAdminPrepState({ preflight, collectionPrepReport, prepareAdminCodeSurface }) {
  const approvedAdoptPolicies = collectionPrepReport?.conflicts?.approvedAdopts || [];
  const preflightProducts = preflight?.products || {};
  const preflightCollections = preflight?.collections || {};
  const preflightMetafields = preflight?.metafieldDefinitions || {};
  const prepMetafields = collectionPrepReport?.metafields || {};
  const prepCollections = collectionPrepReport?.collections || {};

  const checks = {
    approvedAdoptPolicyConfigured: verifyApprovedAdoptPolicies({
      approvedAdopts: approvedAdoptPolicies,
      approvedAdoptPolicyCount: preflightProducts.approvedAdoptPolicyCount,
    }),
    liveAllowlistedConflictMatches: verifyLiveAllowlistedConflictMatches({
      allowlistedAdoptMatchCount: preflightProducts.allowlistedAdoptMatchCount,
      approvedAdoptPolicyCount: preflightProducts.approvedAdoptPolicyCount,
      conflictCount: preflightProducts.conflictCount,
    }),
    requiredMetafieldsReady: verifyMetafieldReadiness({
      preflightMetafields,
      prepMetafields,
    }),
    ruleBackedCollectionsResolved: verifyResolvedCollections({
      preflightCollections,
      prepCollections,
    }),
    pendingCollectionsNonBlocking: verifyPendingCollections({
      preflightCollections,
      prepCollections,
    }),
    prepareAdminProductMutationGuard: verifyPrepareAdminCodeSurface(prepareAdminCodeSurface),
  };

  return {
    generatedAt: new Date().toISOString(),
    summary: summarizeVerification(checks),
    expected: {
      approvedAdoptPolicyCount: EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
      pendingCollectionHandles: EXPECTED_PENDING_COLLECTION_HANDLES,
    },
    observed: {
      approvedAdoptPolicyCount: preflightProducts.approvedAdoptPolicyCount || 0,
      allowlistedAdoptMatchCount: preflightProducts.allowlistedAdoptMatchCount || 0,
      pendingCollectionHandles: (preflightCollections.pending || []).map((item) => item.handle),
      unresolvedRuleBackedCollections: (prepCollections.unresolvedRuleBacked || []).map((item) => item.handle),
      missingMetafields: (preflightMetafields.missing || []).map((item) => `${item.namespace}.${item.key}`),
      typeMismatches: (preflightMetafields.typeMismatches || []).map((item) => `${item.namespace}.${item.key}`),
      productConflicts: preflightProducts.conflictCount || 0,
    },
    checks,
  };
}

function verifyApprovedAdoptPolicies({ approvedAdopts, approvedAdoptPolicyCount }) {
  const configuredCount = approvedAdopts.length;
  const observedCount = Number(approvedAdoptPolicyCount || 0);
  const pass =
    configuredCount === EXPECTED_APPROVED_ADOPT_POLICY_COUNT &&
    observedCount === EXPECTED_APPROVED_ADOPT_POLICY_COUNT;

  return {
    status: pass ? 'pass' : 'fail',
    expectedCount: EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
    configuredCount,
    observedCount,
    message: pass
      ? 'Approved adopt allowlist is configured with all 9 exact policies.'
      : 'Approved adopt allowlist count does not match the 9 expected exact conflict policies.',
  };
}

function verifyLiveAllowlistedConflictMatches({ allowlistedAdoptMatchCount, approvedAdoptPolicyCount, conflictCount }) {
  const matchCount = Number(allowlistedAdoptMatchCount || 0);
  const policyCount = Number(approvedAdoptPolicyCount || 0);
  const conflicts = Number(conflictCount || 0);

  if (policyCount === 0) {
    return {
      status: 'fail',
      expectedCount: EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
      observedMatchCount: matchCount,
      message: 'No approved adopt policies were visible in preflight, so live conflict verification cannot pass.',
    };
  }

  if (matchCount === policyCount) {
    return {
      status: 'pass',
      expectedCount: policyCount,
      observedMatchCount: matchCount,
      message: 'All approved adopt policies still correspond to live allowlisted conflicts in Shopify.',
    };
  }

  if (matchCount === 0 && conflicts === 0) {
    return {
      status: 'drift',
      expectedCount: policyCount,
      observedMatchCount: matchCount,
      message:
        'Approved adopt policies are configured, but current Shopify state no longer exposes those handle conflicts. This is store drift, not a policy misconfiguration.',
    };
  }

  return {
    status: 'fail',
    expectedCount: policyCount,
    observedMatchCount: matchCount,
    message: 'Only part of the approved adopt policy set matched live Shopify conflicts.',
  };
}

function verifyMetafieldReadiness({ preflightMetafields, prepMetafields }) {
  const missing = preflightMetafields.missing || [];
  const typeMismatches = preflightMetafields.typeMismatches || [];
  const missingAfterRun = prepMetafields.missingAfterRun || [];
  const prepTypeMismatches = prepMetafields.typeMismatches || [];
  const pass = !missing.length && !typeMismatches.length && !missingAfterRun.length && !prepTypeMismatches.length;

  return {
    status: pass ? 'pass' : 'fail',
    missing: missing.map((item) => `${item.namespace}.${item.key}`),
    typeMismatches: typeMismatches.map((item) => `${item.namespace}.${item.key}`),
    missingAfterRun: missingAfterRun.map((item) => `${item.namespace}.${item.key}`),
    message: pass
      ? 'Required import and taxonomy metafield definitions exist with compatible types.'
      : 'Metafield definitions are still missing or have type mismatches.',
  };
}

function verifyResolvedCollections({ preflightCollections, prepCollections }) {
  const unresolvedRuleBacked = prepCollections.unresolvedRuleBacked || [];
  const missingCount = Number(preflightCollections.missingCount || 0);
  const pass = !missingCount && !unresolvedRuleBacked.length;

  return {
    status: pass ? 'pass' : 'fail',
    resolvedCount: Number(preflightCollections.resolvedCount || 0),
    missingCount,
    unresolvedRuleBacked: unresolvedRuleBacked.map((item) => item.handle),
    message: pass
      ? 'All rule-backed approved collections resolve in Shopify.'
      : 'Some approved rule-backed collections still do not resolve in Shopify.',
  };
}

function verifyPendingCollections({ preflightCollections, prepCollections }) {
  const observedPending = new Set((preflightCollections.pending || []).map((item) => item.handle));
  const prepPending = new Set((prepCollections.pending || []).map((item) => item.handle));
  const samePendingSet =
    observedPending.size === EXPECTED_PENDING_COLLECTION_HANDLES.length &&
    EXPECTED_PENDING_COLLECTION_HANDLES.every((handle) => observedPending.has(handle) && prepPending.has(handle));
  const pass = samePendingSet && Number(preflightCollections.missingCount || 0) === 0;

  return {
    status: pass ? 'pass' : 'fail',
    expectedPending: EXPECTED_PENDING_COLLECTION_HANDLES,
    observedPending: Array.from(observedPending),
    message: pass
      ? 'Pending collections are explicitly reported and no longer appear as blocking missing collections.'
      : 'Pending collection set drifted or still blocks the approved collection map.',
  };
}

function inspectPrepareAdminCodeSurface({ runImportSource, adminPrepSource }) {
  const productMutationPattern = /\b(productSet|productCreate|productUpdate|productDelete|productVariantsBulkUpdate)\b/;

  return {
    hasProductMutationImport: productMutationPattern.test(String(runImportSource || '')),
    hasProductMutationUsage: productMutationPattern.test(String(adminPrepSource || '')),
    routesPrepareAdminToRunPrepareAdmin:
      /phase === 'prepare-admin'/.test(String(runImportSource || '')) &&
      /runPrepareAdmin\s*\(/.test(String(runImportSource || '')),
  };
}

function verifyPrepareAdminCodeSurface(surface) {
  const pass =
    surface.routesPrepareAdminToRunPrepareAdmin &&
    !surface.hasProductMutationImport &&
    !surface.hasProductMutationUsage;

  return {
    status: pass ? 'pass' : 'fail',
    ...surface,
    message: pass
      ? 'prepare-admin routes only to admin prep logic and does not reference product mutation operations.'
      : 'prepare-admin code surface suggests product mutation references or broken routing.',
  };
}

function summarizeVerification(checks) {
  const statuses = Object.values(checks).map((check) => check.status);
  const hasFail = statuses.includes('fail');
  const hasDrift = statuses.includes('drift');

  return {
    status: hasFail ? 'fail' : hasDrift ? 'pass_with_drift' : 'pass',
    failedChecks: Object.entries(checks)
      .filter(([, check]) => check.status === 'fail')
      .map(([name]) => name),
    driftChecks: Object.entries(checks)
      .filter(([, check]) => check.status === 'drift')
      .map(([name]) => name),
  };
}

async function readRequiredJson(filePath) {
  const data = await readJsonIfExists(filePath);
  if (!data) {
    throw new Error(`Missing required manifest: ${filePath}`);
  }
  return data;
}

module.exports = {
  EXPECTED_APPROVED_ADOPT_POLICY_COUNT,
  EXPECTED_PENDING_COLLECTION_HANDLES,
  inspectPrepareAdminCodeSurface,
  runVerifyAdminPrep,
  verifyAdminPrepState,
};
