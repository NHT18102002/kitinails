const path = require('node:path');

const { readJsonIfExists, writeJson } = require('../fs-utils.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const {
  DEFAULT_APPROVED_MAP_PATH,
  DEFAULT_PROPOSED_MAP_PATH,
} = require('./collection-map.cjs');
const {
  MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET,
  QUERY_FOLDER_IMPORT_CANARY_GUARD,
  buildCanaryContract,
  buildCanaryProductSetVariables,
  customId,
  ensureProductFiles,
  pollCanaryQa,
  validateCanaryGuard,
} = require('./canary.cjs');
const {
  DEFAULT_FILES_STATE_PATH,
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  PAIR_HASH_KEY,
  PUBLISHER_ID,
  PUBLISHER_ID_KEY,
  REQUEST_HASH_KEY,
  assertApprovedContract,
  buildRequestHash,
  runFolderDryRun,
} = require('./dry-run.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

const DEFAULT_BULK_STATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'bulk-state.json');
const DEFAULT_FINAL_REPORT_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'final-verification.json');
const DEFAULT_ROLLOUT_GATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'rollout-gate.json');

const QUERY_FOLDER_IMPORT_BULK_VERIFY = `#graphql
query FolderImportBulkVerify($ids: [ID!]!) {
  shop { name myshopifyDomain }
  nodes(ids: $ids) {
    __typename
    ... on Product {
      id
      handle
      title
      status
      externalId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${EXTERNAL_ID_KEY}") { value type }
      publisherId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PUBLISHER_ID_KEY}") { value }
      requestHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${REQUEST_HASH_KEY}") { value }
      pairHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PAIR_HASH_KEY}") { value }
      media(first: 3) { nodes { id mediaContentType status } }
      collections(first: 100) { nodes { id handle title } }
      variants(first: 10) { nodes { id title price } }
    }
  }
}
`;

function calculateRolloutGateHash(gate) {
  const hashable = { ...(gate || {}) };
  delete hashable.generatedAt;
  return sha256Text(stableStringify(hashable));
}

function validateBulkPreflight({ manifest, dryRun, rolloutGate, state, expectedStoreDomain, approvedDryRunSha }) {
  const errors = [];
  const expectedDomain = normalizeStoreDomain(expectedStoreDomain);
  if (dryRun?.gate !== 'PASS') errors.push('Current dry-run gate is not PASS.');
  if (rolloutGate?.gate !== 'PASS') errors.push('Canary rollout gate is not PASS.');
  if (normalizeStoreDomain(rolloutGate?.shopDomain) !== expectedDomain) errors.push('Rollout gate belongs to a different store.');
  if (!approvedDryRunSha) errors.push('Bulk run requires an explicit approved dry-run SHA-256.');
  if (dryRun?.summary?.updateCount !== 0 || dryRun?.summary?.blockedProductCount !== 0 || dryRun?.summary?.globalBlockingErrorCount !== 0) {
    errors.push('Current dry-run contains updates, blocked products, or global errors.');
  }

  const canaryItem = (dryRun?.items || []).find((item) => item.sourceKey === rolloutGate?.canarySourceKey);
  if (canaryItem?.decision !== 'SKIP_UNCHANGED') errors.push('Approved canary is not SKIP_UNCHANGED in the current dry-run.');

  if (!state) {
    if (dryRun?.reportSha256 !== approvedDryRunSha) errors.push('Current dry-run hash does not match the approved bulk hash.');
    if (rolloutGate?.postCanaryDryRunSha256 !== approvedDryRunSha) errors.push('Rollout gate is not tied to the approved bulk hash.');
    if (dryRun?.summary?.inputProductCount !== 88 || dryRun?.summary?.createCount !== 87 || dryRun?.summary?.skipUnchangedCount !== 1) {
      errors.push('Initial bulk run requires exactly 87 CREATE and 1 SKIP_UNCHANGED.');
    }
  } else {
    if (state.schemaVersion !== 'folder-import-bulk-state-v1') errors.push('Bulk checkpoint schema is unsupported.');
    if (normalizeStoreDomain(state.shopDomain) !== expectedDomain) errors.push('Bulk checkpoint belongs to a different store.');
    if (state.sourceManifestSha256 !== manifest?.manifestSha256) errors.push('Bulk checkpoint manifest hash has drifted.');
    if (state.approvedDryRunSha256 !== approvedDryRunSha) errors.push('Bulk checkpoint approved dry-run hash differs from the command.');
    if (state.rolloutGateHash !== calculateRolloutGateHash(rolloutGate)) errors.push('Bulk checkpoint rollout gate has drifted.');
    const allowed = new Set(['CREATE', 'SKIP_UNCHANGED']);
    if ((dryRun?.items || []).some((item) => !allowed.has(item.decision))) {
      errors.push('Resume dry-run contains a decision other than CREATE or SKIP_UNCHANGED.');
    }
  }
  return { gate: errors.length ? 'BLOCKED' : 'PASS', errors };
}

