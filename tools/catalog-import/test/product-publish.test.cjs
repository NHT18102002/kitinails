const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REQUIRED_PUBLISH_SCOPES,
  buildActivationMutationVariables,
  buildCatalogPublishSummary,
  buildPublishMutationVariables,
  buildPublishPlanSummary,
  createPublishRecord,
  findPublicationTarget,
  selectPublishWorkItems,
  verifyPublishPrerequisites,
} = require('../src/product-publish.cjs');

test('verifyPublishPrerequisites blocks publish when product import or QA is not clean', () => {
  const blockers = verifyPublishPrerequisites({
    importManifest: {
      summary: {
        total: 590,
        completeCount: 589,
        failedCount: 1,
      },
    },
    importQa: {
      summary: {
        total: 590,
        matched: 589,
        mismatched: 1,
        missing: 0,
      },
    },
  });

  assert.deepEqual(blockers, ['productsetImportIncomplete', 'productsetImportFailures', 'productsetQaNotClean']);
});

test('findPublicationTarget prefers explicit id and otherwise finds Online Store channel publication', () => {
  const publications = [
    {
      id: 'gid://shopify/Publication/1',
      catalog: { title: 'Point of Sale' },
      channels: { nodes: [{ handle: 'pos', name: 'Point of Sale' }] },
    },
    {
      id: 'gid://shopify/Publication/2',
      catalog: { title: 'Online Store' },
      channels: { nodes: [{ handle: 'online_store', name: 'Online Store' }] },
    },
  ];

  assert.equal(
    findPublicationTarget({ publications, publicationId: 'gid://shopify/Publication/1' }).id,
    'gid://shopify/Publication/1'
  );
  assert.equal(findPublicationTarget({ publications }).id, 'gid://shopify/Publication/2');
});

test('buildPublishMutationVariables targets one product and one publication', () => {
  assert.deepEqual(
    buildPublishMutationVariables({
      productId: 'gid://shopify/Product/1',
      publicationId: 'gid://shopify/Publication/2',
    }),
    {
      id: 'gid://shopify/Product/1',
      input: [{ publicationId: 'gid://shopify/Publication/2' }],
    }
  );
});

test('buildActivationMutationVariables sets imported product status to ACTIVE only', () => {
  assert.deepEqual(buildActivationMutationVariables({ productId: 'gid://shopify/Product/1' }), {
    product: {
      id: 'gid://shopify/Product/1',
      status: 'ACTIVE',
    },
  });
});

test('selectPublishWorkItems requires explicit confirm flag before mutation work', () => {
  assert.throws(
    () =>
      selectPublishWorkItems({
        plan: { summary: { status: 'pass' }, targetPublication: { id: 'gid://shopify/Publication/2' }, records: [] },
        confirmPublish: false,
      }),
    /--confirm-publish/i
  );
});

test('selectPublishWorkItems skips already completed resume records unless retrying failed', () => {
  const plan = {
    summary: { status: 'pass' },
    targetPublication: { id: 'gid://shopify/Publication/2' },
    records: [
      { handle: 'a', productId: 'gid://shopify/Product/1', status: 'DRAFT', publishedOnTarget: false },
      { handle: 'b', productId: 'gid://shopify/Product/2', status: 'DRAFT', publishedOnTarget: false },
    ],
  };
  const previousRecordsByHandle = new Map([
    ['a', { handle: 'a', status: 'complete', targetPublicationId: 'gid://shopify/Publication/2' }],
    ['b', { handle: 'b', status: 'failed', targetPublicationId: 'gid://shopify/Publication/2' }],
  ]);

  assert.deepEqual(
    selectPublishWorkItems({ plan, previousRecordsByHandle, confirmPublish: true }).map((item) => item.handle),
    []
  );
  assert.deepEqual(
    selectPublishWorkItems({ plan, previousRecordsByHandle, confirmPublish: true, retryFailed: true }).map((item) => item.handle),
    ['b']
  );
});

test('createPublishRecord and buildCatalogPublishSummary count activate, publish, skip, and fail outcomes', () => {
  const records = [
    createPublishRecord({ handle: 'a', status: 'complete', activated: true, published: true }),
    createPublishRecord({ handle: 'b', status: 'complete', activated: false, published: false, alreadyPublished: true }),
    createPublishRecord({ handle: 'c', status: 'failed', errors: [{ message: 'boom' }] }),
  ];
  const summary = buildCatalogPublishSummary(records);

  assert.equal(summary.total, 3);
  assert.equal(summary.completeCount, 2);
  assert.equal(summary.activatedCount, 1);
  assert.equal(summary.publishedCount, 1);
  assert.equal(summary.alreadyPublishedCount, 1);
  assert.equal(summary.failedCount, 1);
});

test('buildPublishPlanSummary reports activation and publication work without mutating', () => {
  const summary = buildPublishPlanSummary({
    blockers: [],
    records: [
      { status: 'DRAFT', publishedOnTarget: false },
      { status: 'ACTIVE', publishedOnTarget: false },
      { status: 'ACTIVE', publishedOnTarget: true },
    ],
  });

  assert.equal(summary.status, 'pass');
  assert.equal(summary.total, 3);
  assert.equal(summary.needsActivationCount, 1);
  assert.equal(summary.needsPublicationCount, 2);
  assert.equal(summary.alreadyPublishedCount, 1);
});

test('buildStagingQaSummary accepts preview URLs when Online Store URL is not exposed', () => {
  const { buildStagingQaSummary } = require('../src/product-publish.cjs');
  const summary = buildStagingQaSummary({
    blockers: [],
    records: [
      {
        status: 'ACTIVE',
        publishedOnTarget: true,
        onlineStoreUrl: '',
        onlineStorePreviewUrl: 'https://example.myshopify.com/products/a',
      },
    ],
  });

  assert.equal(summary.status, 'pass');
  assert.equal(summary.storefrontUrlCount, 1);
  assert.equal(summary.failedCount, 0);
});

test('publish phase requires publication scopes', () => {
  assert.deepEqual(REQUIRED_PUBLISH_SCOPES, ['read_publications', 'write_publications']);
});
