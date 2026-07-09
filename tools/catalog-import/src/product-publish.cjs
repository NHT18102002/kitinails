const path = require('node:path');

const { assertCurrentManifestApproved } = require('./approval.cjs');
const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');

const REQUIRED_PUBLISH_SCOPES = ['read_publications', 'write_publications'];

const QUERY_PUBLISH_SCOPE_PREFLIGHT = `#graphql
query PublishScopePreflight {
  shop {
    name
    myshopifyDomain
  }
  appInstallation {
    accessScopes {
      handle
    }
  }
}
`;

const QUERY_PUBLICATIONS = `#graphql
query CatalogPublications {
  publications(first: 50) {
    nodes {
      id
      autoPublish
      supportsFuturePublishing
      catalog {
        __typename
        ... on AppCatalog {
          id
          title
          apps(first: 5) {
            nodes {
              title
              handle
            }
          }
        }
        ... on MarketCatalog {
          id
          title
        }
        ... on CompanyLocationCatalog {
          id
          title
        }
      }
      channels(first: 10) {
        nodes {
          id
          name
          handle
        }
      }
    }
  }
}
`;

const QUERY_PRODUCT_PUBLISH_STATE = `#graphql
query ProductPublishState($query: String!, $publicationId: ID!) {
  products(first: 10, query: $query) {
    nodes {
      id
      handle
      title
      status
      onlineStoreUrl
      onlineStorePreviewUrl
      publishedOnPublication(publicationId: $publicationId)
      sourceUrl: metafield(namespace: "custom", key: "source_url") {
        value
      }
    }
  }
}
`;

const MUTATION_PUBLISHABLE_PUBLISH = `#graphql
mutation PublishProductToPublication($id: ID!, $input: [PublicationInput!]!) {
  publishablePublish(id: $id, input: $input) {
    publishable {
      ... on Product {
        id
        handle
        status
      }
    }
    userErrors {
      field
      message
    }
  }
}
`;

