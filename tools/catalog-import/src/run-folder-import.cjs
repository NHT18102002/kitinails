const path = require('node:path');

const { paths } = require('./config.cjs');
const {
  DEFAULT_BULK_STATE_PATH,
  DEFAULT_FINAL_REPORT_PATH,
  runFolderBulkImport,
  runFolderFinalVerification,
} = require('./folder-import/bulk.cjs');
const { runCollectionDiscovery, runCollectionMapApproval } = require('./folder-import/collection-map.cjs');
const {
  DEFAULT_CANARY_STATE_PATH,
  DEFAULT_ROLLOUT_GATE_PATH,
  runFolderImportCanary,
  verifyFolderImportCanary,
} = require('./folder-import/canary.cjs');
const { runFolderDryRun } = require('./folder-import/dry-run.cjs');
const {
  DEFAULT_PRICING_PLAN_PATH,
  DEFAULT_PRICING_STATE_PATH,
  DEFAULT_PRICING_VERIFICATION_PATH,
  runFolderPricingApply,
  runFolderPricingPlan,
} = require('./folder-import/pricing.cjs');
const {
  DEFAULT_PUBLISH_PLAN_PATH,
  DEFAULT_PUBLISH_STATE_PATH,
  DEFAULT_PUBLISH_VERIFICATION_PATH,
  runFolderPublishAll,
  runFolderPublishCanary,
  runFolderPublishPlan,
  verifyFolderPublishedProducts,
} = require('./folder-import/publish.cjs');
const { runFolderScan } = require('./folder-import/scan.cjs');
const { prepareFolderImportStore } = require('./folder-import/store-setup.cjs');
const { readJsonIfExists } = require('./fs-utils.cjs');
const { createAdminClient, readAdminEnv } = require('./shopify-admin.cjs');

