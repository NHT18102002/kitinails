const path = require('node:path');

const { readJsonIfExists, writeJson } = require('../fs-utils.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const {
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  PAIR_HASH_KEY,
  PUBLISHER_ID,
  PUBLISHER_ID_KEY,
  REQUEST_HASH_KEY,
} = require('./dry-run.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

const DEFAULT_FINAL_REPORT_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'final-verification.json');
const DEFAULT_PRICING_PLAN_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'pricing-plan.json');
const DEFAULT_PRICING_STATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'pricing-state.json');
const DEFAULT_PRICING_VERIFICATION_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'pricing-verification.json');

const QUERY_FOLDER_IMPORT_PRICING = `#graphql
query FolderImportPricing($ids: [ID!]!) {
  shop { name myshopifyDomain currencyCode }
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
      variants(first: 10) { nodes { id title price } }
    }
  }
}
`;

const MUTATION_FOLDER_IMPORT_PRICE_UPDATE = `#graphql
mutation FolderImportPriceUpdate(
  $productId: ID!
  $variants: [ProductVariantsBulkInput!]!
) {
  productVariantsBulkUpdate(
    productId: $productId
    variants: $variants
    allowPartialUpdates: false
  ) {
    product { id status }
    productVariants { id price }
    userErrors { code field message }
  }
}
`;

function normalizePrice(value) {
  const raw = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error('Price must be a positive decimal with at most two fractional digits.');
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 99999999.99) {
    throw new Error('Price must be greater than 0 and no more than 99999999.99.');
  }
  return amount.toFixed(2);
}

function pricingReportHash(report) {
  const hashable = { ...(report || {}) };
  delete hashable.generatedAt;
  delete hashable.reportSha256;
  return sha256Text(stableStringify(hashable));
}

function validatePricingProduct(product, { expected, verificationItem }) {
  const errors = [];
  if (!product || product.__typename !== 'Product') return ['Product is missing from Shopify.'];
  if (product.id !== verificationItem.productGid) errors.push('product GID mismatch');
  if (product.status !== 'DRAFT') errors.push(`status=${product.status}`);
  if (product.externalId?.value !== expected.sourceKey || product.externalId?.type !== 'id') errors.push('external ID mismatch');
  if (product.publisherId?.value !== PUBLISHER_ID) errors.push('publisher marker mismatch');
  if (product.pairHash?.value !== expected.pairSha256) errors.push('source pair hash mismatch');
  if (product.handle !== expected.proposedHandle) errors.push('handle mismatch');
  if (product.title !== expected.title) errors.push('title mismatch');
  const variants = product.variants?.nodes || [];
  if (variants.length !== 1) errors.push(`variant count=${variants.length}`);
  if (variants.length === 1 && !variants[0]?.id) errors.push('variant GID is missing');
  return errors;
}

function buildPricingPlanReport({ manifest, finalVerification, data, expectedStoreDomain, targetPrice }) {
  const normalizedPrice = normalizePrice(targetPrice);
  const expectedDomain = normalizeStoreDomain(expectedStoreDomain);
  const errors = [];
  if (manifest?.schemaVersion !== 'folder-product-manifest-v1' || manifest?.products?.length !== 88) {
    errors.push('Pricing requires the exact 88-product folder manifest.');
  }
  if (
    finalVerification?.schemaVersion !== 'folder-import-final-verification-v1' ||
    finalVerification?.gate !== 'PASS' ||
    finalVerification?.summary?.verifiedCount !== 88
  ) {
    errors.push('Pricing requires the final 88/88 PASS verification report.');
  }
  if (finalVerification?.sourceManifestSha256 !== manifest?.manifestSha256) {
    errors.push('Final verification does not match the current source manifest.');
  }
  if (normalizeStoreDomain(data?.shop?.myshopifyDomain) !== expectedDomain) {
    errors.push(`Store mismatch: expected ${expectedDomain}.`);
  }
  const verificationItems = finalVerification?.items || [];
  const ids = verificationItems.map((item) => item.productGid).filter(Boolean);
  if (ids.length !== 88 || new Set(ids).size !== 88) errors.push('Final verification must contain 88 unique product GIDs.');

  const expectedBySource = new Map((manifest?.products || []).map((product) => [product.sourceKey, product]));
  const productById = new Map((data?.nodes || []).filter(Boolean).map((product) => [product.id, product]));
  const items = verificationItems.map((verificationItem) => {
    const expected = expectedBySource.get(verificationItem.sourceKey);
    const product = productById.get(verificationItem.productGid);
    const itemErrors = expected
      ? validatePricingProduct(product, { expected, verificationItem })
      : ['Source key is absent from the current manifest.'];
    const variant = product?.variants?.nodes?.[0] || null;
    return {
      sourceKey: verificationItem.sourceKey,
      collectionFolder: verificationItem.collectionFolder,
      productGid: verificationItem.productGid,
      variantGid: variant?.id || null,
      title: product?.title || expected?.title || null,
      currentPrice: variant?.price || null,
      targetPrice: normalizedPrice,
      decision: itemErrors.length ? 'BLOCKED' : variant.price === normalizedPrice ? 'SKIP_UNCHANGED' : 'UPDATE',
      errors: itemErrors,
    };
  });
  if (items.length !== 88) errors.push(`Pricing plan contains ${items.length} items instead of 88.`);
  const blockedCount = items.filter((item) => item.decision === 'BLOCKED').length;
  const report = {
    schemaVersion: 'folder-import-pricing-plan-v1',
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    shop: data?.shop || null,
    sourceManifestSha256: manifest?.manifestSha256 || null,
    finalVerificationSha256: finalVerification?.reportSha256 || null,
    targetPrice: normalizedPrice,
    currencyCode: data?.shop?.currencyCode || null,
    gate: errors.length || blockedCount ? 'BLOCKED' : 'PASS',
    blockingErrors: errors,
    summary: {
      expectedCount: 88,
      itemCount: items.length,
      updateCount: items.filter((item) => item.decision === 'UPDATE').length,
      skipUnchangedCount: items.filter((item) => item.decision === 'SKIP_UNCHANGED').length,
      blockedCount,
    },
    items,
  };
  report.reportSha256 = pricingReportHash(report);
  return report;
}

