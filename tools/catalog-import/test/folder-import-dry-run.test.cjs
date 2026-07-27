const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateCollectionProposalHash } = require('../src/folder-import/collection-map.cjs');
const {
  PUBLISHER_ID,
  QUERY_FOLDER_IMPORT_DRY_RUN_PREFLIGHT,
  QUERY_FOLDER_IMPORT_PRODUCTS,
  QUERY_FOLDER_IMPORT_PRODUCT_DETAILS,
  assertApprovedContract,
  buildFolderDryRun,
  buildMediaPlan,
  buildRequestHash,
  classifyProductDecision,
} = require('../src/folder-import/dry-run.cjs');
const { calculateDryRunHash } = require('../src/folder-import/report.cjs');
const { buildDryRunCsv } = require('../src/folder-import/report.cjs');

function contractFixture() {
  const product = {
    sourceKey: 'folder-import:3d:1',
    collectionFolder: '3d',
    collectionSlug: '3d',
    pairKey: '1',
    title: '3D 01',
    proposedHandle: 'folder-import-3d-01',
    pairSha256: 'pair-hash',
    media: [
      { role: 'primary', path: 'products/3d/1.jpg', bytes: 10, sha256: 'sha-primary' },
      { role: 'secondary', path: 'products/3d/1.1.jpg', bytes: 20, sha256: 'sha-secondary' },
    ],
  };
  const manifest = {
    schemaVersion: 'folder-product-manifest-v1',
    manifestSha256: 'manifest-hash',
    summary: { blockingErrorCount: 0 },
    collections: [{ folder: '3d' }],
    products: [product],
  };
  const target = { gid: 'gid://shopify/Collection/1', handle: '3d', title: '3D' };
  const proposal = {
    schemaVersion: 'folder-collection-map-proposal-v1',
    sourceManifestSha256: manifest.manifestSha256,
    shop: { name: 'Ersa', myshopifyDomain: 'ersa-demo.myshopify.com' },
    summary: { gate: 'PASS', folderCount: 1 },
    mappings: [{ folder: '3d', status: 'PASS', proposed: target }],
  };
  const approved = {
    schemaVersion: 'folder-collection-map-approved-v1',
    sourceManifestSha256: manifest.manifestSha256,
    proposalSha256: calculateCollectionProposalHash(proposal),
    shop: proposal.shop,
    mappings: { '3d': target },
  };
  return { approved, manifest, product, proposal, target };
}

test('approved contract is exact and rejects manifest drift', () => {
  const fixture = contractFixture();
  assert.deepEqual(assertApprovedContract(fixture), [{ folder: '3d', ...fixture.target }]);
  assert.throws(
    () => assertApprovedContract({ ...fixture, manifest: { ...fixture.manifest, manifestSha256: 'changed' } }),
    /manifest hash/
  );
});

test('product decision blocks foreign collisions and updates only owned drafts', () => {
  const { product, target } = contractFixture();
  const requestHash = buildRequestHash(product, target);
  const empty = new Map();
  assert.equal(
    classifyProductDecision({
      product,
      collectionTarget: target,
      requestHash,
      productsByExternalId: empty,
      productsByHandle: empty,
    }).action,
    'CREATE'
  );

  const foreign = {
    gid: 'gid://shopify/Product/foreign',
    handle: product.proposedHandle,
    status: 'DRAFT',
  };
  assert.equal(
    classifyProductDecision({
      product,
      collectionTarget: target,
      requestHash,
      productsByExternalId: empty,
      productsByHandle: new Map([[product.proposedHandle, [foreign]]]),
    }).reason,
    'foreign_handle_collision'
  );

  const owned = {
    gid: 'gid://shopify/Product/owned',
    handle: product.proposedHandle,
    title: product.title,
    status: 'DRAFT',
    publisherId: PUBLISHER_ID,
    requestHash,
    pairHash: product.pairSha256,
    mediaCount: 2,
    collectionGids: [target.gid],
  };
  assert.equal(
    classifyProductDecision({
      product,
      collectionTarget: target,
      requestHash,
      productsByExternalId: new Map([[product.sourceKey, [owned]]]),
      productsByHandle: new Map([[product.proposedHandle, [owned]]]),
    }).action,
    'SKIP_UNCHANGED'
  );
  assert.equal(
    classifyProductDecision({
      product,
      collectionTarget: target,
      requestHash,
      productsByExternalId: new Map([[product.sourceKey, [{ ...owned, status: 'ACTIVE' }]]]),
      productsByHandle: new Map([[product.proposedHandle, [{ ...owned, status: 'ACTIVE' }]]]),
    }).reason,
    'owned_product_is_not_draft'
  );
});

test('request hash changes with media or target collection', () => {
  const { product, target } = contractFixture();
  const first = buildRequestHash(product, target);
  assert.equal(first, buildRequestHash(product, target));
  assert.notEqual(first, buildRequestHash({ ...product, pairSha256: 'new-pair-hash' }, target));
  assert.notEqual(first, buildRequestHash(product, { ...target, gid: 'gid://shopify/Collection/2' }));
});