function buildBulkContracts({ manifest, approved, proposal, canarySourceKey }) {
  assertApprovedContract({ manifest, approved, proposal });
  const collectionOrder = new Map((manifest.collections || []).map((collection, index) => [collection.folder, index]));
  return (manifest.products || [])
    .filter((product) => product.sourceKey !== canarySourceKey)
    .map((product) => buildCanaryContract({ manifest, approved, proposal, sourceKey: product.sourceKey }))
    .sort((left, right) => {
      const collectionDelta = collectionOrder.get(left.product.collectionFolder) - collectionOrder.get(right.product.collectionFolder);
      if (collectionDelta) return collectionDelta;
      return String(left.product.pairKey).localeCompare(String(right.product.pairKey), undefined, { numeric: true });
    });
}

function createBulkState({ manifest, expectedStoreDomain, approvedDryRunSha, rolloutGate, contracts }) {
  return {
    schemaVersion: 'folder-import-bulk-state-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'RUNNING',
    shopDomain: normalizeStoreDomain(expectedStoreDomain),
    sourceManifestSha256: manifest.manifestSha256,
    approvedDryRunSha256: approvedDryRunSha,
    rolloutGateHash: calculateRolloutGateHash(rolloutGate),
    canarySourceKey: rolloutGate.canarySourceKey,
    plannedItemCount: contracts.length,
    sourceKeys: contracts.map((contract) => contract.sourceKey),
    items: {},
  };
}

async function persistItemState({ state, statePath, contract, status, details = {} }) {
  const previous = state.items[contract.sourceKey] || {};
  state.updatedAt = new Date().toISOString();
  state.items[contract.sourceKey] = {
    sourceKey: contract.sourceKey,
    collectionFolder: contract.product.collectionFolder,
    title: contract.product.title,
    handle: contract.product.proposedHandle,
    requestHash: contract.requestHash,
    attempts: previous.attempts || 0,
    ...previous,
    ...details,
    status,
    updatedAt: state.updatedAt,
  };
  await writeJson(statePath, state);
}

