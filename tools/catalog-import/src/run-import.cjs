const path = require('node:path');

const { assertCurrentManifestApproved, readCurrentManifestHash } = require('./approval.cjs');
const { runCollectionMembership } = require('./collection-membership.cjs');
const { paths } = require('./config.cjs');
const { readJsonIfExists } = require('./fs-utils.cjs');
const { runCatalogPublishPlan, runCatalogPublishProducts, runCatalogStagingQa } = require('./product-publish.cjs');
const { runVerifyProductPrep } = require('./product-prep-verify.cjs');
const { runProductSetImportQa } = require('./product-import-qa.cjs');
const { runProductSetImport } = require('./product-import.cjs');
const { runProductSetDryRun } = require('./productset-payload.cjs');
const { runProductSetSchema } = require('./productset-schema.cjs');
const { runTaxonomySync } = require('./taxonomy-sync.cjs');
const { runAssetUpload } = require('./asset-upload.cjs');
const { createAdminClient, readAdminEnv } = require('./shopify-admin.cjs');
const { runPrepareAdmin } = require('./admin-prep.cjs');
const { runVerifyAdminPrep } = require('./admin-prep-verify.cjs');
const { runPreflight } = require('./shopify-preflight.cjs');

async function main() {
  const phase = readArgValue('--phase') || 'dry-run';
  const approval = await assertCurrentManifestApproved();

  if (phase === 'dry-run') {
    await runDryRun(approval);
    return;
  }

  const admin = createAdminClient(readAdminEnv());

  if (phase === 'preflight') {
    const report = await runPreflight({
      graphql: admin.graphql,
      locationId: admin.locationId,
      adoptExisting: hasFlag('--adopt-existing'),
      logger: log,
    });
    logPreflightSummary(report);
    return;
  }

  if (phase === 'prepare-admin') {
    const report = await runPrepareAdmin({
      graphql: admin.graphql,
      logger: log,
    });
    logPrepareAdminSummary(report);
    return;
  }

  if (phase === 'collection-membership') {
    const report = await runCollectionMembership({
      logger: log,
    });
    logCollectionMembershipSummary(report);
    return;
  }

  if (phase === 'productset-schema') {
    const report = await runProductSetSchema({
      graphql: admin.graphql,
    });
    logProductSetSchemaSummary(report);
    return;
  }

  if (phase === 'productset-dry-run') {
    const report = await runProductSetDryRun();
    logProductSetDryRunSummary(report);
    return;
  }

  if (phase === 'taxonomy-sync') {
    const report = await runTaxonomySync({
      graphql: admin.graphql,
      logger: log,
      handleFilter: readArgValue('--handle'),
      limit: Number(readArgValue('--limit') || 0),
      concurrency: Number(readArgValue('--concurrency') || 4),
      confirmSync: hasFlag('--confirm-sync'),
    });
    logTaxonomySyncSummary(report);
    return;
  }

  if (phase === 'verify-product-prep') {
    const report = await runVerifyProductPrep();
    logVerifyProductPrepSummary(report);
    return;
  }

  if (phase === 'productset-import') {
    const report = await runProductSetImport({
      graphql: admin.graphql,
      logger: log,
      concurrency: Number(readArgValue('--concurrency') || 2),
      handleFilter: readArgValue('--handle'),
      limit: Number(readArgValue('--limit') || 0),
      retryFailed: hasFlag('--retry-failed'),
    });
    logProductSetImportSummary(report);
    return;
  }

  if (phase === 'productset-import-qa') {
    const report = await runProductSetImportQa({
      graphql: admin.graphql,
      logger: log,
    });
    logProductSetImportQaSummary(report);
    return;
  }

  if (phase === 'publish-plan') {
    const report = await runCatalogPublishPlan({
      graphql: admin.graphql,
      logger: log,
      publicationId: readArgValue('--publication-id'),
      publicationNameHint: readArgValue('--publication-name') || 'Online Store',
      handleFilter: readArgValue('--handle'),
      limit: Number(readArgValue('--limit') || 0),
    });
    logCatalogPublishPlanSummary(report);
    return;
  }

  if (phase === 'publish-products') {
    const report = await runCatalogPublishProducts({
      graphql: admin.graphql,
      logger: log,
      confirmPublish: hasFlag('--confirm-publish'),
      concurrency: Number(readArgValue('--concurrency') || 2),
      handleFilter: readArgValue('--handle'),
      limit: Number(readArgValue('--limit') || 0),
      retryFailed: hasFlag('--retry-failed'),
    });
    logCatalogPublishProductsSummary(report);
    return;
  }

  if (phase === 'staging-qa') {
    const report = await runCatalogStagingQa({
      graphql: admin.graphql,
      logger: log,
    });
    logCatalogStagingQaSummary(report);
    return;
  }

  if (phase === 'verify-admin-prep') {
    const report = await runVerifyAdminPrep();
    logVerifyAdminPrepSummary(report);
    return;
  }

  if (phase === 'assets') {
    await ensurePreflightScopesReady();
    const report = await runAssetUpload({
      graphql: admin.graphql,
      logger: log,
      chunkSize: Number(readArgValue('--chunk-size') || 20),
    });
    logAssetSummary(report);
    return;
  }

  throw new Error(`Unsupported import phase: ${phase}`);
}