async function queryPricingProducts({ graphql, ids }) {
  return graphql(QUERY_FOLDER_IMPORT_PRICING, { ids });
}

async function runFolderPricingPlan({
  graphql,
  manifest,
  expectedStoreDomain,
  targetPrice,
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
  outputPath = DEFAULT_PRICING_PLAN_PATH,
}) {
  const finalVerification = await readJsonIfExists(finalReportPath);
  const ids = (finalVerification?.items || []).map((item) => item.productGid).filter(Boolean);
  const data = await queryPricingProducts({ graphql, ids });
  const report = buildPricingPlanReport({
    manifest,
    finalVerification,
    data,
    expectedStoreDomain,
    targetPrice,
  });
  await writeJson(outputPath, report);
  return { report, outputPath };
}

function createPricingState({ report, expectedStoreDomain }) {
  return {
    schemaVersion: 'folder-import-pricing-state-v1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'RUNNING',
    shopDomain: normalizeStoreDomain(expectedStoreDomain),
    sourceManifestSha256: report.sourceManifestSha256,
    approvedPlanSha256: report.reportSha256,
    targetPrice: report.targetPrice,
    plannedItemCount: report.summary.updateCount,
    items: {},
  };
}

function validatePricingApplyPreflight({ report, state, expectedStoreDomain, approvedPlanSha }) {
  const errors = [];
  if (report?.gate !== 'PASS') errors.push('Current pricing plan is not PASS.');
  if (!approvedPlanSha) errors.push('Apply requires an explicit approved pricing-plan SHA-256.');
  if (!state && report?.reportSha256 !== approvedPlanSha) errors.push('Current pricing plan hash is not the approved hash.');
  if (state) {
    if (state.schemaVersion !== 'folder-import-pricing-state-v1') errors.push('Pricing checkpoint schema is unsupported.');
    if (normalizeStoreDomain(state.shopDomain) !== normalizeStoreDomain(expectedStoreDomain)) errors.push('Pricing checkpoint belongs to a different store.');
    if (state.sourceManifestSha256 !== report.sourceManifestSha256) errors.push('Pricing checkpoint manifest has drifted.');
    if (state.approvedPlanSha256 !== approvedPlanSha) errors.push('Pricing checkpoint belongs to another approved plan.');
    if (state.targetPrice !== report.targetPrice) errors.push('Pricing checkpoint target price has drifted.');
  }
  if (report?.summary?.blockedCount) errors.push('Pricing plan contains blocked products.');
  return { gate: errors.length ? 'BLOCKED' : 'PASS', errors };
}

async function writePricingItemState({ state, statePath, item, status, details = {} }) {
  state.updatedAt = new Date().toISOString();
  state.items[item.sourceKey] = {
    ...(state.items[item.sourceKey] || {}),
    sourceKey: item.sourceKey,
    productGid: item.productGid,
    variantGid: item.variantGid,
    targetPrice: item.targetPrice,
    ...details,
    status,
    updatedAt: state.updatedAt,
  };
  await writeJson(statePath, state);
}

