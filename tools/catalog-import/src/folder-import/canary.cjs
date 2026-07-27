const path = require('node:path');

const { uploadAssetChunk, pollFilesReady } = require('../asset-upload.cjs');
const { constants, paths } = require('../config.cjs');
const { readJsonIfExists, writeJson } = require('../fs-utils.cjs');
const { normalizeStoreDomain } = require('../shopify-admin.cjs');
const {
  DEFAULT_APPROVED_MAP_PATH,
  DEFAULT_PROPOSED_MAP_PATH,
} = require('./collection-map.cjs');
const {
  DEFAULT_FILES_STATE_PATH,
  EXTERNAL_ID_KEY,
  IDENTITY_NAMESPACE,
  PAIR_HASH_KEY,
  PUBLISHER_ID,
  PUBLISHER_ID_KEY,
  REQUEST_HASH_KEY,
  assertApprovedContract,
  buildRequestHash,
  runFolderDryRun,
} = require('./dry-run.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

const DEFAULT_DRY_RUN_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'dry-run.json');
const DEFAULT_CANARY_STATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'canary.json');
const DEFAULT_ROLLOUT_GATE_PATH = path.join(DEFAULT_OUTPUT_ROOT, 'rollout-gate.json');
const REQUIRED_CANARY_SCOPES = ['read_products', 'write_products', 'read_files', 'write_files'];

const QUERY_FOLDER_IMPORT_CANARY_GUARD = `#graphql
query FolderImportCanaryGuard($identifier: ProductIdentifierInput!, $handleQuery: String!) {
  shop { name myshopifyDomain }
  appInstallation { accessScopes { handle } }
  byExternalId: productByIdentifier(identifier: $identifier) {
    id
    handle
    title
    status
    externalId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${EXTERNAL_ID_KEY}") { value }
    publisherId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PUBLISHER_ID_KEY}") { value }
    requestHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${REQUEST_HASH_KEY}") { value }
    pairHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PAIR_HASH_KEY}") { value }
  }
  byHandle: products(first: 10, query: $handleQuery) {
    nodes {
      id
      handle
      title
      status
      externalId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${EXTERNAL_ID_KEY}") { value }
      publisherId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PUBLISHER_ID_KEY}") { value }
      requestHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${REQUEST_HASH_KEY}") { value }
      pairHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PAIR_HASH_KEY}") { value }
    }
  }
}
`;

const MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET = `#graphql
mutation FolderImportCanaryProductSet(
  $identifier: ProductSetIdentifiers
  $input: ProductSetInput!
) {
  productSet(identifier: $identifier, synchronous: true, input: $input) {
    product { id handle title status }
    userErrors { code field message }
  }
}
`;

const QUERY_FOLDER_IMPORT_CANARY_QA = `#graphql
query FolderImportCanaryQa($identifier: ProductIdentifierInput!) {
  productByIdentifier(identifier: $identifier) {
    id
    handle
    title
    status
    externalId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${EXTERNAL_ID_KEY}") { value }
    publisherId: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PUBLISHER_ID_KEY}") { value }
    requestHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${REQUEST_HASH_KEY}") { value }
    pairHash: metafield(namespace: "${IDENTITY_NAMESPACE}", key: "${PAIR_HASH_KEY}") { value }
    media(first: 10) {
      nodes { id alt mediaContentType status }
    }
    collections(first: 100) {
      nodes { id handle title }
    }
    variants(first: 10) {
      nodes { id title price }
    }
  }
}
`;

function customId(sourceKey) {
  return { customId: { namespace: IDENTITY_NAMESPACE, key: EXTERNAL_ID_KEY, value: sourceKey } };
}

