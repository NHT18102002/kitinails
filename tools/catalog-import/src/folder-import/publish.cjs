const path = require('node:path');

const { readJsonIfExists, writeJson } = require('../fs-utils.cjs');
const {
  MUTATION_PRODUCT_UPDATE_STATUS,
  MUTATION_PUBLISHABLE_PUBLISH,
  QUERY_PUBLICATIONS,
  buildActivationMutationVariables,
  buildPublishMutationVariables,
  findPublicationTarget,
} = require('../product-publish.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const { DEFAULT_APPROVED_MAP_PATH, DEFAULT_PROPOSED_MAP_PATH } = require('./collection-map.cjs');
const {
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  PAIR_HASH_KEY,
  PUBLISHER_ID,
  PUBLISHER_ID_KEY,
  REQUEST_HASH_KEY,
  assertApprovedContract,
  buildRequestHash,
} = require('./dry-run.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

const DEFAULT_FINAL_REPORT_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'final-verification.json');
const DEFAULT_PRICING_VERIFICATION_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'pricing-verification.json');
const DEFAULT_PUBLISH_PLAN_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'publish-plan.json');
const DEFAULT_PUBLISH_STATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'publish-state.json');
const DEFAULT_PUBLISH_VERIFICATION_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'publish-verification.json');
const REQUIRED_FOLDER_PUBLISH_SCOPES = ['read_products', 'write_products', 'read_publications', 'write_publications'];

