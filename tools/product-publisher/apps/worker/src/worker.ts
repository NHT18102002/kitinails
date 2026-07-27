import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { z } from 'zod';
import {
  CatalogSpecSchema,
  type AiSourceImage,
  type CatalogSpec,
} from '@ersa/product-publisher-ai';
import type { BatchDto, BatchItemDto, ItemState } from '@ersa/product-publisher-contracts';
import {
  BatchRepository,
  CheckpointRepository,
  createDataSource,
  JobQueueRepository,
  RepositoryError,
  type ClaimedJob,
} from '@ersa/product-publisher-db';
import { buildStageInputHash, sha256, stableStringify } from '@ersa/product-publisher-domain';
import { createMediaStore } from '@ersa/product-publisher-media';
import {
  missingScopes,
  requiredScopes,
  ShopifyAdminClient,
  ShopifyAdminError,
  type ShopifyDraftPayload,
} from '@ersa/product-publisher-shopify';
import { buildFolderCatalogSpec } from './folder-product.js';

const WorkerConfigSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  WORKER_POLL_MS: z.coerce.number().int().min(100).default(500),
  WORKER_LEASE_SECONDS: z.coerce.number().int().min(30).default(120),
  RELEASE: z.string().default('development'),
  PIPELINE_VERSION: z.string().default('catalog-v1'),
  MEDIA_STORAGE_PATH: z.string().min(1).default('../../var/product-publisher/media'),
  MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().default(''),
  S3_REGION: z.string().default('auto'),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY_ID: z.string().default(''),
  S3_SECRET_ACCESS_KEY: z.string().default(''),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  OPENAI_MODE: z.enum(['mock', 'live']).default('mock'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_VISION_MODEL: z.string().default('gpt-5.6-terra'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-2'),
  SHOPIFY_WRITE_MODE: z.enum(['off', 'draft', 'publish']).default('off'),
  SHOPIFY_STORE_DOMAIN: z.string().default('local-test.myshopify.com'),
  SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().default(''),
  SHOPIFY_API_VERSION: z.string().default('2026-07'),
  SHOPIFY_ONLINE_STORE_PUBLICATION_GID: z.string().default(''),
  PUBLISH_KILL_SWITCH: z.enum(['true', 'false']).default('true'),
  PUBLISHER_ID: z.string().min(3).default('ersa-product-publisher'),
  STORE_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('USD'),
  DEFAULT_PRODUCT_PRICE: z.coerce.number().min(0).default(19.99),
}).passthrough();

const config = WorkerConfigSchema.parse(process.env);
const workerId = `worker-${randomUUID()}`;
const logger = pino({
  base: { service: 'product-publisher-worker', workerId, release: config.RELEASE },
  redact: ['DATABASE_URL', 'SHOPIFY_ADMIN_ACCESS_TOKEN', 'OPENAI_API_KEY', '*.base64', '*.presignedUrl'],
});
const dataSource = createDataSource({
  databaseUrl: config.DATABASE_URL,
  ssl: config.DATABASE_SSL === 'true',
});

await dataSource.initialize();
const queue = new JobQueueRepository(dataSource);
const batches = new BatchRepository(dataSource);
const checkpoints = new CheckpointRepository(dataSource);
const media = createMediaStore(config.MEDIA_STORAGE_DRIVER === 's3'
  ? {
      driver: 's3',
      rootDirectory: config.MEDIA_STORAGE_PATH,
      maxBytes: config.MAX_IMAGE_BYTES,
      region: config.S3_REGION,
      bucket: config.S3_BUCKET,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      forcePathStyle: config.S3_FORCE_PATH_STYLE === 'true',
      ...(config.S3_ENDPOINT ? { endpoint: config.S3_ENDPOINT } : {}),
    }
  : { driver: 'local', rootDirectory: config.MEDIA_STORAGE_PATH, maxBytes: config.MAX_IMAGE_BYTES });
const shopify = config.SHOPIFY_WRITE_MODE === 'off'
  ? null
  : new ShopifyAdminClient({
      storeDomain: config.SHOPIFY_STORE_DOMAIN,
      accessToken: config.SHOPIFY_ADMIN_ACCESS_TOKEN,
      apiVersion: config.SHOPIFY_API_VERSION,
    });