function buildCanaryContract({ manifest, approved, proposal, sourceKey }) {
  const mappings = assertApprovedContract({ manifest, approved, proposal });
  if (!sourceKey) throw new Error('Canary requires an explicit --source-key.');
  const product = (manifest.products || []).find((item) => item.sourceKey === sourceKey);
  if (!product) throw new Error(`Canary source key is not present in the manifest: ${sourceKey}.`);
  const collection = mappings.find((mapping) => mapping.folder === product.collectionFolder);
  if (!collection) throw new Error(`Canary collection mapping is missing for ${product.collectionFolder}.`);
  if ((product.media || []).length !== 2 || !product.media.some((media) => media.role === 'primary') || !product.media.some((media) => media.role === 'secondary')) {
    throw new Error('Canary product must have exactly one primary and one secondary image.');
  }

  return {
    sourceKey,
    product,
    collection,
    requestHash: buildRequestHash(product, collection),
  };
}

function selectCanaryContract({ manifest, approved, proposal, dryRun, sourceKey, approvedDryRunSha }) {
  const contract = buildCanaryContract({ manifest, approved, proposal, sourceKey });
  if (dryRun?.gate !== 'PASS') throw new Error('Canary requires a PASS dry-run report.');
  if (!approvedDryRunSha || dryRun.reportSha256 !== approvedDryRunSha) {
    throw new Error('Canary requires the exact approved dry-run SHA-256.');
  }
  const item = (dryRun.items || []).find((candidate) => candidate.sourceKey === sourceKey);
  if (!item) throw new Error(`Canary source key is not present in the dry-run: ${sourceKey}.`);
  if (item.decision !== 'CREATE') throw new Error(`Canary item must be CREATE, received ${item.decision}.`);
  if (contract.requestHash !== item.requestHash) {
    throw new Error('Canary request hash does not match the approved dry-run item.');
  }
  return {
    ...contract,
    item,
    dryRunSha256: dryRun.reportSha256,
  };
}

function normalizeGuardProduct(product) {
  if (!product) return null;
  return {
    gid: product.id || '',
    handle: product.handle || '',
    title: product.title || '',
    status: product.status || '',
    externalId: product.externalId?.value || '',
    publisherId: product.publisherId?.value || '',
    requestHash: product.requestHash?.value || '',
    pairHash: product.pairHash?.value || '',
  };
}

function validateCanaryGuard({ data, contract, expectedStoreDomain }) {
  const errors = [];
  const liveDomain = normalizeStoreDomain(data?.shop?.myshopifyDomain);
  if (liveDomain !== normalizeStoreDomain(expectedStoreDomain)) {
    errors.push(`Store mismatch: expected ${expectedStoreDomain}, received ${liveDomain || '(missing)'}.`);
  }
  const granted = (data?.appInstallation?.accessScopes || []).map((scope) => scope.handle);
  const missing = REQUIRED_CANARY_SCOPES.filter((scope) => !granted.includes(scope));
  if (missing.length) errors.push(`Missing canary scopes: ${missing.join(', ')}.`);

  const external = normalizeGuardProduct(data?.byExternalId);
  const handleMatches = (data?.byHandle?.nodes || [])
    .filter((product) => product.handle === contract.product.proposedHandle)
    .map(normalizeGuardProduct);
  if (handleMatches.length > 1) errors.push('More than one exact handle match exists.');
  const handle = handleMatches[0] || null;
  if (external && handle && external.gid !== handle.gid) errors.push('External ID and handle resolve to different products.');
  if (!external && handle) errors.push('Canary handle is already owned by a product without the approved external ID.');
  if (external) {
    if (external.publisherId !== PUBLISHER_ID) errors.push('Existing external-ID product has a foreign publisher marker.');
    if (external.status !== 'DRAFT') errors.push('Existing external-ID product is not DRAFT.');
    if (external.handle !== contract.product.proposedHandle) errors.push('Existing external-ID product has an unexpected handle.');
    if (external.requestHash && external.requestHash !== contract.requestHash) errors.push('Existing product request hash differs from canary contract.');
    if (external.pairHash && external.pairHash !== contract.product.pairSha256) errors.push('Existing product pair hash differs from canary contract.');
  }

  return {
    gate: errors.length ? 'BLOCKED' : 'PASS',
    errors,
    existingProduct: external,
    scopes: { required: REQUIRED_CANARY_SCOPES, granted, missing },
    shop: data?.shop || null,
  };
}

