const path = require('node:path');

const { constants, paths } = require('../config.cjs');
const { readJsonIfExists } = require('../fs-utils.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const {
  DEFAULT_APPROVED_MAP_PATH,
  DEFAULT_PROPOSED_MAP_PATH,
  calculateCollectionProposalHash,
  classifyCollection,
} = require('./collection-map.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { sealDryRunReport, writeDryRunArtifacts } = require('./report.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

const IDENTITY_NAMESPACE = 'ersa_automation';
const EXTERNAL_ID_KEY = 'external_id';
const PUBLISHER_ID_KEY = 'publisher_id';
const REQUEST_HASH_KEY = 'request_hash';
const PAIR_HASH_KEY = 'source_pair_sha256';
const PUBLISHER_ID = 'ersa-folder-importer-v1';
const PIPELINE_VERSION = 'folder-import-v1';
const REQUIRED_IMPORT_SCOPES = ['read_products', 'write_products', 'read_files', 'write_files'];
const DEFAULT_FILES_STATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'shopify-files.json');

const COLLECTION_SOURCE_FIELDS = `
  sources {
    __typename
    id
    title
    app { id }
    ... on CollectionConditionsSource {
      shareable
      targetType
      inclusion { conditions { __typename } }
    }
  }
`;

const QUERY_FOLDER_IMPORT_DRY_RUN_PREFLIGHT = `#graphql
query FolderImportDryRunPreflight($collectionIds: [ID!]!) {
  shop {
    name
    myshopifyDomain
  }
  appInstallation {
    accessScopes { handle }
  }
  metafieldDefinitions(
    first: 10
    ownerType: PRODUCT
    namespace: "${IDENTITY_NAMESPACE}"
    key: "${EXTERNAL_ID_KEY}"
  ) {
    nodes {
      id
      namespace
      key
      name
      type { name }
      capabilities { uniqueValues { enabled } }
    }
  }
  nodes(ids: $collectionIds) {
    __typename
    ... on Collection {
      id
      handle
      title
      updatedAt
      ${COLLECTION_SOURCE_FIELDS}
    }
  }
}
`;

const QUERY_FOLDER_IMPORT_PRODUCTS = `#graphql
query FolderImportProducts($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: ID) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      handle
      title
      status
      updatedAt
      externalId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${EXTERNAL_ID_KEY}") { value }
      publisherId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PUBLISHER_ID_KEY}") { value }
      requestHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${REQUEST_HASH_KEY}") { value }
      pairHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PAIR_HASH_KEY}") { value }
    }
  }
}
`;

const QUERY_FOLDER_IMPORT_PRODUCT_DETAILS = `#graphql
query FolderImportProductDetails($id: ID!) {
  node(id: $id) {
    __typename
    ... on Product {
      id
      handle
      title
      status
      media(first: 3) { nodes { id } }
      collections(first: 100) { nodes { id } }
    }
  }
}
`;

function assertApprovedContract({ manifest, approved, proposal }) {
  if (manifest?.schemaVersion !== 'folder-product-manifest-v1' || manifest?.summary?.blockingErrorCount !== 0) {
    throw new Error('Current folder product manifest is missing or blocked.');
  }
  if (approved?.schemaVersion !== 'folder-collection-map-approved-v1') {
    throw new Error('Approved folder collection map is missing or has an unsupported schema.');
  }
  if (proposal?.schemaVersion !== 'folder-collection-map-proposal-v1' || proposal?.summary?.gate !== 'PASS') {
    throw new Error('Collection proposal is missing or no longer PASS.');
  }
  if (
    approved.sourceManifestSha256 !== manifest.manifestSha256 ||
    proposal.sourceManifestSha256 !== manifest.manifestSha256
  ) {
    throw new Error('Folder manifest hash does not match the approved collection contract.');
  }
  if (approved.proposalSha256 !== calculateCollectionProposalHash(proposal)) {
    throw new Error('Approved collection proposal hash does not match the current proposal.');
  }

  const folders = (manifest.collections || []).map((collection) => collection.folder).sort();
  const approvedFolders = Object.keys(approved.mappings || {}).sort();
  if (stableStringify(folders) !== stableStringify(approvedFolders)) {
    throw new Error('Approved collection folders do not exactly match the current product folders.');
  }

  const gids = new Set();
  for (const folder of folders) {
    const target = approved.mappings[folder];
    const proposed = (proposal.mappings || []).find((mapping) => mapping.folder === folder)?.proposed;
    if (!target?.gid || !target?.handle || !target?.title) {
      throw new Error(`Approved mapping is incomplete for folder: ${folder}.`);
    }
    if (stableStringify(target) !== stableStringify(proposed)) {
      throw new Error(`Approved mapping differs from the PASS proposal for folder: ${folder}.`);
    }
    if (gids.has(target.gid)) {
      throw new Error(`Approved collection GID is assigned more than once: ${target.gid}.`);
    }
    gids.add(target.gid);
  }

  return folders.map((folder) => ({ folder, ...approved.mappings[folder] }));
}

