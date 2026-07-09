const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProductSetMutationInput,
  buildImportRequestHash,
  buildImportSummary,
  canReuseImportRecord,
  pollProductOperation,
  selectImportRequests,
} = require('../src/product-import.cjs');

test('buildImportRequestHash is stable for the same request payload', () => {
  const request = {
    identifier: { handle: 'fairy-garden' },
    input: { title: 'Fairy Garden', status: 'DRAFT' },
  };

  assert.equal(buildImportRequestHash(request), buildImportRequestHash({ ...request }));
});

test('buildProductSetMutationInput strips mutable file fields and keeps only reusable file ids', () => {
  const mutationInput = buildProductSetMutationInput({
    identifier: { handle: 'fairy-garden' },
    input: {
      title: 'Fairy Garden',
      files: [
        { id: 'gid://shopify/MediaImage/1', alt: 'A', filename: 'a.jpg', contentType: 'IMAGE' },
        { id: 'gid://shopify/MediaImage/1', alt: 'A2', filename: 'a2.jpg', contentType: 'IMAGE' },
        { id: '', alt: 'B' },
      ],
    },
  });

  assert.deepEqual(mutationInput, {
    identifier: { handle: 'fairy-garden' },
    input: {
      title: 'Fairy Garden',
      files: [{ id: 'gid://shopify/MediaImage/1' }],
    },
  });
});

test('canReuseImportRecord keeps previously completed imports with the same request hash and source URL', () => {
  assert.equal(
    canReuseImportRecord({
      record: {
        status: 'complete',
        requestHash: 'abc',
        sourceUrl: 'https://ersanails.com/products/fairy-garden',
      },
      requestHash: 'abc',
      sourceUrl: 'https://ersanails.com/products/fairy-garden',
    }),
    true
  );

  assert.equal(
    canReuseImportRecord({
      record: {
        status: 'complete',
        requestHash: 'abc',
        sourceUrl: 'https://ersanails.com/products/fairy-garden',
      },
      requestHash: 'def',
      sourceUrl: 'https://ersanails.com/products/fairy-garden',
    }),
    false
  );
});

test('selectImportRequests filters by handle, limit, and retry-failed behavior', () => {
  const requests = [
    { identifier: { handle: 'a' }, input: { metafields: [{ key: 'source_url', value: 'https://ersanails.com/products/a' }] } },
    { identifier: { handle: 'b' }, input: { metafields: [{ key: 'source_url', value: 'https://ersanails.com/products/b' }] } },
    { identifier: { handle: 'c' }, input: { metafields: [{ key: 'source_url', value: 'https://ersanails.com/products/c' }] } },
  ];
  const recordsByHandle = new Map([
    ['a', { handle: 'a', status: 'complete', requestHash: buildImportRequestHash(requests[0]), sourceUrl: 'https://ersanails.com/products/a' }],
    ['b', { handle: 'b', status: 'failed', requestHash: buildImportRequestHash(requests[1]), sourceUrl: 'https://ersanails.com/products/b' }],
  ]);

  assert.deepEqual(
    selectImportRequests({ requests, recordsByHandle }).map((item) => item.handle),
    ['c']
  );
  assert.deepEqual(
    selectImportRequests({ requests, recordsByHandle, retryFailed: true }).map((item) => item.handle),
    ['b', 'c']
  );
  assert.deepEqual(
    selectImportRequests({ requests, recordsByHandle, handleFilter: 'c', limit: 1 }).map((item) => item.handle),
    ['c']
  );
});

test('pollProductOperation returns the completed operation payload', async () => {
  const states = [
    {
      productOperation: {
        __typename: 'ProductSetOperation',
        id: 'gid://shopify/ProductSetOperation/1',
        status: 'CREATED',
        product: null,
        userErrors: [],
      },
    },
    {
      productOperation: {
        __typename: 'ProductSetOperation',
        id: 'gid://shopify/ProductSetOperation/1',
        status: 'COMPLETE',
        product: { id: 'gid://shopify/Product/1', handle: 'fairy-garden', status: 'DRAFT' },
        userErrors: [],
      },
    },
  ];
  let index = 0;

  const result = await pollProductOperation({
    graphql: async () => states[index++],
    operationId: 'gid://shopify/ProductSetOperation/1',
    attempts: 2,
    delayMs: 0,
  });

  assert.equal(result.status, 'COMPLETE');
  assert.equal(result.product.handle, 'fairy-garden');
});

test('pollProductOperation throws when the operation never completes', async () => {
  await assert.rejects(
    pollProductOperation({
      graphql: async () => ({
        productOperation: {
          __typename: 'ProductSetOperation',
          id: 'gid://shopify/ProductSetOperation/1',
          status: 'ACTIVE',
          product: null,
          userErrors: [],
        },
      }),
      operationId: 'gid://shopify/ProductSetOperation/1',
      attempts: 2,
      delayMs: 0,
    }),
    /did not reach COMPLETE/i
  );
});

test('buildImportSummary counts create, update, skip, and fail outcomes', () => {
  const summary = buildImportSummary([
    { decision: 'create', status: 'complete' },
    { decision: 'update', status: 'complete' },
    { decision: 'skip_conflict', status: 'skipped_conflict' },
    { decision: 'retry_deferred', status: 'skipped_previous_failure' },
    { decision: 'create', status: 'failed' },
  ]);

  assert.equal(summary.completeCount, 2);
  assert.equal(summary.createCount, 1);
  assert.equal(summary.updateCount, 1);
  assert.equal(summary.skipConflictCount, 1);
  assert.equal(summary.failedCount, 1);
});