async function processBulkProduct({ graphql, contract, state, statePath, filesStatePath }) {
  const previous = state.items[contract.sourceKey] || {};
  await persistItemState({
    state,
    statePath,
    contract,
    status: 'RUNNING',
    details: { attempts: (previous.attempts || 0) + 1, lastError: null },
  });

  const guardVariables = {
    identifier: customId(contract.sourceKey),
    handleQuery: `handle:${contract.product.proposedHandle}`,
  };
  const guardData = await graphql(QUERY_FOLDER_IMPORT_CANARY_GUARD, guardVariables);
  const guard = validateCanaryGuard({ data: guardData, contract, expectedStoreDomain: contract.shopDomain });
  if (guard.gate !== 'PASS') throw new Error(`Live guard blocked: ${guard.errors.join(' ')}`);

  const currentFilesState = await readJsonIfExists(filesStatePath);
  const files = await ensureProductFiles({ graphql, contract, existingState: currentFilesState, filesStatePath });
  const fileGids = files.map((file) => file.fileGid);
  await persistItemState({
    state,
    statePath,
    contract,
    status: 'FILES_READY',
    details: { files: files.map((file) => ({ sha256: file.sha256, fileGid: file.fileGid, fileStatus: file.fileStatus })) },
  });

  if (!guard.existingProduct) {
    const secondGuardData = await graphql(QUERY_FOLDER_IMPORT_CANARY_GUARD, guardVariables);
    const secondGuard = validateCanaryGuard({ data: secondGuardData, contract, expectedStoreDomain: contract.shopDomain });
    if (secondGuard.gate !== 'PASS' || secondGuard.existingProduct) {
      throw new Error(`Pre-mutation guard blocked: ${secondGuard.errors.join(' ') || 'product appeared concurrently'}`);
    }
    const variables = buildCanaryProductSetVariables({ contract, fileGids });
    const mutationData = await graphql(MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET, variables);
    const payload = mutationData?.productSet;
    if (payload?.userErrors?.length) {
      throw new Error(`productSet failed: ${payload.userErrors.map((error) => error.message).join('; ')}`);
    }
    if (!payload?.product?.id) throw new Error('productSet did not return a product ID.');
    await persistItemState({
      state,
      statePath,
      contract,
      status: 'PRODUCT_MUTATED',
      details: { productGid: payload.product.id },
    });
  }

  const qa = await pollCanaryQa({ graphql, contract, fileGids });
  if (qa.gate !== 'PASS') throw new Error(`Read-back QA failed: ${qa.errors.join(' ')}`);
  await persistItemState({
    state,
    statePath,
    contract,
    status: 'VERIFIED',
    details: { productGid: qa.product.gid, qaHash: sha256Text(stableStringify(qa.product)), qa },
  });
  return qa;
}

function validateFinalProduct(product, { expected, collection, requestHash }) {
  const errors = [];
  if (!product || product.__typename !== 'Product') return ['Product is missing from the final nodes query.'];
  if (product.status !== 'DRAFT') errors.push(`status=${product.status}`);
  if (product.handle !== expected.proposedHandle) errors.push('handle mismatch');
  if (product.title !== expected.title) errors.push('title mismatch');
  if (product.externalId?.value !== expected.sourceKey || product.externalId?.type !== 'id') errors.push('external ID mismatch');
  if (product.publisherId?.value !== PUBLISHER_ID) errors.push('publisher marker mismatch');
  if (product.requestHash?.value !== requestHash) errors.push('request hash mismatch');
  if (product.pairHash?.value !== expected.pairSha256) errors.push('pair hash mismatch');
  const media = product.media?.nodes || [];
  if (media.length !== 2) errors.push(`media count=${media.length}`);
  if (media.some((item) => item.mediaContentType !== 'IMAGE' || item.status !== 'READY')) errors.push('media is not IMAGE/READY');
  const collections = product.collections?.nodes || [];
  if (collections.length !== 1 || collections[0]?.id !== collection.gid) errors.push('collection membership mismatch');
  if (!(product.variants?.nodes || []).length) errors.push('missing default variant');
  return errors;
}