await assertWorkerPreflight();
let stopping = false;

function requestStop(signal: NodeJS.Signals): void {
  stopping = true;
  logger.info({ signal }, 'shutdown requested');
}

process.once('SIGINT', () => requestStop('SIGINT'));
process.once('SIGTERM', () => requestStop('SIGTERM'));
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function assertWorkerPreflight(): Promise<void> {
  if (!shopify) return;
  const preflight = await shopify.preflight();
  const missing = missingScopes(preflight.scopes, requiredScopes(config.SHOPIFY_WRITE_MODE));
  if (missing.length) throw new Error(`Shopify token is missing scopes: ${missing.join(', ')}`);
  if (!preflight.externalIdDefinitionReady) {
    throw new Error('Shopify product metafield definition ersa_automation.external_id with type id is required');
  }
  if (!config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID) {
    throw new Error('Online Store publication GID is required for Shopify write modes');
  }
  if (!preflight.publications.some((publication) => publication.id === config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID)) {
    throw new Error('Configured Online Store publication is not accessible to this app');
  }
  if (config.SHOPIFY_WRITE_MODE === 'publish') {
    if (config.PUBLISH_KILL_SWITCH === 'true') throw new Error('Publishing is blocked by PUBLISH_KILL_SWITCH');
  }
}

async function handleJob(job: ClaimedJob): Promise<void> {
  if (job.jobType !== 'process-batch') throw new Error(`Unsupported job type: ${job.jobType}`);
  const batchId = String(job.payload.batchId ?? '');
  const runMode = z.enum(['off', 'draft', 'publish']).parse(job.payload.runMode);
  const pipelineVersion = String(job.payload.pipelineVersion ?? config.PIPELINE_VERSION);
  if (!batchId) throw new Error('process-batch job is missing batchId');
  if (runMode !== config.SHOPIFY_WRITE_MODE) {
    throw new Error(`Run mode ${runMode} does not match worker mode ${config.SHOPIFY_WRITE_MODE}`);
  }

  const batch = await batches.get(batchId);
  if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
  for (const item of await batches.listItems(batchId)) {
    if (await batches.isCancelled(batchId)) return;
    try {
      await processItem(batch, item, runMode, pipelineVersion);
    } catch (error) {
      const code = error instanceof RepositoryError || error instanceof ShopifyAdminError
        ? error.code
        : 'PIPELINE_STAGE_FAILED';
      const message = error instanceof Error ? error.message : String(error);
      await batches.recordItemError(item.id, code, message, workerId);
      throw error;
    }
  }

  const successState = runMode === 'off'
    ? 'FILES_READY'
    : runMode === 'draft'
      ? 'SHOPIFY_QA_PASSED'
      : 'PUBLISHED';
  const finalState = await batches.finalizeRun(batchId, successState, workerId);
  if (!finalState) throw new Error('Batch has non-terminal items after processing');
}