function buildCanaryProductSetVariables({ contract, fileGids }) {
  if (!Array.isArray(fileGids) || fileGids.length !== 2 || new Set(fileGids).size !== 2) {
    throw new Error('Canary productSet requires exactly two unique READY Shopify file IDs.');
  }
  return {
    identifier: customId(contract.sourceKey),
    input: {
      handle: contract.product.proposedHandle,
      title: contract.product.title,
      status: 'DRAFT',
      collections: [contract.collection.gid],
      files: fileGids.map((id) => ({ id })),
      metafields: [
        // Shopify derives the `id` type from the definition. Omitting `type` is
        // required for productSet to recognize this entry as the customId value.
        { namespace: IDENTITY_NAMESPACE, key: EXTERNAL_ID_KEY, value: contract.sourceKey },
        { namespace: IDENTITY_NAMESPACE, key: PUBLISHER_ID_KEY, type: 'single_line_text_field', value: PUBLISHER_ID },
        { namespace: IDENTITY_NAMESPACE, key: REQUEST_HASH_KEY, type: 'single_line_text_field', value: contract.requestHash },
        { namespace: IDENTITY_NAMESPACE, key: PAIR_HASH_KEY, type: 'single_line_text_field', value: contract.product.pairSha256 },
      ],
    },
  };
}

function validateCanaryQa(product, { contract, fileGids }) {
  const errors = [];
  if (!product?.id) return { gate: 'BLOCKED', errors: ['Product lookup by external ID returned no product.'] };
  if (product.status !== 'DRAFT') errors.push(`Expected DRAFT status, received ${product.status}.`);
  if (product.handle !== contract.product.proposedHandle) errors.push('Product handle mismatch.');
  if (product.title !== contract.product.title) errors.push('Product title mismatch.');
  if (product.externalId?.value !== contract.sourceKey) errors.push('External ID mismatch.');
  if (product.publisherId?.value !== PUBLISHER_ID) errors.push('Publisher marker mismatch.');
  if (product.requestHash?.value !== contract.requestHash) errors.push('Request hash mismatch.');
  if (product.pairHash?.value !== contract.product.pairSha256) errors.push('Pair hash mismatch.');

  const collections = product.collections?.nodes || [];
  if (collections.length !== 1 || collections[0]?.id !== contract.collection.gid) {
    errors.push('Product is not assigned exclusively to the approved canary collection.');
  }
  const media = product.media?.nodes || [];
  if (media.length !== 2) errors.push(`Expected 2 product media records, received ${media.length}.`);
  if (media.some((item) => item.mediaContentType !== 'IMAGE')) errors.push('Canary product media must contain images only.');
  if (media.some((item) => item.status !== 'READY')) errors.push('Canary product media is not READY.');
  const mediaIds = new Set(media.map((item) => item.id));
  if (fileGids.some((id) => !mediaIds.has(id))) errors.push('Product media IDs do not match uploaded file IDs.');
  if (!(product.variants?.nodes || []).length) errors.push('Canary product has no Shopify variant.');

  return {
    gate: errors.length ? 'BLOCKED' : 'PASS',
    errors,
    product: {
      gid: product.id,
      handle: product.handle,
      title: product.title,
      status: product.status,
      collectionGids: collections.map((collection) => collection.id),
      media: media.map((item) => ({ id: item.id, contentType: item.mediaContentType, status: item.status })),
      variantCount: (product.variants?.nodes || []).length,
    },
  };
}

