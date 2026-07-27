const path = require('node:path');

const { paths } = require('../config.cjs');
const { readJsonIfExists, writeJson } = require('../fs-utils.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { normalizeFolderSlug } = require('./scan.cjs');

const DEFAULT_PROPOSED_MAP_PATH = path.join(paths.toolingRoot, 'config', 'folder-collection-map.proposed.json');
const DEFAULT_APPROVED_MAP_PATH = path.join(paths.toolingRoot, 'config', 'folder-collection-map.approved.json');

const QUERY_FOLDER_IMPORT_COLLECTIONS = `#graphql
query FolderImportCollectionDiscovery($first: Int!, $after: String) {
  shop {
    name
    myshopifyDomain
  }
  collections(first: $first, after: $after, sortKey: TITLE) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      handle
      title
      updatedAt
      sources {
        __typename
        id
        title
        app {
          id
        }
        ... on CollectionConditionsSource {
          shareable
          targetType
          inclusion {
            conditions {
              __typename
            }
          }
        }
      }
    }
  }
}
`;

function normalizeLookupText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function classifyCollection(collection) {
  const sources = Array.isArray(collection?.sources) ? collection.sources : [];
  if (!sources.length) {
    return { membershipType: 'MANUAL', manualAssignable: true, reason: 'no_automatic_sources' };
  }

  if (sources.some((source) => source?.__typename !== 'CollectionConditionsSource')) {
    return { membershipType: 'COMPOSED', manualAssignable: false, reason: 'unsupported_source_type' };
  }

  if (sources.some((source) => source?.targetType !== 'PRODUCTS')) {
    return { membershipType: 'VARIANT_OR_UNKNOWN', manualAssignable: false, reason: 'source_target_is_not_products' };
  }

  const conditionCount = sources.reduce(
    (sum, source) => sum + (Array.isArray(source?.inclusion?.conditions) ? source.inclusion.conditions.length : 0),
    0
  );
  if (conditionCount > 0) {
    return { membershipType: 'AUTOMATIC', manualAssignable: false, reason: 'automatic_conditions_present' };
  }

  if (sources.some((source) => source?.shareable && source?.app?.id)) {
    return { membershipType: 'APP_MANAGED', manualAssignable: false, reason: 'shareable_app_managed_source' };
  }

  return { membershipType: 'MANUAL', manualAssignable: true, reason: 'manual_product_selections_only' };
}

function sanitizeCollection(collection) {
  const classification = classifyCollection(collection);
  return {
    gid: String(collection?.id || ''),
    handle: String(collection?.handle || ''),
    title: String(collection?.title || ''),
    updatedAt: collection?.updatedAt || null,
    ...classification,
  };
}

function exactCollectionCandidates(folder, collections) {
  const folderHandle = normalizeFolderSlug(folder);
  const folderText = normalizeLookupText(folder);
  return collections.filter(
    (collection) =>
      String(collection.handle || '').toLowerCase() === folderHandle || normalizeLookupText(collection.title) === folderText
  );
}

function proposeFolderMapping(folder, collections) {
  const exactCandidates = exactCollectionCandidates(folder, collections).map(sanitizeCollection);
  const eligible = exactCandidates.filter((collection) => collection.manualAssignable);
  let status = 'MISSING';
  let reason = 'no_exact_handle_or_title_match';
  let proposed = null;

  if (exactCandidates.length > 1) {
    status = 'AMBIGUOUS';
    reason = 'multiple_exact_handle_or_title_matches';
  } else if (exactCandidates.length === 1 && eligible.length === 0) {
    status = 'BLOCKED_NON_MANUAL';
    reason = exactCandidates[0].reason;
  } else if (eligible.length === 1) {
    status = 'PASS';
    reason = 'unique_exact_manual_collection_match';
    proposed = {
      gid: eligible[0].gid,
      handle: eligible[0].handle,
      title: eligible[0].title,
    };
  }

  return {
    folder,
    folderSlug: normalizeFolderSlug(folder),
    status,
    reason,
    proposed,
    exactCandidates,
  };
}

async function fetchAllCollections({ graphql, pageSize = 100 }) {
  const collections = [];
  let after = null;
  let shop = null;

  do {
    const data = await graphql(QUERY_FOLDER_IMPORT_COLLECTIONS, { first: pageSize, after });
    shop = shop || data?.shop || null;
    const connection = data?.collections;
    if (!connection || !Array.isArray(connection.nodes) || !connection.pageInfo) {
      throw new Error('Shopify collection discovery returned an invalid collections connection.');
    }
    collections.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) break;
    if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) {
      throw new Error('Shopify collection discovery pagination did not advance.');
    }
    after = connection.pageInfo.endCursor;
  } while (true);

  return { shop, collections };
}