async function verifyAllFolderProducts({
  graphql,
  manifest,
  expectedStoreDomain,
  approved,
  proposal,
  dryRun,
  outputPath = DEFAULT_FINAL_REPORT_PATH,
}) {
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  if (dryRun?.gate !== 'PASS') throw new Error('Final verification requires a PASS dry-run.');
  const expectedDomain = normalizeStoreDomain(expectedStoreDomain);
  const ids = (dryRun.items || []).map((item) => item.existingProduct?.gid).filter(Boolean);
  if (ids.length !== manifest.products.length || new Set(ids).size !== manifest.products.length) {
    throw new Error('Final verification requires one unique Shopify product GID per manifest item.');
  }
  const data = await graphql(QUERY_FOLDER_IMPORT_BULK_VERIFY, { ids });
  if (normalizeStoreDomain(data?.shop?.myshopifyDomain) !== expectedDomain) {
    throw new Error('Final verification store mismatch.');
  }
  const byId = new Map((data?.nodes || []).filter(Boolean).map((node) => [node.id, node]));
  const dryBySource = new Map((dryRun.items || []).map((item) => [item.sourceKey, item]));
  const mappingByFolder = new Map(mappings.map((mapping) => [mapping.folder, mapping]));
  const adminStoreHandle = expectedDomain.replace(/\.myshopify\.com$/, '');
  const items = manifest.products.map((expected) => {
    const dryItem = dryBySource.get(expected.sourceKey);
    const collection = mappingByFolder.get(expected.collectionFolder);
    const product = byId.get(dryItem?.existingProduct?.gid);
    const errors = validateFinalProduct(product, {
      expected,
      collection,
      requestHash: buildRequestHash(expected, collection),
    });
    return {
      sourceKey: expected.sourceKey,
      collectionFolder: expected.collectionFolder,
      productGid: product?.id || null,
      adminUrl: product?.id
        ? `https://admin.shopify.com/store/${adminStoreHandle}/products/${product.id.split('/').pop()}`
        : null,
      handle: product?.handle || expected.proposedHandle,
      status: errors.length ? 'FAILED' : 'VERIFIED',
      errors,
    };
  });
  const verifiedCount = items.filter((item) => item.status === 'VERIFIED').length;
  const report = {
    schemaVersion: 'folder-import-final-verification-v1',
    generatedAt: new Date().toISOString(),
    shop: data.shop,
    sourceManifestSha256: manifest.manifestSha256,
    dryRunSha256: dryRun.reportSha256,
    gate: verifiedCount === manifest.products.length ? 'PASS' : 'BLOCKED',
    summary: {
      expectedCount: manifest.products.length,
      verifiedCount,
      failedCount: manifest.products.length - verifiedCount,
      draftCount: items.filter((item) => byId.get(item.productGid)?.status === 'DRAFT').length,
    },
    items,
  };
  report.reportSha256 = sha256Text(stableStringify({ ...report, generatedAt: undefined }));
  await writeJson(outputPath, report);
  return report;
}