function validatePostCanaryDryRun(report, contract) {
  const item = (report?.items || []).find((candidate) => candidate.sourceKey === contract.sourceKey);
  const errors = [];
  if (report?.gate !== 'PASS') errors.push('Post-canary dry-run gate is not PASS.');
  if (item?.decision !== 'SKIP_UNCHANGED') errors.push(`Canary decision must become SKIP_UNCHANGED, received ${item?.decision || 'missing'}.`);
  if (report?.summary?.createCount !== report?.summary?.inputProductCount - 1) errors.push('Post-canary create count is not total minus one.');
  if (report?.summary?.skipUnchangedCount !== 1) errors.push('Post-canary dry-run must contain exactly one unchanged product.');
  if (report?.summary?.updateCount !== 0 || report?.summary?.blockedProductCount !== 0 || report?.summary?.globalBlockingErrorCount !== 0) {
    errors.push('Post-canary dry-run contains updates, blocked products, or global errors.');
  }
  return { gate: errors.length ? 'BLOCKED' : 'PASS', errors, item };
}

function deterministicFilename(media) {
  const extension = path.extname(media.path || '').toLowerCase() || '.jpg';
  return `ersa-folder-${media.sha256.slice(0, 20)}${extension}`;
}

async function ensureProductFiles({ graphql, contract, existingState, filesStatePath }) {
  if (existingState?.shopDomain && normalizeStoreDomain(existingState.shopDomain) !== normalizeStoreDomain(contract.shopDomain)) {
    throw new Error('Shopify file checkpoint belongs to a different store.');
  }
  const existingBySha = new Map((existingState?.files || []).map((file) => [file.sha256, file]));
  const reusable = [];
  for (const media of contract.product.media) {
    const record = existingBySha.get(media.sha256);
    if (record?.fileStatus === 'READY' && record?.fileGid) reusable.push(record);
  }
  if (reusable.length) {
    const live = await pollFilesReady({
      graphql,
      fileIds: reusable.map((file) => file.fileGid),
      attempts: 3,
      delayMs: 500,
    });
    for (const record of reusable) {
      if (live.get(record.fileGid)?.fileStatus !== 'READY') existingBySha.delete(record.sha256);
    }
  }

  const pendingMedia = contract.product.media.filter((media) => !existingBySha.has(media.sha256));
  if (pendingMedia.length) {
    const upload = await uploadAssetChunk({
      graphql,
      assets: pendingMedia.map((media, index) => ({
        sha256: media.sha256,
        localPath: path.resolve(paths.repoRoot, media.path),
        filename: deterministicFilename(media),
        duplicateResolutionMode: 'REPLACE',
        mediaType: 'image',
        sourceUrl: media.path,
        productHandle: contract.product.proposedHandle,
        order: index + 1,
        alt: `${contract.product.title} - image ${index + 1}`,
      })),
      pollAttempts: 30,
      pollDelayMs: 1000,
    });
    for (const file of upload.files || []) {
      existingBySha.set(file.sha256, {
        sha256: file.sha256,
        fileGid: file.shopifyFileId,
        fileStatus: file.fileStatus,
        cdnUrl: file.cdnUrl || '',
        filename: file.filename || '',
        logicalPath: contract.product.media.find((media) => media.sha256 === file.sha256)?.path || '',
        uploadedAt: file.uploadedAt || new Date().toISOString(),
      });
    }
    const errors = (upload.failures || []).filter((failure) => failure.severity !== 'warning');
    await writeJson(filesStatePath, {
      schemaVersion: 'folder-import-shopify-files-v1',
      updatedAt: new Date().toISOString(),
      shopDomain: contract.shopDomain,
      files: Array.from(existingBySha.values()),
    });
    if (errors.length) throw new Error(`Canary media upload failed: ${errors.map((error) => error.message || error.type).join('; ')}`);
  }

  const ordered = contract.product.media.map((media) => existingBySha.get(media.sha256)).filter(Boolean);
  if (ordered.length !== 2 || ordered.some((file) => file.fileStatus !== 'READY' || !file.fileGid)) {
    throw new Error('Canary did not produce exactly two READY Shopify file checkpoints.');
  }
  await writeJson(filesStatePath, {
    schemaVersion: 'folder-import-shopify-files-v1',
    updatedAt: new Date().toISOString(),
    shopDomain: contract.shopDomain,
    files: Array.from(existingBySha.values()),
  });
  return ordered;
}

