const path = require('node:path');

const { createManifestHash } = require('./audit.cjs');
const { assertCurrentManifestApproved } = require('./approval.cjs');
const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const { explainExistingProductDecision } = require('./shopify-preflight.cjs');
const {
  MUTATION_PRODUCT_SET,
  QUERY_PRODUCT_BY_HANDLE,
  QUERY_PRODUCT_OPERATION,
} = require('./shopify-queries.cjs');

function buildImportRequestHash(request) {
  return createManifestHash(request);
}

function buildProductSetMutationInput(request) {
  const seenFileIds = new Set();
  return {
    identifier: request.identifier,
    input: {
      ...request.input,
      files: Array.isArray(request?.input?.files)
        ? request.input.files
            .map((file) => ({ id: file?.id || '' }))
            .filter((file) => {
              if (!file.id || seenFileIds.has(file.id)) return false;
              seenFileIds.add(file.id);
              return true;
            })
        : [],
    },
  };
}

function canReuseImportRecord({ record, requestHash, sourceUrl }) {
  if (!record) return false;
  return (
    record.status === 'complete' &&
    record.requestHash === requestHash &&
    String(record.sourceUrl || '').trim() === String(sourceUrl || '').trim()
  );
}

function selectImportRequests({
  requests,
  recordsByHandle = new Map(),
  handleFilter = '',
  limit = 0,
  retryFailed = false,
}) {
  const selected = [];

  for (const request of requests || []) {
    const handle = String(request?.identifier?.handle || '').trim();
    if (!handle) continue;
    if (handleFilter && handle !== handleFilter) continue;

    const sourceUrl = extractSourceUrlFromRequest(request);
    const requestHash = buildImportRequestHash(request);
    const record = recordsByHandle.get(handle);

    if (canReuseImportRecord({ record, requestHash, sourceUrl })) {
      continue;
    }

    if (record?.status === 'failed' && !retryFailed) {
      continue;
    }

    selected.push({
      handle,
      sourceUrl,
      requestHash,
      request,
      previousRecord: record || null,
    });
  }

  return Number(limit) > 0 ? selected.slice(0, Number(limit)) : selected;
}

async function pollProductOperation({
  graphql,
  operationId,
  attempts = 60,
  delayMs = 2000,
}) {
  let latest = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await graphql(QUERY_PRODUCT_OPERATION, { id: operationId });
    latest = data.productOperation || null;

    if (latest?.status === 'COMPLETE') {
      return latest;
    }

    if (attempt < attempts - 1) {
      await delay(delayMs);
    }
  }

  throw new Error(`Product operation ${operationId} did not reach COMPLETE within the polling window.`);
}

function buildImportSummary(records) {
  const summary = {
    total: records.length,
    completeCount: 0,
    createCount: 0,
    updateCount: 0,
    skipConflictCount: 0,
    skippedUnchangedCount: 0,
    skippedPreviousFailureCount: 0,
    failedCount: 0,
  };

  for (const record of records) {
    if (record.status === 'complete') {
      summary.completeCount += 1;
      if (record.decision === 'create') summary.createCount += 1;
      if (record.decision === 'update') summary.updateCount += 1;
    }
    if (record.status === 'skipped_conflict') summary.skipConflictCount += 1;
    if (record.status === 'skipped_unchanged') summary.skippedUnchangedCount += 1;
    if (record.status === 'skipped_previous_failure') summary.skippedPreviousFailureCount += 1;
    if (record.status === 'failed') summary.failedCount += 1;
  }

  return summary;
}

async function runProductSetImport({
  graphql,
  logger = () => {},
  concurrency = 2,
  handleFilter = '',
  limit = 0,
  retryFailed = false,
  synchronous = false,
}) {
  await assertImportSafety();
  const [dryRun, importManifest] = await Promise.all([
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-dry-run.json')),
    readJsonIfExists(importManifestPath()),
  ]);

  const requests = Array.isArray(dryRun?.requests) ? dryRun.requests : [];
  if (!requests.length) {
    throw new Error(`Missing dry-run requests at ${path.join(paths.manifestsRoot, 'productset-dry-run.json')}.`);
  }

  const recordsByHandle = new Map((importManifest?.records || []).map((record) => [record.handle, record]));
  const selectedRequests = selectImportRequests({
    requests,
    recordsByHandle,
    handleFilter,
    limit,
    retryFailed,
  });
  const failures = Array.isArray(importManifest?.failures) ? importManifest.failures : [];

  logger(`Importing ${selectedRequests.length} productSet requests with concurrency ${concurrency}...`);

  let writeQueue = Promise.resolve();
  const persist = () => {
    writeQueue = writeQueue.then(async () => {
      const records = Array.from(recordsByHandle.values()).sort((left, right) => left.handle.localeCompare(right.handle));
      const manifest = {
        generatedAt: new Date().toISOString(),
        apiVersion: constants.apiVersion,
        summary: buildImportSummary(records),
        records,
        failures,
      };
      await writeJson(importManifestPath(), manifest);
      await writeJson(importFailuresPath(), {
        generatedAt: manifest.generatedAt,
        failures,
      });
      return manifest;
    });

    return writeQueue;
  };

  await mapLimit(selectedRequests, Number(concurrency) || 2, async (selected, index) => {
    if (index > 0 && index % 25 === 0) {
      logger(`Processed ${index}/${selectedRequests.length} import requests...`);
    }

    const result = await importSingleProduct({
      graphql,
      selected,
      synchronous,
    });

    recordsByHandle.set(result.handle, result.record);
    if (result.failure) {
      failures.push(result.failure);
    }
    await persist();
  });

  return persist();
}