async function processItem(
  batch: BatchDto,
  initialItem: BatchItemDto,
  runMode: 'off' | 'draft' | 'publish',
  pipelineVersion: string,
): Promise<void> {
  let item = initialItem;
  for (let guard = 0; guard < 20; guard += 1) {
    if (isTerminalItemState(item.state, runMode)) return;
    if (await batches.isCancelled(batch.id)) return;

    if (item.state === 'NORMALIZED') {
      const target = await batches.authorizeLocalTarget(item.id, workerId);
      if (target.decision === 'BLOCKED_DUPLICATE') return;
      item = await requireItem(item.id);
      if (shopify) item = await reconcileRemoteOwnership(item, target.externalId, target.productGid);
      continue;
    }

    if (item.state === 'DEDUPED') {
      const spec = await analyzeItem(batch, item, pipelineVersion);
      item = await batches.advanceItemState(item.id, 'DEDUPED', 'ANALYZED', workerId);
      logger.info({ itemId: item.id, title: spec.title }, 'product analyzed');
      continue;
    }

    if (item.state === 'ANALYZED') {
      const spec = await loadCatalogSpec(batch, item, pipelineVersion);
      await generateImages(item, spec, pipelineVersion);
      item = await batches.advanceItemState(item.id, 'ANALYZED', 'GENERATED', workerId);
      continue;
    }

    if (item.state === 'GENERATED') {
      const spec = await loadCatalogSpec(batch, item, pipelineVersion);
      const passed = await runLocalQa(item, spec);
      if (!passed) return;
      item = await batches.advanceItemState(item.id, 'GENERATED', 'LOCAL_QA_PASSED', workerId);
      continue;
    }

    if (item.state === 'LOCAL_QA_PASSED') {
      const spec = await loadCatalogSpec(batch, item, pipelineVersion);
      if (shopify) await uploadFiles(item, spec, pipelineVersion);
      item = await batches.advanceItemState(item.id, 'LOCAL_QA_PASSED', 'FILES_READY', workerId);
      continue;
    }

    if (item.state === 'FILES_READY') {
      if (runMode === 'off') return;
      if (!shopify) throw new Error('Shopify client is unavailable in write mode');
      const spec = await loadCatalogSpec(batch, item, pipelineVersion);
      item = await syncDraft(batch, item, spec, pipelineVersion);
      continue;
    }

    if (item.state === 'DRAFT_SYNCED') {
      if (!shopify || !item.externalId || !item.productGid) throw new Error('Draft target is incomplete');
      const spec = await loadCatalogSpec(batch, item, pipelineVersion);
      const passed = await runShopifyQa(item, spec);
      if (!passed) return;
      item = await batches.advanceItemState(item.id, 'DRAFT_SYNCED', 'SHOPIFY_QA_PASSED', workerId);
      continue;
    }

    if (item.state === 'SHOPIFY_QA_PASSED') {
      if (runMode === 'draft') return;
      item = await batches.advanceItemState(item.id, 'SHOPIFY_QA_PASSED', 'PUBLISHING', workerId);
      continue;
    }

    if (item.state === 'PUBLISHING') {
      await publishItem(item, pipelineVersion);
      return;
    }

    throw new RepositoryError('ITEM_STATE_UNSUPPORTED', `Cannot process item in ${item.state}`);
  }
  throw new Error('Item workflow exceeded its state transition guard');
}

async function reconcileRemoteOwnership(
  item: BatchItemDto,
  externalId: string,
  authorizedProductGid: string | null,
): Promise<BatchItemDto> {
  if (!shopify) return item;
  const remote = await shopify.findProductByExternalId(externalId, config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID || undefined);
  const conflict = !remote
    ? Boolean(authorizedProductGid)
    : remote.publisherId !== config.PUBLISHER_ID
      || (Boolean(authorizedProductGid) && remote.id !== authorizedProductGid)
      || remote.status !== 'DRAFT';
  if (conflict) {
    return batches.holdItem(
      item.id,
      'DEDUPED',
      'DRAFT_CONFLICT',
      'REMOTE_OWNERSHIP_CONFLICT',
      'Matching Shopify product is missing, foreign, active, or differs from the immutable target',
      workerId,
    );
  }
  if (remote && !authorizedProductGid) {
    await batches.bindShopifyProduct(item.id, remote.id, remote.payloadHash ?? remote.snapshotHash);
    return requireItem(item.id);
  }
  return item;
}

async function analyzeItem(batch: BatchDto, item: BatchItemDto, pipelineVersion: string): Promise<CatalogSpec> {
  const sources = await loadSourceImages(item.id);
  const sourceAssets = (await batches.getAssets(item.id)).filter((asset) => asset.kind === 'SOURCE');
  const inputHash = buildStageInputHash({
    itemId: item.id,
    stage: 'analyze',
    sourceHashes: sources.map((source) => source.canonicalHash),
    pipelineVersion,
    providerInputs: { collection: batch.collection, schema: 'folder-direct-v1' },
  });
  const checkpoint = await checkpoints.begin({ batchItemId: item.id, stage: 'analyze', inputHash, pipelineVersion });
  if (checkpoint.state === 'COMPLETED') return CatalogSpecSchema.parse(checkpoint.output?.spec);
  const startedAt = Date.now();
  try {
    const spec = buildFolderCatalogSpec({
      batch,
      item,
      sourceAssets,
      currencyCode: config.STORE_CURRENCY,
      defaultProductPrice: config.DEFAULT_PRODUCT_PRICE,
    });
    await batches.recordProviderCall({
      itemId: item.id,
      provider: 'local',
      operation: 'derive-folder-product',
      model: 'folder-direct-v1',
      providerRequestId: null,
      inputHash,
      promptHash: null,
      state: 'COMPLETED',
      durationMs: Date.now() - startedAt,
    });
    await checkpoints.complete(checkpoint, {
      spec,
      provider: 'local',
      model: 'folder-direct-v1',
      providerRequestId: null,
    });
    return spec;
  } catch (error) {
    await checkpoints.fail(checkpoint, 'ANALYSIS_FAILED');
    throw error;
  }
}

