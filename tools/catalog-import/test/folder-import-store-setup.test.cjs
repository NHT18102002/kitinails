const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MUTATION_FOLDER_IMPORT_COLLECTION_CREATE,
  MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE,
  MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE,
  buildStoreSetupPlan,
  inspectIdentityDefinition,
  prepareFolderImportStore,
} = require('../src/folder-import/store-setup.cjs');

const manifest = {
  collections: [{ folder: '3d' }, { folder: 'cute' }, { folder: 'nail art' }, { folder: 'y2k' }],
};

function preflight(definitions = []) {
  return {
    shop: { name: 'My Store', myshopifyDomain: 'target.myshopify.com' },
    appInstallation: { accessScopes: [{ handle: 'read_products' }, { handle: 'write_products' }] },
    metafieldDefinitions: { nodes: definitions },
  };
}

function missingProposal() {
  return {
    mappings: manifest.collections.map(({ folder }) => ({
      folder,
      status: 'MISSING',
      reason: 'no_exact_handle_or_title_match',
    })),
  };
}

test('store setup plan creates only the four approved manual targets and unique identity definition', () => {
  const plan = buildStoreSetupPlan({
    manifest,
    proposal: missingProposal(),
    preflight: preflight(),
    expectedStoreDomain: 'target.myshopify.com',
  });
  assert.equal(plan.gate, 'READY');
  assert.deepEqual(
    plan.collections.map(({ folder, title, handle, action }) => ({ folder, title, handle, action })),
    [
      { folder: '3d', title: '3D', handle: '3d', action: 'CREATE' },
      { folder: 'cute', title: 'Cute', handle: 'cute', action: 'CREATE' },
      { folder: 'nail art', title: 'Nail Art', handle: 'nail-art', action: 'CREATE' },
      { folder: 'y2k', title: 'Y2K', handle: 'y2k', action: 'CREATE' },
    ]
  );
  assert.equal(plan.identityDefinition.action, 'CREATE');
});

test('store setup blocks drifted collection targets and invalid existing definition', () => {
  const proposal = missingProposal();
  proposal.mappings[0] = {
    folder: '3d',
    status: 'PASS',
    proposed: { gid: 'gid://shopify/Collection/1', handle: 'other', title: '3D' },
  };
  const invalidDefinition = {
    id: 'gid://shopify/MetafieldDefinition/1',
    namespace: 'ersa_automation',
    key: 'external_id',
    type: { name: 'number_integer' },
    capabilities: { uniqueValues: { enabled: false } },
  };
  const plan = buildStoreSetupPlan({
    manifest,
    proposal,
    preflight: preflight([invalidDefinition]),
    expectedStoreDomain: 'target.myshopify.com',
  });
  assert.equal(plan.gate, 'BLOCKED');
  assert.equal(plan.collections[0].action, 'BLOCKED');
  assert.equal(inspectIdentityDefinition([invalidDefinition]).action, 'BLOCKED');
});

test('store setup reuses the exact manual handle after a merchant title rename', () => {
  const proposal = missingProposal();
  proposal.mappings[0] = {
    folder: '3d',
    status: 'PASS',
    proposed: { gid: 'gid://shopify/Collection/1', handle: '3d', title: '3D Nails' },
  };
  const definition = {
    id: 'gid://shopify/MetafieldDefinition/1',
    namespace: 'ersa_automation',
    key: 'external_id',
    type: { name: 'id' },
    capabilities: { uniqueValues: { enabled: true } },
  };
  const plan = buildStoreSetupPlan({
    manifest,
    proposal,
    preflight: preflight([definition]),
    expectedStoreDomain: 'target.myshopify.com',
  });
  assert.equal(plan.gate, 'READY');
  assert.deepEqual(plan.collections[0], {
    folder: '3d',
    title: '3D Nails',
    handle: '3d',
    action: 'REUSE',
    reason: 'exact_manual_handle_exists',
    gid: 'gid://shopify/Collection/1',
  });
});

test('store setup safely recreates only an empty unique legacy external ID definition', () => {
  const legacyDefinition = {
    id: 'gid://shopify/MetafieldDefinition/1',
    namespace: 'ersa_automation',
    key: 'external_id',
    type: { name: 'single_line_text_field' },
    metafieldsCount: 0,
    capabilities: { uniqueValues: { enabled: true } },
  };
  assert.equal(inspectIdentityDefinition([legacyDefinition]).action, 'RECREATE_LEGACY_TYPE');
  assert.equal(inspectIdentityDefinition([{ ...legacyDefinition, metafieldsCount: 1 }]).action, 'BLOCKED');
});

test('store setup requires explicit mutation confirmation', async () => {
  const calls = [];
  const graphql = async (document) => {
    calls.push(document);
    if (document.includes('SetupPreflight')) return preflight();
    return {
      shop: { name: 'My Store', myshopifyDomain: 'target.myshopify.com' },
      collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    };
  };
  const result = await prepareFolderImportStore({
    graphql,
    manifest,
    expectedStoreDomain: 'target.myshopify.com',
    confirmMutations: false,
  });
  assert.equal(result.mode, 'PLAN_ONLY');
  assert.equal(calls.some((document) => /\bmutation\b/i.test(document)), false);
});

test('store setup mutation documents are restricted to collection and identity-definition setup', () => {
  assert.match(MUTATION_FOLDER_IMPORT_COLLECTION_CREATE, /collectionCreate/);
  assert.match(MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE, /metafieldDefinitionCreate/);
  assert.match(MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE, /metafieldDefinitionDelete/);
  for (const document of [
    MUTATION_FOLDER_IMPORT_COLLECTION_CREATE,
    MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_CREATE,
    MUTATION_FOLDER_IMPORT_IDENTITY_DEFINITION_DELETE,
  ]) {
    assert.equal(/productCreate|productSet|fileCreate|publishablePublish|customer/i.test(document), false);
  }
});
