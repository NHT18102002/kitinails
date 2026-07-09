const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const {
  buildCollectionPreparationPlan,
  canAdoptConflict,
  readCollectionRuleMap,
  readConflictResolutionConfig,
  requiredProductMetafieldDefinitions,
} = require('./admin-prep.cjs');
const {
  QUERY_COLLECTION_BY_HANDLE,
  QUERY_IMPORT_PREFLIGHT,
  QUERY_PRODUCT_BY_HANDLE,
} = require('./shopify-queries.cjs');

const REQUIRED_SCOPES = [
  'read_products',
  'write_products',
  'read_files',
  'write_files',
  'read_inventory',
  'write_inventory',
  'read_locations',
];

function classifyExistingProduct({
  handle = '',
  sourceUrl,
  existingSourceUrl,
  existingProductId = '',
  adoptExisting = false,
  conflictResolutionByHandle = new Map(),
}) {
  return explainExistingProductDecision({
    handle,
    sourceUrl,
    existingSourceUrl,
    existingProductId,
    adoptExisting,
    conflictResolutionByHandle,
  }).decision;
}

function explainExistingProductDecision({
  handle = '',
  sourceUrl,
  existingSourceUrl,
  existingProductId = '',
  adoptExisting = false,
  conflictResolutionByHandle = new Map(),
}) {
  const expected = String(sourceUrl || '').trim();
  const existing = String(existingSourceUrl || '').trim();

  if (expected && existing && expected === existing) {
    return {
      decision: 'update',
      reason: 'source_url_match',
    };
  }

  if (adoptExisting) {
    return {
      decision: 'adopt',
      reason: 'adopt_existing_flag',
    };
  }

  if (
    canAdoptConflict({
      handle,
      sourceUrl: expected,
      existingProductId,
      conflictResolutionByHandle,
    })
  ) {
    return {
      decision: 'adopt',
      reason: 'allowlisted_conflict',
    };
  }

  return {
    decision: 'skip_conflict',
    reason: 'source_url_conflict',
  };
}

function findMissingScopes(grantedHandles) {
  const granted = new Set((grantedHandles || []).map((scope) => String(scope).trim()).filter(Boolean));
  return REQUIRED_SCOPES.filter((scope) => !granted.has(scope));
}

function mapApprovedCollectionIds({ approvedCollections, resolvedByHandle }) {
  const collectionIds = [];
  const missingHandles = [];

  for (const collection of approvedCollections || []) {
    const handle = collection.handle;
    const id = resolvedByHandle.get(handle);

    if (id) {
      collectionIds.push(id);
    } else {
      missingHandles.push(handle);
    }
  }

  return { collectionIds, missingHandles };
}

function selectImportLocation(locations, explicitLocationId) {
  const requested = String(explicitLocationId || '').trim();

  if (requested) {
    const location = (locations || []).find((item) => item.id === requested);
    if (!location) {
      throw new Error(`SHOPIFY_LOCATION_ID was provided but not found: ${requested}`);
    }
    return location;
  }

  const activeLocation = (locations || []).find((item) => item.isActive);

  if (!activeLocation) {
    throw new Error('No active Shopify location found for later inventory preparation.');
  }

  return activeLocation;
}

