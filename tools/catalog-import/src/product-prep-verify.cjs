const path = require('node:path');

const { paths } = require('./config.cjs');
const { readJsonIfExists, writeJson, writeText } = require('./fs-utils.cjs');
const { readCurrentManifestHash } = require('./approval.cjs');

function summarizeMerchantInputRequired(normalizedProducts) {
  const summary = {
    totalProducts: 0,
    byField: {},
    byCategory: {},
  };

  for (const product of normalizedProducts || []) {
    const missingFields = Array.isArray(product.merchantInputRequired) ? product.merchantInputRequired : [];
    if (!missingFields.length) continue;

    summary.totalProducts += 1;
    summary.byCategory[product.categoryHint || 'unknown'] = (summary.byCategory[product.categoryHint || 'unknown'] || 0) + 1;

    for (const field of missingFields) {
      summary.byField[field] = (summary.byField[field] || 0) + 1;
    }
  }

  return summary;
}

function buildProductImportReadiness({
  approvedManifestSha256,
  currentManifestSha256,
  preflight,
  adminPrepVerification,
  shopifyFiles,
  collectionMembership,
  populationForecast,
  productSetDryRun,
  normalizedProducts,
}) {
  const blockers = [];
  const warnings = [];
  const merchantInput = summarizeMerchantInputRequired(normalizedProducts);
  const readyFileCount = Number(shopifyFiles?.readyFileCount || 0);
  const uniqueAssetHashes = Number(shopifyFiles?.uniqueAssetHashes || 0);
  const hasScopeGap = Boolean(preflight?.scopes?.missing?.length);
  const hasCollectionGap = Boolean(preflight?.collections?.pendingCount || preflight?.collections?.missingHandles?.length);
  const hasMetafieldGap = Boolean(preflight?.metafieldDefinitions?.missing?.length || preflight?.metafieldDefinitions?.typeMismatches?.length);
  const hasConflictGap = Number(preflight?.products?.conflictCount || 0) > 0;
  const hasPrepFailures = Boolean(adminPrepVerification?.summary?.failedChecks?.length);
  const hasMissingSourceCollections = Boolean(collectionMembership?.missingSourceCollections?.length);
  const unobservableSourceCollections = new Set(collectionMembership?.unobservableSourceCollections || []);
  const blockingEmptyApprovedCollections = (populationForecast?.emptyApprovedCollections || []).filter(
    (handle) => !unobservableSourceCollections.has(handle)
  );
  const hasEmptyApprovedCollections = Boolean(blockingEmptyApprovedCollections.length);
  const hasBuildErrors = Boolean(productSetDryRun?.summary?.buildErrors?.length);
  const hasProductCountMismatch = Number(productSetDryRun?.summary?.productCount || 0) !== (normalizedProducts || []).length;
  const hasMediaGap = uniqueAssetHashes > 0 && readyFileCount !== uniqueAssetHashes;

  if (approvedManifestSha256 !== currentManifestSha256) blockers.push('approvalHashMismatch');
  if (hasScopeGap) blockers.push('missingScopes');
  if (hasCollectionGap) blockers.push('pendingOrMissingCollections');
  if (hasMetafieldGap) blockers.push('missingOrMismatchedMetafields');
  if (hasConflictGap) blockers.push('productConflicts');
  if (hasPrepFailures) blockers.push('adminPrepVerificationFailed');
  if (hasMissingSourceCollections) blockers.push('missingSourceCollections');
  if (hasEmptyApprovedCollections) blockers.push('emptyApprovedCollections');
  if (hasBuildErrors) blockers.push('productSetBuildErrors');
  if (hasProductCountMismatch) blockers.push('productCountMismatch');
  if (hasMediaGap) blockers.push('mediaNotReady');

  if (merchantInput.totalProducts > 0) warnings.push('merchantInputRequired');
  if (adminPrepVerification?.summary?.driftChecks?.length) warnings.push('adminPrepDrift');
  if (unobservableSourceCollections.size > 0) warnings.push('unobservableSourceCollections');

  return {
    status: blockers.length ? 'fail' : 'pass',
    blockers,
    warnings,
    summary: {
      approvedManifestSha256,
      currentManifestSha256,
      readyFileCount,
      uniqueAssetHashes,
      productCount: Number(productSetDryRun?.summary?.productCount || 0),
      variantCount: Number(productSetDryRun?.summary?.variantCount || 0),
      payloadStatus: productSetDryRun?.summary?.payloadStatus || '',
      emptyApprovedCollections: blockingEmptyApprovedCollections,
      unobservableSourceCollections: Array.from(unobservableSourceCollections),
      merchantInputRequired: merchantInput,
    },
  };
}

async function runVerifyProductPrep() {
  const [
    approval,
    currentManifest,
    preflight,
    adminPrepVerification,
    shopifyFiles,
    collectionMembership,
    populationForecast,
    productSetDryRun,
    normalized,
  ] = await Promise.all([
    readJsonIfExists(path.join(paths.toolingRoot, 'config', 'import-approval.json')),
    readCurrentManifestHash(),
    readJsonIfExists(path.join(paths.manifestsRoot, 'import-preflight.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'admin-prep-verification.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'shopify-files.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'source-collection-membership.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'collection-population-forecast.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-dry-run.json')),
    readJsonIfExists(path.join(paths.normalizedRoot, 'products.json')),
  ]);

  const normalizedProducts = Array.isArray(normalized) ? normalized : normalized?.products || [];
  const readiness = buildProductImportReadiness({
    approvedManifestSha256: approval?.approvedManifestSha256 || '',
    currentManifestSha256: currentManifest,
    preflight,
    adminPrepVerification,
    shopifyFiles,
    collectionMembership,
    populationForecast,
    productSetDryRun,
    normalizedProducts,
  });

  const manifest = {
    generatedAt: new Date().toISOString(),
    ...readiness,
  };

  await writeJson(path.join(paths.manifestsRoot, 'product-import-readiness.json'), manifest);
  await writeText(path.join(paths.docsRoot, 'catalog-product-import-readiness.md'), toMarkdownReadiness(manifest));
  return manifest;
}

function toMarkdownReadiness(readiness) {
  return [
    '# Product Import Readiness',
    '',
    `- Status: ${readiness.status}`,
    `- Blockers: ${readiness.blockers.join(', ') || 'none'}`,
    `- Warnings: ${readiness.warnings.join(', ') || 'none'}`,
    `- Manifest hash: ${readiness.summary.currentManifestSha256}`,
    `- Ready files: ${readiness.summary.readyFileCount}/${readiness.summary.uniqueAssetHashes}`,
    `- Product payloads: ${readiness.summary.productCount}`,
    `- Variant payloads: ${readiness.summary.variantCount}`,
    `- Payload status: ${readiness.summary.payloadStatus}`,
    `- Merchant-input-required products: ${readiness.summary.merchantInputRequired.totalProducts}`,
  ].join('\n');
}

module.exports = {
  buildProductImportReadiness,
  runVerifyProductPrep,
  summarizeMerchantInputRequired,
};