async function loadCatalogSpec(batch: BatchDto, item: BatchItemDto, pipelineVersion: string): Promise<CatalogSpec> {
  const sources = await loadSourceImages(item.id);
  const inputHash = buildStageInputHash({
    itemId: item.id,
    stage: 'analyze',
    sourceHashes: sources.map((source) => source.canonicalHash),
    pipelineVersion,
    providerInputs: { collection: batch.collection, schema: 'folder-direct-v1' },
  });
  const checkpoint = await checkpoints.get(item.id, 'analyze', inputHash, pipelineVersion);
  if (checkpoint?.state !== 'COMPLETED') throw new Error('Completed analysis checkpoint is missing');
  return CatalogSpecSchema.parse(checkpoint.output?.spec);
}

async function generateImages(item: BatchItemDto, spec: CatalogSpec, pipelineVersion: string): Promise<void> {
  const sources = await loadSourceImages(item.id);
  const sourceAssets = (await batches.getAssets(item.id)).filter((asset) => asset.kind === 'SOURCE');
  const inputHash = buildStageInputHash({
    itemId: item.id,
    stage: 'prepare-source-images',
    sourceHashes: sources.map((source) => source.canonicalHash),
    pipelineVersion,
    providerInputs: { schema: 'folder-direct-v1', specHash: sha256(stableStringify(spec)) },
  });
  const checkpoint = await checkpoints.begin({
    batchItemId: item.id,
    stage: 'prepare-source-images',
    inputHash,
    pipelineVersion,
  });
  if (checkpoint.state === 'COMPLETED') return;
  if (sourceAssets.length !== 2) throw new Error('Exactly two source images are required');
  await checkpoints.complete(checkpoint, {
    assetIds: sourceAssets.map((asset) => asset.id),
    mediaCount: sourceAssets.length,
  });
}

async function runLocalQa(item: BatchItemDto, spec: CatalogSpec): Promise<boolean> {
  const assets = await batches.getAssets(item.id);
  const sourceAssets = assets.filter((asset) => asset.kind === 'SOURCE' && asset.status === 'READY');
  const findings: Array<Record<string, unknown>> = [];
  const fail = (code: string, message: string) => findings.push({ severity: 'ERROR', code, message });
  if (sourceAssets.length !== 2) fail('SOURCE_COUNT_INVALID', 'Exactly two normalized source images are required');
  if (new Set(sourceAssets.map((asset) => asset.contentHash)).size !== sourceAssets.length) {
    fail('SOURCE_IMAGES_DUPLICATE', 'The two source images must be different');
  }
  if (/<\s*(script|iframe|object|embed|style)|javascript:|\son\w+\s*=/i.test(spec.descriptionHtml)) {
    fail('DESCRIPTION_HTML_UNSAFE', 'Description contains unsafe HTML');
  }
  if (spec.metafields.some((field) => field.namespace === 'ersa_automation')) {
    fail('RESERVED_METAFIELD_NAMESPACE', 'AI output attempted to write reserved ownership metafields');
  }
  if (spec.variants.some((variant) => variant.price.currencyCode !== config.STORE_CURRENCY)) {
    fail('VARIANT_CURRENCY_MISMATCH', 'Variant currency differs from store currency');
  }
  const passed = findings.length === 0;
  if (passed) findings.push({ severity: 'INFO', code: 'LOCAL_QA_PASSED', message: 'Folder product and two source images passed local QA' });
  await batches.recordQaReport({ itemId: item.id, stage: 'LOCAL', passed, findings });
  if (!passed) {
    await batches.holdItem(item.id, 'GENERATED', 'QA_HOLD', 'LOCAL_QA_FAILED', 'Catalog data or images failed local QA', workerId);
  }
  return passed;
}