async function pollCanaryQa({ graphql, contract, fileGids, attempts = 30, delayMs = 1000 }) {
  let latest = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const data = await graphql(QUERY_FOLDER_IMPORT_CANARY_QA, { identifier: customId(contract.sourceKey) });
    latest = validateCanaryQa(data?.productByIdentifier, { contract, fileGids });
    if (latest.gate === 'PASS') return latest;
    if (attempt < attempts - 1) await delay(delayMs);
  }
  return latest || { gate: 'BLOCKED', errors: ['Canary QA did not return a result.'] };
}

async function runFolderImportCanary({
  graphql,
  manifest,
  expectedStoreDomain,
  sourceKey,
  approvedDryRunSha,
  confirmCanary = false,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  dryRunPath = DEFAULT_DRY_RUN_PATH,
  filesStatePath = DEFAULT_FILES_STATE_PATH,
  canaryStatePath = DEFAULT_CANARY_STATE_PATH,
  rolloutGatePath = DEFAULT_ROLLOUT_GATE_PATH,
}) {
  if (!confirmCanary) throw new Error('Canary mutation requires --confirm-canary.');
  const [approved, proposal, dryRun, filesState, previousCanary] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(dryRunPath),
    readJsonIfExists(filesStatePath),
    readJsonIfExists(canaryStatePath),
  ]);
  const contract = selectCanaryContract({ manifest, approved, proposal, dryRun, sourceKey, approvedDryRunSha });
  contract.shopDomain = normalizeStoreDomain(expectedStoreDomain);
  if (previousCanary && (
    previousCanary.shopDomain !== contract.shopDomain ||
    previousCanary.sourceKey !== contract.sourceKey ||
    previousCanary.requestHash !== contract.requestHash
  )) {
    throw new Error('Existing canary checkpoint belongs to a different store/source/request contract.');
  }

  const guardVariables = {
    identifier: customId(contract.sourceKey),
    handleQuery: `handle:${contract.product.proposedHandle}`,
  };
  const guardData = await graphql(QUERY_FOLDER_IMPORT_CANARY_GUARD, guardVariables);
  const guard = validateCanaryGuard({ data: guardData, contract, expectedStoreDomain });
  if (guard.gate !== 'PASS') throw new Error(`Canary live guard blocked: ${guard.errors.join(' ')}`);

  const files = await ensureProductFiles({ graphql, contract, existingState: filesState, filesStatePath });
  const fileGids = files.map((file) => file.fileGid);
  await writeJson(canaryStatePath, {
    schemaVersion: 'folder-import-canary-v1',
    updatedAt: new Date().toISOString(),
    status: 'FILES_READY',
    shopDomain: contract.shopDomain,
    sourceKey: contract.sourceKey,
    requestHash: contract.requestHash,
    approvedDryRunSha256: contract.dryRunSha256,
    collectionGid: contract.collection.gid,
    files: files.map((file) => ({ sha256: file.sha256, fileGid: file.fileGid, fileStatus: file.fileStatus })),
  });

  const secondGuardData = await graphql(QUERY_FOLDER_IMPORT_CANARY_GUARD, guardVariables);
  const secondGuard = validateCanaryGuard({ data: secondGuardData, contract, expectedStoreDomain });
  if (secondGuard.gate !== 'PASS') throw new Error(`Canary pre-mutation guard blocked: ${secondGuard.errors.join(' ')}`);

  const variables = buildCanaryProductSetVariables({ contract, fileGids });
  const mutationData = await graphql(MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET, variables);
  const payload = mutationData?.productSet;
  if (payload?.userErrors?.length) {
    throw new Error(`Canary productSet failed: ${payload.userErrors.map((error) => error.message).join('; ')}`);
  }
  if (!payload?.product?.id) throw new Error('Canary productSet did not return a product ID.');
  await writeJson(canaryStatePath, {
    schemaVersion: 'folder-import-canary-v1',
    updatedAt: new Date().toISOString(),
    status: 'PRODUCT_MUTATED',
    shopDomain: contract.shopDomain,
    sourceKey: contract.sourceKey,
    requestHash: contract.requestHash,
    approvedDryRunSha256: contract.dryRunSha256,
    productGid: payload.product.id,
    collectionGid: contract.collection.gid,
    files: files.map((file) => ({ sha256: file.sha256, fileGid: file.fileGid, fileStatus: file.fileStatus })),
  });

  const qa = await pollCanaryQa({ graphql, contract, fileGids });
  if (qa.gate !== 'PASS') {
    await writeJson(canaryStatePath, {
      schemaVersion: 'folder-import-canary-v1',
      updatedAt: new Date().toISOString(),
      status: 'QA_BLOCKED',
      shopDomain: contract.shopDomain,
      sourceKey: contract.sourceKey,
      requestHash: contract.requestHash,
      approvedDryRunSha256: contract.dryRunSha256,
      productGid: payload.product.id,
      collectionGid: contract.collection.gid,
      files: files.map((file) => ({ sha256: file.sha256, fileGid: file.fileGid, fileStatus: file.fileStatus })),
      qa,
    });
    throw new Error(`Canary read-back QA failed: ${qa.errors.join(' ')}`);
  }

  const postDryRun = await runFolderDryRun({
    graphql,
    manifest,
    expectedStoreDomain,
    approvedPath,
    proposalPath,
    filesStatePath,
  });
  const rollout = validatePostCanaryDryRun(postDryRun.report, contract);
  const qaHash = sha256Text(stableStringify(qa.product));
  const finalState = {
    schemaVersion: 'folder-import-canary-v1',
    updatedAt: new Date().toISOString(),
    status: rollout.gate === 'PASS' ? 'QA_PASS' : 'ROLLOUT_BLOCKED',
    shopDomain: contract.shopDomain,
    sourceKey: contract.sourceKey,
    requestHash: contract.requestHash,
    approvedDryRunSha256: contract.dryRunSha256,
    postCanaryDryRunSha256: postDryRun.report.reportSha256,
    productGid: qa.product.gid,
    collectionGid: contract.collection.gid,
    files: files.map((file) => ({ sha256: file.sha256, fileGid: file.fileGid, fileStatus: file.fileStatus })),
    qaHash,
    qa,
    rollout,
  };
  await writeJson(canaryStatePath, finalState);
  await writeJson(rolloutGatePath, {
    schemaVersion: 'folder-import-rollout-gate-v1',
    generatedAt: new Date().toISOString(),
    gate: rollout.gate,
    shopDomain: contract.shopDomain,
    canarySourceKey: contract.sourceKey,
    canaryProductGid: qa.product.gid,
    canaryQaHash: qaHash,
    approvedDryRunSha256: contract.dryRunSha256,
    postCanaryDryRunSha256: postDryRun.report.reportSha256,
    errors: rollout.errors,
  });
  if (rollout.gate !== 'PASS') throw new Error(`Post-canary rollout gate failed: ${rollout.errors.join(' ')}`);

  return { contract, files, qa, rollout, postDryRun: postDryRun.report, state: finalState };
}

