const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const { discoverFolderCollections } = require('./collection-map.cjs');

const IDENTITY_NAMESPACE = 'ersa_automation';
const EXTERNAL_ID_KEY = 'external_id';
const IDENTITY_TYPE = 'id';
const REQUIRED_SETUP_SCOPES = ['read_products', 'write_products'];
const COLLECTION_TARGETS = Object.freeze({
  '3d': Object.freeze({ title: '3D', handle: '3d' }),
  cute: Object.freeze({ title: 'Cute', handle: 'cute' }),
  'nail art': Object.freeze({ title: 'Nail Art', handle: 'nail-art' }),
  y2k: Object.freeze({ title: 'Y2K', handle: 'y2k' }),
});

const QUERY_FOLDER_IMPORT_SETUP_PREFLIGHT = `#graphql
query FolderImportSetupPreflight {
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
      metafieldsCount
      capabilities { uniqueValues { enabled } }
    }
  }
}
`;

const MUTATION_FOLDER_IMPORT_COLLECTION_CREATE = `#graphql
mutation FolderImportCollectionCreate($collection: CollectionCreateInput!) {
  collectionCreate(collection: $collection) {
    collection {
      id
      handle
      title
      updatedAt
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
    }
    userErrors { field message }
  }
}
`;

const MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE = `#graphql
mutation FolderImportIdentityDefinitionCreate($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    createdDefinition {
      id
      namespace
      key
      name
      type { name }
      capabilities { uniqueValues { enabled } }
    }
    userErrors { field message code }
  }
}
`;

const MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE = `#graphql
mutation FolderImportIdentityDefinitionDelete($id: ID!) {
  metafieldDefinitionDelete(id: $id, deleteAllAssociatedMetafields: false) {
    deletedDefinitionId
    userErrors { field message code }
  }
}
`;

function expectedCollectionTargets(manifest) {
  const folders = (manifest?.collections || []).map((collection) => String(collection?.folder || '')).filter(Boolean);
  const expectedFolders = Object.keys(COLLECTION_TARGETS);
  if (folders.length !== expectedFolders.length || folders.some((folder) => !COLLECTION_TARGETS[folder])) {
    throw new Error(
      `Store setup is restricted to the approved folders: ${expectedFolders.join(', ')}.`
    );
  }
  return folders.map((folder) => ({ folder, ...COLLECTION_TARGETS[folder] }));
}

function inspectIdentityDefinition(definitions) {
  const definition = (definitions || []).find(
    (item) => item?.namespace === IDENTITY_NAMESPACE && item?.key === EXTERNAL_ID_KEY
  );
  if (!definition) return { action: 'CREATE', status: 'READY', definition: null, errors: [] };

  const errors = [];
  if (
    definition.type?.name === 'single_line_text_field' &&
    definition.capabilities?.uniqueValues?.enabled === true &&
    definition.metafieldsCount === 0
  ) {
    return {
      action: 'RECREATE_LEGACY_TYPE',
      status: 'READY',
      definition,
      errors: [],
    };
  }
  if (definition.type?.name !== IDENTITY_TYPE) {
    errors.push(`existing definition type must be ${IDENTITY_TYPE}`);
  }
  if (definition.capabilities?.uniqueValues?.enabled !== true) {
    errors.push('existing definition must enable unique values');
  }
  return {
    action: errors.length ? 'BLOCKED' : 'REUSE',
    status: errors.length ? 'BLOCKED' : 'READY',
    definition,
    errors,
  };
}