const MUTATION_PRODUCT_UPDATE_STATUS = `#graphql
mutation ActivateImportedProduct($product: ProductUpdateInput) {
  productUpdate(product: $product) {
    product {
      id
      handle
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;

function verifyPublishPrerequisites({ importManifest, importQa }) {
  const blockers = [];
  const importSummary = importManifest?.summary || {};
  const qaSummary = importQa?.summary || {};

  if (!importManifest) blockers.push('missingProductsetImportManifest');
  if (!importQa) blockers.push('missingProductsetImportQaManifest');

  if (importManifest && Number(importSummary.completeCount || 0) !== Number(importSummary.total || 0)) {
    blockers.push('productsetImportIncomplete');
  }

  if (importManifest && Number(importSummary.failedCount || 0) > 0) {
    blockers.push('productsetImportFailures');
  }

  if (
    importQa &&
    (Number(qaSummary.matched || 0) !== Number(qaSummary.total || 0) ||
      Number(qaSummary.mismatched || 0) > 0 ||
      Number(qaSummary.missing || 0) > 0)
  ) {
    blockers.push('productsetQaNotClean');
  }

  return blockers;
}

function findMissingPublishScopes(grantedScopes) {
  const granted = new Set((grantedScopes || []).map((scope) => String(scope).trim()).filter(Boolean));
  return REQUIRED_PUBLISH_SCOPES.filter((scope) => !granted.has(scope));
}

function findPublicationTarget({ publications = [], publicationId = '', publicationNameHint = 'Online Store' }) {
  const requestedId = String(publicationId || '').trim();
  if (requestedId) {
    return publications.find((publication) => publication.id === requestedId) || null;
  }

  const hint = normalizeText(publicationNameHint || 'Online Store');
  return (
    publications.find((publication) =>
      (publication.channels?.nodes || []).some((channel) => {
        const handle = normalizeText(channel.handle);
        const name = normalizeText(channel.name);
        return handle === 'online_store' || handle === 'online-store' || name === hint || name === 'online store';
      })
    ) ||
    publications.find((publication) => normalizeText(publication.catalog?.title) === hint) ||
    publications.find((publication) =>
      (publication.catalog?.apps?.nodes || []).some((app) => normalizeText(app.title) === hint || normalizeText(app.handle) === 'online_store')
    ) ||
    null
  );
}

function buildPublishMutationVariables({ productId, publicationId }) {
  return {
    id: productId,
    input: [{ publicationId }],
  };
}

function buildActivationMutationVariables({ productId }) {
  return {
    product: {
      id: productId,
      status: 'ACTIVE',
    },
  };
}

function selectPublishWorkItems({
  plan,
  previousRecordsByHandle = new Map(),
  confirmPublish = false,
  retryFailed = false,
  handleFilter = '',
  limit = 0,
}) {
  if (!confirmPublish) {
    throw new Error('Publishing requires explicit --confirm-publish.');
  }

  if (plan?.summary?.status !== 'pass') {
    throw new Error(`Publish plan is not pass. Current status: ${plan?.summary?.status || 'missing'}.`);
  }

  if (!plan?.targetPublication?.id) {
    throw new Error('Publish plan is missing targetPublication.id.');
  }

  const selected = [];
  for (const record of plan.records || []) {
    const handle = String(record.handle || '').trim();
    if (!handle) continue;
    if (handleFilter && handle !== handleFilter) continue;
    if (record.status === 'ACTIVE' && record.publishedOnTarget) continue;

    const previous = previousRecordsByHandle.get(handle);
    if (previous?.status === 'complete' && previous.targetPublicationId === plan.targetPublication.id) continue;
    if (previous?.status === 'failed' && !retryFailed) continue;

    selected.push({
      ...record,
      targetPublicationId: plan.targetPublication.id,
    });
  }

  return Number(limit) > 0 ? selected.slice(0, Number(limit)) : selected;
}

function createPublishRecord({
  handle,
  productId = '',
  targetPublicationId = '',
  status,
  activated = false,
  published = false,
  alreadyPublished = false,
  finalState = null,
  errors = [],
  startedAt = '',
  completedAt = '',
}) {
  return {
    handle,
    productId,
    targetPublicationId,
    status,
    activated,
    published,
    alreadyPublished,
    finalState,
    errors,
    startedAt,
    completedAt,
  };
}

function buildCatalogPublishSummary(records) {
  return {
    total: records.length,
    completeCount: records.filter((record) => record.status === 'complete').length,
    activatedCount: records.filter((record) => record.activated).length,
    publishedCount: records.filter((record) => record.published).length,
    alreadyPublishedCount: records.filter((record) => record.alreadyPublished).length,
    failedCount: records.filter((record) => record.status === 'failed').length,
  };
}

function buildPublishPlanSummary({ blockers = [], records = [] }) {
  const activeCount = records.filter((record) => record.status === 'ACTIVE').length;
  const draftCount = records.filter((record) => record.status === 'DRAFT').length;
  const alreadyPublishedCount = records.filter((record) => record.publishedOnTarget).length;
  const needsActivationCount = records.filter((record) => record.status !== 'ACTIVE').length;
  const needsPublicationCount = records.filter((record) => !record.publishedOnTarget).length;

  return {
    status: blockers.length ? 'blocked' : 'pass',
    blockers,
    total: records.length,
    activeCount,
    draftCount,
    alreadyPublishedCount,
    needsActivationCount,
    needsPublicationCount,
  };
}

async function runCatalogPublishPlan({
  graphql,
  logger = () => {},
  publicationId = '',
  publicationNameHint = 'Online Store',
  handleFilter = '',
  limit = 0,
}) {
  await assertCurrentManifestApproved();

  const [importManifest, importQa] = await Promise.all([
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-import.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'productset-import-qa.json')),
  ]);

  const blockers = verifyPublishPrerequisites({ importManifest, importQa });
  const scopePreflight = await graphql(QUERY_PUBLISH_SCOPE_PREFLIGHT);
  const grantedScopes = (scopePreflight.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missingScopes = findMissingPublishScopes(grantedScopes);

  if (missingScopes.length) {
    blockers.push('missingPublicationScopes');
  }

  const baseManifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    mode: {
      productStatusMutations: false,
      publishMutations: false,
      themePublishMutations: false,
    },
    shop: scopePreflight.shop,
    scopes: {
      required: REQUIRED_PUBLISH_SCOPES,
      granted: grantedScopes,
      missing: missingScopes,
    },
    targetPublication: null,
    summary: buildPublishPlanSummary({ blockers, records: [] }),
    records: [],
  };

  if (blockers.length) {
    await writeJson(publishPlanPath(), baseManifest);
    return baseManifest;
  }

  const publicationsData = await graphql(QUERY_PUBLICATIONS);
  const publications = publicationsData.publications?.nodes || [];
  const targetPublication = findPublicationTarget({ publications, publicationId, publicationNameHint });

  if (!targetPublication) {
    blockers.push('targetPublicationMissing');
    const blocked = {
      ...baseManifest,
      publications,
      summary: buildPublishPlanSummary({ blockers, records: [] }),
    };
    await writeJson(publishPlanPath(), blocked);
    return blocked;
  }

  const importRecords = selectImportedProductRecords({
    importManifest,
    handleFilter,
    limit,
  });
  const records = [];

  logger(`Planning publication state for ${importRecords.length} imported products...`);
  await mapLimit(importRecords, 2, async (record, index) => {
    if (index > 0 && index % 50 === 0) {
      logger(`Checked ${index}/${importRecords.length} publish targets...`);
    }

    records.push(
      await readProductPublishState({
        graphql,
        record,
        publicationId: targetPublication.id,
      })
    );
  });

  records.sort((left, right) => left.handle.localeCompare(right.handle));
  const manifest = {
    ...baseManifest,
    targetPublication: summarizePublication(targetPublication),
    publications: publications.map(summarizePublication),
    summary: buildPublishPlanSummary({ blockers, records }),
    records,
  };

  await writeJson(publishPlanPath(), manifest);
  return manifest;
}

async function runCatalogPublishProducts({
  graphql,
  logger = () => {},
  confirmPublish = false,
  concurrency = 2,
  handleFilter = '',
  limit = 0,
  retryFailed = false,
}) {
  await assertCurrentManifestApproved();

  const [plan, existingManifest] = await Promise.all([
    readJsonIfExists(publishPlanPath()),
    readJsonIfExists(publishManifestPath()),
  ]);
  const previousRecordsByHandle = new Map((existingManifest?.records || []).map((record) => [record.handle, record]));
  const failures = [];
  const workItems = selectPublishWorkItems({
    plan,
    previousRecordsByHandle,
    confirmPublish,
    retryFailed,
    handleFilter,
    limit,
  });

  logger(`Publishing ${workItems.length} imported products to ${plan.targetPublication.channelNames?.join(', ') || plan.targetPublication.id}...`);

  let writeQueue = Promise.resolve();
  const persist = () => {
    writeQueue = writeQueue.then(async () => {
      const records = Array.from(previousRecordsByHandle.values()).sort((left, right) => left.handle.localeCompare(right.handle));
      const manifest = {
        generatedAt: new Date().toISOString(),
        apiVersion: constants.apiVersion,
        targetPublication: plan.targetPublication,
        mode: {
          productStatusMutations: true,
          publishMutations: true,
          themePublishMutations: false,
        },
        summary: buildCatalogPublishSummary(records),
        records,
      };
      await writeJson(publishManifestPath(), manifest);
      await writeJson(publishFailuresPath(), {
        generatedAt: manifest.generatedAt,
        failures: records.filter((record) => record.status === 'failed'),
      });
      return manifest;
    });

    return writeQueue;
  };

  await mapLimit(workItems, Number(concurrency) || 2, async (item, index) => {
    if (index > 0 && index % 25 === 0) {
      logger(`Published workflow checked ${index}/${workItems.length} products...`);
    }

    const result = await publishSingleProduct({
      graphql,
      item,
    });
    previousRecordsByHandle.set(result.handle, result.record);
    if (result.record.status === 'failed') failures.push(result.record);
    await persist();
  });

  return persist();
}

async function publishSingleProduct({ graphql, item }) {
  const startedAt = new Date().toISOString();
  const errors = [];
  let activated = false;
  let published = false;
  const alreadyPublished = Boolean(item.publishedOnTarget);

  try {
    if (item.missing || !item.productId) {
      throw new Error('Product is missing from publish plan or has no productId.');
    }

    if (item.status !== 'ACTIVE') {
      const activation = await runWithRetries(() =>
        graphql(MUTATION_PRODUCT_UPDATE_STATUS, buildActivationMutationVariables({ productId: item.productId }))
      );
      const activationErrors = activation.productUpdate?.userErrors || [];
      if (activationErrors.length) {
        errors.push(...activationErrors);
        throw new Error('Product activation returned user errors.');
      }
      activated = true;
    }

    if (!item.publishedOnTarget) {
      const publication = await runWithRetries(() =>
        graphql(
          MUTATION_PUBLISHABLE_PUBLISH,
          buildPublishMutationVariables({
            productId: item.productId,
            publicationId: item.targetPublicationId,
          })
        )
      );
      const publicationErrors = publication.publishablePublish?.userErrors || [];
      if (publicationErrors.length) {
        errors.push(...publicationErrors);
        throw new Error('Product publish returned user errors.');
      }
      published = true;
    }

    const finalState = await readProductPublishState({
      graphql,
      record: item,
      publicationId: item.targetPublicationId,
    });

    if (finalState.status !== 'ACTIVE' || !finalState.publishedOnTarget) {
      errors.push({
        field: ['finalState'],
        message: 'Product was not ACTIVE and published after mutation.',
      });
      throw new Error('Final publish state did not pass.');
    }

    return {
      handle: item.handle,
      record: createPublishRecord({
        handle: item.handle,
        productId: item.productId,
        targetPublicationId: item.targetPublicationId,
        status: 'complete',
        activated,
        published,
        alreadyPublished,
        finalState,
        errors: [],
        startedAt,
        completedAt: new Date().toISOString(),
      }),
    };
  } catch (error) {
    return {
      handle: item.handle,
      record: createPublishRecord({
        handle: item.handle,
        productId: item.productId || '',
        targetPublicationId: item.targetPublicationId || '',
        status: 'failed',
        activated,
        published,
        alreadyPublished,
        finalState: null,
        errors: errors.length ? errors : [{ message: error.message }],
        startedAt,
        completedAt: new Date().toISOString(),
      }),
    };
  }
}

async function runCatalogStagingQa({ graphql, logger = () => {} }) {
  const plan = await readJsonIfExists(publishPlanPath());
  const blockers = [];

  if (!plan) blockers.push('missingPublishPlan');
  if (plan && plan.summary?.status !== 'pass') blockers.push('publishPlanBlocked');
  if (plan && !plan.targetPublication?.id) blockers.push('targetPublicationMissing');

  const records = [];
  if (!blockers.length) {
    logger(`QA checking ${plan.records.length} staged storefront products...`);
    await mapLimit(plan.records || [], 2, async (record, index) => {
      if (index > 0 && index % 50 === 0) {
        logger(`QA checked ${index}/${plan.records.length} published products...`);
      }
      records.push(
        await readProductPublishState({
          graphql,
          record,
          publicationId: plan.targetPublication.id,
        })
      );
    });
  }

  records.sort((left, right) => left.handle.localeCompare(right.handle));
  const summary = buildStagingQaSummary({ blockers, records });
  const manifest = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    targetPublication: plan?.targetPublication || null,
    summary,
    records,
  };

  await writeJson(stagingQaPath(), manifest);
  return manifest;
}

function buildStagingQaSummary({ blockers = [], records = [] }) {
  const activeCount = records.filter((record) => record.status === 'ACTIVE').length;
  const publishedCount = records.filter((record) => record.publishedOnTarget).length;
  const onlineStoreUrlCount = records.filter((record) => record.onlineStoreUrl).length;
  const onlineStorePreviewUrlCount = records.filter((record) => record.onlineStorePreviewUrl).length;
  const storefrontUrlCount = records.filter((record) => record.storefrontUrl || record.onlineStoreUrl || record.onlineStorePreviewUrl).length;
  const missingCount = records.filter((record) => record.missing).length;
  const failedCount = records.filter(
    (record) =>
      record.missing ||
      record.status !== 'ACTIVE' ||
      !record.publishedOnTarget ||
      !(record.storefrontUrl || record.onlineStoreUrl || record.onlineStorePreviewUrl)
  ).length;

  return {
    status: blockers.length || failedCount ? 'blocked' : 'pass',
    blockers,
    total: records.length,
    activeCount,
    publishedCount,
    onlineStoreUrlCount,
    onlineStorePreviewUrlCount,
    storefrontUrlCount,
    missingCount,
    failedCount,
  };
}

function selectImportedProductRecords({ importManifest, handleFilter = '', limit = 0 }) {
  const selected = (importManifest?.records || [])
    .filter((record) => record.status === 'complete')
    .filter((record) => !handleFilter || record.handle === handleFilter);

  return Number(limit) > 0 ? selected.slice(0, Number(limit)) : selected;
}

async function readProductPublishState({ graphql, record, publicationId }) {
  const data = await runWithRetries(() =>
    graphql(QUERY_PRODUCT_PUBLISH_STATE, {
      query: `handle:${record.handle}`,
      publicationId,
    })
  );
  const exact = (data.products?.nodes || []).find((product) => product.handle === record.handle);

  if (!exact) {
    return {
      handle: record.handle,
      productId: record.productId || '',
      sourceUrl: record.sourceUrl || '',
      missing: true,
      status: '',
      onlineStoreUrl: '',
      onlineStorePreviewUrl: '',
      storefrontUrl: '',
      publishedOnTarget: false,
      actions: ['resolve_missing_product'],
    };
  }

  const actions = [];
  if (exact.status !== 'ACTIVE') actions.push('activate_product');
  if (!exact.publishedOnPublication) actions.push('publish_to_publication');

  return {
    handle: exact.handle,
    productId: exact.id,
    expectedProductId: record.productId || '',
    sourceUrl: exact.sourceUrl?.value || '',
    expectedSourceUrl: record.sourceUrl || '',
    missing: false,
    status: exact.status,
    onlineStoreUrl: exact.onlineStoreUrl || '',
    onlineStorePreviewUrl: exact.onlineStorePreviewUrl || '',
    storefrontUrl: exact.onlineStoreUrl || exact.onlineStorePreviewUrl || '',
    publishedOnTarget: Boolean(exact.publishedOnPublication),
    actions,
  };
}

function summarizePublication(publication) {
  if (!publication) return null;
  return {
    id: publication.id,
    catalogTitle: publication.catalog?.title || '',
    catalogType: publication.catalog?.__typename || '',
    channelNames: (publication.channels?.nodes || []).map((channel) => channel.name).filter(Boolean),
    channelHandles: (publication.channels?.nodes || []).map((channel) => channel.handle).filter(Boolean),
    autoPublish: Boolean(publication.autoPublish),
    supportsFuturePublishing: Boolean(publication.supportsFuturePublishing),
  };
}

async function runWithRetries(operation, attempts = 5) {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === attempts - 1) break;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function publishPlanPath() {
  return path.join(paths.manifestsRoot, 'catalog-publish-plan.json');
}

function publishManifestPath() {
  return path.join(paths.manifestsRoot, 'catalog-publish.json');
}

function publishFailuresPath() {
  return path.join(paths.manifestsRoot, 'catalog-publish-failures.json');
}

function stagingQaPath() {
  return path.join(paths.manifestsRoot, 'catalog-staging-qa.json');
}

module.exports = {
  MUTATION_PUBLISHABLE_PUBLISH,
  MUTATION_PRODUCT_UPDATE_STATUS,
  QUERY_PRODUCT_PUBLISH_STATE,
  QUERY_PUBLICATIONS,
  QUERY_PUBLISH_SCOPE_PREFLIGHT,
  REQUIRED_PUBLISH_SCOPES,
  buildActivationMutationVariables,
  buildCatalogPublishSummary,
  buildPublishMutationVariables,
  buildPublishPlanSummary,
  buildStagingQaSummary,
  createPublishRecord,
  findMissingPublishScopes,
  findPublicationTarget,
  runCatalogPublishPlan,
  runCatalogPublishProducts,
  runCatalogStagingQa,
  selectImportedProductRecords,
  selectPublishWorkItems,
  verifyPublishPrerequisites,
};