function buildRequestContract(product, collectionTarget) {
  return {
    pipelineVersion: PIPELINE_VERSION,
    sourceKey: product.sourceKey,
    pairSha256: product.pairSha256,
    title: product.title,
    handle: product.proposedHandle,
    status: 'DRAFT',
    collection: {
      gid: collectionTarget.gid,
      handle: collectionTarget.handle,
      title: collectionTarget.title,
    },
    ownership: {
      namespace: IDENTITY_NAMESPACE,
      externalId: product.sourceKey,
      publisherId: PUBLISHER_ID,
    },
    media: (product.media || []).map((media) => ({
      role: media.role,
      sha256: media.sha256,
      path: media.path,
    })),
  };
}

function buildRequestHash(product, collectionTarget) {
  return sha256Text(stableStringify(buildRequestContract(product, collectionTarget)));
}

function normalizeLiveProduct(product) {
  return {
    gid: String(product?.id || ''),
    handle: String(product?.handle || ''),
    title: String(product?.title || ''),
    status: String(product?.status || ''),
    updatedAt: product?.updatedAt || null,
    externalId: String(product?.externalId?.value || ''),
    publisherId: String(product?.publisherId?.value || ''),
    requestHash: String(product?.requestHash?.value || ''),
    pairHash: String(product?.pairHash?.value || ''),
    mediaCount: Array.isArray(product?.media?.nodes) ? product.media.nodes.length : null,
    collectionGids: Array.isArray(product?.collections?.nodes)
      ? product.collections.nodes.map((collection) => collection.id)
      : [],
  };
}

function indexLiveProducts(products) {
  const byExternalId = new Map();
  const byHandle = new Map();
  for (const rawProduct of products || []) {
    const product = normalizeLiveProduct(rawProduct);
    if (product.externalId) {
      const matches = byExternalId.get(product.externalId) || [];
      matches.push(product);
      byExternalId.set(product.externalId, matches);
    }
    if (product.handle) {
      const matches = byHandle.get(product.handle) || [];
      matches.push(product);
      byHandle.set(product.handle, matches);
    }
  }
  return { byExternalId, byHandle };
}