async function runPreflight({ graphql, locationId = '', adoptExisting = false, logger = () => {} }) {
  const normalizedProducts = await readNormalizedProducts();
  const [approvedCollections, conflictResolution, collectionRuleMap] = await Promise.all([
    readApprovedCollections(),
    readConflictResolutionConfig(),
    readCollectionRuleMap(),
  ]);
  const preflight = await graphql(QUERY_IMPORT_PREFLIGHT);

  const grantedScopes = (preflight.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missingScopes = findMissingScopes(grantedScopes);
  const locations = preflight.locations?.nodes || [];
  const selectedLocation = selectImportLocation(locations, locationId);
  const metafieldDefinitions = compareMetafieldDefinitions(
    preflight.metafieldDefinitions?.nodes || [],
    requiredProductMetafieldDefinitions()
  );

  logger(`Resolving ${approvedCollections.length} approved collections...`);
  const collectionResolution = await resolveApprovedCollections({
    graphql,
    approvedCollections,
    collectionRuleMapByHandle: collectionRuleMap.byHandle,
  });

  logger(`Checking ${normalizedProducts.length} normalized product handles...`);
  const productChecks = await mapLimit(normalizedProducts, 5, async (product, index) => {
    if (index > 0 && index % 50 === 0) {
      logger(`Checked ${index}/${normalizedProducts.length} product handles...`);
    }

    return resolveProductConflict({
      graphql,
      product,
      adoptExisting,
      conflictResolutionByHandle: conflictResolution.byHandle,
    });
  });

  const productSummary = summarizeProductChecks({
    normalizedCount: normalizedProducts.length,
    approvedAdoptPolicyCount: conflictResolution.byHandle.size,
    productChecks,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    shop: preflight.shop,
    approvalRequired: true,
    mode: {
      productMutations: false,
      collectionMutations: false,
      metafieldDefinitionMutations: false,
      stagedUploadMutations: false,
    },
    scopes: {
      required: REQUIRED_SCOPES,
      granted: grantedScopes,
      missing: missingScopes,
    },
    locations: {
      available: locations,
      selected: selectedLocation,
      selectedFromEnv: Boolean(String(locationId || '').trim()),
    },
    collections: collectionResolution,
    metafieldDefinitions,
    products: {
      ...productSummary,
      checks: productChecks,
    },
  };

  const reportPath = path.join(paths.manifestsRoot, 'import-preflight.json');
  await writeJson(reportPath, report);

  if (missingScopes.length) {
    throw new Error(`Shopify Admin token is missing required scopes: ${missingScopes.join(', ')}`);
  }

  return report;
}

async function readNormalizedProducts() {
  const normalized = await readJsonIfExists(path.join(paths.normalizedRoot, 'products.json'));
  const products = Array.isArray(normalized) ? normalized : normalized?.products;

  if (!Array.isArray(products) || !products.length) {
    throw new Error(`Missing normalized products at ${path.join(paths.normalizedRoot, 'products.json')}. Run audit first.`);
  }

  return products;
}

async function readApprovedCollections() {
  const approved = await readJsonIfExists(path.join(paths.toolingRoot, 'config', 'collection-map.approved.json'));
  const collections = approved?.collections || approved?.include || [];

  if (!Array.isArray(collections)) {
    throw new Error('collection-map.approved.json must include a collections array.');
  }

  return collections;
}

async function resolveApprovedCollections({ graphql, approvedCollections }) {
  const resolved = [];
  const resolvedByHandle = new Map();

  for (const collection of approvedCollections) {
    const handle = String(collection.handle || '').trim();
    if (!handle) continue;

    const data = await graphql(QUERY_COLLECTION_BY_HANDLE, {
      query: `handle:${handle}`,
    });
    const match = (data.collections?.nodes || []).find((item) => item.handle === handle);

    if (match) {
      resolved.push({
        approvedHandle: handle,
        id: match.id,
        handle: match.handle,
        title: match.title,
      });
      resolvedByHandle.set(handle, match.id);
    }
  }

  const { collectionIds } = mapApprovedCollectionIds({
    approvedCollections,
    resolvedByHandle,
  });
  const collectionRuleMap = arguments[0].collectionRuleMapByHandle;
  const preparationPlan = buildCollectionPreparationPlan({
    approvedCollections,
    resolvedByHandle,
    collectionRuleMapByHandle: collectionRuleMap,
  });
  const missingHandles = preparationPlan.toCreate.map((item) => item.handle);

  return {
    approvedCount: approvedCollections.length,
    resolvedCount: resolved.length,
    virtualSkipCount: preparationPlan.virtualSkips.length,
    pendingCount: preparationPlan.pending.length,
    missingCount: preparationPlan.toCreate.length + preparationPlan.missingRule.length,
    collectionIds,
    missingHandles,
    resolved,
    virtualSkips: preparationPlan.virtualSkips,
    pending: preparationPlan.pending,
    missing: preparationPlan.toCreate.concat(preparationPlan.missingRule).map((item) => ({
      approvedHandle: item.handle,
      title: item.title || '',
      strategy: item.strategy || 'missing_rule',
    })),
  };
}

async function resolveProductConflict({ graphql, product, adoptExisting, conflictResolutionByHandle }) {
  const data = await graphql(QUERY_PRODUCT_BY_HANDLE, {
    query: `handle:${product.handle}`,
  });
  const exact = (data.products?.nodes || []).find((item) => item.handle === product.handle);

  if (!exact) {
    return {
      handle: product.handle,
      sourceUrl: product.sourceUrl,
      decision: 'create',
      decisionReason: 'not_found',
      existing: null,
    };
  }

  const existingSourceUrl = exact.sourceUrl?.value || '';
  const { decision, reason } = explainExistingProductDecision({
    handle: product.handle,
    sourceUrl: product.sourceUrl,
    existingSourceUrl,
    existingProductId: exact.id,
    adoptExisting,
    conflictResolutionByHandle,
  });

  return {
    handle: product.handle,
    sourceUrl: product.sourceUrl,
    decision,
    decisionReason: reason,
    existing: {
      id: exact.id,
      handle: exact.handle,
      title: exact.title,
      status: exact.status,
      sourceUrl: existingSourceUrl,
    },
  };
}

function summarizeProductChecks({ normalizedCount = 0, approvedAdoptPolicyCount = 0, productChecks = [] }) {
  const createCandidateCount = productChecks.filter((item) => item.decision === 'create').length;
  const updateCandidateCount = productChecks.filter((item) => item.decision === 'update').length;
  const adoptCandidateCount = productChecks.filter((item) => item.decision === 'adopt').length;
  const conflictCount = productChecks.filter((item) => item.decision === 'skip_conflict').length;
  const allowlistedAdoptMatchCount = productChecks.filter(
    (item) => item.decision === 'adopt' && item.decisionReason === 'allowlisted_conflict'
  ).length;
  const flaggedAdoptCount = productChecks.filter(
    (item) => item.decision === 'adopt' && item.decisionReason === 'adopt_existing_flag'
  ).length;

  return {
    normalizedCount,
    createCandidateCount,
    updateCandidateCount,
    adoptCandidateCount,
    conflictCount,
    approvedAdoptPolicyCount,
    allowlistedAdoptMatchCount,
    flaggedAdoptCount,
  };
}

function compareMetafieldDefinitions(existingDefinitions, requiredDefinitions) {
  const byKey = new Map(
    (existingDefinitions || []).map((definition) => [`${definition.namespace}.${definition.key}`, definition])
  );

  const required = requiredDefinitions.map((definition) => {
    const existing = byKey.get(`${definition.namespace}.${definition.key}`);
    const existingType = existing?.type?.name || existing?.type || '';

    return {
      ...definition,
      status: existing ? (existingType === definition.type ? 'present' : 'type_mismatch') : 'missing',
      existingDefinitionId: existing?.id || '',
      existingType,
    };
  });

  return {
    existingCount: existingDefinitions.length,
    required,
    missing: required.filter((definition) => definition.status === 'missing'),
    typeMismatches: required.filter((definition) => definition.status === 'type_mismatch'),
  };
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

module.exports = {
  REQUIRED_SCOPES,
  classifyExistingProduct,
  compareMetafieldDefinitions,
  explainExistingProductDecision,
  findMissingScopes,
  mapApprovedCollectionIds,
  summarizeProductChecks,
  requiredProductMetafieldDefinitions,
  resolveApprovedCollections,
  runPreflight,
  selectImportLocation,
};