async function main() {
  const phase = readArgValue('--phase') || 'scan';
  const productsRootArg = readArgValue('--products-root');
  const productsRoot = productsRootArg ? path.resolve(paths.repoRoot, productsRootArg) : undefined;
  const scan = await runFolderScan({ productsRoot });

  if (phase === 'scan') {
    printJson({
      ok: scan.report.gate === 'PASS',
      phase,
      readOnly: true,
      summary: scan.report.summary,
      gate: scan.report.gate,
      manifestSha256: scan.manifest.manifestSha256,
      manifestPath: path.relative(paths.repoRoot, scan.manifestPath),
      reportPath: path.relative(paths.repoRoot, scan.reportPath),
    });
    if (scan.report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'approve-collections') {
    if (!hasFlag('--confirm-approval')) {
      throw new Error('Collection map approval requires --confirm-approval.');
    }
    if (scan.report.gate !== 'PASS') {
      throw new Error('Collection map approval is blocked because the folder scan contains pairing errors.');
    }
    const approval = await runCollectionMapApproval({
      currentManifestSha256: scan.manifest.manifestSha256,
    });
    printJson({
      ok: true,
      phase,
      shopifyReadOnly: true,
      approvedMappingCount: Object.keys(approval.approved.mappings).length,
      sourceManifestSha256: approval.approved.sourceManifestSha256,
      proposalSha256: approval.approved.proposalSha256,
      outputPath: path.relative(paths.repoRoot, approval.outputPath),
    });
    return;
  }

  if (phase === 'dry-run') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Dry-run is blocked because the folder scan contains pairing errors.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const dryRun = await runFolderDryRun({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
    });
    printJson({
      ok: dryRun.report.gate === 'PASS',
      phase,
      readOnly: true,
      gate: dryRun.report.gate,
      shop: dryRun.report.shop,
      summary: dryRun.report.summary,
      blockingErrors: dryRun.report.blockingErrors,
      reportSha256: dryRun.report.reportSha256,
      jsonPath: path.relative(paths.repoRoot, dryRun.jsonPath),
      csvPath: path.relative(paths.repoRoot, dryRun.csvPath),
    });
    if (dryRun.report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'prepare-store') {
    if (!hasFlag('--confirm-mutations')) {
      throw new Error('Store preparation requires --confirm-mutations.');
    }
    if (scan.report.gate !== 'PASS') {
      throw new Error('Store preparation is blocked because the folder scan contains pairing errors.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const setup = await prepareFolderImportStore({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      confirmMutations: true,
    });
    printJson({
      ok: true,
      phase,
      shop: setup.verification.shop,
      mutations: setup.mutations,
      collectionChecks: setup.verification.collections,
      identityDefinition: setup.verification.identityDefinition,
      gate: 'PASS',
    });
    return;
  }

  if (phase === 'canary') {
    if (!hasFlag('--confirm-canary')) {
      throw new Error('Canary requires --confirm-canary.');
    }
    if (scan.report.gate !== 'PASS') {
      throw new Error('Canary is blocked because the folder scan contains pairing errors.');
    }
    const sourceKey = readArgValue('--source-key');
    const approvedDryRunSha = readArgValue('--approved-dry-run-sha');
    if (!sourceKey || !approvedDryRunSha) {
      throw new Error('Canary requires --source-key and --approved-dry-run-sha.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const canary = await runFolderImportCanary({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      sourceKey,
      approvedDryRunSha,
      confirmCanary: true,
    });
    printJson({
      ok: true,
      phase,
      shop: canary.postDryRun.shop,
      sourceKey: canary.contract.sourceKey,
      product: canary.qa.product,
      qaGate: canary.qa.gate,
      rolloutGate: canary.rollout.gate,
      postCanarySummary: canary.postDryRun.summary,
      postCanaryDryRunSha256: canary.postDryRun.reportSha256,
      canaryStatePath: path.relative(paths.repoRoot, DEFAULT_CANARY_STATE_PATH),
      rolloutGatePath: path.relative(paths.repoRoot, DEFAULT_ROLLOUT_GATE_PATH),
    });
    return;
  }

  if (phase === 'verify-canary') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Canary verification is blocked because the folder scan contains pairing errors.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const verification = await verifyFolderImportCanary({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      sourceKey: readArgValue('--source-key'),
    });
    printJson({
      ok: true,
      phase,
      readOnly: true,
      shop: verification.postDryRun.shop,
      sourceKey: verification.contract.sourceKey,
      product: verification.qa.product,
      qaGate: verification.qa.gate,
      rolloutGate: verification.rollout.gate,
      postCanarySummary: verification.postDryRun.summary,
      postCanaryDryRunSha256: verification.postDryRun.reportSha256,
      canaryStatePath: path.relative(paths.repoRoot, DEFAULT_CANARY_STATE_PATH),
      rolloutGatePath: path.relative(paths.repoRoot, DEFAULT_ROLLOUT_GATE_PATH),
    });
    return;
  }

  if (phase === 'run') {
    if (!hasFlag('--confirm-import')) throw new Error('Bulk import requires --confirm-import.');
    if (scan.report.gate !== 'PASS') {
      throw new Error('Bulk import is blocked because the folder scan contains pairing errors.');
    }
    const approvedDryRunSha = readArgValue('--approved-dry-run-sha');
    if (!approvedDryRunSha) throw new Error('Bulk import requires --approved-dry-run-sha.');
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderBulkImport({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      approvedDryRunSha,
      confirmImport: true,
      logger: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
    });
    printJson({
      ok: true,
      phase,
      shopDomain: result.state.shopDomain,
      state: result.state.status,
      bulkItemCount: result.state.plannedItemCount,
      postBulkSummary: result.postDryRun.summary,
      finalVerification: result.verification.summary,
      finalDryRunSha256: result.postDryRun.reportSha256,
      finalVerificationSha256: result.verification.reportSha256,
      bulkStatePath: path.relative(paths.repoRoot, DEFAULT_BULK_STATE_PATH),
      finalReportPath: path.relative(paths.repoRoot, DEFAULT_FINAL_REPORT_PATH),
    });
    return;
  }

  if (phase === 'verify') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Final verification is blocked because the folder scan contains pairing errors.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const report = await runFolderFinalVerification({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
    });
    printJson({
      ok: report.gate === 'PASS',
      phase,
      readOnly: true,
      shop: report.shop,
      gate: report.gate,
      summary: report.summary,
      reportSha256: report.reportSha256,
      outputPath: path.relative(paths.repoRoot, DEFAULT_FINAL_REPORT_PATH),
    });
    if (report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'price-plan') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Pricing plan is blocked because the folder scan contains pairing errors.');
    }
    const targetPrice = readArgValue('--price');
    if (!targetPrice) throw new Error('Pricing plan requires --price.');
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderPricingPlan({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      targetPrice,
    });
    printJson({
      ok: result.report.gate === 'PASS',
      phase,
      readOnly: true,
      gate: result.report.gate,
      shop: result.report.shop,
      currencyCode: result.report.currencyCode,
      targetPrice: result.report.targetPrice,
      summary: result.report.summary,
      blockingErrors: result.report.blockingErrors,
      reportSha256: result.report.reportSha256,
      outputPath: path.relative(paths.repoRoot, DEFAULT_PRICING_PLAN_PATH),
    });
    if (result.report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'price-apply') {
    if (!hasFlag('--confirm-price-update')) {
      throw new Error('Pricing apply requires --confirm-price-update.');
    }
    if (scan.report.gate !== 'PASS') {
      throw new Error('Pricing apply is blocked because the folder scan contains pairing errors.');
    }
    const targetPrice = readArgValue('--price');
    const approvedPlanSha = readArgValue('--approved-plan-sha');
    if (!targetPrice || !approvedPlanSha) {
      throw new Error('Pricing apply requires --price and --approved-plan-sha.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderPricingApply({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      targetPrice,
      approvedPlanSha,
      confirmApply: true,
      logger: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
    });
    printJson({
      ok: true,
      phase,
      state: result.state.status,
      targetPrice: result.state.targetPrice,
      verification: result.verification.summary,
      verificationSha256: result.verification.reportSha256,
      statePath: path.relative(paths.repoRoot, DEFAULT_PRICING_STATE_PATH),
      verificationPath: path.relative(paths.repoRoot, DEFAULT_PRICING_VERIFICATION_PATH),
    });
    return;
  }

  if (phase === 'publish-plan') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Publish plan is blocked because the folder scan contains pairing errors.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderPublishPlan({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      publicationId: readArgValue('--publication-id'),
    });
    printJson({
      ok: result.report.gate === 'PASS',
      phase,
      readOnly: true,
      gate: result.report.gate,
      shop: result.report.shop,
      targetPublication: result.report.targetPublication,
      targetPrice: result.report.targetPrice,
      summary: result.report.summary,
      blockingErrors: result.report.blockingErrors,
      reportSha256: result.report.reportSha256,
      outputPath: path.relative(paths.repoRoot, DEFAULT_PUBLISH_PLAN_PATH),
    });
    if (result.report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'publish-canary') {
    if (!hasFlag('--confirm-publish')) throw new Error('Publish canary requires --confirm-publish.');
    if (scan.report.gate !== 'PASS') {
      throw new Error('Publish canary is blocked because the folder scan contains pairing errors.');
    }
    const sourceKey = readArgValue('--source-key');
    const approvedPlanSha = readArgValue('--approved-plan-sha');
    if (!sourceKey || !approvedPlanSha) {
      throw new Error('Publish canary requires --source-key and --approved-plan-sha.');
    }
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderPublishCanary({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      sourceKey,
      approvedPlanSha,
      confirmPublish: true,
    });
    printJson({
      ok: true,
      phase,
      state: result.state.status,
      sourceKey,
      productGid: result.item.productGid,
      finalStatus: result.item.finalStatus,
      publishedOnTarget: result.item.publishedOnTarget,
      onlineStoreUrl: result.item.onlineStoreUrl,
      statePath: path.relative(paths.repoRoot, DEFAULT_PUBLISH_STATE_PATH),
    });
    return;
  }

  if (phase === 'publish-run') {
    if (!hasFlag('--confirm-publish')) throw new Error('Full publish requires --confirm-publish.');
    if (scan.report.gate !== 'PASS') {
      throw new Error('Full publish is blocked because the folder scan contains pairing errors.');
    }
    const approvedPlanSha = readArgValue('--approved-plan-sha');
    if (!approvedPlanSha) throw new Error('Full publish requires --approved-plan-sha.');
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const result = await runFolderPublishAll({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      approvedPlanSha,
      confirmPublish: true,
      logger: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
    });
    printJson({
      ok: true,
      phase,
      state: result.state.status,
      verification: result.verification.summary,
      verificationSha256: result.verification.reportSha256,
      statePath: path.relative(paths.repoRoot, DEFAULT_PUBLISH_STATE_PATH),
      verificationPath: path.relative(paths.repoRoot, DEFAULT_PUBLISH_VERIFICATION_PATH),
    });
    return;
  }

  if (phase === 'publish-verify') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Publish verification is blocked because the folder scan contains pairing errors.');
    }
    const state = await readJsonIfExists(DEFAULT_PUBLISH_STATE_PATH);
    const publicationId = readArgValue('--publication-id') || state?.publicationId;
    if (!publicationId) throw new Error('Publish verification requires --publication-id or a publish checkpoint.');
    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const report = await verifyFolderPublishedProducts({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
      publicationId,
    });
    printJson({
      ok: report.gate === 'PASS',
      phase,
      readOnly: true,
      gate: report.gate,
      shop: report.shop,
      summary: report.summary,
      reportSha256: report.reportSha256,
      outputPath: path.relative(paths.repoRoot, DEFAULT_PUBLISH_VERIFICATION_PATH),
    });
    if (report.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  if (phase === 'discover-collections') {
    if (scan.report.gate !== 'PASS') {
      throw new Error('Collection discovery is blocked because the folder scan contains pairing errors.');
    }

    const adminEnv = readAdminEnv();
    const admin = createAdminClient(adminEnv);
    const discovery = await runCollectionDiscovery({
      graphql: admin.graphql,
      manifest: scan.manifest,
      expectedStoreDomain: admin.storeDomain,
    });
    printJson({
      ok: discovery.proposal.summary.gate === 'PASS',
      phase,
      readOnly: true,
      shop: discovery.proposal.shop,
      summary: discovery.proposal.summary,
      mappings: discovery.proposal.mappings,
      outputPath: path.relative(paths.repoRoot, discovery.outputPath),
    });
    if (discovery.proposal.summary.gate !== 'PASS') process.exitCode = 2;
    return;
  }

  throw new Error(`Unsupported folder import phase: ${phase}`);
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? '' : process.argv[index + 1] || '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  hasFlag,
  readArgValue,
};
