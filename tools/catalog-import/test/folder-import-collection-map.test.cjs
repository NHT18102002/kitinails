const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QUERY_FOLDER_IMPORT_COLLECTIONS,
  buildApprovedCollectionMap,
  classifyCollection,
  discoverFolderCollections,
  proposeFolderMapping,
} = require('../src/folder-import/collection-map.cjs');

function source({ conditions = [], app = null, targetType = 'PRODUCTS' } = {}) {
  return {
    __typename: 'CollectionConditionsSource',
    id: 'gid://shopify/CollectionSource/1',
    title: 'Products',
    app,
    shareable: false,
    targetType,
    inclusion: { conditions },
  };
}

function collection({ id, handle, title, sources = [source()] }) {
  return { id, handle, title, updatedAt: '2026-07-22T00:00:00Z', sources };
}

test('collection classification allows only condition-free, manually assignable product sources', () => {
  assert.deepEqual(classifyCollection(collection({ id: '0', handle: 'empty', title: 'Empty', sources: [] })), {
    membershipType: 'MANUAL',
    manualAssignable: true,
    reason: 'no_automatic_sources',
  });
  assert.deepEqual(classifyCollection(collection({ id: '1', handle: 'cute', title: 'Cute' })), {
    membershipType: 'MANUAL',
    manualAssignable: true,
    reason: 'manual_product_selections_only',
  });
  assert.equal(
    classifyCollection(
      collection({ id: '2', handle: 'smart', title: 'Smart', sources: [source({ conditions: [{ __typename: 'TagCondition' }] })] })
    ).membershipType,
    'AUTOMATIC'
  );
  assert.equal(
    classifyCollection(
      collection({
        id: '3',
        handle: 'app',
        title: 'App',
        sources: [{ ...source({ app: { id: 'gid://shopify/App/1' } }), shareable: true }],
      })
    )
      .manualAssignable,
    false
  );
  assert.equal(
    classifyCollection(collection({ id: '4', handle: 'legacy', title: 'Legacy', sources: [source({ app: { id: 'gid://shopify/App/1' } })] }))
      .manualAssignable,
    true
  );
});

test('folder mapping requires one exact manual handle or title match', () => {
  const collections = [
    collection({ id: 'gid://shopify/Collection/1', handle: 'nail-art', title: 'Nail Art' }),
  ];
  const mapping = proposeFolderMapping('nail art', collections);

  assert.equal(mapping.status, 'PASS');
  assert.deepEqual(mapping.proposed, {
    gid: 'gid://shopify/Collection/1',
    handle: 'nail-art',
    title: 'Nail Art',
  });

  const ambiguous = proposeFolderMapping('cute', [
    collection({ id: 'gid://shopify/Collection/2', handle: 'cute', title: 'Designs' }),
    collection({ id: 'gid://shopify/Collection/3', handle: 'other', title: 'Cute' }),
  ]);
  assert.equal(ambiguous.status, 'AMBIGUOUS');
  assert.equal(proposeFolderMapping('missing', collections).status, 'MISSING');
});

test('Shopify discovery paginates with queries only and blocks automatic collection matches', async () => {
  const calls = [];
  const pages = [
    {
      shop: { name: 'Ersa', myshopifyDomain: 'ersa-demo.myshopify.com' },
      collections: {
        nodes: [collection({ id: 'gid://shopify/Collection/1', handle: '3d', title: '3D' })],
        pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
      },
    },
    {
      shop: { name: 'Ersa', myshopifyDomain: 'ersa-demo.myshopify.com' },
      collections: {
        nodes: [
          collection({
            id: 'gid://shopify/Collection/2',
            handle: 'cute',
            title: 'Cute',
            sources: [source({ conditions: [{ __typename: 'ProductTagCondition' }] })],
          }),
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    },
  ];
  const graphql = async (query, variables) => {
    assert.equal(/\bmutation\b/i.test(query), false);
    calls.push(variables);
    return pages[calls.length - 1];
  };
  const manifest = {
    manifestSha256: 'abc123',
    collections: [{ folder: '3d' }, { folder: 'cute' }],
  };

  const proposal = await discoverFolderCollections({
    graphql,
    manifest,
    expectedStoreDomain: 'ersa-demo.myshopify.com',
    pageSize: 1,
  });

  assert.deepEqual(calls, [
    { first: 1, after: null },
    { first: 1, after: 'cursor-1' },
  ]);
  assert.equal(proposal.mode.shopifyReadOnly, true);
  assert.equal(proposal.summary.passCount, 1);
  assert.equal(proposal.summary.blockedNonManualCount, 1);
  assert.equal(proposal.summary.gate, 'BLOCKED');
  assert.equal(proposal.mappings.find((mapping) => mapping.folder === 'cute').status, 'BLOCKED_NON_MANUAL');
});

test('collection discovery rejects a different live store', async () => {
  const graphql = async () => ({
    shop: { name: 'Wrong', myshopifyDomain: 'wrong.myshopify.com' },
    collections: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
  });

  await assert.rejects(
    discoverFolderCollections({
      graphql,
      manifest: { collections: [{ folder: '3d' }] },
      expectedStoreDomain: 'expected.myshopify.com',
    }),
    /Shopify store mismatch/
  );
});

test('discovery document cannot mutate Shopify', () => {
  assert.match(QUERY_FOLDER_IMPORT_COLLECTIONS, /^#graphql\s+query\b/);
  assert.equal(/\bmutation\b/i.test(QUERY_FOLDER_IMPORT_COLLECTIONS), false);
});

test('approved mapping requires a passing proposal tied to the current manifest', () => {
  const proposal = {
    schemaVersion: 'folder-collection-map-proposal-v1',
    generatedAt: '2026-07-22T00:00:00Z',
    sourceManifestSha256: 'manifest-1',
    shop: { myshopifyDomain: 'ersa-demo.myshopify.com' },
    summary: { gate: 'PASS', folderCount: 1 },
    mappings: [
      {
        folder: '3d',
        status: 'PASS',
        proposed: { gid: 'gid://shopify/Collection/1', handle: '3d', title: '3D' },
      },
    ],
  };
  const approved = buildApprovedCollectionMap({
    proposal,
    currentManifestSha256: 'manifest-1',
    approvedAt: '2026-07-22T01:00:00Z',
  });

  assert.deepEqual(approved.mappings['3d'], {
    gid: 'gid://shopify/Collection/1',
    handle: '3d',
    title: '3D',
  });
  assert.match(approved.proposalSha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => buildApprovedCollectionMap({ proposal, currentManifestSha256: 'different-manifest' }),
    /manifest hash/
  );
});