async function runFolderBulkImport({
  graphql,
  manifest,
  expectedStoreDomain,
  approvedDryRunSha,
  confirmImport = false,
  logger = () => {},
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  dryRunPath = path.join(DEFAULT_OUTPUT_ROOT, 'dry-run.json'),
  rolloutGatePath = DEFAULT_ROLLOUT_GATE_PATH,
  filesStatePath = DEFAULT_FILES_STATE_PATH,
  statePath = DEFAULT_BULK_STATE_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
}) {
  if (!confirmImport) throw new Error('Bulk import requires --confirm-import.');
  const [approved, proposal, dryRun, rolloutGate, existingState] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(dryRunPath),
    readJsonIfExists(rolloutGatePath),
    readJsonIfExists(statePath),
  ]);
  const preflight = validateBulkPreflight({
    manifest,
    dryRun,
    rolloutGate,
    state: existingState,
    expectedStoreDomain,
    approvedDryRunSha,
  });
  if (preflight.gate !== 'PASS') throw new Error(`Bulk preflight blocked: ${preflight.errors.join(' ')}`);

  const contracts = buildBulkContracts({ manifest, approved, proposal, canarySourceKey: rolloutGate.canarySourceKey });
  if (contracts.length !== 87) throw new Error(`Bulk plan must contain exactly 87 products, received ${contracts.length}.`);
  const state = existingState || createBulkState({ manifest, expectedStoreDomain, approvedDryRunSha, rolloutGate, contracts });
  if (stableStringify(state.sourceKeys) !== stableStringify(contracts.map((contract) => contract.sourceKey))) {
    throw new Error('Bulk checkpoint source-key plan has drifted.');
  }
  await writeJson(statePath, state);

  let completed = Object.values(state.items).filter((item) => item.status === 'VERIFIED').length;
  for (const contract of contracts) {
    contract.shopDomain = normalizeStoreDomain(expectedStoreDomain);
    if (state.items[contract.sourceKey]?.status === 'VERIFIED') continue;
    logger({ event: 'ITEM_START', completed, total: contracts.length, sourceKey: contract.sourceKey, collection: contract.product.collectionFolder });
    try {
      const qa = await processBulkProduct({ graphql, contract, state, statePath, filesStatePath });
      completed += 1;
      logger({ event: 'ITEM_VERIFIED', completed, total: contracts.length, sourceKey: contract.sourceKey, productGid: qa.product.gid });
    } catch (error) {
      await persistItemState({
        state,
        statePath,
        contract,
        status: 'FAILED',
        details: { lastError: error.message },
      });
      state.status = 'BLOCKED';
      state.updatedAt = new Date().toISOString();
      await writeJson(statePath, state);
      throw new Error(`Bulk stopped at ${contract.sourceKey}: ${error.message}`);
    }
  }

  const postDryRun = await runFolderDryRun({
    graphql,
    manifest,
    expectedStoreDomain,
    approvedPath,
    proposalPath,
    filesStatePath,
  });
  if (
    postDryRun.report.gate !== 'PASS' ||
    postDryRun.report.summary.createCount !== 0 ||
    postDryRun.report.summary.updateCount !== 0 ||
    postDryRun.report.summary.skipUnchangedCount !== manifest.products.length ||
    postDryRun.report.summary.blockedProductCount !== 0
  ) {
    throw new Error('Post-bulk dry-run did not converge to 88 SKIP_UNCHANGED.');
  }
  const verification = await verifyAllFolderProducts({
    graphql,
    manifest,
    expectedStoreDomain,
    approved,
    proposal,
    dryRun: postDryRun.report,
    outputPath: finalReportPath,
  });
  if (verification.gate !== 'PASS') throw new Error(`Final verification failed for ${verification.summary.failedCount} products.`);
  state.status = 'COMPLETE';
  state.updatedAt = new Date().toISOString();
  state.completedAt = state.updatedAt;
  state.finalDryRunSha256 = postDryRun.report.reportSha256;
  state.finalVerificationSha256 = verification.reportSha256;
  await writeJson(statePath, state);
  return { state, postDryRun: postDryRun.report, verification };
}

async function runFolderFinalVerification({
  graphql,
  manifest,
  expectedStoreDomain,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  filesStatePath = DEFAULT_FILES_STATE_PATH,
  statePath = DEFAULT_BULK_STATE_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
}) {
  const [approved, proposal] = await Promise.all([readJsonIfExists(approvedPath), readJsonIfExists(proposalPath)]);
  const dryRun = await runFolderDryRun({ graphql, manifest, expectedStoreDomain, approvedPath, proposalPath, filesStatePath });
  const report = await verifyAllFolderProducts({
    graphql,
    manifest,
    expectedStoreDomain,
    approved,
    proposal,
    dryRun: dryRun.report,
    outputPath: finalReportPath,
  });
  const state = await readJsonIfExists(statePath);
  if (
    state?.schemaVersion === 'folder-import-bulk-state-v1' &&
    state.status === 'COMPLETE' &&
    state.sourceManifestSha256 === manifest.manifestSha256 &&
    normalizeStoreDomain(state.shopDomain) === normalizeStoreDomain(expectedStoreDomain)
  ) {
    state.updatedAt = new Date().toISOString();
    state.lastVerifiedAt = state.updatedAt;
    state.finalDryRunSha256 = dryRun.report.reportSha256;
    state.finalVerificationSha256 = report.reportSha256;
    await writeJson(statePath, state);
  }
  return report;
}

module.exports = {
  DEFAULT_BULK_STATE_PATH,
  DEFAULT_FINAL_REPORT_PATH,
  QUERY_FOLDER_IMPORT_BULK_VERIFY,
  buildBulkContracts,
  calculateRolloutGateHash,
  createBulkState,
  processBulkProduct,
  runFolderBulkImport,
  runFolderFinalVerification,
  validateBulkPreflight,
  validateFinalProduct,
  verifyAllFolderProducts,
};