async function verifyFolderImportCanary({
  graphql,
  manifest,
  expectedStoreDomain,
  sourceKey,
  approvedPath = DEFAULT_APPROVED_MAP_PATH,
  proposalPath = DEFAULT_PROPOSED_MAP_PATH,
  filesStatePath = DEFAULT_FILES_STATE_PATH,
  canaryStatePath = DEFAULT_CANARY_STATE_PATH,
  rolloutGatePath = DEFAULT_ROLLOUT_GATE_PATH,
}) {
  const [approved, proposal, filesState, previousCanary] = await Promise.all([
    readJsonIfExists(approvedPath),
    readJsonIfExists(proposalPath),
    readJsonIfExists(filesStatePath),
    readJsonIfExists(canaryStatePath),
  ]);
  if (!previousCanary) throw new Error('Canary checkpoint is missing.');
  const selectedSourceKey = sourceKey || previousCanary.sourceKey;
  const contract = buildCanaryContract({ manifest, approved, proposal, sourceKey: selectedSourceKey });
  contract.shopDomain = normalizeStoreDomain(expectedStoreDomain);
  if (
    previousCanary.shopDomain !== contract.shopDomain ||
    previousCanary.sourceKey !== contract.sourceKey ||
    previousCanary.requestHash !== contract.requestHash
  ) {
    throw new Error('Canary checkpoint does not match the current store/source/request contract.');
  }

  const fileBySha = new Map((filesState?.files || []).map((file) => [file.sha256, file]));
  const files = contract.product.media.map((media) => fileBySha.get(media.sha256)).filter(Boolean);
  if (files.length !== 2 || files.some((file) => !file.fileGid || file.fileStatus !== 'READY')) {
    throw new Error('Canary verification requires exactly two READY file checkpoints.');
  }
  const fileGids = files.map((file) => file.fileGid);
  const guardData = await graphql(QUERY_FOLDER_IMPORT_CANARY_GUARD, {
    identifier: customId(contract.sourceKey),
    handleQuery: `handle:${contract.product.proposedHandle}`,
  });
  const guard = validateCanaryGuard({ data: guardData, contract, expectedStoreDomain });
  if (guard.gate !== 'PASS' || !guard.existingProduct) {
    throw new Error(`Read-only canary guard blocked: ${guard.errors.join(' ') || 'product is missing'}`);
  }
  const qa = await pollCanaryQa({ graphql, contract, fileGids });
  if (qa.gate !== 'PASS') throw new Error(`Read-only canary QA failed: ${qa.errors.join(' ')}`);

  const postDryRun = await runFolderDryRun({
    graphql,
    manifest,
    expectedStoreDomain,
    approvedPath,
    proposalPath,
    filesStatePath,
  });
  const rollout = validatePostCanaryDryRun(postDryRun.report, contract);
  if (rollout.gate !== 'PASS') throw new Error(`Read-only rollout verification failed: ${rollout.errors.join(' ')}`);
  const qaHash = sha256Text(stableStringify(qa.product));
  const verifiedAt = new Date().toISOString();
  const finalState = {
    ...previousCanary,
    updatedAt: verifiedAt,
    status: 'QA_PASS',
    postCanaryDryRunSha256: postDryRun.report.reportSha256,
    productGid: qa.product.gid,
    collectionGid: contract.collection.gid,
    qaHash,
    qa,
    rollout,
  };
  await writeJson(canaryStatePath, finalState);
  await writeJson(rolloutGatePath, {
    schemaVersion: 'folder-import-rollout-gate-v1',
    generatedAt: verifiedAt,
    gate: 'PASS',
    shopDomain: contract.shopDomain,
    canarySourceKey: contract.sourceKey,
    canaryProductGid: qa.product.gid,
    canaryQaHash: qaHash,
    approvedDryRunSha256: previousCanary.approvedDryRunSha256,
    postCanaryDryRunSha256: postDryRun.report.reportSha256,
    errors: [],
  });
  return { contract, files, guard, qa, rollout, postDryRun: postDryRun.report, state: finalState };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  DEFAULT_CANARY_STATE_PATH,
  DEFAULT_DRY_RUN_PATH,
  DEFAULT_ROLLOUT_GATE_PATH,
  MUTATION_FOLDER_IMPORT_CANARY_PRODUCT_SET,
  QUERY_FOLDER_IMPORT_CANARY_GUARD,
  QUERY_FOLDER_IMPORT_CANARY_QA,
  REQUIRED_CANARY_SCOPES,
  buildCanaryContract,
  buildCanaryProductSetVariables,
  customId,
  deterministicFilename,
  ensureProductFiles,
  pollCanaryQa,
  runFolderImportCanary,
  selectCanaryContract,
  validateCanaryGuard,
  validateCanaryQa,
  validatePostCanaryDryRun,
  verifyFolderImportCanary,
};