async function uploadFiles(item: BatchItemDto, spec: CatalogSpec, pipelineVersion: string): Promise<void> {
  if (!shopify) return;
  const assets = (await batches.getAssets(item.id)).filter((asset) => asset.kind === 'SOURCE');
  for (const asset of assets) {
    const brief = spec.imageBriefs.find((candidate) => candidate.role === asset.role);
    const alt = brief?.alt ?? `${spec.title} ${asset.slot === 'SOURCE_1' ? 'front' : 'detail'} reference`;
    const inputHash = buildStageInputHash({
      itemId: item.id,
      stage: `shopify-file-${asset.id}`,
      sourceHashes: [asset.contentHash],
      pipelineVersion,
    });
    const checkpoint = await checkpoints.begin({
      batchItemId: item.id,
      stage: `shopify-file-${asset.id}`,
      inputHash,
      pipelineVersion,
    });
    if (asset.shopifyFileGid && checkpoint.state === 'COMPLETED') continue;
    try {
      const file = await shopify.ensureImageFile({
        contentHash: asset.contentHash,
        data: await media.readBuffer(asset.storageKey),
        alt,
      });
      await batches.setAssetShopifyFile(asset.id, file.id);
      if (checkpoint.state !== 'COMPLETED') await checkpoints.complete(checkpoint, { fileGid: file.id });
    } catch (error) {
      if (checkpoint.state !== 'COMPLETED') await checkpoints.fail(checkpoint, 'SHOPIFY_FILE_UPLOAD_FAILED');
      throw error;
    }
  }
}

async function syncDraft(
  batch: BatchDto,
  item: BatchItemDto,
  spec: CatalogSpec,
  pipelineVersion: string,
): Promise<BatchItemDto> {
  if (!shopify || !item.externalId) throw new Error('Shopify draft target is incomplete');
  const assets = (await batches.getAssets(item.id)).filter((asset) => asset.kind === 'SOURCE');
  const fileGids = assets.map((asset) => asset.shopifyFileGid).filter((value): value is string => Boolean(value));
  if (fileGids.length !== assets.length || fileGids.length !== 2) throw new Error('Two Shopify files must be ready before draft sync');
  const payload = toShopifyPayload(batch, spec, fileGids);
  const inputHash = buildStageInputHash({
    itemId: item.id,
    stage: 'shopify-draft-sync',
    sourceHashes: assets.map((asset) => asset.contentHash),
    pipelineVersion,
    providerInputs: payload,
  });
  const checkpoint = await checkpoints.begin({ batchItemId: item.id, stage: 'shopify-draft-sync', inputHash, pipelineVersion });
  if (checkpoint.state !== 'COMPLETED') {
    try {
      const snapshot = await shopify.upsertDraftProduct({
        externalId: item.externalId,
        publisherId: config.PUBLISHER_ID,
        batchId: batch.id,
        pipelineVersion,
        modelManifest: JSON.stringify({
          pipeline: 'folder-direct-v1',
          media: 'two-source-images',
          pipelineVersion,
        }),
        payload,
        expectedProductGid: item.productGid,
        ...(config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID
          ? { publicationGid: config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID }
          : {}),
      });
      await batches.bindShopifyProduct(item.id, snapshot.id, snapshot.payloadHash ?? snapshot.snapshotHash);
      await checkpoints.complete(checkpoint, { productGid: snapshot.id, snapshotHash: snapshot.snapshotHash });
    } catch (error) {
      await checkpoints.fail(checkpoint, 'SHOPIFY_DRAFT_SYNC_FAILED');
      throw error;
    }
  }
  return batches.advanceItemState(item.id, 'FILES_READY', 'DRAFT_SYNCED', workerId);
}