async function runDryRun(approval) {
  const adminEnv = readAdminEnv();
  const currentHash = await readCurrentManifestHash();
  const assetsManifest = await readJsonIfExists(path.join(paths.manifestsRoot, 'assets.json'));
  const normalizedProducts = await readJsonIfExists(path.join(paths.normalizedRoot, 'products.json'));
  const products = Array.isArray(normalizedProducts)
    ? normalizedProducts
    : normalizedProducts?.products || [];

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        productMutations: false,
        stagedUploadMutations: false,
        apiVersion: '2026-07',
        storeDomain: adminEnv.storeDomain,
        endpoint: adminEnv.endpoint,
        locationConfigured: Boolean(adminEnv.locationId),
        approvedManifestSha256: approval.approvedManifestSha256,
        currentManifestSha256: currentHash,
        draftOnly: approval.draftOnly,
        normalizedProductCount: products.length,
        assetRecords: assetsManifest?.assets?.length || 0,
        uniqueAssetHashes: assetsManifest?.assets
          ? new Set(assetsManifest.assets.map((asset) => asset.sha256).filter(Boolean)).size
          : 0,
      },
      null,
      2
    )}\n`
  );
}

async function ensurePreflightScopesReady() {
  const preflightPath = path.join(paths.manifestsRoot, 'import-preflight.json');
  const preflight = await readJsonIfExists(preflightPath);

  if (!preflight) {
    throw new Error(`Missing ${preflightPath}. Run npm run import:preflight before uploading assets.`);
  }

  const missingScopes = preflight.scopes?.missing || [];
  if (missingScopes.length) {
    throw new Error(`Preflight has missing scopes: ${missingScopes.join(', ')}`);
  }
}

function logPreflightSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        report: 'data/catalog/manifests/import-preflight.json',
        shop: report.shop,
        missingScopes: report.scopes.missing,
        selectedLocation: report.locations.selected,
        approvedCollections: report.collections.approvedCount,
        resolvedCollections: report.collections.resolvedCount,
        virtualSkipCollections: report.collections.virtualSkipCount,
        pendingCollections: report.collections.pendingCount,
        missingCollections: report.collections.missingHandles,
        approvedAdoptPolicies: report.products.approvedAdoptPolicyCount,
        productCreateCandidates: report.products.createCandidateCount,
        productUpdateCandidates: report.products.updateCandidateCount,
        productAdoptCandidates: report.products.adoptCandidateCount,
        allowlistedAdoptMatches: report.products.allowlistedAdoptMatchCount,
        flaggedAdoptCandidates: report.products.flaggedAdoptCount,
        productConflicts: report.products.conflictCount,
        missingMetafieldDefinitions: report.metafieldDefinitions.missing.map(
          (definition) => `${definition.namespace}.${definition.key}`
        ),
      },
      null,
      2
    )}\n`
  );
}

function logAssetSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        report: 'data/catalog/manifests/shopify-files.json',
        failuresReport: 'data/catalog/manifests/shopify-files-failures.json',
        uniqueAssetHashes: report.uniqueAssetHashes,
        readyFileCount: report.readyFileCount,
        totalFilesInManifest: report.files.length,
        failuresAndWarnings: report.failures.length,
      },
      null,
      2
    )}\n`
  );
}

function logPrepareAdminSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        report: 'data/catalog/manifests/collection-prep-report.json',
        approvedConflictAdopts: report.conflicts.approvedAdopts.length,
        createdMetafieldDefinitions: report.metafields.created.length,
        missingMetafieldsAfterRun: report.metafields.missingAfterRun.map(
          (definition) => `${definition.namespace}.${definition.key}`
        ),
        createdCollections: report.collections.created.map((collection) => collection.handle),
        pendingCollections: report.collections.pending.map((collection) => collection.handle),
        unresolvedRuleBackedCollections: report.collections.unresolvedRuleBacked.map((collection) => collection.handle),
      },
      null,
      2
    )}\n`
  );
}

function logVerifyAdminPrepSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.status !== 'fail',
        status: report.summary.status,
        report: 'data/catalog/manifests/admin-prep-verification.json',
        failedChecks: report.summary.failedChecks,
        driftChecks: report.summary.driftChecks,
        approvedAdoptPolicyCount: report.observed.approvedAdoptPolicyCount,
        allowlistedAdoptMatchCount: report.observed.allowlistedAdoptMatchCount,
        pendingCollections: report.observed.pendingCollectionHandles,
        unresolvedRuleBackedCollections: report.observed.unresolvedRuleBackedCollections,
        missingMetafields: report.observed.missingMetafields,
        typeMismatches: report.observed.typeMismatches,
        productConflicts: report.observed.productConflicts,
      },
      null,
      2
    )}\n`
  );
}

function logCollectionMembershipSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        report: 'data/catalog/manifests/source-collection-membership.json',
        tagsReport: 'data/catalog/manifests/product-source-tags.json',
        forecastReport: 'data/catalog/manifests/collection-population-forecast.json',
        sourceCollectionHandles: report.sourceCollectionHandles.length,
        productsWithSourceMembership: report.productsWithSourceMembership,
        missingSourceCollections: report.missingSourceCollections,
        emptyApprovedCollections: report.forecastEmptyApprovedCollections,
      },
      null,
      2
    )}\n`
  );
}

function logProductSetSchemaSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        report: 'data/catalog/manifests/productset-schema.json',
        apiVersion: report.apiVersion,
        typeCount: report.types.length,
        typeNames: report.types.map((type) => type.name),
      },
      null,
      2
    )}\n`
  );
}

function logProductSetDryRunSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.buildErrors.length === 0,
        report: 'data/catalog/manifests/productset-dry-run.json',
        productCount: report.summary.productCount,
        variantCount: report.summary.variantCount,
        payloadStatus: report.summary.payloadStatus,
        buildErrors: report.summary.buildErrors.length,
      },
      null,
      2
    )}\n`
  );
}

function logTaxonomySyncSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.failedCount === 0,
        mode: report.summary.mode,
        report:
          report.summary.mode === 'apply'
            ? 'data/catalog/manifests/taxonomy-sync.json'
            : 'data/catalog/manifests/taxonomy-sync-plan.json',
        failuresReport:
          report.summary.mode === 'apply' ? 'data/catalog/manifests/taxonomy-sync-failures.json' : '',
        total: report.summary.total,
        plannedUpdates: report.summary.updateCount,
        updated: report.summary.updatedCount,
        unchanged: report.summary.unchangedCount,
        missingProducts: report.summary.missingProductCount,
        skippedNotApplicable: report.summary.skippedNotApplicableCount,
        skippedMerchantInput: report.summary.skippedMerchantInputCount,
        merchantInputRequired: report.summary.merchantInputRequiredCount,
        failed: report.summary.failedCount,
      },
      null,
      2
    )}\n`
  );
}

function logVerifyProductPrepSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.status === 'pass',
        status: report.status,
        report: 'data/catalog/manifests/product-import-readiness.json',
        blockers: report.blockers,
        warnings: report.warnings,
        productCount: report.summary.productCount,
        variantCount: report.summary.variantCount,
        readyFiles: report.summary.readyFileCount,
        uniqueAssetHashes: report.summary.uniqueAssetHashes,
      },
      null,
      2
    )}\n`
  );
}

function logProductSetImportSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.failedCount === 0,
        report: 'data/catalog/manifests/productset-import.json',
        failuresReport: 'data/catalog/manifests/productset-import-failures.json',
        total: report.summary.total,
        complete: report.summary.completeCount,
        creates: report.summary.createCount,
        updates: report.summary.updateCount,
        skippedConflicts: report.summary.skipConflictCount,
        skippedUnchanged: report.summary.skippedUnchangedCount,
        skippedPreviousFailure: report.summary.skippedPreviousFailureCount,
        failed: report.summary.failedCount,
      },
      null,
      2
    )}\n`
  );
}

function logProductSetImportQaSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.missing === 0 && report.summary.mismatched === 0,
        report: 'data/catalog/manifests/productset-import-qa.json',
        total: report.summary.total,
        matched: report.summary.matched,
        mismatched: report.summary.mismatched,
        missing: report.summary.missing,
      },
      null,
      2
    )}\n`
  );
}

function logCatalogPublishPlanSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.status === 'pass',
        status: report.summary.status,
        report: 'data/catalog/manifests/catalog-publish-plan.json',
        targetPublication: report.targetPublication,
        missingScopes: report.scopes?.missing || [],
        blockers: report.summary.blockers,
        total: report.summary.total,
        active: report.summary.activeCount,
        draft: report.summary.draftCount,
        alreadyPublished: report.summary.alreadyPublishedCount,
        needsActivation: report.summary.needsActivationCount,
        needsPublication: report.summary.needsPublicationCount,
      },
      null,
      2
    )}\n`
  );
}

function logCatalogPublishProductsSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.failedCount === 0,
        report: 'data/catalog/manifests/catalog-publish.json',
        failuresReport: 'data/catalog/manifests/catalog-publish-failures.json',
        targetPublication: report.targetPublication,
        total: report.summary.total,
        complete: report.summary.completeCount,
        activated: report.summary.activatedCount,
        published: report.summary.publishedCount,
        alreadyPublished: report.summary.alreadyPublishedCount,
        failed: report.summary.failedCount,
      },
      null,
      2
    )}\n`
  );
}

function logCatalogStagingQaSummary(report) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: report.summary.status === 'pass',
        status: report.summary.status,
        report: 'data/catalog/manifests/catalog-staging-qa.json',
        targetPublication: report.targetPublication,
        blockers: report.summary.blockers,
        total: report.summary.total,
        active: report.summary.activeCount,
        published: report.summary.publishedCount,
        storefrontUrls: report.summary.storefrontUrlCount,
        onlineStoreUrls: report.summary.onlineStoreUrlCount,
        onlineStorePreviewUrls: report.summary.onlineStorePreviewUrlCount,
        missing: report.summary.missingCount,
        failed: report.summary.failedCount,
      },
      null,
      2
    )}\n`
  );
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