async function discoverFolderCollections({ graphql, manifest, expectedStoreDomain = '', pageSize = 100 }) {
  if (typeof graphql !== 'function') throw new Error('discoverFolderCollections requires a GraphQL query function.');
  const folders = (manifest?.collections || []).map((collection) => String(collection.folder || '')).filter(Boolean);
  if (!folders.length) throw new Error('Folder manifest does not contain any collection folders.');

  const discovery = await fetchAllCollections({ graphql, pageSize });
  const liveDomain = normalizeStoreDomain(discovery.shop?.myshopifyDomain);
  const expectedDomain = normalizeStoreDomain(expectedStoreDomain);
  if (expectedDomain && liveDomain !== expectedDomain) {
    throw new Error(`Shopify store mismatch: expected ${expectedDomain}, received ${liveDomain || '(missing)'}.`);
  }

  const mappings = folders.map((folder) => proposeFolderMapping(folder, discovery.collections));
  const statusCounts = mappings.reduce((counts, mapping) => {
    counts[mapping.status] = (counts[mapping.status] || 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 'folder-collection-map-proposal-v1',
    generatedAt: new Date().toISOString(),
    mode: {
      shopifyReadOnly: true,
      productMutations: false,
      collectionMutations: false,
      publicationMutations: false,
    },
    sourceManifestSha256: manifest.manifestSha256 || null,
    shop: discovery.shop,
    summary: {
      folderCount: folders.length,
      liveCollectionCount: discovery.collections.length,
      passCount: statusCounts.PASS || 0,
      missingCount: statusCounts.MISSING || 0,
      ambiguousCount: statusCounts.AMBIGUOUS || 0,
      blockedNonManualCount: statusCounts.BLOCKED_NON_MANUAL || 0,
      gate: (statusCounts.PASS || 0) === folders.length ? 'PASS' : 'BLOCKED',
    },
    mappings,
    discoveredCollections: discovery.collections.map(sanitizeCollection),
  };
}

async function runCollectionDiscovery({
  graphql,
  manifest,
  expectedStoreDomain = '',
  outputPath = DEFAULT_PROPOSED_MAP_PATH,
} = {}) {
  const proposal = await discoverFolderCollections({ graphql, manifest, expectedStoreDomain });
  await writeJson(outputPath, proposal);
  return { proposal, outputPath };
}

function buildApprovedCollectionMap({ proposal, currentManifestSha256, approvedAt = new Date().toISOString() }) {
  if (proposal?.summary?.gate !== 'PASS') {
    throw new Error('Collection proposal gate must be PASS before approval.');
  }
  if (!currentManifestSha256 || proposal.sourceManifestSha256 !== currentManifestSha256) {
    throw new Error('Collection proposal manifest hash does not match the current folder manifest.');
  }

  const proposalMappings = Array.isArray(proposal.mappings) ? proposal.mappings : [];
  if (!proposalMappings.length || proposalMappings.length !== proposal.summary.folderCount) {
    throw new Error('Collection proposal mappings are missing or incomplete.');
  }

  const mappings = {};
  const assignedGids = new Set();
  for (const mapping of proposalMappings) {
    const folder = String(mapping?.folder || '').trim();
    const target = mapping?.proposed;
    if (mapping?.status !== 'PASS' || !folder || !target?.gid || !target?.handle || !target?.title) {
      throw new Error(`Collection mapping is not approvable: ${folder || '(missing folder)'}.`);
    }
    if (assignedGids.has(target.gid)) {
      throw new Error(`Shopify collection is assigned to more than one folder: ${target.gid}.`);
    }
    assignedGids.add(target.gid);
    mappings[folder] = {
      gid: target.gid,
      handle: target.handle,
      title: target.title,
    };
  }

  return {
    schemaVersion: 'folder-collection-map-approved-v1',
    approvedAt,
    approvalMode: 'explicit-confirmation',
    proposalSha256: calculateCollectionProposalHash(proposal),
    sourceManifestSha256: proposal.sourceManifestSha256,
    shop: proposal.shop,
    mappings,
  };
}

function calculateCollectionProposalHash(proposal) {
  return sha256Text(
    stableStringify({
      schemaVersion: proposal?.schemaVersion || '',
      sourceManifestSha256: proposal?.sourceManifestSha256 || '',
      shopDomain: normalizeStoreDomain(proposal?.shop?.myshopifyDomain),
      mappings: (proposal?.mappings || []).map((mapping) => ({
        folder: mapping?.folder || '',
        status: mapping?.status || '',
        proposed: mapping?.proposed || null,
      })),
    })
  );
}

async function runCollectionMapApproval({
  currentManifestSha256,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  outputPath = DEFAULT_APPROVED_MAP_PATH,
} = {}) {
  const proposal = await readJsonIfExists(proposalPath);
  if (!proposal) throw new Error(`Missing collection proposal: ${proposalPath}`);
  const approved = buildApprovedCollectionMap({ proposal, currentManifestSha256 });
  await writeJson(outputPath, approved);
  return { approved, outputPath };
}

module.exports = {
  DEFAULT_APPROVED_MAP_PATH,
  DEFAULT_PROPOSED_MAP_PATH,
  QUERY_FOLDER_IMPORT_COLLECTIONS,
  buildApprovedCollectionMap,
  calculateCollectionProposalHash,
  classifyCollection,
  discoverFolderCollections,
  exactCollectionCandidates,
  fetchAllCollections,
  normalizeLookupText,
  proposeFolderMapping,
  runCollectionMapApproval,
  runCollectionDiscovery,
  sanitizeCollection,
};