async function runShopifyQa(item: BatchItemDto, spec: CatalogSpec): Promise<boolean> {
  if (!shopify || !item.externalId || !item.productGid) return false;
  const assets = (await batches.getAssets(item.id)).filter((asset) => asset.kind === 'SOURCE');
  const payload = toShopifyPayload((await requireBatch(item.batchId)), spec, assets.map((asset) => asset.shopifyFileGid!));
  const expectedPayloadHash = sha256(stableStringify(payload));
  const remote = await shopify.findProductByExternalId(item.externalId, config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID || undefined);
  const findings: Array<Record<string, unknown>> = [];
  const fail = (code: string, message: string) => findings.push({ severity: 'ERROR', code, message });
  if (!remote) fail('REMOTE_PRODUCT_MISSING', 'Draft product cannot be read back by external ID');
  if (remote && remote.id !== item.productGid) fail('REMOTE_TARGET_DRIFT', 'Read-back product differs from immutable target');
  if (remote && remote.publisherId !== config.PUBLISHER_ID) fail('REMOTE_OWNERSHIP_DRIFT', 'Publisher ownership metafield differs');
  if (remote && remote.externalId !== item.externalId) fail('REMOTE_EXTERNAL_ID_DRIFT', 'External ID differs');
  if (remote && remote.status !== 'DRAFT') fail('REMOTE_NOT_DRAFT', 'Product must remain DRAFT during QA');
  if (remote?.publishedOnTarget) fail('REMOTE_PREMATURE_PUBLICATION', 'Product was published before QA completed');
  if (remote && remote.payloadHash !== expectedPayloadHash) fail('REMOTE_PAYLOAD_DRIFT', 'Managed payload hash differs');
  if (remote && (remote.title !== spec.title || remote.handle !== spec.handle)) fail('REMOTE_CONTENT_DRIFT', 'Title or handle differs');
  if (remote && (remote.media.length !== 2 || remote.media.some((entry) => entry.status !== 'READY'))) {
    fail('REMOTE_MEDIA_NOT_READY', 'Exactly two ready media items are required');
  }
  const passed = findings.length === 0;
  if (passed) findings.push({ severity: 'INFO', code: 'SHOPIFY_QA_PASSED', message: 'DRAFT read-back matches the managed payload' });
  await batches.recordQaReport({
    itemId: item.id,
    stage: 'SHOPIFY_DRAFT',
    passed,
    findings,
    ...(remote ? { snapshotHash: remote.snapshotHash } : {}),
  });
  if (!passed) {
    await batches.holdItem(item.id, 'DRAFT_SYNCED', 'DRAFT_QA_FAILED', 'SHOPIFY_QA_FAILED', 'Shopify DRAFT read-back failed QA', workerId);
  }
  return passed;
}

async function publishItem(item: BatchItemDto, pipelineVersion: string): Promise<void> {
  if (!shopify || !item.productGid || !item.externalId) throw new Error('Publish target is incomplete');
  if (config.PUBLISH_KILL_SWITCH === 'true' || !config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID) {
    throw new Error('Publishing is disabled by safety configuration');
  }
  const inputHash = buildStageInputHash({
    itemId: item.id,
    stage: 'publish-online-store',
    sourceHashes: [item.productGid],
    pipelineVersion,
    providerInputs: { publication: config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID },
  });
  const checkpoint = await checkpoints.begin({ batchItemId: item.id, stage: 'publish-online-store', inputHash, pipelineVersion });
  try {
    if (checkpoint.state !== 'COMPLETED') {
      await shopify.setProductStatus(item.productGid, 'ACTIVE');
      await shopify.publish(item.productGid, config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID);
      const remote = await shopify.findProductByExternalId(item.externalId, config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID);
      if (!remote || remote.id !== item.productGid || remote.status !== 'ACTIVE' || !remote.publishedOnTarget) {
        throw new ShopifyAdminError('SHOPIFY_PUBLISH_VERIFY_FAILED', 'Published product failed read-back verification', true);
      }
      await batches.recordQaReport({
        itemId: item.id,
        stage: 'SHOPIFY_PUBLISHED',
        passed: true,
        findings: [{ severity: 'INFO', code: 'PUBLISH_VERIFIED', message: 'Product is ACTIVE on the target publication' }],
        snapshotHash: remote.snapshotHash,
      });
      await checkpoints.complete(checkpoint, { snapshotHash: remote.snapshotHash, productGid: remote.id });
    }
    await batches.advanceItemState(item.id, 'PUBLISHING', 'PUBLISHED', workerId);
  } catch (error) {
    if (checkpoint.state !== 'COMPLETED') await checkpoints.fail(checkpoint, 'SHOPIFY_PUBLISH_FAILED');
    try {
      await shopify.rollbackPublication(item.productGid, config.SHOPIFY_ONLINE_STORE_PUBLICATION_GID);
      await batches.holdItem(
        item.id,
        'PUBLISHING',
        'DRAFT_QA_FAILED',
        'PUBLISH_ROLLED_BACK',
        'Publish failed verification and was rolled back to DRAFT',
        workerId,
      );
    } catch (rollbackError) {
      await batches.holdItem(
        item.id,
        'PUBLISHING',
        'COMPENSATION_REQUIRED',
        'PUBLISH_ROLLBACK_FAILED',
        rollbackError instanceof Error ? rollbackError.message : 'Publication rollback failed',
        workerId,
      );
    }
  }
}