async function importSingleProduct({ graphql, selected, synchronous }) {
  const { handle, request, requestHash, sourceUrl, previousRecord } = selected;
  const startedAt = new Date().toISOString();
  const guard = await guardLiveProduct({
    graphql,
    handle,
    sourceUrl,
  });

  if (guard.decision === 'skip_conflict') {
    return {
      handle,
      record: {
        handle,
        decision: 'skip_conflict',
        status: 'skipped_conflict',
        requestHash,
        sourceUrl,
        productId: guard.existing?.id || '',
        operationId: '',
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [
          {
            type: 'source_url_conflict',
            message: 'Existing product handle belongs to a different or blank source URL.',
            existing: guard.existing || null,
          },
        ],
      },
    };
  }

  try {
    const payload = await runWithRetries(() =>
      graphql(MUTATION_PRODUCT_SET, {
        ...buildProductSetMutationInput(request),
        synchronous,
      })
    );
    const userErrors = payload.productSet?.userErrors || [];

    if (userErrors.length) {
      return {
        handle,
        record: {
          handle,
          decision: guard.decision,
          status: 'failed',
          requestHash,
          sourceUrl,
          productId: '',
          operationId: payload.productSet?.productSetOperation?.id || '',
          startedAt,
          completedAt: new Date().toISOString(),
          errors: userErrors,
        },
        failure: {
          handle,
          sourceUrl,
          requestHash,
          type: 'product_set_user_errors',
          errors: userErrors,
        },
      };
    }

    const operationId = payload.productSet?.productSetOperation?.id || '';
    let completedProduct = payload.productSet?.product || null;

    if (operationId) {
      const operation = await pollProductOperation({
        graphql: (query, variables) => runWithRetries(() => graphql(query, variables)),
        operationId,
      });

      if (Array.isArray(operation.userErrors) && operation.userErrors.length) {
        return {
          handle,
          record: {
            handle,
            decision: guard.decision,
            status: 'failed',
            requestHash,
            sourceUrl,
            productId: operation.product?.id || '',
            operationId,
            startedAt,
            completedAt: new Date().toISOString(),
            errors: operation.userErrors,
          },
          failure: {
            handle,
            sourceUrl,
            requestHash,
            type: 'product_operation_user_errors',
            errors: operation.userErrors,
          },
        };
      }

      completedProduct = operation.product || completedProduct;
    }

    return {
      handle,
      record: {
        handle,
        decision: guard.decision,
        status: 'complete',
        requestHash,
        sourceUrl,
        productId: completedProduct?.id || previousRecord?.productId || '',
        operationId,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [],
      },
    };
  } catch (error) {
    return {
      handle,
      record: {
        handle,
        decision: guard.decision,
        status: 'failed',
        requestHash,
        sourceUrl,
        productId: previousRecord?.productId || '',
        operationId: '',
        startedAt,
        completedAt: new Date().toISOString(),
        errors: [{ message: error.message }],
      },
      failure: {
        handle,
        sourceUrl,
        requestHash,
        type: 'runtime_error',
        message: error.message,
      },
    };
  }
}

async function assertImportSafety() {
  const [approval, readiness, preflight] = await Promise.all([
    assertCurrentManifestApproved(),
    readJsonIfExists(path.join(paths.manifestsRoot, 'product-import-readiness.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'import-preflight.json')),
  ]);

  if (!approval.draftOnly) {
    throw new Error('Import approval must remain draftOnly=true.');
  }

  if (readiness?.status !== 'pass') {
    throw new Error(`Product import readiness is not pass. Current status: ${readiness?.status || 'missing'}.`);
  }

  if ((preflight?.products?.conflictCount || 0) > 0) {
    throw new Error(`Preflight reports ${preflight.products.conflictCount} product conflicts. Resolve before import.`);
  }
}

async function guardLiveProduct({ graphql, handle, sourceUrl }) {
  const data = await graphql(QUERY_PRODUCT_BY_HANDLE, {
    query: `handle:${handle}`,
  });
  const exact = (data.products?.nodes || []).find((item) => item.handle === handle);

  if (!exact) {
    return {
      decision: 'create',
      existing: null,
    };
  }

  const decision = explainExistingProductDecision({
    handle,
    sourceUrl,
    existingSourceUrl: exact.sourceUrl?.value || '',
    existingProductId: exact.id,
  });

  return {
    decision: decision.decision,
    existing: {
      id: exact.id,
      handle: exact.handle,
      title: exact.title,
      status: exact.status,
      sourceUrl: exact.sourceUrl?.value || '',
    },
  };
}

async function runWithRetries(operation, attempts = 5) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) {
        break;
      }
      await delay(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError;
}

function isRetryableError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('429') ||
    message.includes('throttled') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('econnreset') ||
    message.includes('socket hang up') ||
    message.includes('fetch failed')
  );
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

function extractSourceUrlFromRequest(request) {
  return request?.input?.metafields?.find((item) => item.key === 'source_url')?.value || '';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function importManifestPath() {
  return path.join(paths.manifestsRoot, 'productset-import.json');
}

function importFailuresPath() {
  return path.join(paths.manifestsRoot, 'productset-import-failures.json');
}

module.exports = {
  buildProductSetMutationInput,
  buildImportRequestHash,
  buildImportSummary,
  canReuseImportRecord,
  pollProductOperation,
  runProductSetImport,
  selectImportRequests,
};