test('media plan deduplicates by sha256 and reuses only READY checkpoints', () => {
  const { manifest, product } = contractFixture();
  const duplicateProduct = {
    ...product,
    sourceKey: 'folder-import:3d:2',
    media: [
      { ...product.media[0], role: 'primary' },
      { role: 'secondary', path: 'products/3d/2.1.jpg', bytes: 30, sha256: 'sha-third' },
    ],
  };
  const plan = buildMediaPlan(
    { ...manifest, products: [product, duplicateProduct] },
    { files: [{ sha256: 'sha-primary', fileGid: 'gid://shopify/MediaImage/1', fileStatus: 'READY' }] }
  );
  assert.deepEqual(plan.summary, {
    mediaReferenceCount: 4,
    uniqueMediaHashCount: 3,
    uploadCount: 2,
    reuseCheckpointCount: 1,
  });
});

test('dry-run remains read-only and blocks when unique external ID definition is missing', async () => {
  const fixture = contractFixture();
  const calls = [];
  const graphql = async (query, variables) => {
    assert.equal(/\bmutation\b/i.test(query), false);
    calls.push({ query, variables });
    if (query.includes('FolderImportDryRunPreflight')) {
      return {
        shop: fixture.proposal.shop,
        appInstallation: {
          accessScopes: ['read_products', 'write_products', 'read_files', 'write_files'].map((handle) => ({ handle })),
        },
        metafieldDefinitions: { nodes: [] },
        nodes: [
          {
            __typename: 'Collection',
            id: fixture.target.gid,
            handle: fixture.target.handle,
            title: fixture.target.title,
            sources: [],
          },
        ],
      };
    }
    if (query.includes('FolderImportProducts')) {
      return { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    throw new Error('Unexpected query');
  };

  const report = await buildFolderDryRun({
    graphql,
    ...fixture,
    filesState: null,
    expectedStoreDomain: 'ersa-demo.myshopify.com',
    generatedAt: '2026-07-22T00:00:00Z',
  });

  assert.equal(report.gate, 'BLOCKED');
  assert.equal(report.summary.createCount, 1);
  assert.equal(report.summary.blockedProductCount, 0);
  assert.equal(report.blockingErrors[0].code, 'IDENTITY_DEFINITION_MISSING');
  assert.equal(calls.length, 2);
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
  assert.match(buildDryRunCsv(report), /folder-import:3d:1,CREATE/);
});

test('dry-run treats collection GID and handle as identity while allowing merchant title changes', async () => {
  const fixture = contractFixture();
  const graphql = async (query) => {
    assert.equal(/\bmutation\b/i.test(query), false);
    if (query.includes('FolderImportDryRunPreflight')) {
      return {
        shop: fixture.proposal.shop,
        appInstallation: {
          accessScopes: ['read_products', 'write_products', 'read_files', 'write_files'].map((handle) => ({ handle })),
        },
        metafieldDefinitions: {
          nodes: [{
            namespace: 'ersa_automation',
            key: 'external_id',
            type: { name: 'id' },
            capabilities: { uniqueValues: { enabled: true } },
          }],
        },
        nodes: [{
          __typename: 'Collection',
          id: fixture.target.gid,
          handle: fixture.target.handle,
          title: '3D Nails',
          sources: [],
        }],
      };
    }
    if (query.includes('FolderImportProducts')) {
      return { products: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } };
    }
    throw new Error('Unexpected query');
  };

  const report = await buildFolderDryRun({
    graphql,
    ...fixture,
    filesState: null,
    expectedStoreDomain: 'ersa-demo.myshopify.com',
    generatedAt: '2026-07-23T00:00:00Z',
  });

  assert.equal(report.gate, 'PASS');
  assert.equal(report.preflight.collectionChecks[0].status, 'PASS');
  assert.equal(report.preflight.collectionChecks[0].expected.title, '3D');
  assert.equal(report.preflight.collectionChecks[0].live.title, '3D Nails');
});

test('all dry-run Shopify documents are query-only', () => {
  for (const query of [
    QUERY_FOLDER_IMPORT_DRY_RUN_PREFLIGHT,
    QUERY_FOLDER_IMPORT_PRODUCTS,
    QUERY_FOLDER_IMPORT_PRODUCT_DETAILS,
  ]) {
    assert.equal(/\bmutation\b/i.test(query), false);
  }
});

test('dry-run hash ignores volatile report and Shopify timestamps', () => {
  const first = {
    generatedAt: '2026-07-22T00:00:00Z',
    reportSha256: 'old',
    shop: { updatedAt: '2026-07-22T00:00:01Z', handle: '3d' },
    items: [{ sourceKey: 'folder-import:3d:1', existingProduct: { updatedAt: '2026-07-22T00:00:02Z', status: 'DRAFT' } }],
  };
  const second = {
    ...first,
    generatedAt: '2026-07-22T01:00:00Z',
    reportSha256: 'new',
    shop: { ...first.shop, updatedAt: '2026-07-22T01:00:01Z' },
    items: [{ ...first.items[0], existingProduct: { ...first.items[0].existingProduct, updatedAt: '2026-07-22T01:00:02Z' } }],
  };
  assert.equal(calculateDryRunHash(first), calculateDryRunHash(second));
});