function buildStoreSetupPlan({ manifest, proposal, preflight, expectedStoreDomain }) {
  const liveDomain = normalizeStoreDomain(preflight?.shop?.myshopifyDomain);
  const expectedDomain = normalizeStoreDomain(expectedStoreDomain);
  const blockingErrors = [];
  if (!liveDomain || liveDomain !== expectedDomain) {
    blockingErrors.push(`Shopify store mismatch: expected ${expectedDomain}, received ${liveDomain || '(missing)'}.`);
  }

  const grantedScopes = (preflight?.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missingScopes = REQUIRED_SETUP_SCOPES.filter((scope) => !grantedScopes.includes(scope));
  if (missingScopes.length) blockingErrors.push(`Missing setup scopes: ${missingScopes.join(', ')}.`);

  const targets = expectedCollectionTargets(manifest);
  const proposalByFolder = new Map((proposal?.mappings || []).map((mapping) => [mapping.folder, mapping]));
  const collectionPlan = targets.map((target) => {
    const mapping = proposalByFolder.get(target.folder);
    if (!mapping) {
      blockingErrors.push(`Missing discovery result for folder ${target.folder}.`);
      return { ...target, action: 'BLOCKED', reason: 'missing_discovery_result' };
    }
    if (mapping.status === 'MISSING') {
      return { ...target, action: 'CREATE', reason: 'exact_target_missing' };
    }
    if (
      mapping.status === 'PASS' &&
      mapping.proposed?.handle === target.handle
    ) {
      return {
        ...target,
        title: mapping.proposed.title,
        action: 'REUSE',
        reason: 'exact_manual_handle_exists',
        gid: mapping.proposed.gid,
      };
    }

    blockingErrors.push(`Collection target ${target.folder} is ${mapping.status} or has an unexpected handle.`);
    return { ...target, action: 'BLOCKED', reason: mapping.reason || 'unexpected_existing_collection' };
  });

  const identityPlan = inspectIdentityDefinition(preflight?.metafieldDefinitions?.nodes || []);
  blockingErrors.push(...identityPlan.errors.map((error) => `Identity definition: ${error}.`));

  return {
    shop: preflight?.shop || null,
    scopes: { required: REQUIRED_SETUP_SCOPES, granted: grantedScopes, missing: missingScopes },
    collections: collectionPlan,
    identityDefinition: identityPlan,
    blockingErrors,
    gate: blockingErrors.length ? 'BLOCKED' : 'READY',
  };
}

function assertNoUserErrors(payload, operation) {
  const errors = payload?.userErrors || [];
  if (errors.length) {
    throw new Error(`${operation} failed: ${errors.map((error) => error.message).join('; ')}`);
  }
}

async function createIdentityDefinition(graphql) {
  const data = await graphql(MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE, {
    definition: {
      name: 'Ersa Import External ID',
      namespace: IDENTITY_NAMESPACE,
      key: EXTERNAL_ID_KEY,
      description: 'Stable source identity used by the authorized Ersa folder product importer.',
      ownerType: 'PRODUCT',
      type: IDENTITY_TYPE,
      capabilities: { uniqueValues: { enabled: true } },
    },
  });
  const payload = data?.metafieldDefinitionCreate;
  assertNoUserErrors(payload, 'metafieldDefinitionCreate');
  if (!payload?.createdDefinition?.id) throw new Error('metafieldDefinitionCreate did not return a definition.');
  return payload.createdDefinition;
}

async function deleteEmptyLegacyIdentityDefinition(graphql, definition) {
  if (
    !definition?.id ||
    definition.namespace !== IDENTITY_NAMESPACE ||
    definition.key !== EXTERNAL_ID_KEY ||
    definition.type?.name !== 'single_line_text_field' ||
    definition.metafieldsCount !== 0
  ) {
    throw new Error('Refusing to delete an identity definition that is not the exact empty legacy definition.');
  }
  const data = await graphql(MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE, { id: definition.id });
  const payload = data?.metafieldDefinitionDelete;
  assertNoUserErrors(payload, 'metafieldDefinitionDelete');
  if (payload?.deletedDefinitionId !== definition.id) {
    throw new Error('metafieldDefinitionDelete did not return the expected definition ID.');
  }
  return payload.deletedDefinitionId;
}

async function createManualCollection(graphql, target) {
  const data = await graphql(MUTATION_FOLDER_IMPORT_COLLECTION_CREATE, {
    collection: { title: target.title, handle: target.handle },
  });
  const payload = data?.collectionCreate;
  assertNoUserErrors(payload, `collectionCreate(${target.handle})`);
  const collection = payload?.collection;
  if (!collection?.id || collection.handle !== target.handle || collection.title !== target.title) {
    throw new Error(`collectionCreate(${target.handle}) returned an unexpected collection.`);
  }
  return collection;
}

async function prepareFolderImportStore({
  graphql,
  manifest,
  expectedStoreDomain,
  confirmMutations = false,
}) {
  if (typeof graphql !== 'function') throw new Error('prepareFolderImportStore requires a GraphQL function.');
  const preflight = await graphql(QUERY_FOLDER_IMPORT_SETUP_PREFLIGHT);
  const proposal = await discoverFolderCollections({ graphql, manifest, expectedStoreDomain });
  const plan = buildStoreSetupPlan({ manifest, proposal, preflight, expectedStoreDomain });

  if (!confirmMutations) return { mode: 'PLAN_ONLY', plan, mutations: [] };
  if (plan.gate !== 'READY') {
    throw new Error(`Store setup is blocked: ${plan.blockingErrors.join(' ')}`);
  }

  const mutations = [];
  if (plan.identityDefinition.action === 'RECREATE_LEGACY_TYPE') {
    const legacyDefinition = plan.identityDefinition.definition;
    await deleteEmptyLegacyIdentityDefinition(graphql, legacyDefinition);
    mutations.push({ type: 'IDENTITY_DEFINITION_DELETED', gid: legacyDefinition.id, reason: 'empty_legacy_type' });
    const definition = await createIdentityDefinition(graphql);
    mutations.push({ type: 'IDENTITY_DEFINITION_CREATED', gid: definition.id, metafieldType: IDENTITY_TYPE });
  }
  if (plan.identityDefinition.action === 'CREATE') {
    const definition = await createIdentityDefinition(graphql);
    mutations.push({ type: 'IDENTITY_DEFINITION_CREATED', gid: definition.id, metafieldType: IDENTITY_TYPE });
  }
  for (const target of plan.collections.filter((collection) => collection.action === 'CREATE')) {
    const collection = await createManualCollection(graphql, target);
    mutations.push({ type: 'COLLECTION_CREATED', folder: target.folder, gid: collection.id, handle: collection.handle });
  }

  const verificationPreflight = await graphql(QUERY_FOLDER_IMPORT_SETUP_PREFLIGHT);
  const verificationProposal = await discoverFolderCollections({ graphql, manifest, expectedStoreDomain });
  const verification = buildStoreSetupPlan({
    manifest,
    proposal: verificationProposal,
    preflight: verificationPreflight,
    expectedStoreDomain,
  });
  if (verification.gate !== 'READY' || verification.collections.some((item) => item.action !== 'REUSE')) {
    throw new Error(`Store setup verification failed: ${verification.blockingErrors.join(' ')}`);
  }
  if (verification.identityDefinition.action !== 'REUSE') {
    throw new Error('Store setup verification did not find the unique external ID definition.');
  }

  return { mode: 'MUTATED_AND_VERIFIED', plan, mutations, verification };
}

module.exports = {
  COLLECTION_TARGETS,
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  IDENTITY_TYPE,
  MUTATION_FOLDER_IMPORT_COLLECTION_CREATE,
  MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE,
  MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE,
  QUERY_FOLDER_IMPORT_SETUP_PREFLIGHT,
  REQUIRED_SETUP_SCOPES,
  buildStoreSetupPlan,
  createIdentityDefinition,
  createManualCollection,
  deleteEmptyLegacyIdentityDefinition,
  expectedCollectionTargets,
  inspectIdentityDefinition,
  prepareFolderImportStore,
};