function toShopifyPayload(batch: BatchDto, spec: CatalogSpec, fileGids: readonly string[]): ShopifyDraftPayload {
  return {
    title: spec.title,
    handle: spec.handle,
    descriptionHtml: spec.descriptionHtml,
    vendor: spec.vendor,
    productType: spec.productType,
    tags: spec.tags,
    seo: spec.seo,
    collectionGid: batch.collection.gid,
    fileGids,
    options: spec.options,
    variants: spec.variants.map((variant) => ({ optionValues: variant.optionValues, price: variant.price.amount })),
    metafields: spec.metafields,
  };
}

async function loadSourceImages(itemId: string): Promise<readonly [AiSourceImage, AiSourceImage]> {
  const sourceAssets = (await batches.getAssets(itemId))
    .filter((asset) => asset.kind === 'SOURCE')
    .sort((left, right) => String(left.slot).localeCompare(String(right.slot)));
  if (sourceAssets.length !== 2) throw new Error('Exactly two source assets are required');
  const images = await Promise.all(sourceAssets.map(async (asset) => ({
    data: await media.readBuffer(asset.storageKey),
    mimeType: 'image/webp' as const,
    canonicalHash: asset.canonicalHash ?? asset.contentHash,
  })));
  return images as [AiSourceImage, AiSourceImage];
}

async function requireItem(itemId: string): Promise<BatchItemDto> {
  const item = await batches.getItem(itemId);
  if (!item) throw new RepositoryError('ITEM_NOT_FOUND', 'Batch item not found');
  return item;
}

async function requireBatch(batchId: string): Promise<BatchDto> {
  const batch = await batches.get(batchId);
  if (!batch) throw new RepositoryError('BATCH_NOT_FOUND', 'Batch not found');
  return batch;
}

function isTerminalItemState(state: ItemState, runMode: 'off' | 'draft' | 'publish'): boolean {
  if (['BLOCKED_DUPLICATE', 'QA_HOLD', 'DRAFT_QA_FAILED', 'DRAFT_CONFLICT', 'FAILED_FINAL', 'COMPENSATION_REQUIRED'].includes(state)) {
    return true;
  }
  if (runMode === 'off') return state === 'FILES_READY';
  if (runMode === 'draft') return state === 'SHOPIFY_QA_PASSED';
  return state === 'PUBLISHED';
}

while (!stopping) {
  const job = await queue.claim(workerId, config.WORKER_LEASE_SECONDS);
  if (!job) {
    await sleep(config.WORKER_POLL_MS);
    continue;
  }

  logger.info({ jobId: job.id, jobType: job.jobType, attempt: job.attempts }, 'job claimed');
  const heartbeat = setInterval(() => {
    void queue.heartbeat(job.id, workerId, config.WORKER_LEASE_SECONDS).catch((error) => {
      logger.error({ err: error, jobId: job.id }, 'job heartbeat failed');
    });
  }, Math.max(5_000, Math.floor(config.WORKER_LEASE_SECONDS * 1_000 / 3)));
  try {
    await handleJob(job);
    const completed = await queue.complete(job.id, workerId);
    if (!completed) throw new Error('Job lease was lost before completion');
    logger.info({ jobId: job.id }, 'job completed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await queue.fail(job, workerId, message, Math.min(60_000, 1_000 * 2 ** Math.max(0, job.attempts - 1)));
    logger.error({ err: error, jobId: job.id }, 'job failed');
  } finally {
    clearInterval(heartbeat);
  }
}

if (dataSource.isInitialized) await dataSource.destroy();
logger.info('worker stopped');