const QUERY_FOLDER_IMPORT_PUBLISH_STATE = `#graphql
query FolderImportPublishState($ids: [ID!]!, $publicationId: ID!) {
  shop { name myshopifyDomain currencyCode }
  appInstallation { accessScopes { handle } }
  nodes(ids: $ids) {
    __typename
    ... on Product {
      id
      handle
      title
      status
      onlineStoreUrl
      onlineStorePreviewUrl
      publishedOnPublication(publicationId: $publicationId)
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

function summarizePublication(publication) {
  if (!publication) return null;
  return {
    id: publication.id,
    catalogTitle: publication.catalog?.title || '',
    channelNames: (publication.channels?.nodes || []).map((channel) => channel.name).filter(Boolean),
    channelHandles: (publication.channels?.nodes || []).map((channel) => channel.handle).filter(Boolean),
  };
}

function isOnlineStorePublication(publication) {
  return (publication?.channels?.nodes || []).some((channel) => channel.handle === 'online_store' || channel.name === 'Online Store');
}

function publishPlanHash(report) {
  const core = {
    schemaVersion: report?.schemaVersion,
    shopDomain: normalizeStoreDomain(report?.shop?.myshopifyDomain),
    sourceManifestSha256: report?.sourceManifestSha256,
    finalVerificationSha256: report?.finalVerificationSha256,
    pricingVerificationSha256: report?.pricingVerificationSha256,
    targetPrice: report?.targetPrice,
    publicationId: report?.targetPublication?.id,
    items: (report?.items || []).map((item) => ({
      sourceKey: item.sourceKey,
      productGid: item.productGid,
      handle: item.handle,
      status: item.status,
      publishedOnTarget: item.publishedOnTarget,
      decision: item.decision,
    })),
  };
  return sha256Text(stableStringify(core));
}

function validateFolderPublishProduct(product, { expected, verificationItem, collection, targetPrice, publicationId }) {
  const errors = [];
  if (!product || product.__typename !== 'Product') return ['Product is missing from Shopify.'];
  if (product.id !== verificationItem.productGid) errors.push('product GID mismatch');
  if (!['DRAFT', 'ACTIVE'].includes(product.status)) errors.push(`status=${product.status}`);
  if (product.externalId?.value !== expected.sourceKey || product.externalId?.type !== 'id') errors.push('external ID mismatch');
  if (product.publisherId?.value !== PUBLISHER_ID) errors.push('publisher marker mismatch');
  if (product.requestHash?.value !== buildRequestHash(expected, collection)) errors.push('request hash mismatch');
  if (product.pairHash?.value !== expected.pairSha256) errors.push('source pair hash mismatch');
  if (product.handle !== expected.proposedHandle) errors.push('handle mismatch');
  if (product.title !== expected.title) errors.push('title mismatch');
  const media = product.media?.nodes || [];
  if (media.length !== 2) errors.push(`media count=${media.length}`);
  if (media.some((item) => item.mediaContentType !== 'IMAGE' || item.status !== 'READY')) errors.push('media is not IMAGE/READY');
  const collections = product.collections?.nodes || [];
  if (collections.length !== 1 || collections[0]?.id !== collection.gid) errors.push('collection membership mismatch');
  const variants = product.variants?.nodes || [];
  if (variants.length !== 1) errors.push(`variant count=${variants.length}`);
  if (variants.length === 1 && variants[0]?.price !== targetPrice) errors.push(`price=${variants[0]?.price}`);
  if (!publicationId) errors.push('target publication is missing');
  return errors;
}

function validatePublishArtifacts({ manifest, finalVerification, pricingVerification }) {
  const errors = [];
  if (manifest?.schemaVersion !== 'folder-product-manifest-v1' || manifest?.products?.length !== 88) {
    errors.push('Publish requires the exact 88-product source manifest.');
  }
  if (
    finalVerification?.schemaVersion !== 'folder-import-final-verification-v1' ||
    finalVerification?.gate !== 'PASS' ||
    finalVerification?.summary?.verifiedCount !== 88 ||
    finalVerification?.sourceManifestSha256 !== manifest?.manifestSha256
  ) {
    errors.push('Publish requires the current 88/88 final verification.');
  }
  if (
    pricingVerification?.schemaVersion !== 'folder-import-pricing-plan-v1' ||
    pricingVerification?.gate !== 'PASS' ||
    pricingVerification?.summary?.itemCount !== 88 ||
    pricingVerification?.summary?.updateCount !== 0 ||
    pricingVerification?.summary?.skipUnchangedCount !== 88 ||
    pricingVerification?.summary?.blockedCount !== 0 ||
    pricingVerification?.sourceManifestSha256 !== manifest?.manifestSha256
  ) {
    errors.push('Publish requires a converged 88/88 pricing verification.');
  }
  return errors;
}

function buildFolderPublishPlanReport({
  manifest,
  finalVerification,
  pricingVerification,
  mappings,
  data,
  expectedStoreDomain,
  targetPublication,
}) {
  const blockingErrors = validatePublishArtifacts({ manifest, finalVerification, pricingVerification });
  if (normalizeStoreDomain(data?.shop?.myshopifyDomain) !== normalizeStoreDomain(expectedStoreDomain)) {
    blockingErrors.push(`Store mismatch: expected ${normalizeStoreDomain(expectedStoreDomain)}.`);
  }
  const grantedScopes = (data?.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missingScopes = REQUIRED_FOLDER_PUBLISH_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  if (missingScopes.length) blockingErrors.push(`Missing publish scopes: ${missingScopes.join(', ')}.`);
  if (!targetPublication || !isOnlineStorePublication(targetPublication)) {
    blockingErrors.push('A unique Online Store publication target is required.');
  }

  const verificationItems = finalVerification?.items || [];
  const ids = verificationItems.map((item) => item.productGid).filter(Boolean);
  if (ids.length !== 88 || new Set(ids).size !== 88) blockingErrors.push('Final verification must contain 88 unique product GIDs.');
  const expectedBySource = new Map((manifest?.products || []).map((product) => [product.sourceKey, product]));
  const collectionByFolder = new Map((mappings || []).map((mapping) => [mapping.folder, mapping]));
  const liveById = new Map((data?.nodes || []).filter(Boolean).map((product) => [product.id, product]));
  const targetPrice = pricingVerification?.targetPrice || '';
  const publicationId = targetPublication?.id || '';
  const items = verificationItems.map((verificationItem) => {
    const expected = expectedBySource.get(verificationItem.sourceKey);
    const collection = collectionByFolder.get(verificationItem.collectionFolder);
    const product = liveById.get(verificationItem.productGid);
    const errors = !expected || !collection
      ? ['Manifest product or collection mapping is missing.']
      : validateFolderPublishProduct(product, {
        expected,
        verificationItem,
        collection,
        targetPrice,
        publicationId,
      });
    const publishedOnTarget = Boolean(product?.publishedOnPublication);
    const needsActivation = product?.status !== 'ACTIVE';
    const needsPublication = !publishedOnTarget;
    return {
      sourceKey: verificationItem.sourceKey,
      collectionFolder: verificationItem.collectionFolder,
      productGid: verificationItem.productGid,
      handle: product?.handle || expected?.proposedHandle || null,
      title: product?.title || expected?.title || null,
      status: product?.status || null,
      publishedOnTarget,
      onlineStoreUrl: product?.onlineStoreUrl || null,
      onlineStorePreviewUrl: product?.onlineStorePreviewUrl || null,
      needsActivation,
      needsPublication,
      decision: errors.length ? 'BLOCKED' : needsActivation || needsPublication ? 'PUBLISH' : 'SKIP_PUBLISHED',
      errors,
    };
  });
  const blockedCount = items.filter((item) => item.decision === 'BLOCKED').length;
  const report = {
    schemaVersion: 'folder-import-publish-plan-v1',
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    shop: data?.shop || null,
    scopes: { required: REQUIRED_FOLDER_PUBLISH_SCOPES, granted: grantedScopes, missing: missingScopes },
    sourceManifestSha256: manifest?.manifestSha256 || null,
    finalVerificationSha256: finalVerification?.reportSha256 || null,
    pricingVerificationSha256: pricingVerification?.reportSha256 || null,
    targetPrice,
    targetPublication: summarizePublication(targetPublication),
    gate: blockingErrors.length || blockedCount ? 'BLOCKED' : 'PASS',
    blockingErrors,
    summary: {
      expectedCount: 88,
      itemCount: items.length,
      publishCount: items.filter((item) => item.decision === 'PUBLISH').length,
      skipPublishedCount: items.filter((item) => item.decision === 'SKIP_PUBLISHED').length,
      blockedCount,
      activeCount: items.filter((item) => item.status === 'ACTIVE').length,
      publishedCount: items.filter((item) => item.publishedOnTarget).length,
    },
    items,
  };
  report.reportSha256 = publishPlanHash(report);
  return report;
}

async function queryFolderPublishState({ graphql, ids, publicationId }) {
  return graphql(QUERY_FOLDER_IMPORT_PUBLISH_STATE, { ids, publicationId });
}

async function runFolderPublishPlan({
  graphql,
  manifest,
  expectedStoreDomain,
  publicationId = '',
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
  pricingVerificationPath = DEFAULT_PRICING_VERIFICATION_PATH,
  outputPath = DEFAULT_PUBLISH_PLAN_PATH,
}) {
  const [approved, proposal, finalVerification, pricingVerification, publicationsData] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(finalReportPath),
    readJsonIfExists(pricingVerificationPath),
    graphql(QUERY_PUBLICATIONS),
  ]);
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  const targetPublication = findPublicationTarget({
    publications: publicationsData?.publications?.nodes || [],
    publicationId,
    publicationNameHint: 'Online Store',
  });
  const ids = (finalVerification?.items || []).map((item) => item.productGid).filter(Boolean);
  const data = await queryFolderPublishState({ graphql, ids, publicationId: targetPublication?.id || '' });
  const report = buildFolderPublishPlanReport({
    manifest,
    finalVerification,
    pricingVerification,
    mappings,
    data,
    expectedStoreDomain,
    targetPublication,
  });
  await writeJson(outputPath, report);
  return { report, outputPath };
}

function validatePublishApplyPreflight({ plan, state, manifest, expectedStoreDomain, approvedPlanSha }) {
  const errors = [];
  if (plan?.schemaVersion !== 'folder-import-publish-plan-v1' || plan?.gate !== 'PASS') errors.push('Saved publish plan is not PASS.');
  if (plan?.reportSha256 !== publishPlanHash(plan)) errors.push('Saved publish plan hash is invalid.');
  if (!approvedPlanSha || plan?.reportSha256 !== approvedPlanSha) errors.push('Publish plan SHA is not explicitly approved.');
  if (plan?.sourceManifestSha256 !== manifest?.manifestSha256) errors.push('Publish plan source manifest has drifted.');
  if (normalizeStoreDomain(plan?.shop?.myshopifyDomain) !== normalizeStoreDomain(expectedStoreDomain)) errors.push('Publish plan belongs to another store.');
  if (plan?.summary?.itemCount !== 88 || plan?.summary?.blockedCount !== 0) errors.push('Publish plan must contain exactly 88 unblocked items.');
  if (state) {
    if (state.schemaVersion !== 'folder-import-publish-state-v1') errors.push('Publish checkpoint schema is unsupported.');
    if (state.approvedPlanSha256 !== approvedPlanSha) errors.push('Publish checkpoint belongs to another plan.');
    if (normalizeStoreDomain(state.shopDomain) !== normalizeStoreDomain(expectedStoreDomain)) errors.push('Publish checkpoint belongs to another store.');
  }
  return { gate: errors.length ? 'BLOCKED' : 'PASS', errors };
}

function createPublishState({ plan, expectedStoreDomain }) {
  return {
    schemaVersion: 'folder-import-publish-state-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'RUNNING',
    shopDomain: normalizeStoreDomain(expectedStoreDomain),
    sourceManifestSha256: plan.sourceManifestSha256,
    approvedPlanSha256: plan.reportSha256,
    publicationId: plan.targetPublication.id,
    plannedItemCount: 88,
    canarySourceKey: null,
    items: {},
  };
}

async function writePublishItemState({ state, statePath, item, status, details = {} }) {
  state.updatedAt = new Date().toISOString();
  state.items[item.sourceKey] = {
    ...(state.items[item.sourceKey] || {}),
    sourceKey: item.sourceKey,
    productGid: item.productGid,
    handle: item.handle,
    ...details,
    status,
    updatedAt: state.updatedAt,
  };
  await writeJson(statePath, state);
}

async function pollPublishedProduct({ graphql, item, publicationId, validate, attempts = 12 }) {
  let lastProduct = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await queryFolderPublishState({ graphql, ids: [item.productGid], publicationId });
    lastProduct = data?.nodes?.[0] || null;
    const errors = validate(lastProduct);
    if (!errors.length && lastProduct.status === 'ACTIVE' && lastProduct.publishedOnPublication) return lastProduct;
    await delay(1000);
  }
  throw new Error(`Publish read-back timed out for ${item.sourceKey}.`);
}

async function processPublishItem({ graphql, manifest, mappings, finalVerification, plan, item, state, statePath }) {
  const expected = manifest.products.find((product) => product.sourceKey === item.sourceKey);
  const verificationItem = finalVerification.items.find((candidate) => candidate.sourceKey === item.sourceKey);
  const collection = mappings.find((mapping) => mapping.folder === item.collectionFolder);
  const publicationId = plan.targetPublication.id;
  const validate = (product) => validateFolderPublishProduct(product, {
    expected,
    verificationItem,
    collection,
    targetPrice: plan.targetPrice,
    publicationId,
  });
  const guardData = await queryFolderPublishState({ graphql, ids: [item.productGid], publicationId });
  let product = guardData?.nodes?.[0] || null;
  const guardErrors = validate(product);
  if (guardErrors.length) throw new Error(`Publish guard blocked: ${guardErrors.join('; ')}`);
  await writePublishItemState({ state, statePath, item, status: 'RUNNING', details: { beforeStatus: product.status } });

  let activated = false;
  let published = false;
  if (product.status !== 'ACTIVE') {
    const data = await graphql(MUTATION_PRODUCT_UPDATE_STATUS, buildActivationMutationVariables({ productId: item.productGid }));
    const errors = data?.productUpdate?.userErrors || [];
    if (errors.length) throw new Error(`productUpdate failed: ${errors.map((error) => error.message).join('; ')}`);
    if (data?.productUpdate?.product?.id !== item.productGid || data?.productUpdate?.product?.status !== 'ACTIVE') {
      throw new Error('productUpdate did not return the expected ACTIVE product.');
    }
    activated = true;
  }
  if (!product.publishedOnPublication) {
    const data = await graphql(MUTATION_PUBLISHABLE_PUBLISH, buildPublishMutationVariables({
      productId: item.productGid,
      publicationId,
    }));
    const errors = data?.publishablePublish?.userErrors || [];
    if (errors.length) throw new Error(`publishablePublish failed: ${errors.map((error) => error.message).join('; ')}`);
    if (data?.publishablePublish?.publishable?.id !== item.productGid) {
      throw new Error('publishablePublish did not return the expected product.');
    }
    published = true;
  }
  product = await pollPublishedProduct({ graphql, item, publicationId, validate });
  await writePublishItemState({
    state,
    statePath,
    item,
    status: 'VERIFIED',
    details: {
      activated,
      published,
      finalStatus: product.status,
      publishedOnTarget: Boolean(product.publishedOnPublication),
      onlineStoreUrl: product.onlineStoreUrl || null,
      onlineStorePreviewUrl: product.onlineStorePreviewUrl || null,
    },
  });
  return product;
}

async function loadPublishApplyContext({ manifest, planPath, statePath, approvedPath, proposalPath, finalReportPath }) {
  const [plan, state, approved, proposal, finalVerification] = await Promise.all([
    readJsonIfExists(planPath),
    readJsonIfExists(statePath),
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(finalReportPath),
  ]);
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  return { plan, state, mappings, finalVerification };
}

async function runFolderPublishCanary({
  graphql,
  manifest,
  expectedStoreDomain,
  sourceKey,
  approvedPlanSha,
  confirmPublish = false,
  planPath = DEFAULT_PUBLISH_PLAN_PATH,
  statePath = DEFAULT_PUBLISH_STATE_PATH,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
}) {
  if (!confirmPublish) throw new Error('Publish canary requires --confirm-publish.');
  if (!sourceKey) throw new Error('Publish canary requires --source-key.');
  const context = await loadPublishApplyContext({ manifest, planPath, statePath, approvedPath, proposalPath, finalReportPath });
  const preflight = validatePublishApplyPreflight({
    plan: context.plan,
    state: context.state,
    manifest,
    expectedStoreDomain,
    approvedPlanSha,
  });
  if (preflight.gate !== 'PASS') throw new Error(`Publish canary preflight blocked: ${preflight.errors.join(' ')}`);
  const item = context.plan.items.find((candidate) => candidate.sourceKey === sourceKey);
  if (!item || item.decision === 'BLOCKED') throw new Error('Canary source is absent or blocked in the approved plan.');
  const state = context.state || createPublishState({ plan: context.plan, expectedStoreDomain });
  if (state.canarySourceKey && state.canarySourceKey !== sourceKey) throw new Error('Publish checkpoint is pinned to another canary source.');
  state.canarySourceKey = sourceKey;
  await writeJson(statePath, state);
  try {
    const product = await processPublishItem({
      graphql,
      manifest,
      mappings: context.mappings,
      finalVerification: context.finalVerification,
      plan: context.plan,
      item,
      state,
      statePath,
    });
    state.status = 'CANARY_PASS';
    state.updatedAt = new Date().toISOString();
    await writeJson(statePath, state);
    return { state, item: state.items[sourceKey], product };
  } catch (error) {
    await writePublishItemState({ state, statePath, item, status: 'FAILED', details: { lastError: error.message } });
    state.status = 'BLOCKED';
    await writeJson(statePath, state);
    throw error;
  }
}

async function verifyFolderPublishedProducts({
  graphql,
  manifest,
  expectedStoreDomain,
  publicationId,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
  pricingVerificationPath = DEFAULT_PRICING_VERIFICATION_PATH,
  outputPath = DEFAULT_PUBLISH_VERIFICATION_PATH,
}) {
  const [approved, proposal, finalVerification, pricingVerification] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(finalReportPath),
    readJsonIfExists(pricingVerificationPath),
  ]);
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  const ids = (finalVerification?.items || []).map((item) => item.productGid).filter(Boolean);
  const data = await queryFolderPublishState({ graphql, ids, publicationId });
  const report = buildFolderPublishPlanReport({
    manifest,
    finalVerification,
    pricingVerification,
    mappings,
    data,
    expectedStoreDomain,
    targetPublication: {
      id: publicationId,
      channels: { nodes: [{ name: 'Online Store', handle: 'online_store' }] },
      catalog: { title: 'Online Store' },
    },
  });
  const failedItems = report.items.filter((item) => item.errors.length || item.status !== 'ACTIVE' || !item.publishedOnTarget);
  const verification = {
    ...report,
    schemaVersion: 'folder-import-publish-verification-v1',
    mode: 'READ_ONLY',
    gate: report.gate === 'PASS' && failedItems.length === 0 ? 'PASS' : 'BLOCKED',
    summary: {
      expectedCount: 88,
      verifiedCount: report.items.length - failedItems.length,
      failedCount: failedItems.length,
      activeCount: report.items.filter((item) => item.status === 'ACTIVE').length,
      publishedCount: report.items.filter((item) => item.publishedOnTarget).length,
      storefrontUrlCount: report.items.filter((item) => item.onlineStoreUrl || item.onlineStorePreviewUrl).length,
    },
  };
  verification.reportSha256 = publishPlanHash(verification);
  await writeJson(outputPath, verification);
  return verification;
}

async function runFolderPublishAll({
  graphql,
  manifest,
  expectedStoreDomain,
  approvedPlanSha,
  confirmPublish = false,
  logger = () => {},
  planPath = DEFAULT_PUBLISH_PLAN_PATH,
  statePath = DEFAULT_PUBLISH_STATE_PATH,
  verificationPath = DEFAULT_PUBLISH_VERIFICATION_PATH,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
}) {
  if (!confirmPublish) throw new Error('Full publish requires --confirm-publish.');
  const context = await loadPublishApplyContext({ manifest, planPath, statePath, approvedPath, proposalPath, finalReportPath });
  const preflight = validatePublishApplyPreflight({
    plan: context.plan,
    state: context.state,
    manifest,
    expectedStoreDomain,
    approvedPlanSha,
  });
  if (preflight.gate !== 'PASS') throw new Error(`Full publish preflight blocked: ${preflight.errors.join(' ')}`);
  if (context.state?.status !== 'CANARY_PASS' && context.state?.status !== 'RUNNING' && context.state?.status !== 'COMPLETE') {
    throw new Error('Full publish requires a PASS canary checkpoint.');
  }
  if (!context.state?.canarySourceKey || context.state.items?.[context.state.canarySourceKey]?.status !== 'VERIFIED') {
    throw new Error('Full publish requires a verified canary item.');
  }
  const state = context.state;
  state.status = 'RUNNING';
  await writeJson(statePath, state);
  for (const item of context.plan.items) {
    if (state.items[item.sourceKey]?.status === 'VERIFIED') continue;
    logger({ event: 'PUBLISH_ITEM_START', sourceKey: item.sourceKey, productGid: item.productGid });
    try {
      await processPublishItem({
        graphql,
        manifest,
        mappings: context.mappings,
        finalVerification: context.finalVerification,
        plan: context.plan,
        item,
        state,
        statePath,
      });
      logger({ event: 'PUBLISH_ITEM_VERIFIED', sourceKey: item.sourceKey, productGid: item.productGid });
    } catch (error) {
      await writePublishItemState({ state, statePath, item, status: 'FAILED', details: { lastError: error.message } });
      state.status = 'BLOCKED';
      await writeJson(statePath, state);
      throw new Error(`Publish stopped at ${item.sourceKey}: ${error.message}`);
    }
  }
  const verification = await verifyFolderPublishedProducts({
    graphql,
    manifest,
    expectedStoreDomain,
    publicationId: context.plan.targetPublication.id,
    approvedPath,
    proposalPath,
    finalReportPath,
    outputPath: verificationPath,
  });
  if (verification.gate !== 'PASS' || verification.summary.verifiedCount !== 88) {
    throw new Error(`Final publish verification failed for ${verification.summary.failedCount} products.`);
  }
  state.status = 'COMPLETE';
  state.updatedAt = new Date().toISOString();
  state.completedAt = state.updatedAt;
  state.verificationSha256 = verification.reportSha256;
  await writeJson(statePath, state);
  return { state, verification };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  DEFAULT_PUBLISH_PLAN_PATH,
  DEFAULT_PUBLISH_STATE_PATH,
  DEFAULT_PUBLISH_VERIFICATION_PATH,
  QUERY_FOLDER_IMPORT_PUBLISH_STATE,
  REQUIRED_FOLDER_PUBLISH_SCOPES,
  buildFolderPublishPlanReport,
  createPublishState,
  isOnlineStorePublication,
  processPublishItem,
  publishPlanHash,
  runFolderPublishAll,
  runFolderPublishCanary,
  runFolderPublishPlan,
  validateFolderPublishProduct,
  validatePublishApplyPreflight,
  validatePublishArtifacts,
  verifyFolderPublishedProducts,
};