function classifyProductDecision({ product, collectionTarget, requestHash, productsByExternalId, productsByHandle }) {
  const externalMatches = productsByExternalId.get(product.sourceKey) || [];
  const handleMatches = productsByHandle.get(product.proposedHandle) || [];

  if (externalMatches.length > 1) {
    return decision('BLOCKED', 'duplicate_external_id', null, { matchCount: externalMatches.length });
  }
  if (handleMatches.length > 1) {
    return decision('BLOCKED', 'duplicate_handle_match', null, { matchCount: handleMatches.length });
  }

  const ownedCandidate = externalMatches[0] || null;
  const handleCandidate = handleMatches[0] || null;
  if (ownedCandidate && handleCandidate && ownedCandidate.gid !== handleCandidate.gid) {
    return decision('BLOCKED', 'handle_owned_by_different_product', ownedCandidate, {
      conflictingProductGid: handleCandidate.gid,
    });
  }

  if (ownedCandidate) {
    if (ownedCandidate.publisherId !== PUBLISHER_ID) {
      return decision('BLOCKED', 'ownership_marker_mismatch', ownedCandidate);
    }
    if (ownedCandidate.status !== 'DRAFT') {
      return decision('BLOCKED', 'owned_product_is_not_draft', ownedCandidate);
    }

    const unchanged =
      ownedCandidate.requestHash === requestHash &&
      ownedCandidate.pairHash === product.pairSha256 &&
      ownedCandidate.handle === product.proposedHandle &&
      ownedCandidate.title === product.title &&
      ownedCandidate.mediaCount === 2 &&
      ownedCandidate.collectionGids.includes(collectionTarget.gid);
    return unchanged
      ? decision('SKIP_UNCHANGED', 'owned_draft_matches_request', ownedCandidate)
      : decision('UPDATE', 'owned_draft_requires_reconcile', ownedCandidate);
  }

  if (handleCandidate) {
    return decision('BLOCKED', 'foreign_handle_collision', handleCandidate);
  }

  return decision('CREATE', 'no_existing_identity_or_handle', null);
}

function decision(action, reason, existingProduct, details = {}) {
  return { action, reason, existingProduct, details };
}

function buildMediaPlan(manifest, filesState) {
  const readyBySha = new Map();
  for (const file of filesState?.files || []) {
    if (file?.sha256 && file?.fileGid && file?.fileStatus === 'READY') {
      readyBySha.set(file.sha256, file);
    }
  }

  const references = [];
  const uniqueBySha = new Map();
  for (const product of manifest.products || []) {
    for (const media of product.media || []) {
      const ready = readyBySha.get(media.sha256);
      const record = {
        sourceKey: product.sourceKey,
        role: media.role,
        path: media.path,
        sha256: media.sha256,
        bytes: media.bytes,
        action: ready ? 'REUSE_CHECKPOINT' : 'UPLOAD',
        fileGid: ready?.fileGid || null,
      };
      references.push(record);
      if (!uniqueBySha.has(media.sha256)) uniqueBySha.set(media.sha256, record);
    }
  }

  const unique = Array.from(uniqueBySha.values());
  return {
    references,
    summary: {
      mediaReferenceCount: references.length,
      uniqueMediaHashCount: unique.length,
      uploadCount: unique.filter((media) => media.action === 'UPLOAD').length,
      reuseCheckpointCount: unique.filter((media) => media.action === 'REUSE_CHECKPOINT').length,
    },
  };
}

async function fetchAllProducts({ graphql, pageSize = 100 }) {
  const products = [];
  let after = null;
  do {
    const data = await graphql(QUERY_FOLDER_IMPORT_PRODUCTS, { first: pageSize, after });
    const connection = data?.products;
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
      throw new Error('Shopify product inventory query returned an invalid connection.');
    }
    products.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) {
      throw new Error('Shopify product inventory pagination did not advance.');
    }
    after = connection.pageInfo.endCursor;
  } while (true);
  return products;
}

async function enrichOwnedProducts({ graphql, products, sourceKeys }) {
  const sourceKeySet = new Set(sourceKeys);
  const matched = products.filter((product) => sourceKeySet.has(String(product?.externalId?.value || '')));
  const detailsById = new Map();
  await mapLimit(matched, 4, async (product) => {
    const data = await graphql(QUERY_FOLDER_IMPORT_PRODUCT_DETAILS, { id: product.id });
    if (data?.node?.__typename !== 'Product') {
      throw new Error(`Shopify product detail lookup failed for ${product.id}.`);
    }
    detailsById.set(product.id, data.node);
  });
  return products.map((product) => ({ ...product, ...(detailsById.get(product.id) || {}) }));
}