async function applyPricingItem({ graphql, manifest, finalVerification, item, state, statePath }) {
  const expected = manifest.products.find((product) => product.sourceKey === item.sourceKey);
  const verificationItem = finalVerification.items.find((candidate) => candidate.sourceKey === item.sourceKey);
  const guardData = await queryPricingProducts({ graphql, ids: [item.productGid] });
  const product = guardData?.nodes?.[0];
  const errors = validatePricingProduct(product, { expected, verificationItem });
  if (errors.length) throw new Error(`Pricing guard blocked: ${errors.join('; ')}`);
  const variant = product.variants.nodes[0];
  if (variant.id !== item.variantGid) throw new Error('Pricing guard blocked: variant GID changed.');
  if (variant.price === item.targetPrice) {
    await writePricingItemState({ state, statePath, item, status: 'VERIFIED', details: { previousPrice: variant.price, result: 'ALREADY_TARGET' } });
    return;
  }
  await writePricingItemState({ state, statePath, item, status: 'RUNNING', details: { previousPrice: variant.price } });
  const data = await graphql(MUTATION_FOLDER_IMPORT_PRICE_UPDATE, {
    productId: item.productGid,
    variants: [{ id: item.variantGid, price: item.targetPrice }],
  });
  const payload = data?.productVariantsBulkUpdate;
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map((error) => error.message).join('; '));
  }
  const updated = payload?.productVariants?.find((candidate) => candidate.id === item.variantGid);
  if (payload?.product?.status !== 'DRAFT' || updated?.price !== item.targetPrice) {
    throw new Error('Pricing mutation response failed DRAFT/price verification.');
  }
  await writePricingItemState({ state, statePath, item, status: 'VERIFIED', details: { result: 'UPDATED' } });
}

async function runFolderPricingApply({
  graphql,
  manifest,
  expectedStoreDomain,
  targetPrice,
  approvedPlanSha,
  confirmApply = false,
  logger = () => {},
  finalReportPath = DEFAULT_FINAL_REPORT_PATH,
  planPath = DEFAULT_PRICING_PLAN_PATH,
  statePath = DEFAULT_PRICING_STATE_PATH,
  verificationPath = DEFAULT_PRICING_VERIFICATION_PATH,
}) {
  if (!confirmApply) throw new Error('Pricing mutation requires --confirm-price-update.');
  const [finalVerification, existingState] = await Promise.all([
    readJsonIfExists(finalReportPath),
    readJsonIfExists(statePath),
  ]);
  const planResult = await runFolderPricingPlan({
    graphql,
    manifest,
    expectedStoreDomain,
    targetPrice,
    finalReportPath,
    outputPath: planPath,
  });
  const preflight = validatePricingApplyPreflight({
    report: planResult.report,
    state: existingState,
    expectedStoreDomain,
    approvedPlanSha,
  });
  if (preflight.gate !== 'PASS') throw new Error(`Pricing preflight blocked: ${preflight.errors.join(' ')}`);
  const state = existingState || createPricingState({ report: planResult.report, expectedStoreDomain });
  await writeJson(statePath, state);

  for (const item of planResult.report.items) {
    if (item.decision === 'SKIP_UNCHANGED' || state.items[item.sourceKey]?.status === 'VERIFIED') continue;
    logger({ event: 'PRICE_ITEM_START', sourceKey: item.sourceKey, productGid: item.productGid, targetPrice: item.targetPrice });
    try {
      await applyPricingItem({ graphql, manifest, finalVerification, item, state, statePath });
      logger({ event: 'PRICE_ITEM_VERIFIED', sourceKey: item.sourceKey, productGid: item.productGid });
    } catch (error) {
      await writePricingItemState({ state, statePath, item, status: 'FAILED', details: { lastError: error.message } });
      state.status = 'BLOCKED';
      await writeJson(statePath, state);
      throw new Error(`Pricing stopped at ${item.sourceKey}: ${error.message}`);
    }
  }

  const verification = await runFolderPricingPlan({
    graphql,
    manifest,
    expectedStoreDomain,
    targetPrice,
    finalReportPath,
    outputPath: verificationPath,
  });
  if (
    verification.report.gate !== 'PASS' ||
    verification.report.summary.updateCount !== 0 ||
    verification.report.summary.skipUnchangedCount !== 88
  ) {
    throw new Error('Pricing read-back did not converge to 88 SKIP_UNCHANGED.');
  }
  state.status = 'COMPLETE';
  state.updatedAt = new Date().toISOString();
  state.completedAt = state.updatedAt;
  state.verificationSha256 = verification.report.reportSha256;
  await writeJson(statePath, state);
  return { state, verification: verification.report };
}

module.exports = {
  DEFAULT_PRICING_PLAN_PATH,
  DEFAULT_PRICING_STATE_PATH,
  DEFAULT_PRICING_VERIFICATION_PATH,
  MUTATION_FOLDER_IMPORT_PRICE_UPDATE,
  QUERY_FOLDER_IMPORT_PRICING,
  applyPricingItem,
  buildPricingPlanReport,
  createPricingState,
  normalizePrice,
  pricingReportHash,
  runFolderPricingApply,
  runFolderPricingPlan,
  validatePricingApplyPreflight,
  validatePricingProduct,
};
