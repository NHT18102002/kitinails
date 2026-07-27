import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import type { DataSource } from 'typeorm';
import {
  CreateBatchInputSchema,
  type ApiError,
  type HealthResponse,
} from '@ersa/product-publisher-contracts';
import {
  BatchRepository,
  EventRepository,
  RepositoryError,
} from '@ersa/product-publisher-db';
import { createMediaStore, MediaValidationError } from '@ersa/product-publisher-media';
import {
  missingScopes,
  requiredScopes,
  ShopifyAdminClient,
  ShopifyAdminError,
} from '@ersa/product-publisher-shopify';
import type { ApiConfig } from './config.js';

export interface BuildAppOptions {
  config: ApiConfig;
  dataSource: DataSource;
}

function tokenMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const receivedDigest = createHash('sha256').update(received).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: options.config.nodeEnv === 'test' ? 'silent' : 'info',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'SHOPIFY_ADMIN_ACCESS_TOKEN',
          'OPENAI_API_KEY',
          'DATABASE_URL',
          '*.base64',
          '*.presignedUrl',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => randomUUID(),
  });

  await app.register(cors, {
    origin: options.config.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86_400,
  });
  app.addHook('onRequest', async (request, reply) => {
    const isPublicHealthRoute = request.url.startsWith('/api/health/');
    if (!options.config.appAccessToken || isPublicHealthRoute || request.method === 'OPTIONS') return;

    const authorization = request.headers.authorization;
    const received = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
    if (tokenMatches(received, options.config.appAccessToken)) return;

    const body: ApiError = {
      code: 'UNAUTHORIZED',
      message: 'A valid product publisher access token is required',
      retryable: false,
      requestId: request.id,
    };
    return reply.status(401).send(body);
  });

  const batches = new BatchRepository(options.dataSource);
  const events = new EventRepository(options.dataSource);
  const media = createMediaStore(options.config.mediaStorageDriver === 's3'
    ? {
        driver: 's3',
        rootDirectory: options.config.mediaStoragePath,
        maxBytes: options.config.maxImageBytes,
        region: options.config.s3Region,
        bucket: options.config.s3Bucket,
        accessKeyId: options.config.s3AccessKeyId,
        secretAccessKey: options.config.s3SecretAccessKey,
        forcePathStyle: options.config.s3ForcePathStyle,
        ...(options.config.s3Endpoint ? { endpoint: options.config.s3Endpoint } : {}),
      }
    : {
        driver: 'local',
        rootDirectory: options.config.mediaStoragePath,
        maxBytes: options.config.maxImageBytes,
      });
  const shopify = options.config.shopifyAccessToken
    ? new ShopifyAdminClient({
        storeDomain: options.config.shopDomain,
        accessToken: options.config.shopifyAccessToken,
        apiVersion: options.config.shopifyApiVersion,
      })
    : null;
  await app.register(multipart, {
    limits: {
      files: 2,
      fileSize: options.config.maxImageBytes,
      fields: 0,
    },
  });
  const shop = await batches.ensureShop({
    shopDomain: options.config.shopDomain,
    apiVersion: options.config.shopifyApiVersion,
  });

  async function getRunPreflight() {
    const required = requiredScopes(options.config.shopifyWriteMode);
    if (!shopify) {
      return {
        connected: false,
        requiredScopes: required,
        missingScopes: options.config.shopifyWriteMode === 'off' ? [] : required,
        publications: [],
        configuredPublication: options.config.shopifyOnlineStorePublicationGid,
        publicationReady: options.config.shopifyWriteMode === 'off',
        externalIdDefinitionReady: options.config.shopifyWriteMode === 'off',
        blocked: options.config.shopifyWriteMode !== 'off',
      };
    }
    const live = await shopify.preflight();
    const missing = missingScopes(live.scopes, required);
    const configuredPublication = options.config.shopifyOnlineStorePublicationGid;
    const publicationReady = options.config.shopifyWriteMode === 'off'
      || Boolean(configuredPublication && live.publications.some((publication) => publication.id === configuredPublication));
    const blocked = missing.length > 0
      || !publicationReady
      || (options.config.shopifyWriteMode !== 'off' && !live.externalIdDefinitionReady)
      || (options.config.shopifyWriteMode === 'publish' && options.config.publishKillSwitch);
    return {
      connected: true,
      liveShop: live.shop,
      requiredScopes: required,
      missingScopes: missing,
      publications: live.publications,
      configuredPublication,
      publicationReady,
      externalIdDefinitionReady: live.externalIdDefinitionReady,
      blocked,
    };
  }

  app.setErrorHandler((error, request, reply) => {
    const repositoryError = error instanceof RepositoryError ? error : null;
    const mediaError = error instanceof MediaValidationError ? error : null;
    const shopifyError = error instanceof ShopifyAdminError ? error : null;
    const transportStatus = typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number(error.statusCode)
      : null;
    const statusCode = repositoryError?.code === 'BATCH_NOT_FOUND'
      ? 404
      : mediaError
        ? 422
        : shopifyError
          ? shopifyError.retryable ? 503 : 502
        : repositoryError
          ? 409
          : transportStatus && transportStatus >= 400 && transportStatus < 500
            ? transportStatus
            : 500;
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    const body: ApiError = {
      code: repositoryError?.code ?? mediaError?.code ?? shopifyError?.code
        ?? (statusCode === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST'),
      message: statusCode === 500 ? 'Unexpected server error' : message,
      retryable: shopifyError?.retryable ?? false,
      requestId: request.id,
    };
    if (statusCode === 500) request.log.error({ err: error }, 'request failed');
    void reply.status(statusCode).send(body);
  });

  app.get('/api/health/live', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'product-publisher-api',
    database: 'not_checked',
    release: options.config.release,
  }));

  app.get('/api/health/ready', async (_request, reply): Promise<HealthResponse> => {
    try {
      await options.dataSource.query('SELECT 1');
      return {
        status: 'ok',
        service: 'product-publisher-api',
        database: 'up',
        release: options.config.release,
      };
    } catch {
      void reply.status(503);
      return {
        status: 'degraded',
        service: 'product-publisher-api',
        database: 'down',
        release: options.config.release,
      };
    }
  });

  app.get('/api/shop/preflight', async () => {
    const preflight = await getRunPreflight();

    return {
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      apiVersion: shop.apiVersion,
      openAiMode: options.config.openAiMode,
      openAiReady: options.config.openAiReady,
      shopifyWriteMode: options.config.shopifyWriteMode,
      publishKillSwitch: options.config.publishKillSwitch,
      pipelineVersion: options.config.pipelineVersion,
      maxImageBytes: options.config.maxImageBytes,
      maxBatchItems: options.config.maxBatchItems,
      ...preflight,
      status: preflight.blocked ? 'blocked' : options.config.shopifyWriteMode === 'off' ? 'mock_ready' : 'ready',
    };
  });

  app.get('/api/collections', async () => ({
    source: shopify ? 'shopify' : 'mock',
    collections: shopify ? await shopify.listCollections() : [
      {
        gid: 'gid://shopify/Collection/mock-press-ons',
        title: 'Press On Nails',
        handle: 'press-on-nails',
        rulesHash: 'mock-rules-v1',
        kind: 'MANUAL',
        compatibility: 'ASSIGNABLE',
      },
    ],
  }));

  app.post('/api/batches', async (request, reply) => {
    const input = CreateBatchInputSchema.parse(request.body);
    const batch = await batches.create(shop.id, input.collection, 'api');
    return reply.status(201).send(batch);
  });

  app.get('/api/batches', async () => ({
    batches: await Promise.all((await batches.list()).map((batch) => batches.getWithItems(batch.id))),
  }));

  app.get<{ Params: { batchId: string } }>('/api/batches/:batchId', async (request, reply) => {
    const batch = await batches.getWithItems(request.params.batchId);
    if (!batch) return reply.status(404).send({ code: 'BATCH_NOT_FOUND', message: 'Batch not found', retryable: false });
    return batch;
  });

  app.post<{ Params: { batchId: string } }>('/api/batches/:batchId/items', async (request, reply) => {
    const stored = [];
    try {
      let index = 0;
      for await (const part of request.files()) {
        index += 1;
        if (index > 2) throw new RepositoryError('SOURCE_IMAGE_COUNT_INVALID', 'Exactly two images are required');
        stored.push({
          ...await media.ingest(part.file, index === 1 ? 'SOURCE_1' : 'SOURCE_2'),
          originalFilename: part.filename,
        });
      }
      if (stored.length !== 2) {
        throw new RepositoryError('SOURCE_IMAGE_COUNT_INVALID', 'Exactly two images are required');
      }

      const item = await batches.addNormalizedItem(
        request.params.batchId,
        stored.map((asset) => ({
          storageKey: asset.storageKey,
          rawHash: asset.rawHash,
          contentHash: asset.contentHash,
          canonicalHash: asset.canonicalHash,
          perceptualHash: asset.perceptualHash,
          slot: asset.slot,
          metadata: {
            mimeType: asset.mimeType,
            originalMimeType: asset.originalMimeType,
            byteSize: asset.byteSize,
            width: asset.width,
            height: asset.height,
            originalFilename: asset.originalFilename,
          },
        })),
        options.config.maxBatchItems,
        'api',
      );
      return reply.status(201).send({ item, assets: await batches.getAssets(item.id) });
    } catch (error) {
      await Promise.allSettled(stored.map((asset) => media.remove(asset.storageKey)));
      throw error;
    }
  });

  app.post<{ Params: { batchId: string } }>('/api/batches/:batchId/seal', async (request) => (
    batches.seal(request.params.batchId, 'api')
  ));

  app.post<{ Params: { batchId: string } }>('/api/batches/:batchId/run', async (request) => {
    const preflight = await getRunPreflight();
    if (preflight.blocked) {
      throw new RepositoryError('RUN_PREFLIGHT_BLOCKED', 'Shopify ownership, scope, publication, or kill-switch preflight failed');
    }
    return batches.authorizeRun(
      request.params.batchId,
      options.config.shopifyWriteMode,
      options.config.pipelineVersion,
      'api',
    );
  });

  app.post<{ Params: { batchId: string } }>('/api/batches/:batchId/resume', async (request) => {
    const preflight = await getRunPreflight();
    if (preflight.blocked) throw new RepositoryError('RUN_PREFLIGHT_BLOCKED', 'Run preflight failed');
    return batches.resumeRun(
      request.params.batchId,
      options.config.shopifyWriteMode,
      options.config.pipelineVersion,
      'api',
    );
  });

  app.post<{ Params: { batchId: string } }>('/api/batches/:batchId/cancel', async (request) => (
    batches.cancel(request.params.batchId, 'api')
  ));

  app.get<{ Params: { itemId: string } }>('/api/items/:itemId', async (request, reply) => {
    const item = await batches.getItem(request.params.itemId);
    if (!item) return reply.status(404).send({ code: 'ITEM_NOT_FOUND', message: 'Item not found', retryable: false });
    return item;
  });

  app.get<{ Params: { itemId: string } }>('/api/items/:itemId/assets', async (request) => ({
    assets: await batches.getAssets(request.params.itemId),
  }));

  app.get<{ Params: { itemId: string } }>('/api/items/:itemId/qa', async (request) => ({
    reports: await batches.getQaReports(request.params.itemId),
  }));

  app.get<{ Params: { batchId: string }; Querystring: { after?: string } }>(
    '/api/batches/:batchId/events/history',
    async (request) => ({
      events: await events.list(request.params.batchId, request.query.after ?? '0'),
    }),
  );

  app.get<{ Params: { batchId: string } }>('/api/batches/:batchId/events', async (request, reply) => {
    const lastEventId = String(request.headers['last-event-id'] ?? '0');
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let cursor = lastEventId;
    let closed = false;
    request.raw.on('close', () => { closed = true; });

    while (!closed) {
      const nextEvents = await events.list(request.params.batchId, cursor);
      for (const event of nextEvents) {
        reply.raw.write(`id: ${event.id}\nevent: workflow\ndata: ${JSON.stringify(event)}\n\n`);
        cursor = event.id;
      }
      if (nextEvents.length === 0) reply.raw.write(': heartbeat\n\n');
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  });

  return app;
}