function validateLivePreflight({ preflight, expectedStoreDomain, mappings }) {
  const blockingErrors = [];
  const liveDomain = normalizeStoreDomain(preflight?.shop?.myshopifyDomain);
  if (liveDomain !== normalizeStoreDomain(expectedStoreDomain)) {
    blockingErrors.push({ code: 'STORE_DOMAIN_MISMATCH', message: `Expected ${expectedStoreDomain}, received ${liveDomain}.` });
  }

  const grantedScopes = (preflight?.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missingScopes = REQUIRED_IMPORT_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  if (missingScopes.length) {
    blockingErrors.push({ code: 'MISSING_IMPORT_SCOPES', message: `Missing scopes: ${missingScopes.join(', ')}.` });
  }

  const definitions = preflight?.metafieldDefinitions?.nodes || [];
  const definition = definitions.find(
    (item) => item.namespace === IDENTITY_NAMESPACE && item.key === EXTERNAL_ID_KEY
  );
  if (!definition) {
    blockingErrors.push({
      code: 'IDENTITY_DEFINITION_MISSING',
      message: `Missing unique PRODUCT metafield definition ${IDENTITY_NAMESPACE}.${EXTERNAL_ID_KEY}.`,
    });
  } else {
    if (definition.type?.name !== 'id') {
      blockingErrors.push({ code: 'IDENTITY_DEFINITION_TYPE_INVALID', message: 'External ID definition must be id for Shopify custom-ID lookups.' });
    }
    if (definition.capabilities?.uniqueValues?.enabled !== true) {
      blockingErrors.push({ code: 'IDENTITY_DEFINITION_NOT_UNIQUE', message: 'External ID definition must enable unique values.' });
    }
  }

  const nodesById = new Map((preflight?.nodes || []).filter(Boolean).map((node) => [node.id, node]));
  const collectionChecks = mappings.map((mapping) => {
    const live = nodesById.get(mapping.gid);
    const classification = live?.__typename === 'Collection' ? classifyCollection(live) : null;
    const pass =
      live?.__typename === 'Collection' &&
      live.handle === mapping.handle &&
      classification?.manualAssignable === true;
    if (!pass) {
      blockingErrors.push({
        code: 'COLLECTION_MAPPING_DRIFT',
        message: `Live collection no longer matches approved target for folder ${mapping.folder}.`,
      });
    }
    return {
      folder: mapping.folder,
      expected: { gid: mapping.gid, handle: mapping.handle, title: mapping.title },
      live: live
        ? { gid: live.id, handle: live.handle, title: live.title, ...classification }
        : null,
      status: pass ? 'PASS' : 'BLOCKED',
    };
  });

  return {
    blockingErrors,
    scopes: { required: REQUIRED_IMPORT_SCOPES, granted: grantedScopes, missing: missingScopes },
    identityDefinition: definition
      ? {
          id: definition.id,
          namespace: definition.namespace,
          key: definition.key,
          type: definition.type?.name || '',
          uniqueValuesEnabled: definition.capabilities?.uniqueValues?.enabled === true,
        }
      : null,
    collectionChecks,
  };
}

async function buildFolderDryRun({
  graphql,
  manifest,
  approved,
  proposal,
  filesState = null,
  expectedStoreDomain,
  generatedAt = new Date().toISOString(),
}) {
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  const preflight = await graphql(QUERY_FOLDER_IMPORT_DRY_RUN_PREFLIGHT, {
    collectionIds: mappings.map((mapping) => mapping.gid),
  });
  const liveChecks = validateLivePreflight({ preflight, expectedStoreDomain, mappings });
  const rawProducts = await fetchAllProducts({ graphql });
  const liveProducts = await enrichOwnedProducts({
    graphql,
    products: rawProducts,
    sourceKeys: manifest.products.map((product) => product.sourceKey),
  });
  const productIndex = indexLiveProducts(liveProducts);
  const mediaPlan = buildMediaPlan(manifest, filesState);
  const mappingByFolder = new Map(mappings.map((mapping) => [mapping.folder, mapping]));
  const mediaBySourceKey = new Map();
  for (const media of mediaPlan.references) {
    const records = mediaBySourceKey.get(media.sourceKey) || [];
    records.push(media);
    mediaBySourceKey.set(media.sourceKey, records);
  }

  const items = manifest.products.map((product) => {
    const collectionTarget = mappingByFolder.get(product.collectionFolder);
    const requestHash = buildRequestHash(product, collectionTarget);
    const result = classifyProductDecision({
      product,
      collectionTarget,
      requestHash,
      productsByExternalId: productIndex.byExternalId,
      productsByHandle: productIndex.byHandle,
    });
    return {
      sourceKey: product.sourceKey,
      decision: result.action,
      reason: result.reason,
      title: product.title,
      handle: product.proposedHandle,
      collectionFolder: product.collectionFolder,
      collectionGid: collectionTarget.gid,
      pairSha256: product.pairSha256,
      requestHash,
      existingProduct: result.existingProduct,
      details: result.details,
      media: mediaBySourceKey.get(product.sourceKey) || [],
    };
  });

  const decisionCounts = items.reduce((counts, item) => {
    counts[item.decision] = (counts[item.decision] || 0) + 1;
    return counts;
  }, {});
  const productBlockingErrors = items
    .filter((item) => item.decision === 'BLOCKED')
    .map((item) => ({ code: 'PRODUCT_CONFLICT', sourceKey: item.sourceKey, message: item.reason }));
  const blockingErrors = [...liveChecks.blockingErrors, ...productBlockingErrors];

  return sealDryRunReport({
    schemaVersion: 'folder-import-dry-run-v1',
    generatedAt,
    apiVersion: constants.apiVersion,
    mode: {
      shopifyReadOnly: true,
      productMutations: false,
      fileMutations: false,
      collectionMutations: false,
      publicationMutations: false,
    },
    gate: blockingErrors.length === 0 ? 'PASS' : 'BLOCKED',
    sourceManifestSha256: manifest.manifestSha256,
    approvedProposalSha256: approved.proposalSha256,
    shop: preflight.shop,
    preflight: liveChecks,
    summary: {
      inputProductCount: manifest.products.length,
      liveProductCount: liveProducts.length,
      createCount: decisionCounts.CREATE || 0,
      updateCount: decisionCounts.UPDATE || 0,
      skipUnchangedCount: decisionCounts.SKIP_UNCHANGED || 0,
      blockedProductCount: decisionCounts.BLOCKED || 0,
      globalBlockingErrorCount: liveChecks.blockingErrors.length,
      ...mediaPlan.summary,
    },
    blockingErrors,
    items,
  });
}

async function runFolderDryRun({
  graphql,
  manifest,
  expectedStoreDomain,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  filesStatePath = DEFAULT_FILES_STATE_PATH,
  outputRoot = DEFAULT_OUTPUT_ROOT,
} = {}) {
  const [approved, proposal, filesState] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(filesStatePath),
  ]);
  const report = await buildFolderDryRun({
    graphql,
    manifest,
    approved,
    proposal,
    filesState,
    expectedStoreDomain,
  });
  const artifacts = await writeDryRunArtifacts({ report, outputRoot });
  return { report, ...artifacts };
}

async function mapLimit(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Number(concurrency) || 1) }, worker));
  return results;
}

module.exports = {
  DEFAULT_FILES_STATE_PATH,
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  PAIR_HASH_KEY,
  PIPELINE_VERSION,
  PUBLISHER_ID,
  PUBLISHER_ID_KEY,
  QUERY_FOLDER_IMPORT_DRY_RUN_PREFLIGHT,
  QUERY_FOLDER_IMPORT_PRODUCTS,
  QUERY_FOLDER_IMPORT_PRODUCT_DETAILS,
  REQUEST_HASH_KEY,
  REQUIRED_IMPORT_SCOPES,
  assertApprovedContract,
  buildFolderDryRun,
  buildMediaPlan,
  buildRequestContract,
  buildRequestHash,
  classifyProductDecision,
  fetchAllProducts,
  indexLiveProducts,
  normalizeLiveProduct,
  runFolderDryRun,
  validateLivePreflight,
};
